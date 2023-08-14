# ecommerce-demo

An example ecommerce site showcasing Okta's new Financial Grade Identity (FGI)
functionality. It uses pushed authorization requests (PAR) to securely
transmit transaction details for appoval via a custom mobile push notification.

## Setup

**Local Environment**

Make a copy of `.env.sample` and save it as `.env` in the `app` folder.
Fill in the details for your two applications; you can run this demo inside a
single tenant with two applications, but for storytelling, it works better if
you have two separate tenants: one for the store and one for the bank.

**CIC Tenant**

Create a new regular web application in your tenant. This will be the plant
store.

### Install Dependencies

Install the dependencies by running:

```bash
npm install
```

### Running the Demo

To run the demo locally:

```bash
npm run dev
```

This will start a development server on `http://localhost:8080`.
