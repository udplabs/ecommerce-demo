/**
* Handler that will be called during the execution of a PostLogin flow.
*
* @param {CustomEvent} event - Details about the user and the context in which they are logging in.
* @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
*/
exports.onExecutePostLogin = async (event, api) => {
    const axios = require('axios');
  
    const { client, request, transaction } = event || {};
    const { use_tx_authz } = client?.metadata || {};
    
    console.group('=== metadata ===');
    console.log(client?.metadata);
    console.groupEnd();
    console.group('=== transaction ===');
    console.log(transaction);
    console.groupEnd();
    console.group('=== request ===');
    console.log(request);
    console.groupEnd();
  
    const { linking_id, requested_authorization_details = [] } = transaction || {};
  
    if (use_tx_authz === 'true') {
      console.log(transaction);
      
      const [authorization_details = {}] = requested_authorization_details ?? [];
  
      const tx_link_id = linking_id;
  
      api.accessToken.setCustomClaim('tx_details', authorization_details);
  
      const firebase_url = `https://okta-ciam-demo-default-rtdb.firebaseio.com/message/${tx_link_id}.json`;
      const options = {
        method: 'PUT',
        url: firebase_url,
        headers: {
          'Content-type': 'application/json'
        },
        data: authorization_details
      };
  
      await axios.request(options);
  
      api.multifactor.enable("guardian");
    }
  };
  