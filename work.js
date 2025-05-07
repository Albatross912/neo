const { getAccessToken } = require('./auth');
const { execSync } = require('child_process');
var axios = require('axios');
var qs = require('qs');

// Modified placeOrder to use async/await and return the result
async function placeOrder(finalSid, accessToken, viewToken){
    var data = qs.stringify({
        'jData': JSON.stringify({ // Ensure inner JSON is also stringified
            "am": "NO", "dq": "0", "es": "nse_cm", "mp": "0",
            "pc": "CNC", "pf": "N", "pr": "6.50", "pt": "L",
            "qt": "1", "rt": "DAY", "tp": "0", "ts": "IDEA-EQ", "tt": "B"
        })
      });
      var config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://gw-napi.kotaksecurities.com/Orders/2.0/quick/order/rule/ms/place',
        headers: {
          'accept': 'application/json',
          'Sid': finalSid,
          'Auth': viewToken,
          'neo-fin-key': 'neotradeapi',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${accessToken}`
        },
        data : data
      };

      try {
        console.log("Placing order...");
        const response = await axios(config);
        console.log("Place Order Response Received.");
        return response.data; // Return the data
      } catch (error) {
        console.error("Error placing order:", error.response ? error.response.data : error.message);
        throw error; // Re-throw the error to be caught by runCommands
      }
}

// Modified processFile to use async/await and return the result
async function processFile(accessToken){
    var config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: 'https://gw-napi.kotaksecurities.com/Files/1.0/masterscrip/v2/file-paths',
        headers: {
            'accept': '*/*',
            'Authorization': `Bearer ${accessToken}`
        }
    };

    try {
        console.log("Processing file (fetching master scrip paths)...");
        const response = await axios(config);
        // Extract URLs from response data and store in array
        const urls = response.data.data.map(item => item.url);
        
        // Print the URLs
        console.log("Retrieved URLs:");
        urls.forEach((url, index) => {
            console.log(`${index + 1}. ${url}`);
        });
        console.log("Process File Response Received.");
        return response.data; // Return the data
    } catch (error) {
        console.error("Error processing file:", error.response ? error.response.data : error.message);
        throw error; // Re-throw the error to be caught by runCommands
    }
}

// Wrap the asynchronous code in an async function
async function runCommands() {
    try {
        // 1. Get Access Token
        console.log("Fetching access token...");
        const accessToken = await getAccessToken();
        console.log("Access Token obtained."); // Don't log the actual token for security

        // 2. Define and Execute TOTP Login Curl
        // IMPORTANT: The TOTP code below needs to be updated frequently!
        const currentTOTP = "281461"; // <<< Replace with the current valid TOTP before running
        const mobileNumber = "+919610684338";
        const ucc = "XVP9K";

        const totpDataPayload = JSON.stringify({
            mobileNumber: mobileNumber,
            ucc: ucc,
            totp: currentTOTP
        }).replace(/'/g, "'''");


        const getViewTokenCurl =
            `curl --location --request POST 'https://gw-napi.kotaksecurities.com/login/1.0/login/v6/totp/login' \
--header 'Authorization: Bearer ${accessToken}' \
--header 'neo-fin-key: neotradeapi' \
--header 'Content-Type: application/json' \
--data '${totpDataPayload}'`;

        console.log("Executing TOTP Login Command...");
        const totpStdout = execSync(getViewTokenCurl, { encoding: 'utf-8' });
        console.log("TOTP Login Command Successful!");
        // console.log("Output:", totpStdout); // Log raw output if needed

        // 3. Parse TOTP Response to get sid and viewToken
        let sid = null;
        let viewToken = null;
        let finalSid = null;
        try {
            const totpResponse = JSON.parse(totpStdout);
            if (totpResponse && totpResponse.data && totpResponse.data.sid && totpResponse.data.token) {
                sid = totpResponse.data.sid;
                viewToken = totpResponse.data.token;
                console.log(`
Extracted SID: ${sid}`);
                console.log(`Extracted View Token: ******`); // Don't log the full token
            } else {
                throw new Error("Could not find sid or token in TOTP response data.");
            }
        } catch (parseError) {
            console.error("Error parsing TOTP login response:", parseError);
            console.error("Raw Response:", totpStdout);
            return; // Stop if parsing failed
        }

        // 4. Define and Execute MPIN Validation Curl
        const mpin = '223565'; // Replace with your actual MPIN if different
        const mpinDataPayload = JSON.stringify({ mpin: mpin }).replace(/'/g, "'''");

        const validateMpinCurl = `curl --location --request POST 'https://gw-napi.kotaksecurities.com/login/1.0/login/v6/totp/validate' \
--header 'accept: application/json' \
--header 'sid: ${sid}' \
--header 'Auth: ${viewToken}' \
--header 'neo-fin-key: neotradeapi' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer ${accessToken}' \
--data '${mpinDataPayload}'`;

        console.log("Executing MPIN Validation Command...");
        const mpinStdout = execSync(validateMpinCurl, { encoding: 'utf-8' });
        console.log("MPIN Validation Command Successful!");
        // console.log("Output:", mpinStdout); // Log raw output if needed

        // 5. Parse MPIN response (optional, e.g., to get finalSid)
        try {
            const mpinResponse = JSON.parse(mpinStdout);
            console.log("Parsed MPIN Validation Response:");
            // console.log(JSON.stringify(mpinResponse, null, 2)); // Log full response if needed
            if (mpinResponse && mpinResponse.data && mpinResponse.data.sid) { // Check data and sid exist
                finalSid = mpinResponse.data.sid;
                console.log(`Final SID: ${finalSid}`);
            } else {
                console.warn("Warning: Could not find final SID in MPIN response.");
                console.log("MPIN Response Data:", mpinResponse.data); // Log data part for inspection
                 // Decide if you need to stop here if finalSid is crucial for placeOrder
                if (!finalSid) {
                     throw new Error("Final SID is missing, cannot place order.");
                }
            }
        } catch (parseError) {
            console.warn("Warning: MPIN validation output was not valid JSON or structure unexpected.");
            console.log("Raw Response:", mpinStdout);
            // Decide if you need to stop here
             throw new Error("Failed to parse MPIN response, cannot proceed.");
        }

        // --- Execute processFile and THEN placeOrder ---

        // 6. Call processFile and wait for its response
        const processFileResponse = await processFile(accessToken);
        console.log("--- Response from processFile ---");
        console.log(JSON.stringify(processFileResponse, null, 2)); // Log the response

        // 7. Call placeOrder and wait for its response
        const placeOrderResponse = await placeOrder(finalSid, accessToken, viewToken);
        console.log("--- Response from placeOrder ---");
        console.log(JSON.stringify(placeOrderResponse, null, 2)); // Log the response

        console.log("--- Workflow Completed Successfully ---");

    } catch (error) {
        // Handle errors from any await call (getAccessToken, execSync, processFile, placeOrder)
        console.error('--- An error occurred during the workflow ---');
        if (error.status) { // Error from execSync
            console.error('Command Failed');
            console.error('Status:', error.status);
            console.error('Stderr:', error.stderr ? error.stderr.toString() : 'N/A');
            console.error('Stdout:', error.stdout ? error.stdout.toString() : 'N/A');
        } else { // Error likely from getAccessToken, JSON parsing, axios calls, or logic
            console.error('Error Message:', error.message);
            // console.error(error.stack); // Uncomment for detailed stack trace if needed
        }
    }
}

// Call the async function to start the process
runCommands();
