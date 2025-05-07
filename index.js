const { getAccessToken } = require('./auth');
const axios = require('axios');
const qs = require('qs');
const fs = require('fs').promises; // Use promises version of fs
const path = require('path'); // To handle file path

const CACHE_FILE = path.join(__dirname, '.auth_cache.json'); // Cache file in the same directory
const CACHE_EXPIRY_MS = 23.5 * 60 * 60 * 1000; // Cache expiry time (23.5 hours in milliseconds)

// --- In-memory cache for session tokens ---
let cachedViewToken = null;
let cachedSid = null;
// -----------------------------------------

async function main() {
  let accessToken; // Removed viewToken and sid from here
  let cacheIsValid = false;
  let finalSid
  // 1. Try to load accessToken from cache
  try {
    const cacheContent = await fs.readFile(CACHE_FILE, 'utf-8');
    const cachedData = JSON.parse(cacheContent);
    const cacheAge = Date.now() - (cachedData.timestamp || 0);

    if (cachedData && cachedData.accessToken && cacheAge < CACHE_EXPIRY_MS) {
      accessToken = cachedData.accessToken;
      cacheIsValid = true;
      console.log("Using valid cached accessToken.");
    } else if (cacheAge >= CACHE_EXPIRY_MS) {
        console.log("Auth cache (accessToken) has expired.");
    } else {
        console.log("Auth cache (accessToken) is incomplete or invalid.");
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log("Auth cache file not found. Proceeding with full authentication.");
    } else {
      console.error("Error reading auth cache:", error);
    }
  }

  // 2. Get new accessToken if cache is invalid/missing
  if (!cacheIsValid) {
      try {
          console.log("Fetching new access token...");
          accessToken = await getAccessToken();
          console.log("New access token obtained.");
          // Since we got a new accessToken, any old viewToken/sid are conceptually invalid
          cachedViewToken = null; // Clear in-memory session cache as well
          cachedSid = null;      // Clear in-memory session cache as well

          // Cache the new accessToken immediately
          try {
              const cacheData = {
                  accessToken: accessToken,
                  timestamp: Date.now() // Store current timestamp
              };
              await fs.writeFile(CACHE_FILE, JSON.stringify(cacheData), 'utf-8');
              console.log("New accessToken cached successfully.");
          } catch (writeError) {
              console.error("Error writing accessToken cache:", writeError);
          }

      } catch(error) {
          console.error("Failed to get access token:", error);
          return; // Cannot proceed without accessToken
      }
  }

  // 3. Perform TOTP login ONLY if viewToken and sid are not already cached in memory
  if (!accessToken) {
      console.error("Cannot perform TOTP login without an access token.");
      return;
  }

  // --- MODIFIED: Check in-memory cache before TOTP ---
  if (!cachedViewToken || !cachedSid) {
    console.log("Performing TOTP login (viewToken/sid not found in memory cache)...");
    try {
      // Make sure you update the TOTP value when needed!
      var data1 = JSON.stringify({
        "mobileNumber": "+919610684338", // Consider moving sensitive data out of code
        "ucc": "XVP9K",                 // Consider moving sensitive data out of code
        "totp": "595943"                // IMPORTANT: Update this manually when needed for the first run
      });

      var config1 = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://gw-napi.kotaksecurities.com/login/1.0/login/v6/totp/login',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'neo-fin-key': 'neotradeapi',
          'Content-Type': 'application/json'
        },
        data: data1
      };

      const response = await axios(config1); // Use await
      console.log("TOTP Login Response Data:", response.data);

      if (response.data && response.data.data && response.data.data.token && response.data.data.sid) {
          // --- Store in memory cache ---
          cachedViewToken = response.data.data.token;
          cachedSid = response.data.data.sid;
          // ---------------------------
          console.log("Login successful. Obtained and cached viewToken and sid for this session.");

      } else {
         console.error("Failed to extract token and sid from login response:", response.data);
         return; // Stop execution if login failed
      }

    } catch (loginError) {
      console.error('An error occurred during login:', loginError.response ? loginError.response.data : loginError.message);
      // Check if the error is due to an expired/invalid accessToken
      if (loginError.response && (loginError.response.status === 401 || loginError.response.status === 403)) {
          console.log("TOTP login failed, possibly due to invalid/expired accessToken.");
          cachedViewToken = null; // Clear potentially invalid session tokens
          cachedSid = null;
          // Optionally clear accessToken cache if TOTP fails specifically due to it
          if (cacheIsValid) {
              console.log("Deleting accessToken cache due to TOTP failure...");
              try {
                  await fs.unlink(CACHE_FILE);
                  console.log("AccessToken cache deleted. Please restart the application to re-authenticate fully.");
              } catch (deleteError) {
                  console.error("Failed to delete accessToken cache:", deleteError);
              }
          }
      }
      return; // Stop execution if login failed
    }
  } else {
      console.log("Using cached viewToken and sid from memory. Skipping TOTP login.");
  }
  // --- END MODIFIED SECTION ---


  // 5. Now proceed with the next step using the obtained/cached viewToken and sid
  //    Use cachedViewToken and cachedSid instead of local variables
  if (cachedViewToken && cachedSid) {
    console.log("Proceeding with next API call using:");
    console.log("SID:", cachedSid);
    console.log("Token (viewToken):", cachedViewToken);

    try {
      // Example: Validate MPIN
      var data2 = JSON.stringify({
        "mpin": "223565" // Consider moving sensitive data out of code
      });

      var config2 = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://gw-napi.kotaksecurities.com/login/1.0/login/v6/totp/validate',
        headers: {
          'accept': 'application/json',
          'sid': cachedSid, // Use cachedSid
          'Auth': cachedViewToken, // Use cachedViewToken
          'neo-fin-key': 'neotradeapi',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        data: data2
      };

      console.log("Attempting MPIN validation...");
      const validateResponse = await axios(config2);
      console.log("MPIN Validation Response:", JSON.stringify(validateResponse.data));
      finalSID = validateResponse.data.data.sid;
      console.log("Final SID:", finalSID);
      // --- Add further API calls here ---
      var config3 = {
        method: 'get',
      maxBodyLength: Infinity,
        url: 'https://gw-napi.kotaksecurities.com/Files/1.0/masterscrip/v2/file-paths',
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${accessToken}`
        }
      };
      const outputData = {
        finalSid: finalSID,
        accessToken: accessToken,
        cachedViewToken: cachedViewToken
      };
      await fs.writeFile('output.json', JSON.stringify(outputData), 'utf-8');
      axios(config3)
      .then(function (response) {
        console.log(JSON.stringify(response.data));// This seems to be a *new* SID from the response? Be careful.
                                                // If this API call returns a *new* SID needed for subsequent calls,
                                                // you might need to update cachedSid or use finalSID directly.
                                                // Let's assume for now the MPIN validation SID is the one needed.
        console.log("SID from file-paths endpoint:", cachedSid); // Log the SID from this specific response
                                                                // Decide which SID to use below based on API requirements.
                                                                // Using cachedSid for consistency with the logic above.
                                                                // If finalSID *is* required, replace cachedSid below with finalSID.

        console.log(cachedSid)

        var data = qs.stringify({
          'jData': '{"am":"NO", "dq":"0","es":"nse_cm", "mp":"0", "pc":"CNC", "pf":"N", "pr":"6.50", "pt":"L", "qt":"1", "rt":"DAY", "tp":"0", "ts":"IDEA-EQ", "tt":"S"}' 
        });
        // Processing here
        var config = {
          method: 'post',
        maxBodyLength: Infinity,
          url: 'https://gw-napi.kotaksecurities.com/Orders/2.0/quick/order/rule/ms/place',
          headers: { 
            'accept': 'application/json', 
            'Sid': finalSid, 
            'Auth': cachedViewToken, 
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
        
      })
      .catch(function (error) {
        console.error("File Paths API Error:", error.response ? error.response.data : error.message); // Log error details
      });

    } catch (apiError) {
      console.error('An error occurred during subsequent API calls:', apiError.response ? apiError.response.data : apiError.message);
      // If an API error occurs (e.g., 401 Unauthorized), it might mean the session tokens are invalid.
      if (apiError.response && (apiError.response.status === 401 || apiError.response.status === 403)) {
          console.log("API call failed with auth error. Clearing in-memory session cache.");
          cachedViewToken = null; // Clear potentially invalid session tokens
          cachedSid = null;
          // Depending on the API, you might also need to clear the accessToken cache here.
          // await fs.unlink(CACHE_FILE).catch(e => console.error("Failed to clear accessToken cache:", e));
      }
    }

  } else {
      console.error("Could not obtain valid session credentials (viewToken, sid) to proceed.");
  }
}

main(); // Run the main function
