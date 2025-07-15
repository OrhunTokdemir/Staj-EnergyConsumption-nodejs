const axios = require('axios');
const qs = require('qs');
const fs = require('fs'); // Add fs module to read files
const schedule = require('node-schedule');
require('dotenv').config();
const setupDatabase = require('./db.js'); // Import the setup function
const { insertEnergyData, closeDatabase } = require('./dbMethods.js');
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
  
  console.log(`Processing ${userType} - Total records: ${totalCount}, Total pages: ${totalPages}`);
  
  // Process pages sequentially instead of all at once
  let currentPage = 1;
  let errorCount = 0; // Move errorCount outside so it persists across calls
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
              sendEmail(EmailRecipient, 'API Error Notification', `Too many errors encountered while processing ${userType}. Please check the API status.`);
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

// Set up a cleanup function for when the app is shutting down
process.on('SIGINT', () => {
  console.log('Application shutting down, cleaning up...');
  closeDatabase(db);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Application terminated, cleaning up...');
  closeDatabase(db);
  process.exit(0);
});

const job = schedule.scheduleJob('0 * 1 16 * *', function(){
  // This runs at midnight (00:00) on the 14th day of every month
  
  // Set up logger with current date/time for this specific run
  const jobStartTime = new Date();
  const restoreConsole = setupLogger(jobStartTime);
  
  console.log('=== SCHEDULED JOB STARTED ===');
  console.log('Job execution time:', jobStartTime.toISOString());
  console.log('Starting data fetching process for both users...');
  
  // Create a fresh database connection for this monthly run
  const monthlyDb = setupDatabase();
  
  // Modified function to use the fresh database connection
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
    
    console.log(`Processing ${userType} - Total records: ${totalCount}, Total pages: ${totalPages}`);
    
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
                sendEmail(EmailRecipient, 'API Error Notification', `Too many errors encountered while processing ${userType}. Please check the API status.`);
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
      
      // Close the monthly database connection after the job completes
      closeDatabase(monthlyDb);
      
      // Restore console and log the completion message
      const message = restoreConsole();
      console.log(message);
    })
    .catch(error => {
      console.error('Error during user processing:', error.message);
      console.error('=== SCHEDULED JOB FAILED ===');
      
      // Close the monthly database connection even on error
      closeDatabase(monthlyDb);
      
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
