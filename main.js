const axios = require('axios');
const qs = require('qs');
const fs = require('fs'); // Add fs module to read files
const setupDatabase = require('./db.js'); // Import the setup function
const { insertEnergyData } = require('./dbMethods.js');

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
      'Cookie': 'TS01f5a18f=01cbc7c0b290621404c1faf18d481d119cc9f680d3b62309fd97f0b40ba1db0c1376aceaeba1788b0359e245da715fb6dceb76ab6d'
    },
    data: data
  };

  return axios.request(config)
    .then((response) => {
      console.log(`Authentication successful for user: ${username}`);
      return response.data; // Return the ticket
    })
    .catch((error) => {
      console.error(`Authentication error for user ${username}:`, error.message);
      throw error;
    });
}

// Function to fetch data from the API and insert it into the database
function fetchEnergyData(ticket, userType, pageNumber = 1, pageSize = 10) {
  let data = JSON.stringify({
    "periodDate": "2025-07-01T00:00:00+03:00",
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
      'Cookie': 'TS0107156a=01cbc7c0b29e8ec2b81d49fce69777510d6410257a2c108ca4a2ffd4602ddce499db5f0599401fbd413b609133ef2f4c982a2d416f'
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
    "periodDate": "2025-07-01T00:00:00+03:00",
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
      'Cookie': 'TS0107156a=01cbc7c0b29e8ec2b81d49fce69777510d6410257a2c108ca4a2ffd4602ddce499db5f0599401fbd413b609133ef2f4c982a2d416f'
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
          currentPage++;
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

// Process both users sequentially
console.log('Starting data fetching process for both users...');
authenticateAndProcessUser(USERNAMEK1, 'K1')
  .then(() => {
    console.log('K1 user data processing completed, starting K2...');
    return authenticateAndProcessUser(USERNAMEK2, 'K2');
  })
  .then(() => {
    console.log('All users processed successfully!');
  })
  .catch(error => {
    console.error('Error during user processing:', error.message);
  });

