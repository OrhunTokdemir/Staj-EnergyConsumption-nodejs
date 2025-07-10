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
      console.log('Authentication successful');
      return response.data; // Return the ticket
    })
    .catch((error) => {
      console.error('Authentication error:', error.message);
      throw error;
    });
}

// Function to fetch data from the API and insert it into the database
function fetchEnergyData(ticket, pageNumber = 1, pageSize = 10) {
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

      // 2. Pass the db instance to your other functions
      insertEnergyData(db, items, 'K1');
      console.log('Data insertion process completed.');
      return items;
    })
    .catch((error) => {
      console.error('Error fetching energy data:', error.message);
      throw error;
    });
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

const USERNAME = credentials.username;
const PASSWORD = credentials.password;

// Chain the authentication and data fetching process
authenticate(USERNAME, PASSWORD)
  .then(ticket => {
    console.log('Got authentication ticket, fetching energy data...');
    for(let i=1;i<=38;i++) {
      fetchEnergyData(ticket, i, 10)
        .then(items => {
          console.log(`Page ${i} processed with ${items.length} records`);
        })
        .catch(error => {
          console.error(`Error processing page ${i}:`, error.message);
        });
    }
  });
 
