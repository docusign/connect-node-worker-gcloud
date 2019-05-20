/**
 * @file
 * processNotification -- Handle an event notification
 * 
 * Strategy for this worker example:
 * 1. Notifications are ignored unless the notification's envelope:
 *    a. Envelope status is completed
 *    b. The envelope has an Envelope Custom Field "Sales order" with content
 * 2. The software will then download and store the "combined" document on the
 *    configured "outputDir" directory. The format will be "Order_xyz.pdf"
 *    where xyz is the value from the "Sales order" Envelope Custom Field.
 * 
 *    The combined document download will include the certificate of completion
 *    if the Admin Tool is set: screen Signing Settings, section Envelope Delivery
 *       option Attach certificate of completion to envelope is checked.
 * 
 * To manually test: curl -X POST localhost:5000/docusign-listener?test=123
 * To manually test a broken worker: curl -X POST localhost:5000/docusign-listener?test=/break
 * 
 * @author DocuSign
 * 
 */

const dsConfig = require('../ds_configuration.js').config
    , parseString = require('xml2js').parseString
    , {promisify} = require('util')
    , fse = require('fs-extra')
    , path = require('path')
    , dsJwtAuth = require('./dsJwtAuth')
    , docusign = require('docusign-esign')
    , rp = require('request-promise-native')
    , AsyncLock = require('async-lock')
    , lock = new AsyncLock()
    , parseStringAsync = promisify(parseString)
    , testOutputDirName = dsConfig.testOutputDirName
    , testOutputDir = path.join(path.normalize("."), testOutputDirName)
    , outputDir = path.join(process.cwd(), dsConfig.outputDir)
    , sleep = (seconds) => {
        return new Promise(resolve => setTimeout(resolve, 1000 * seconds))}
    ;

const processNotification = exports;

/**
 * Process the notification message
 * @param {boolean||string} test null or false indicates: real data, not a test.
 *                       Other values are used as the test data value.
 *                       If a test value includes /break then the worker will immediately exit.
 *                       This is for testing job recovery when the worker crashes. 
 * @param {string} xml if !test 
 */
processNotification.process = async (test, xml) => {
    if (test) {
        //return await processTest(test);
        return await lock.acquire("test_data", async () => await processTest(test))
    }

    // Step 1. parse the xml
    const msg = await parseStringAsync(xml)
        , envelopeStatus = msg.DocuSignEnvelopeInformation.EnvelopeStatus[0]
        , envelopeId = envelopeStatus.EnvelopeID[0]
        , created = envelopeStatus.Created[0] // date/time the envelope was created
        , status = envelopeStatus.Status[0]
        , completed = status == 'Completed' ? envelopeStatus.Completed[0] : false  // when env was completed
        , subject = envelopeStatus.Subject[0]
        , senderName = envelopeStatus.UserName[0]
        , senderEmail = envelopeStatus.Email[0]
        , completedMsg = completed ? `Completed ${completed}.` : ""
        , orderNumber = getOrderNumber(envelopeStatus)
        , lightColor = getLightColor(envelopeStatus)
        ;
    
    // For debugging, you can print the entire notification
    //console.log(`received notification!\n${JSON.stringify(msg, null, "    ")}`);

    console.log (`${new Date().toUTCString()} EnvelopeId ${envelopeId} Status: ${status}.
    Order number: ${orderNumber}. Subject: ${subject}
    Sender: ${senderName} <${senderEmail}>. Light color: ${lightColor}
    Sent ${created}. ${completedMsg}`);

    // Step 2. Filter the notifications
    // Connect sends notifications about all envelopes from the account, sent by anyone.
    // So in many use cases, we will need to filter out some notifications.
    // Notifications that we don't want should be simply ignored. 
    // DO NOT reject them by sending a 400 response to DocuSign--that would only
    // cause them to be resent.
    //
    // For this example, we'll filter out any notifications unless the 
    // envelope status is complete and has an "Order number" envelope custom field
    if (status != "Completed") {
        if (dsConfig.debug) {console.log(`IGNORED: envelope status is ${status}.`)}
        return
    }
    if (!orderNumber) {
        if (dsConfig.debug) {console.log(`IGNORED: envelope does not have a  ${dsConfig.envelopeCustomField} envelope custom field.`)}
        return
    }
    
    // Step 3. Check that this is not a duplicate notification
    // The queuing system delivers on an "at least once" basis. So there is a 
    // chance that we have already processes this notification.
    //
    // For this example, we'll just repeat the document fetch if it is duplicate notification
    
    // Step 3 Download and save the "combined" document
    try {
        await saveDoc(envelopeId, orderNumber)
    } catch (e) {
        // Returning a promise rejection tells the queuing system that the 
        // download failed. It will be retried by the queuing system.
        return Promise.reject(new Error("job process#saveDoc error"))
    } 

    // Step 4 Set the light's color
    // This is an optional step: it changes the LIFX light color to the value
    // set in the envelope's custom field.
    if (lightColor && dsConfig.lifxAccessToken && dsConfig.lifxAccessToken != '{LIFX_ACCESS_TOKEN}') {
        const lifxToken = dsConfig.lifxAccessToken
            , lifxSelector = dsConfig.lifxSelector
            , options = {url: `https://api.lifx.com/v1/lights/${lifxSelector}/state`,
                method: 'PUT', auth: {bearer: dsConfig.lifxAccessToken},
                form:{power: 'on', color: lightColor, duration: 0.0}}
            ;
        try {await rp(options)} catch(e) {}
    }
}

/**
 * Search through the Envelope Custom Fields to see if an order number
 * field is present
 * @param {object} envelopeStatus 
 */
function getOrderNumber(envelopeStatus){
    const customFields = envelopeStatus.CustomFields[0].CustomField
        , orderField = customFields.find( field => field.Name[0] == dsConfig.envelopeCustomField)
        , result = orderField ? orderField.Value[0] : null;
    return result
}

/**
 * Search through the Envelope Custom Fields to see if a Light color
 * field is present
 * @param {object} envelopeStatus 
 */
function getLightColor(envelopeStatus){
    const customFields = envelopeStatus.CustomFields[0].CustomField
        , colorField = customFields.find( field => field.Name[0] == dsConfig.envelopeColorCustomField)
        , result = colorField ? colorField.Value[0] : null;
    return result
}

/**
 * Downloads and saves the combined documents from the envelope.
 * 
 * @param {string} envelopeId 
 * @param {string} orderNumber
 */
async function saveDoc(envelopeId, orderNumber) {
    try {
        await dsJwtAuth.checkToken();
        let dsApiClient = new docusign.ApiClient();
        dsApiClient.setBasePath(dsJwtAuth.basePath);
        dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + dsJwtAuth.accessToken);
        let envelopesApi = new docusign.EnvelopesApi(dsApiClient);
    
        // Call EnvelopeDocuments::get.
        const docResult = await envelopesApi.getDocument(
                dsJwtAuth.accountId, envelopeId, "combined", null)
            , sanitizedOrderNumber = orderNumber.replace(/\W/g, '_')
            , fileName = dsConfig.outputFilePefix + sanitizedOrderNumber + '.pdf';
        
        // create the output dir if need be
        const dirExists = await fse.exists(outputDir);
        if (!dirExists) {await fse.mkdir(outputDir)}

        // Create the output file
        await fse.writeFile(path.join(outputDir, fileName), docResult, 'binary');

        if (dsConfig.enableBreakTest && ("" + orderNumber).includes("/break")) {
            throw new Error('Break test')
        }

    } catch (e) {
        console.error(`\n${new Date().toUTCString()} Error while fetching and saving docs for envelope ${envelopeId}, order ${orderNumber}.`);
        console.error(e);
        throw new Error("saveDoc error");
    }
}

/**
 * 
 * @param {string} test -- what value was sent as a test.
 * It will be stored in one of testOutputDir/test1.txt, test2.txt, test3.txt, test4.txt, test5.txt
 * 
 * If a test value includes /break then the worker will immediately exit.
 * This is for testing job recovery when the worker crashes. 
 *
 */
async function processTest (test) {
    // Are we being asked to crash?
    if (dsConfig.enableBreakTest && ("" + test).includes("/break")) {
        console.error(`${new Date().toUTCString()} BREAKING worker test!`);
        process.exit(2);
    }

    console.log(`Processing test value ${test}`);

    // Create testOutputDir if need be
    const dirExists = await fse.exists(testOutputDir);
    if (!dirExists) {
        await fse.mkdir(testOutputDir)
    }

    // The new test message will be placed in test1.
    // So first shuffle test4 to test5 (if it exists); and so on.
    for (let i = 19; i >= 1; i--) {
        const oldFile = `test${i}.txt`
            , newFile = `test${i + 1}.txt`;
        try {
            fse.renameSync (path.join(testOutputDir, oldFile), path.join(testOutputDir, newFile))
        } catch (e) {}  
    }

    // Now write the test message into test1.txt
    await fse.writeFile(path.join(testOutputDir, "test1.txt"), test);
}