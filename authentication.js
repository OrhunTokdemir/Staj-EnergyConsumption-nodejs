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