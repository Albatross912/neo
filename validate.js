const axios = require('axios');
const qs = require('qs');



async function validateTotp(viewToken, mpin, sid) {
  const data = JSON.stringify({
    "mpin": mpin
  });

  const config = ({
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://gw-napi.kotaksecurities.com/login/1.0/login/v6/totp/validate',
    headers: {
      'accept': 'application/json',
      'sid': sid,
      'Auth': viewToken,
      'neo-fin-key': 'neotradeapi',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${viewToken}` // Assuming viewToken is also used as a bearer token here
    },
    data: data
  });

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

module.exports = { validate: validateTotp };