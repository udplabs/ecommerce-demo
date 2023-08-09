# auth0-webapp

This is a simple web-app that uses Auth0 Open ID Connect capabilites to authenticate users and get their permission to consume an API. The code is based on https://github.com/auth0-training/labs-node-working-with-apis.

To run simply add information from your Auth0 Tenant to the .env file, and then run from vscode (it is also ready to use the Remote - Containers extension - see https://code.visualstudio.com/docs/remote/containers) or manually run both api en web-app processes as follows:

```
npm install --prefix ./src/web-app
npm start --prefix ./src/web-app
```

```
npm install --prefix ./src/api
npm start --prefix ./src/api
```
