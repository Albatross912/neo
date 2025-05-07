const axios = require('axios');
const qs = require('qs');
let cachedAccessToken = null;
async function getAccessToken() {
  if (cachedAccessToken) return cachedAccessToken
  const clientSecret = 'IU5sFNqJF5_8DPAqLlGKqEbyuHga';
  const clientId = 'PPxoVSopZTI_2ujFbU3rdabWHsga';
  const encodedCredentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  var data = qs.stringify({
    'grant_type': 'client_credentials' 
  });
  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://napi.kotaksecurities.com/oauth2/token',
    headers: {
      'accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${encodedCredentials}`
    },
    data: data

  };

  try {
    const response = await axios.request(config);
    cachedAccessToken = response.data.access_token;
    return cachedAccessToken
  } catch (error) {
    console.error('Error getting auth token:', error);
    throw error;
  }
}

module.exports = { getAccessToken };