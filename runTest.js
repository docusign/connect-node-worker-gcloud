#!/usr/bin/env node --require dotenv/config

/**
 * See settings in ds_configuration.js
 */

const dsConfig = require('./ds_configuration.js').config
    , fse = require('fs-extra')
    , path = require('path')
    , rp = require('request-promise-native')
    , testOutputDirName = dsConfig.testOutputDirName
    , testOutputDir = path.join(path.normalize("."), testOutputDirName)
    , moment = require('moment')
    , sleep = (seconds) => {
        return new Promise(resolve => setTimeout(resolve, 1000 * seconds))}
    , log = msg => {console.log(`${new Date().toUTCString()} ${msg}`)}
    ;

let timeStart
  , timeChecks = []
  , timeCheckNumber = 0 // 0..6 
  , enqueueErrors = 0
  , dequeueErrors = 0
  , successes = 0 
  , mode // help, many or few
  , testsSent = [] // test values sent that should also be receieved
  , foundAll = false
  ;

async function startTest() {
  timeStart = moment() 
  for (let i = 0; i <= 7; i++) {
    timeChecks[i] = moment(timeStart).add(i + 1, 'h')
  }
  log("Starting");
  await doTests();
  log("Done.\n");
}

async function doTests() {
  while (timeCheckNumber <= 7) {
    while (moment().isBefore(timeChecks[timeCheckNumber])) {
      await doTest();
      if (mode == "few") {
        await sleep(moment.duration(moment().diff(timeChecks[timeCheckNumber])).asSeconds() + 2)
      }
    }
    showStats();
    timeCheckNumber ++;
  }
  showStats();
}

function showStats() {
  const rate = Math.round((100.0 * successes) / (enqueueErrors + dequeueErrors + successes));
  log (`##### Test statistics: ${successes} (${rate}%) successes, ${enqueueErrors} enqueue errors, ${dequeueErrors} dequeue errors.`)
}

async function doTest() {
  await send(); // sets testsSent
  const endTime = moment().add(3, 'minutes');
  foundAll = false;
  const tests = testsSent.length,
        successesStart = successes;
  while (!foundAll && moment().isBefore(endTime)){
    await sleep(1);
    await checkResults(); // sets foundAll and updates testsSent
  }
  if (!foundAll) {
    dequeueErrors += testsSent.length;
  }
  log (`Test: ${tests} sent. ${successes - successesStart } successes, ${testsSent.length} failures.`)
}

/**
 * Look for the reception of the testsSent values
 */
async function checkResults(){
    let testsReceived = [];
    for (let i = 1; i <= 20; i++) {
      let fileData = null;
      try {fileData = await fse.readFile(path.join(testOutputDir, `test${i}.txt`))} catch(e){}
      if (fileData) {testsReceived.push(fileData.toString())}
    }
    // Create a private copy of testsSent (testsSentOrig) and reset testsSent
    // Then, for each element in testsSentOrig not found, add back to testsSent.
    let testsSentOrig = testsSent;
    testsSent = [];
    testsSentOrig.forEach(testValue => {
      const found = testsReceived.includes(testValue);
      if (found) {successes ++} 
      else {testsSent.push(testValue)}
    })
    // Update foundAll
    foundAll = testsSent.length == 0 
}

async function send() {
  testsSent =  [];
  for (let i = 0 ; i < 5; i++) {
    try {
      const testValue = Date.now().toString();
      await send1(testValue);
      testsSent.push(testValue)
    } catch (e) {
      enqueueErrors ++;
      log (`Enqueue error: ${e}`);
      await sleep(30);
    }
  }
}

/**
 * Send one enqueue request. Errors will be caught by caller
 * @param {string} test The test value 
 */
async function send1(test){
  let options = {url: `${dsConfig.testEnqueueUrl}?test=${test}`, method: 'POST', body: ''}
    , auth = authObject();
  if (auth) {options.auth = auth};
  return await rp(options) 
}

/**
 * Returns an auth object for the request library or false
 * if Basic Auth is not being used
 */
function authObject() {
  if (dsConfig.basicAuthName && dsConfig.basicAuthName != '{BASIC_AUTH_NAME}') {
    return {user: dsConfig.basicAuthName, pass: dsConfig.basicAuthPW} 
  } else {
    return false
  }
}



////////////////////////////////////
//
// Mainline

if (process.argv.length < 3) {mode = 'help'}
else {mode = process.argv[2]}

if (mode === 'help') {
  console.log(`
./runTest.js many  # send many tests
./runTest.js few   # send five tests, wait an hour, repeat

Tests run for 8 hours, with interim reports every hour.\n`)
} else if (mode === 'many' || mode === 'few') {startTest()
} else {console.log(`\nProblem: unrecogpnized mode '${mode}'\n`)}





