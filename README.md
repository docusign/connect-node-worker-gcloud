# Connect Node Worker for Google Cloud

This is an example worker application for
Connect webhook notification messages sent
via the 
[Google Cloud Pub/Sub](https://cloud.google.com/pubsub/) 
service.

This application receives messages from the queue
via a 
[Pub/Sub Subscription](https://cloud.google.com/pubsub/docs/subscriber),
and then processes
them:

1. If the envelope is complete, the application
   uses a DocuSign JWT Grant token to retrieve
   the envelope's combined set of documents,
   and stores them in the `output` directory.

   The envelope must include an Envelope Custom Field
   named `Sales order.` The Sales order field is used
   to name the output file.
1. Optionally, this worker app can be configured to
   also change the color of an 
   [LIFX](https://www.lifx.com/)
   bulb (or set of bulbs)
   to the color set in the envelope's 
   Custom Field `Light color`

## Architecture
![Connect listener architecture](docs/connect_listener_architecture.png)

This figure shows the solution's architecture. 
This worker application is written in Node.js. 
But it 
could be written in a different language.

Google has SDK libraries for 
[Pub/Sub clients](https://cloud.google.com/pubsub/docs/reference/libraries)
for C#, Go, Java, Node.js, PHP, Python, and Ruby. 

## Installation

1. Install the example 
   [Connect listener for Google Cloud](../connect-node-listener-gcloud) on Google Cloud.
   At the end of this step, you will have the
   `Subscription name` and a `Service Account credentials file`.

1. Install the latest Long Term Support version of 
   Node v8.x or v10.x on your system, with the
   npm package manager.

1. Configure a DocuSign Integration Key for the application.
   The application uses the OAuth JWT Grant flow.

   If consent has not been granted to the application by
   the user, then the application provides a url
   that can be used to grant individual consent.

   **To enable individual consent:** either
   add the URL `https://www.docusign.com` as a redirect URI
   for the Integration Key, or add a different URL and
   update the `oAuthConsentRedirectURI` setting
   in the ds_configuration.js file.

1. Download this repo to a directory.

1. In the directory:

   `npm install`
1. Configure `ds_configuration.js` or set the 
   environment variables as indicated in that file.

1. Set and export the environment variable 
   `GOOGLE_APPLICATION_CREDENTIALS` to the 
   name (and directory) of the service account
   JSON credentials file. DocuSign suggests `gcloud.json`

1. Start the listener:

   `npm start`

## Testing
Configure a DocuSign Connect subscription to send notifications to
the Cloud Function. Create / complete a DocuSign envelope.
The envelope **must include an Envelope Custom Field named "Sales order".**

* Check the Connect logs for feedback.
* Check the console output of this app for log output.
* Check the `output` directory to see if the envelope's
  combined documents and CoC were downloaded.

  By default, the documents will only be downloaded if
  the envelope is complete and includes a 
  `Sales order` custom field.

## Semi-automatic testing
The repo includes a `runTest.js` file. It conducts an
end-to-end integration test of enqueuing and dequeuing
test messages. See the file for more information.

## License and Pull Requests

### License
This repository uses the MIT License. See the LICENSE file for more information.

### Pull Requests
Pull requests are welcomed. Pull requests will only be considered if their content
uses the MIT License.

