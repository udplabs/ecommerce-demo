const dotenv = require('dotenv')
dotenv.config({ path: '.env' })

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
	CLIENT_ID,
	CLIENT_SECRET,
	AUDIENCE,
	SCOPE,
	RESPONSE_TYPE,
	SESSION_SECRET,
	APP_URL,
	BANK_ISSUER,
	BANK_CLIENT_ID,
	BANK_AUDIENCE,
	BANK_AUD_SCOPES,
	BANK_REDIRECT_URI,
	PVT_KEY,
} = process.env
const PORT = process.env.PORT || 8080

const express = require('express')
const cors = require('cors')({ origin: true })
const morgan = require('morgan')
const logger = require('./winston')
const bodyParser = require('body-parser')

// add-ons for the front end
const session = require('express-session')
const createError = require('http-errors')
const cookieParser = require('cookie-parser')
const path = require('path')
const { auth, requiresAuth } = require('express-openid-connect')
const { Issuer } = require('openid-client')
const { JWK } = require('node-jose')

var privateKey = PVT_KEY
var keystore = JWK.createKeyStore()
var auth0Issuer
var client

const responseType = 'code'
const responseTypesWithToken = ['code id_token', 'code']

const authConfig = {
	secret: SESSION_SECRET,
	authRequired: false,
	auth0Logout: true,
	baseURL: APP_URL,
	issuerBaseURL: ISSUER_BASE_URL,
	clientID: CLIENT_ID,
	clientSecret: CLIENT_SECRET,
	authorizationParams: {
		response_type: RESPONSE_TYPE,
		audience: AUDIENCE,
		scope: SCOPE,
	},
}

const app = express()
app.use(cors)

// new stuff for the front end
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')
app.use('/static', express.static('public'))
app.use(auth(authConfig))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(
	session({
		secret: SESSION_SECRET,
		resave: false,
		saveUninitialized: true,
	})
)

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(
	morgan('":method :url :status :res[content-length] - :response-time ms"', {
		stream: logger.stream,
	})
)

app.get('/', async (req, res, next) => {
	try {
		auth0Issuer = await Issuer.discover(`${BANK_ISSUER}`)
		await keystore.add(privateKey, 'pem')

		client = new auth0Issuer.Client(
			{
				client_id: BANK_CLIENT_ID,
				token_endpoint_auth_method: 'private_key_jwt',
				redirect_uris: [BANK_REDIRECT_URI],
			},
			keystore.toJSON(true)
		)

		res.render('home', {
			user: req.oidc && req.oidc.user,
		})
	} catch (err) {
		console.log(err)
		next(err)
	}
})

app.get('/user', requiresAuth(), async (req, res) => {
	res.render('user', {
		user: req.oidc && req.oidc.user,
		id_token: req.oidc && req.oidc.idToken,
		access_token: req.oidc && req.oidc.accessToken,
		refresh_token: req.oidc && req.oidc.refreshToken,
	})
})

app.get('/cart', requiresAuth(), async (req, res) => {
	let errorMessage
	const error = req.query && req.query.error
	if (error === 'access_denied') {
		// The AS said we are not allowed to do this transaction, tell the end-user!
		errorMessage =
			'You are not authorized to make this transaction. Perhaps you can try with a smaller transaction amount?'
		delete req.session.pendingTransaction
	}

	res.render('cart', {
		user: req.oidc && req.oidc.user,
		id_token: req.oidc && req.oidc.idToken,
		access_token: req.oidc && req.oidc.accessToken,
		refresh_token: req.oidc && req.oidc.refreshToken,
		errorMessage,
	})
})

app.get('/prepare-transaction', requiresAuth(), async (req, res) => {
	let errorMessage
	const error = req.query && req.query.error
	if (error === 'access_denied') {
		// The AS said we are not allowed to do this transaction, tell the end-user!
		errorMessage =
			'You are not authorized to make this transaction. Perhaps you can try with a smaller transaction amount?'
		delete req.session.pendingTransaction
	}

	const transaction_amount = (req.query && req.query.transaction_amount) || 15
	res.render('transaction', {
		user: req.oidc && req.oidc.user,
		id_token: req.oidc && req.oidc.idToken,
		access_token: req.oidc && req.oidc.accessToken,
		refresh_token: req.oidc && req.oidc.refreshToken,
		transaction_amount,
		errorMessage,
	})
})

app.get('/resume-transaction', requiresAuth(), async (req, res, next) => {
	const tokenSet = await client.callback(
		BANK_REDIRECT_URI,
		{ code: req.query.code },
		{ nonce: '132123' }
	)
	console.log(`Token set: ${tokenSet}`)

	if (req.session.pendingTransaction) {
		console.log(
			'Processing pending transaction',
			req.session.pendingTransaction
		)
		try {
			const { type, amount, from, to } =
				req.session.pendingTransaction
			// TODO: handle the error case here...
			submitTransaction({ type, amount, from, to }, req)
			res.redirect('/transaction-complete')
		} catch (err) {
			console.log('refused to connect')
			console.log(err.stack)
			return next(err)
		}
	} else {
		const transaction_amount = (req.query && req.query.amount) || 15
		res.render('transaction', {
			user: req.oidc && req.oidc.user,
			id_token: req.oidc && req.oidc.idToken,
			access_token: req.oidc && req.oidc.accessToken,
			refresh_token: req.oidc && req.oidc.refreshToken,
			transaction_amount,
		})
	}
})

app.get('/transaction-complete', requiresAuth(), async (req, res) => {
	res.render('transaction-complete', {
		user: req.oidc && req.oidc.user,
	})
})

const submitTransaction = (payload, req) => {
	const type = payload.type
	const transferFrom = payload.from
	const transferTo = payload.to
	const amount = payload.amount

	purchases.push({
		date: new Date(),
		description: `${type} from ${transferTo} paid via ${transferFrom}`,
		value: amount,
	})

	delete req.session.pendingTransaction
}

app.post('/submit-transaction', requiresAuth(), async (req, res, next) => {
	const type = req.body.type
	const amount = Number(req.body.amount)
	const transferFrom = req.body.transferFrom
	const transferTo = req.body.transferTo
	try {
		if (responseTypesWithToken.includes(RESPONSE_TYPE)) {
			const authorization_details = [
				{
					type: type,
					amount: amount,
					from: transferFrom,
					to: transferTo,
				},
			]

			req.session.pendingTransaction = {
				type: type,
				amount: amount,
				from: transferFrom,
				to: transferTo,
			}

			const authorization_request = {
				audience: BANK_AUDIENCE,
				scope: `openid profile ${BANK_AUD_SCOPES}`,
				nonce: '132123',
				response_type: responseType,
				authorization_details: JSON.stringify(authorization_details),
			}
			// console.log('PAR', pushed_authz_request)

			const response = await client.pushedAuthorizationRequest(
				authorization_request
			)
			console.log('PAR response', response)

			res.redirect(
				`${BANK_ISSUER}/authorize?client_id=${process.env.BANK_CLIENT_ID}&request_uri=${response.request_uri}`
			)

			return
		} else {
			next(
				createError(
					403,
					'Access token required to complete this operation. Please, use an OIDC flow that issues an access_token'
				)
			)
		}
	} catch (err) {
		next(err)
	}
})

app.get('/balance', requiresAuth(), async (req, res, next) => {
	try {
		if (responseTypesWithToken.includes(RESPONSE_TYPE)) {
			let totalPurchases = purchases.reduce(
				(accum, purchase) => accum + purchase.value,
				0
			)

			res.render('balance', {
				user: req.oidc && req.oidc.user,
				balance: totalPurchases,
				purchases: purchases,
			})
		} else {
			next(
				createError(
					403,
					'Access token required to complete this operation. Please, use an OIDC flow that issues an access_token'
				)
			)
		}
	} catch (err) {
		next(err)
	}
})

app.get('/api', (request, response) => {
	response.status(200).end('OK')
})

app.get('/api/timestamp', (request, response) => {
	response.send(`${Date.now()}`)
})

// catch 404 and forward to error handler
app.use((req, res, next) => {
	next(createError(404))
})

app.listen(PORT, () => {
	console.log(`App listening on port ${PORT}`)
})

module.exports = app
