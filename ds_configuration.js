// ds_configuration.js -- configuration information
// Either fill in the data below or set the environment variables
//
const env = process.env;

exports.config = {
    basicAuthName: env.BASIC_AUTH_NAME || '{BASIC_AUTH_NAME}' // The required Basic Auth Name (From Connect)
  , basicAuthPW: env.BASIC_AUTH_PW || '{BASIC_AUTH_PW}' // The required Basic Auth Password (From Connect)
  , subscriptionName: env.SUBSCRIPTION  || '{SUBSCRIPTION}'
  , outputDir: "output" // relative to this app's root dir
  , outputFilePefix: "order_"
  , envelopeCustomField: "Sales order" // The value of this field is used in the output file name
  , envelopeColorCustomField: "Light color" // The value of this field is used for the color bulb
  , lifxAccessToken: env.LIFX_ACCESS_TOKEN  || '{LIFX_ACCESS_TOKEN}' // optional
  , lifxSelector: 'all'
  , clientId: env.DS_CLIENT_ID || '{CLIENT_ID}'
    /** The guid for the user who will be impersonated.
     *  An email address can't be used.
     *  This is the user (or 'service account')
     *  that the JWT will represent. */
  , impersonatedUserGuid: env.DS_IMPERSONATED_USER_GUID || '{IMPERSONATED_GUID}'
    /** The private key */
    /** Enter the key as a multiline string value. No leading spaces! */
  , privateKey: env.DS_PRIVATE_KEY || `{RSA_PRIVATE_KEY}`
    /** The account_id that will be used.
     *  If set to false, then the user's default account will be used.
     *  If an account_id is provided then it must be the guid
     *  version of the account number.
     *  Default: false  */
  , targetAccountId: false
    // The authentication server. DO NOT INCLUDE https:// prefix!
  , authServer: env.DS_AUTH_SERVER || 'account-d.docusign.com'
    /** The same value must be set as a redirect URI in the
     *  DocuSign admin tool. This setting is <b>only</b> used for individually granting
     *  permission to the clientId if organizational-level permissions
     *  are not used.
     *  <br><b>Default:</b> <tt>https://www.docusign.com</tt> */
  , oAuthConsentRedirectURI: 'https://www.docusign.com'
    // To provide accurate reporting, the next setting must be the same as the value 
    // in the listener configuration file

    // settings for development
  , debug: true // Send debugging statements to console
  , testOutputDirName: 'testMessages'
  , enableBreakTest: true // should the worker break tests be enabled? Disable to clear the queue
  // These settings are only needed for using the runTest.js file
  , testEnqueueUrl: env.ENQ_URL || '' // URL for enquing a test. Same as the listener's url


}
