/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

class InsufficientAuthorizationDetailsError extends Error {
  constructor() {
    super("Insufficient Authorization Details")
    this.code = "insufficient_authorization_details"
    this.status = 403
    this.headers = {
      "WWW-Authenticate": `Bearer realm="api", error="${this.code}""`,
    }
    this.responsePayload = {
      code: this.code,
      status: this.status,
      message: this.message,
    }
    this.name = this.constructor.name
  }
}

const { onRequest } = require("firebase-functions/v2/https")
// const logger = require("firebase-functions/logger");
// logger.info("Hello logs!", {structuredData: true});

const {
  checkUrl,
  ISSUER_BASE_URL, // Auth0 Tenant Url
  AUDIENCE,
//   API_PORT,
//   PORT,
  REQUIRED_SCOPES,
  BANK_ISSUER,
  BANK_AUDIENCE,
  REQUIRED_BANK_AUD,
  REQUIRED_BANK_SCOPES,
} = require("./env-config")

const express = require("express")
const cors = require("cors")
const { auth, requiredScopes } = require("express-oauth2-jwt-bearer")
const morgan = require("morgan")
const logger = require("./winston")
const bodyParser = require("body-parser")

const purchases = [
  {
    date: new Date(),
    description: "Purchase from Atko Green paid via Okta Bank",
    value: 102,
  },
  {
    date: new Date(),
    description: "Purchase from Atko Green paid via Okta Bank",
    value: 42,
  },
]

var authSelf = auth({
  issuerBaseURL: ISSUER_BASE_URL,
  audience: AUDIENCE,
})

var authPayment = auth({
  issuerBaseURL: BANK_ISSUER,
  audience: BANK_AUDIENCE,
})

const app = express()

// Used to normalize URL
app.use(checkUrl())

app.use(
  morgan('":method :url :status :res[content-length] - :response-time ms"', {
    stream: logger.stream,
  })
)
app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.get("/api", (request, response) => {
  response.status(200).end("OK")
})

app.get("/api/balance", authSelf, (request, response) => {
  let totalPurchases = purchases.reduce((accum, purchase) => accum + purchase.value, 0)
  let balance = totalPurchases
  logger.info(`balance: ${balance}`)
  response.send({ balance })
})

app.get("/api/reports", authSelf, requiredScopes("read:balance"), (request, response) => {
    logger.info(`Valid token with scopes ${REQUIRED_SCOPES}`)
    response.send(purchases)
  }
)

app.post("/api/transaction", authPayment, requiredScopes("process:payment"), (request, response, next) => {
    logger.info(`/transaction, ${JSON.stringify(req.auth.payload, null, 2)}`)
    const jwtPayload = request.auth.payload
    if (!jwtPayload.tx_details) {
      return next(new InsufficientAuthorizationDetailsError())
    }
    //const transaction_id = req.body.transaction_id;
    const type = request.body.type
    const transferFrom = request.body.transferFrom
    const transferTo = request.body.transferTo
    const requestedTransactionAmount = request.body.amount
    const grantedTransactionAmount = jwtPayload.tx_details.amount
    if (requestedTransactionAmount != grantedTransactionAmount) {
      logger.info(
        `Mismatching requested/granted transaction amounts ${JSON.stringify(
          requestedTransactionAmount
        )} vs ${JSON.stringify(grantedTransactionAmount)}`
      )
      return next(new InsufficientAuthorizationDetailsError())
    }
    purchases.push({
      date: new Date(),
      description: `${type} from ${transferTo} paid via ${transferFrom}`,
      value: requestedTransactionAmount,
    })
    response.send({ confirmed: true })
  }
)

app.use((err, request, response, next) => {
  logger.error(`Error: ${err.stack}`)
  response.status(err.status || 500)
  response.json(
    err.responsePayload || {
      code: err.code,
      status: err.status,
      message: err.message,
    }
  )
})

app.get("/api/timestamp", (request, response) => {
  response.send(`${Date.now()}`)
})

app.get("/api/timestamp-cached", (request, response) => {
  response.set("Cache-control", "public, max-age=300, s-maxage=600")
  response.send(`${Date.now()}`)
})

exports.app = onRequest(app)
