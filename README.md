# ecommerce-demo

An example ecommerce site showcasing Okta's new Financial Grade Identity (FGI)
functionality. It uses pushed authorization requests (PAR) to securely
transmit transaction details for appoval via a custom mobile push notification.

## Setup

Make a copy of `.env.sample` and save it as `.env` in the `functions` folder.
Fill in the details for your two applications; you can run this demo inside a
single tenant with two applications, but for storytelling, it works better if
you have two separate tenants: one for the store and one for the bank.

### Install Firebase

Install the firebase tools if you don't have them already:

```bash
npm install -g firebase-tools
```

### Install Dependencies

Once you have your environment set up, install the dependencies by running:

```bash
npm run init
```

### Running the Demo

To run the demo locally

```bash
npm run serve
```

This will start the Firebase emulators for cloud functions and hosting.

`insert screenshot here`

Note the URL and port of the hosting service now running. In my example,
my ecommerce demo is running at 

`http://127.0.0.1:5002`

That is the "public" part of your site. In my example, the backend is running
under the Firebase Cloud Functions emulator at

`http://127.0.0.1:5001`

You can use your browser or Postman to make a request to

`http://localhost:5001/ecommerce-demo-254ec/us-central1/app/api/timestamp`

if you want to verify the backend is up and running.
