const axios = require('axios');
const setPeriodDate = require('time.js'); // Assuming this is a function that sets the period date dynamically
const qs = require('qs');

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
module.exports = {
  authenticate,
  getTotalCount
};