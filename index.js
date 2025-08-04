const axios = require('axios');
const qs = require('qs');
const fs = require('fs'); // Add fs module to read files
const schedule = require('node-schedule');
require('dotenv').config();
const { setupOracleDatabase } = require('./Oracledb');
const { insertEnergyDataOracle, closeDatabaseOracle, deleteRowsOracle } = require('./OracledbMethods');
const { sendEmail } = require('./message.js');
const setupLogger = require('./logger.js'); // Import the logger
const { setPeriodDate } = require('./time.js');
const { authenticate, getTotalCount } = require('./authentication.js'); // Import authentication functions
// Track the latest OracleDB connection for shutdown

let lastMonthlyDb = null;
function setLastMonthlyDb(db) {
  lastMonthlyDb = db;
}
// Store original console for potential restoration
let originalConsole = console;
// Handle PM2 and manual shutdown signals to close OracleDB connection
function handleShutdown() {
  if (lastMonthlyDb) {
    closeDatabaseOracle(lastMonthlyDb);
    originalConsole.log('OracleDB connection closed due to manual shutdown');
  } else {
    originalConsole.log('No OracleDB connection to close during shutdown');
  }
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
process.on('SIGQUIT', handleShutdown);
process.on('SIGUSR2', handleShutdown);

// Store original console for potential restoration


const USERNAMEK1 = process.env.USERNAME1; // ✅ Fixed: "process" not "provess"
const USERNAMEK2 = process.env.USERNAME2;
const PASSWORD = process.env.USERPASSWORD;


// Set up cleanup functions for when the app is shutting down

// ...existing code...

const job = schedule.scheduleJob('0 * * * * *', function(){
  // This runs at midnight (00:00) on the 25th day of every month
  
  // Set up logger with current date/time for this specific run
  const jobStartTime = new Date();
  const restoreConsole = setupLogger(jobStartTime);
  
  console.log('=== SCHEDULED JOB STARTED ===');
  console.log('Job execution time:', jobStartTime.toISOString());
  console.log('Starting data fetching process for both users...');
  
  // Create a new database connection for this scheduled cycle
  // For OracleDB, reuse the same connection (no need for createNewDatabaseConnection)
  let monthlyDb;
  setupOracleDatabase().then(conn => {
    monthlyDb = conn;
    setLastMonthlyDb(conn); // Make it accessible for shutdown
    console.log('OracleDB connection established for monthly job');
  
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
                deleteRowsOracle(dbConnection, userType, periodDate).then(deletedCount => {
                  console.log(`Successfully deleted ${deletedCount} rows for ${userType}`);
                  // Send email with deletion info
                  sendEmail(EmailRecipient, 'API Error Notification - Data Rolled Back', 
                    `Too many errors encountered while processing ${userType} in monthly job. Please check the API status.\n\n` +
                    `Data rollback performed: ${deletedCount} rows deleted for period ${periodDate}\n` +
                    `Monthly job execution time: ${new Date().toISOString()}`);
                }).catch(deleteError => {
                  console.error(`Error during monthly data rollback for ${userType}:`, deleteError.message);
                  sendEmail(EmailRecipient, 'API Error Notification - Rollback Failed', 
                    `Too many errors encountered while processing ${userType} in monthly job. Please check the API status.\n\n` +
                    `WARNING: Data rollback failed! Manual cleanup may be required for period ${periodDate}\n` +
                    `Error: ${deleteError.message}\n` +
                    `Monthly job execution time: ${new Date().toISOString()}`);
                });
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

        // Wait for the OracleDB insertion to complete
        return insertEnergyDataOracle(dbConnection, items, userType)
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
      // Close the OracleDB connection for this cycle
      try {
        console.log('Closing OracleDB connection for monthly job cycle...');
        closeDatabaseOracle(monthlyDb);
        console.log('OracleDB connection closed successfully for monthly job cycle');
      } catch (closeError) {
        console.error('Error closing OracleDB connection for monthly job:', closeError.message);
      }
      // Restore console and log the completion message
      const message = restoreConsole();
      console.log(message);
    })
    .catch(error => {
      console.error('Error during user processing:', error.message);
      console.error('=== SCHEDULED JOB FAILED ===');
      // Close the OracleDB connection even if there's an error
      try {
        console.log('Closing OracleDB connection for failed monthly job cycle...');
        closeDatabaseOracle(monthlyDb);
        console.log('OracleDB connection closed successfully for failed monthly job cycle');
      } catch (closeError) {
        console.error('Error closing OracleDB connection for failed monthly job:', closeError.message);
      }
      // Restore console even if there's an error
      const message = restoreConsole();
      console.log(message);
    });
  });
});

console.log('Energy Consumption Data Fetcher started');
console.log('Application will run scheduled job at midnight on the 25th day of every month');
console.log('Next scheduled run:', job.nextInvocation());
console.log('Application is running and waiting for scheduled jobs...');
console.log('Current date:', new Date().toISOString());
