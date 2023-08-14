process.on('uncaughtException', function (err) {
	console.log(err)
})

class InsufficientAuthorizationDetailsError extends Error {
	constructor() {
		super('Insufficient Authorization Details')
		this.code = 'insufficient_authorization_details'
		this.status = 403
		this.headers = {
			'WWW-Authenticate': `Bearer realm="api", error="${this.code}""`,
		}
		this.responsePayload = {
			code: this.code,
			status: this.status,
			message: this.message,
		}
		this.name = this.constructor.name
	}
}

const { onRequest } = require('firebase-functions/v2/https')
const dotenv = require('dotenv')
dotenv.config({ path: '.env' })
// const logger = require("firebase-functions/logger")
// logger.info("Hello logs!", {structuredData: true})

const purchases = [
	{
		date: new Date(),
		description: 'Purchase from Atko Green paid via Okta Bank',
		value: 102,
	},
	{
		date: new Date(),
		description: 'Purchase from Atko Green paid via Okta Bank',
		value: 42,
	},
]

const {
	ISSUER_BASE_URL,
	AUDIENCE,
	REQUIRED_SCOPES,
	BANK_ISSUER,
	BANK_AUDIENCE,
} = process.env

//console.log(`ISSUER_BASE_URL ${ISSUER_BASE_URL}`)

const express = require('express')
const cors = require('cors')
const { auth, requiredScopes } = require('express-oauth2-jwt-bearer')
const morgan = require('morgan')
const logger = require('./winston')
const bodyParser = require('body-parser')

const app = express()
app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(
	morgan('":method :url :status :res[content-length] - :response-time ms"', {
		stream: logger.stream,
	})
)

const authSelf = auth({
	issuerBaseURL: ISSUER_BASE_URL,
	audience: AUDIENCE,
})

const authPayment = auth({
	issuerBaseURL: BANK_ISSUER,
	audience: BANK_AUDIENCE,
})

app.get('/api', (request, response) => {
	response.status(200).end('OK')
})

app.get('/api/balance', authSelf, (request, response) => {
	let totalPurchases = purchases.reduce(
		(accum, purchase) => accum + purchase.value,
		0
	)
	let balance = totalPurchases
	logger.info(`balance: ${balance}`)
	response.json({
		totalBalance: balance,
	})
})

app.get(
	'/api/reports',
	authSelf,
	requiredScopes('read:balance'),
	(request, response) => {
		logger.info(`Valid token with scopes ${REQUIRED_SCOPES}`)
		response.json(purchases)
	}
)

app.post(
	'/api/transaction',
	authPayment,
	requiredScopes('process:payment'),
	(request, response, next) => {
		logger.info(
			`/transaction, ${JSON.stringify(request.auth.payload, null, 2)}`
		)
		const jwtPayload = request.auth.payload
		if (!jwtPayload.tx_details) {
			return next(new InsufficientAuthorizationDetailsError())
		}
		const type = request.body.type
		const transferFrom = request.body.transferFrom
		const transferTo = request.body.transferTo
		const requestedTransactionAmount = request.body.amount
		const grantedTransactionAmount = jwtPayload.tx_details.amount

		console.log(`body: ${request.body}`)
		console.log(`transferFrom: ${transferFrom}`)
		console.log(`transferTo: ${transferTo}`)
		console.log(`requested: ${requestedTransactionAmount}`)
		console.log(`granted: ${grantedTransactionAmount}`)

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
		response.json({
			confirmed: true,
		})
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

app.get('/api/timestamp', (request, response) => {
	response.send(`${Date.now()}`)
})

exports.app = onRequest(app)
