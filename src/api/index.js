const {
  checkUrl,
  ISSUER_BASE_URL, // Auth0 Tenant Url
  AUDIENCE,
  API_PORT,
  PORT,
  REQUIRED_SCOPES,
  BANK_ISSUER,
  REQUIRED_BANK_AUD,
  REQUIRED_BANK_SCOPES,
} = require("./env-config")

const express = require("express")
const cors = require("cors")
const { createServer } = require("http")
const {
  auth,
  requiredScopes,
  claimCheck,
} = require("express-oauth2-jwt-bearer")
const morgan = require("morgan")
const logger = require("./winston")
const bodyParser = require("body-parser")
const { BANK_AUDIENCE } = require("../web-app/env-config")

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

/****************************
 * This method is here to allow a
 * successful response on root requests.
 * This stops content security policy
 * from preventing the user to make
 * requests via the browsers console.
 ****************************/
app.get("/", (req, res) => {
  res.status(200).end("OK")
})
/****************************/

// 👆 public routes above 👆
// Issuer and Audience can be obtained from env vars, but better make it explicit

var authSelf = auth({
  issuerBaseURL: ISSUER_BASE_URL,
  audience: AUDIENCE,
})

var authPayment = auth({
  issuerBaseURL: BANK_ISSUER,
  audience: BANK_AUDIENCE,
})

// 👇 private routes below 👇

app.get("/balance", authSelf, (req, res) => {
  let totalPurchases = purchases.reduce(
    (accum, purchase) => accum + purchase.value,
    0
  )
  let balance = totalPurchases
  logger.info(`balance: ${balance}`)
  res.send({ balance })
})

app.get("/reports", authSelf, requiredScopes("read:balance"), (req, res) => {
  logger.info(`Valid token with scopes ${REQUIRED_SCOPES}`)
  res.send(purchases)
})

class InsufficientAuthorizationDetailsError extends Error {
  constructor(transaction_id) {
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
      transaction_id,
    }
    this.name = this.constructor.name
  }
}

const newTransactionId = () =>
  Math.floor(Math.random() * 10000000000).toString()

app.post(
  "/transaction",
  authPayment,
  requiredScopes("process:payment"),
  (req, res, next) => {
    logger.info(`/transaction, ${JSON.stringify(req.auth.payload, null, 2)}`)
    const jwtPayload = req.auth.payload
    if (!jwtPayload.tx_details) {
      return next(new InsufficientAuthorizationDetailsError(newTransactionId()))
    }
    //const transaction_id = req.body.transaction_id;
    const type = req.body.type
    const transferFrom = req.body.transferFrom
    const transferTo = req.body.transferTo
    const requestedTransactionAmount = req.body.amount
    const grantedTransactionAmount = jwtPayload.tx_details.amount
    if (requestedTransactionAmount != grantedTransactionAmount) {
      logger.info(
        `Mismatching requested/granted transaction amounts ${JSON.stringify(
          requestedTransactionAmount
        )} vs ${JSON.stringify(grantedTransactionAmount)}`
      )
      return next(new InsufficientAuthorizationDetailsError(newTransactionId()))
    }
    purchases.push({
      date: new Date(),
      description: `${type} from ${transferTo} paid via ${transferFrom}`,
      value: requestedTransactionAmount,
    })
    res.send({ confirmed: true })
  }
)

app.use((err, req, res, next) => {
  logger.error(`Error: ${err.stack}`)

  res.status(err.status || 500)
  res.json(
    err.responsePayload || {
      code: err.code,
      status: err.status,
      message: err.message,
    }
  )
})

createServer(app).listen(PORT || API_PORT, () => {
  logger.info(`API server listening at: ${PORT || API_PORT}`)
})
