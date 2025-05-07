var axios = require('axios');


const fs = require('fs');
const outputData = JSON.parse(fs.readFileSync('output.json', 'utf-8'));
const viewToken = outputData.cachedViewToken;
const tempAccessToken = "eyJ4NXQiOiJNbUprWWpVMlpETmpNelpqTURBM05UZ3pObUUxTm1NNU1qTXpNR1kyWm1OaFpHUTFNakE1TmciLCJraWQiOiJaalJqTUdRek9URmhPV1EwTm1WallXWTNZemRtWkdOa1pUUmpaVEUxTlRnMFkyWTBZVEUyTlRCaVlURTRNak5tWkRVeE5qZ3pPVGM0TWpGbFkyWXpOUV9SUzI1NiIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiJjbGllbnQ2MjA0MiIsImF1dCI6IkFQUExJQ0FUSU9OIiwiYXVkIjoiUFB4b1ZTb3BaVElfMnVqRmJVM3JkYWJXSHNnYSIsIm5iZiI6MTc0NjQyNjQ5MCwiYXpwIjoiUFB4b1ZTb3BaVElfMnVqRmJVM3JkYWJXSHNnYSIsInNjb3BlIjoiZGVmYXVsdCIsImlzcyI6Imh0dHBzOlwvXC9uYXBpLmtvdGFrc2VjdXJpdGllcy5jb206NDQzXC9vYXV0aDJcL3Rva2VuIiwiZXhwIjoxNzQ2NTEyODkwLCJpYXQiOjE3NDY0MjY0OTAsImp0aSI6ImI5OGRkZjNkLTQ3NjAtNGExYy1iNzFhLTcwMmVmOWQ5YWE2NyJ9.gY050LQPkSR6eX0OnCi1aQBeUsDiQJmNLvklTe_JkL3ThkGkCkQQtikQxiA3UI4FaMDdDZwJEEvD64tpV_nHIhyrUP1ow5eyNDTNsnbbfo6yPfPRW0zIuzmIumlTV7WEgFv2c_liW7_jX02N5M7WswgEYw5gSvKJY7gBgEgbY0Qc1aHSM5p9g2_oVkJcflQzOHRzXjzDlWKX2PWb2g8BE46b9gIBDCXH-pAgF6HP6wYpaYBgqEWqiPWRZC961OrU4cd6BjnDJhzNc1kp470Gx2e9h3t18enyenmrtYJvjxLfEmgaJeClm65YL2Ultz7DaxC1CoHPdnyDLWGZdw4WhA"
const accessToken = outputData.accessToken;
const sid = outputData.finalSid;
// var config = {
//   method: 'get',
// maxBodyLength: Infinity,
//   url: 'https://gw-napi.kotaksecurities.com/Files/1.0/masterscrip/v2/file-paths',
//   headers: { 
//     'accept': '*/*', 
//     'Authorization': `Bearer ${accessToken}` 
//   }
// };

// axios(config)
// .then(function (response) {
//   console.log(JSON.stringify(response.data));
// })
// .catch(function (error) {
//   console.log(error);
// });

var axios = require('axios');
var qs = require('qs');
var data = qs.stringify({
  'jData': '{"am":"NO", "dq":"0","es":"nse_cm", "mp":"0", "pc":"CNC", "pf":"N", "pr":"6.50", "pt":"L", "qt":"1", "rt":"DAY", "tp":"0", "ts":"IDEA-EQ", "tt":"S"}' 
});
var config = {
  method: 'post',
maxBodyLength: Infinity,
  url: 'https://gw-napi.kotaksecurities.com/Orders/2.0/quick/order/rule/ms/place',
  headers: { 
    'accept': 'application/json', 
    'Sid': sid, 
    'Auth': viewToken, 
    'neo-fin-key': 'neotradeapi', 
    'Content-Type': 'application/x-www-form-urlencoded', 
    'Authorization': `Bearer ${accessToken}`
  },
  data : data
};

axios(config)
.then(function (response) {
  console.log(JSON.stringify(response.data));
})
.catch(function (error) {
  console.log(error);
});
