const axios = require('axios');
const qs = require('qs');
const fs = require('fs'); // Add fs module to read files
const schedule = require('node-schedule');
require('dotenv').config();
const setupDatabase = require('./db.js'); // Import the setup function
const { createNewDatabaseConnection } = require('./db.js'); // Import the new connection function
const { insertEnergyData, closeDatabase, deleteRows } = require('./dbMethods.js');
const { sendEmail } = require('./message');
const setupLogger = require('./logger'); // Import the logger
const { setPeriodDate } = require('./time.js');

// Store original console for potential restoration
let originalConsole = console;

// 1. Call the function to get the single DB instance
const db = setupDatabase();



// Function to authenticate with the EPIAS API and get a ticket
function authenticate(username, password) {
  let data = qs.stringify({
    'username': username,
    'password': password 
  });

  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://cas.epias.com.tr/cas/v1/tickets?format=text',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded', 
      
    },
    data: data
  };

  return axios.request(config)
    .then((response) => {
      console.log(`Authentication successful for user`);
      return response.data; // Return the ticket
    })
    .catch((error) => {
      console.error(`Authentication error for user ${username}:`, error.message);
      throw error;
    });
}

// Function to fetch data from the API and insert it into the database
function fetchEnergyData(ticket,userType, pageNumber = 1, pageSize = 10) {
  let data = JSON.stringify({
    "periodDate": setPeriodDate(), // Use dynamic date
    "page": {
      "number": pageNumber,
      "size": pageSize,
      "sort": {
        "direction": "DESC",
        "field": "periodDate"
      }
    }
  });

  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://epys.epias.com.tr/demand/v1/pre-notification/supplier/query',
    headers: { 
      'TGT': ticket,
      'Content-Type': 'application/json', 
      
    },
    data: data
  };

  return axios.request(config)
    .then((response) => {
      const items = response.data.body.content.items;

      // Wait for the database insertion to complete
      return insertEnergyData(db, items, userType)
        .then(() => {
          console.log(`Data insertion process completed for ${userType}.`);
          return items;
        });
    })
    .catch((error) => {
      console.error(`Error fetching energy data for ${userType}:`, error.message);
      throw error;
    });
}

// Function to get the total count of records
function getTotalCount(ticket) {
  let data = JSON.stringify({
    "periodDate": setPeriodDate(), // Use dynamic date
    "page": {
      "number": 1,
      "size": 1, // We only need one record to get the total count
      "sort": {
        "direction": "DESC",
        "field": "periodDate"
      }
    }
  });

  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://epys.epias.com.tr/demand/v1/pre-notification/supplier/query',
    headers: { 
      'TGT': ticket,
      'Content-Type': 'application/json', 
      
    },
    data: data
  };

  return axios.request(config)
    .then((response) => {
      const totalElements = response.data.body.content.page.total;
      console.log(`Total records available: ${totalElements}`);
      return totalElements;
    })
    .catch((error) => {
      console.error('Error fetching total count:', error.message);
      throw error;
    });
}

// Function to process all pages for a specific user
function processUserData(ticket, userType, totalCount, pageSize) {
  const totalPages = Math.ceil(totalCount / pageSize);
  const periodDate = setPeriodDate(); // Track the period date for this run
  
  console.log(`Processing ${userType} - Total records: ${totalCount}, Total pages: ${totalPages}`);
  console.log(`Period date for this run: ${periodDate}`);
  
  // Process pages sequentially instead of all at once
  let currentPage = 1;
  let errorCount = 0;
  const EmailRecipient = process.env.EMAIL_RECIPIENT;
  
  function processNextPage() {
    if (currentPage <= totalPages) {
      console.log(`Processing ${userType} page ${currentPage}...`);
      return fetchEnergyData(ticket, userType, currentPage, pageSize)
        .then(items => {
          console.log(`${userType} page ${currentPage} processed with ${items.length} records`);
          currentPage++;
          return processNextPage(); // Process next page
        })
        .catch(error => {
          console.error(`Error processing ${userType} page ${currentPage}:`, error.message);
          
          // Don't count database duplicate/unique constraint errors as real errors
          const isDuplicateError = error.message.includes('UNIQUE constraint') || 
                                 error.message.includes('duplicate') ||
                                 error.message.includes('already exists');
          
          if (!isDuplicateError) {
            errorCount++;
            if (errorCount >= 5) {
              console.error(`Too many errors encountered for ${userType}, stopping further processing and sending email to api owner.`);
              
              // DELETE ALL ROWS ADDED IN THIS CYCLE
              try {
                console.log(`Deleting all rows added for ${userType} in this cycle due to too many errors...`);
                
                // Use the same global database connection for deletion
                const deletedCount = deleteRows(db, userType, periodDate);
                console.log(`Successfully deleted ${deletedCount} rows for ${userType}`);
                
                // Send email with deletion info
                sendEmail(EmailRecipient, 'API Error Notification - Data Rolled Back', 
                  `Too many errors encountered while processing ${userType}. Please check the API status.\n\n` +
                  `Data rollback performed: ${deletedCount} rows deleted for period ${periodDate}`);
                
              } catch (deleteError) {
                console.error(`Error during data rollback for ${userType}:`, deleteError.message);
                sendEmail(EmailRecipient, 'API Error Notification - Rollback Failed', 
                  `Too many errors encountered while processing ${userType}. Please check the API status.\n\n` +
                  `WARNING: Data rollback failed! Manual cleanup may be required for period ${periodDate}`);
              }
              
              return Promise.resolve(); // Stop further processing
            }
          } else {
            console.log(`Skipping duplicate record error for ${userType} page ${currentPage}, continuing...`);
          }
          
          currentPage++; // Skip to next page even if this one fails
          return processNextPage(); // Continue with next page even if this one fails
        });
    } else {
      console.log(`All pages processed successfully for ${userType}!`);
      return Promise.resolve();
    }
  }
  
  return processNextPage();
}

// Run the authentication process and then fetch energy data
// Load credentials from the JSON file
let credentials;
try {
  const rawData = fs.readFileSync('./credentials.json');
  credentials = JSON.parse(rawData);
  console.log('Credentials loaded successfully');
} catch (error) {
  console.error('Failed to load credentials:', error.message);
  process.exit(1); // Exit if credentials can't be loaded
}

const USERNAMEK1 = credentials.username1;
const USERNAMEK2 = credentials.username2;
const PASSWORD = credentials.password;

// Function to authenticate and process data for a specific user
function authenticateAndProcessUser(username, userType) {
  return authenticate(username, PASSWORD)
    .then(ticket => {
      console.log(`Got authentication ticket for ${userType}, getting total count...`);
      return getTotalCount(ticket).then(totalCount => {
        const pageSize = 10;
        return processUserData(ticket, userType, totalCount, pageSize);
      });
    })
    .catch(error => {
      console.error(`Authentication or processing failed for ${userType}:`, error.message);
      throw error;
    });
}

// Set up cleanup functions for when the app is shutting down
process.on('SIGINT', () => {
  console.log('Application shutting down (SIGINT), cleaning up...');
  if (db) {
    closeDatabase(db);
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Application terminated (SIGTERM), cleaning up...');
  if (db) {
    closeDatabase(db);
  }
  process.exit(0);
});

// PM2 specific cleanup - when PM2 stops the process
process.on('SIGQUIT', () => {
  console.log('Application quit (SIGQUIT), cleaning up...');
  if (db) {
    closeDatabase(db);
  }
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  console.error('Stack:', error.stack);
  if (db) {
    closeDatabase(db);
  }
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (db) {
    closeDatabase(db);
  }
  process.exit(1);
});

// Handle process exit
process.on('exit', (code) => {
  console.log(`Process exiting with code: ${code}`);
  // Note: Only synchronous operations are safe here
  // The database should already be closed by other handlers
});

// Handle PM2 reload/restart
process.on('SIGUSR2', () => {
  console.log('Application reloading (SIGUSR2), cleaning up...');
  if (db) {
    closeDatabase(db);
  }
  process.exit(0);
});

const job = schedule.scheduleJob('0 * 10 16 * *', function(){
  // This runs at midnight (00:00) on the 14th day of every month
  
  // Set up logger with current date/time for this specific run
  const jobStartTime = new Date();
  const restoreConsole = setupLogger(jobStartTime);
  
  console.log('=== SCHEDULED JOB STARTED ===');
  console.log('Job execution time:', jobStartTime.toISOString());
  console.log('Starting data fetching process for both users...');
  
  // Create a new database connection for this scheduled cycle
  let monthlyDb;
  try {
    monthlyDb = createNewDatabaseConnection();
    console.log('New database connection established for monthly job');
  } catch (error) {
    console.error('Failed to establish database connection for monthly job:', error.message);
    const message = restoreConsole();
    console.log(message);
    return;
  }
  
  // Modified function to use the global database connection
  function authenticateAndProcessUserMonthly(username, userType) {
    return authenticate(username, PASSWORD)
      .then(ticket => {
        console.log(`Got authentication ticket for ${userType}, getting total count...`);
        return getTotalCount(ticket).then(totalCount => {
          const pageSize = 10;
          return processUserDataMonthly(ticket, userType, totalCount, pageSize, monthlyDb);
        });
      })
      .catch(error => {
        console.error(`Authentication or processing failed for ${userType}:`, error.message);
        throw error;
      });
  }
  
  // Modified function to use the fresh database connection
  function processUserDataMonthly(ticket, userType, totalCount, pageSize, dbConnection) {
    const totalPages = Math.ceil(totalCount / pageSize);
    const periodDate = setPeriodDate(); // Track the period date for this run
    
    console.log(`Processing ${userType} - Total records: ${totalCount}, Total pages: ${totalPages}`);
    console.log(`Period date for this monthly run: ${periodDate}`);
    
    // Process pages sequentially instead of all at once
    let currentPage = 1;
    let errorCount = 0;
    const EmailRecipient = process.env.EMAIL_RECIPIENT;
    
    function processNextPage() {
      if (currentPage <= totalPages) {
        console.log(`Processing ${userType} page ${currentPage}...`);
        return fetchEnergyDataMonthly(ticket, userType, currentPage, pageSize, dbConnection)
          .then(items => {
            console.log(`${userType} page ${currentPage} processed with ${items.length} records`);
            currentPage++;
            return processNextPage();
          })
          .catch(error => {
            console.error(`Error processing ${userType} page ${currentPage}:`, error.message);
            
            // Don't count database duplicate/unique constraint errors as real errors
            const isDuplicateError = error.message.includes('UNIQUE constraint') || 
                                   error.message.includes('duplicate') ||
                                   error.message.includes('already exists');
            
            if (!isDuplicateError) {
              errorCount++;
              if (errorCount >= 5) {
                console.error(`Too many errors encountered for ${userType}, stopping further processing and sending email to api owner.`);
                
                // DELETE ALL ROWS ADDED IN THIS MONTHLY CYCLE
                try {
                  console.log(`Deleting all rows added for ${userType} in this monthly cycle due to too many errors...`);
                  
                  // Use the same database connection for deletion
                  const deletedCount = deleteRows(dbConnection, userType, periodDate);
                  console.log(`Successfully deleted ${deletedCount} rows for ${userType}`);
                  
                  // Send email with deletion info
                  sendEmail(EmailRecipient, 'Monthly API Error Notification - Data Rolled Back', 
                    `Too many errors encountered while processing ${userType} in monthly job. Please check the API status.\n\n` +
                    `Data rollback performed: ${deletedCount} rows deleted for period ${periodDate}\n` +
                    `Monthly job execution time: ${new Date().toISOString()}`);
                  
                } catch (deleteError) {
                  console.error(`Error during monthly data rollback for ${userType}:`, deleteError.message);
                  sendEmail(EmailRecipient, 'Monthly API Error Notification - Rollback Failed', 
                    `Too many errors encountered while processing ${userType} in monthly job. Please check the API status.\n\n` +
                    `WARNING: Data rollback failed! Manual cleanup may be required for period ${periodDate}\n` +
                    `Error: ${deleteError.message}\n` +
                    `Monthly job execution time: ${new Date().toISOString()}`);
                }
                
                return Promise.resolve();
              }
            } else {
              console.log(`Skipping duplicate record error for ${userType} page ${currentPage}, continuing...`);
            }
            
            currentPage++;
            return processNextPage();
          });
      } else {
        console.log(`All pages processed successfully for ${userType}!`);
        return Promise.resolve();
      }
    }
    
    return processNextPage();
  }
  
  // Modified function to use the fresh database connection
  function fetchEnergyDataMonthly(ticket, userType, pageNumber, pageSize, dbConnection) {
    let data = JSON.stringify({
      "periodDate": setPeriodDate(),
      "page": {
        "number": pageNumber,
        "size": pageSize,
        "sort": {
          "direction": "DESC",
          "field": "periodDate"
        }
      }
    });

    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://epys.epias.com.tr/demand/v1/pre-notification/supplier/query',
      headers: { 
        'TGT': ticket,
        'Content-Type': 'application/json', 
      },
      data: data
    };

    return axios.request(config)
      .then((response) => {
        const items = response.data.body.content.items;

        // Wait for the database insertion to complete using the fresh connection
        return insertEnergyData(dbConnection, items, userType)
          .then(() => {
            console.log(`Data insertion process completed for ${userType}.`);
            return items;
          });
      })
      .catch((error) => {
        console.error(`Error fetching energy data for ${userType}:`, error.message);
        throw error;
      });
  }
  
  authenticateAndProcessUserMonthly(USERNAMEK1, 'K1')
    .then(() => {
      console.log('K1 user data processing completed, starting K2...');
      return authenticateAndProcessUserMonthly(USERNAMEK2, 'K2');
    })
    .then(() => {
      console.log('All users processed successfully!');
      console.log('=== SCHEDULED JOB COMPLETED ===');
      
      // Close the database connection for this cycle
      try {
        console.log('Closing database connection for monthly job cycle...');
        closeDatabase(monthlyDb);
        console.log('Database connection closed successfully for monthly job cycle');
      } catch (closeError) {
        console.error('Error closing database connection for monthly job:', closeError.message);
      }
      
      // Restore console and log the completion message
      const message = restoreConsole();
      console.log(message);
    })
    .catch(error => {
      console.error('Error during user processing:', error.message);
      console.error('=== SCHEDULED JOB FAILED ===');
      
      // Close the database connection even if there's an error
      try {
        console.log('Closing database connection for failed monthly job cycle...');
        closeDatabase(monthlyDb);
        console.log('Database connection closed successfully for failed monthly job cycle');
      } catch (closeError) {
        console.error('Error closing database connection for failed monthly job:', closeError.message);
      }
      
      // Restore console even if there's an error
      const message = restoreConsole();
      console.log(message);
    });
});

console.log('Energy Consumption Data Fetcher started');
console.log('Application will run scheduled job at midnight on the 14th day of every month');
console.log('Next scheduled run:', job.nextInvocation());
console.log('Application is running and waiting for scheduled jobs...');
console.log('Current date:', new Date().toISOString());
