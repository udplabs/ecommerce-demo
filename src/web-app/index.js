process.on('uncaughtException', function (err) {
	console.log(err)
})

const {
	checkUrl,
	ISSUER_BASE_URL, // Auth0 Tenant Url
	CLIENT_ID, // Auth0 Web App Client
	CLIENT_SECRET, // Auth0 Web App CLient Secret
	RESPONSE_TYPE,
	AUDIENCE,
	SCOPE,
	SESSION_SECRET, // Cookie Encryption Key
	APP_PORT,
	PORT,
	APP_URL, // Public URL for this app
	API_URL, // URL for Expenses API
	PKJWT_ISSUER,
	PKJWT_CLIENT_ID,
	PKJWT_REDIRECT_URI,
	PVT_KEY,
	BANK_AUDIENCE,
	BANK_AUD_SCOPES,
} = require('./env-config')

const express = require('express')
const session = require('express-session')
const createError = require('http-errors')
const cookieParser = require('cookie-parser')
const morgan = require('morgan')
const logger = require('./winston')
const path = require('path')
const { createServer } = require('http')
const { auth, requiresAuth } = require('express-openid-connect')
const { Issuer, generators } = require('openid-client')
const { JWK } = require('node-jose')
const axios = require('axios').default
const jwt = require('jsonwebtoken')

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
app.use(checkUrl()) // Used to normalize URL
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')
app.use(auth(authConfig))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, 'public')))
app.use(
	morgan('":method :url :status :res[content-length] - :response-time ms"', {
		stream: logger.stream,
	})
)
app.use(
	session({
		secret: SESSION_SECRET,
		resave: false,
		saveUninitialized: true,
	})
)

/************* BEGIN webapp routes *************/

app.get('/', async (req, res, next) => {
	try {
		auth0Issuer = await Issuer.discover(`${PKJWT_ISSUER}`)
		await keystore.add(privateKey, 'pem')

		client = new auth0Issuer.Client(
			{
				client_id: PKJWT_CLIENT_ID,
				token_endpoint_auth_method: 'private_key_jwt',
				redirect_uris: [PKJWT_REDIRECT_URI],
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

	//const transaction_amount = req.query && req.query.transaction_amount || 15;
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
		PKJWT_REDIRECT_URI,
		{ code: req.query.code },
		{ nonce: '132123' }
	)

	if (req.session.pendingTransaction) {
		console.log(
			'Processing pending transaction',
			req.session.pendingTransaction
		)
		try {
			const { type, amount, transferFrom, transferTo } =
				req.session.pendingTransaction
			// TODO: handle the error case here...
			await submitTransaction(
				{ type, amount, transferFrom, transferTo },
				tokenSet,
				req
			)
			//   res.render("transaction-complete", {
			//     user: req.oidc && req.oidc.user,
			//   })
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

app.get('/transaction-complete', requiresAuth(), async (req, res, next) => {
	res.render('transaction-complete', {
		user: req.oidc && req.oidc.user,
	})
})

const submitTransaction = async (payload, tokenSet, req) => {
	console.log('tokenSet', tokenSet)
	logger.info(`Send request to API with token type: ${tokenSet.token_type}`)
	logger.info(`${API_URL}/transaction`)
	await axios.post(`${API_URL}/transaction`, payload, {
		headers: {
			Authorization: `${tokenSet.token_type} ${tokenSet.access_token}`,
		},
	})

	delete req.session.pendingTransaction
}

app.post('/submit-transaction', requiresAuth(), async (req, res, next) => {
	// console.log(req.body)
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
					transferFrom: transferFrom,
					transferTo: transferTo,
				},
			]

			req.session.pendingTransaction = {
				type: 'Purchase',
				amount: amount,
				transferFrom: transferFrom,
				transferTo: transferTo,
			}

			const authorization_request = {
				audience: BANK_AUDIENCE,
				scope: `openid profile ${BANK_AUD_SCOPES}`,
				nonce: '132123',
				response_type: responseType,
				authorization_details: JSON.stringify(authorization_details),
			}
			// console.log('PAR', pushed_authz_request)

			const response = await client.pushedAuthorizationRequest(authorization_request)
			console.log('PAR response', response)

			res.redirect(
				`${PKJWT_ISSUER}/authorize?client_id=${process.env.PKJWT_CLIENT_ID}&request_uri=${response.request_uri}`
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
			let { token_type, access_token } = req.oidc.accessToken
			logger.info(`Send request to API with token type: ${token_type}`)
			let balance = await axios.get(`${API_URL}/balance`, {
				headers: {
					Authorization: `${token_type} ${access_token}`,
				},
			})
			let transactionHistory = await axios.get(`${API_URL}/reports`, {
				headers: {
					Authorization: `${token_type} ${access_token}`,
				},
			})
			res.render('balance', {
				user: req.oidc && req.oidc.user,
				balance: balance.data.balance,
				purchases: transactionHistory.data,
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

// app.get('/consent', async (req, res, next) => {
// 	let sessionToken = req.query.session_token

// 	const claims = jwt.decode(sessionToken) // using jose library to decode JWT
// 	console.log(claims)
// 	if (!claims.authorization_details) {
// 		throw new Error('authorization details claim required')
// 	}
// 	req.session['transaction_linking_id'] = claims.transaction_linking_id
// 	req.session[claims.transaction_linking_id] = claims.authorization_details

// 	res.render('consent', {
// 		authorization_details: claims.authorization_details,
// 		state: req.query.state,
// 		sub: claims.sub,
// 	})
// })

// app.post('/consent/accept', async (req, res, next) => {
// 	let authz_details = JSON.parse(req.body.authorization_details)
// 	console.log(authz_details)
// 	authz_details.accountId = 'ABC123'

// 	let payload = {
// 		iss: PKJWT_CLIENT_ID, // YOUR CLIENT_ID
// 		sub: req.body.sub,
// 		exp: Math.floor(Date.now() / 1000) + 60,
// 		decision: 'accept',
// 		state: req.body.state,
// 		authorization_details: authz_details,
// 	}

// 	let token = jwt.sign(payload, 'ABC')

// 	console

// 	res.redirect(
// 		`${PKJWT_ISSUER}/continue?state=${req.body.state}&consentToken=${token}`
// 	)
// })

// app.post('/consent/deny', async (req, res, next) => {
// 	let payload = {
// 		iss: PKJWT_CLIENT_ID, // YOUR CLIENT_ID
// 		sub: req.body.sub,
// 		exp: Math.floor(Date.now() / 1000) + 60,
// 		decision: 'deny',
// 		state: req.body.state,
// 		authorization_details: authz_details,
// 	}

// 	let token = jwt.sign(payload, 'ABC')

// 	res.redirect(
// 		`${PKJWT_ISSUER}/continue?state=${req.body.state}&consentToken=${token}`
// 	)
// })

// catch 404 and forward to error handler
app.use(function (req, res, next) {
	next(createError(404))
})

// error handler
app.use(function (err, req, res, next) {
	if (err.error === 'access_denied') {
		// Crude way of handling the unauthorized error from the authorization server.
		// We must redirect back to the /prepare-transaction page, but be sure to capture that the transaction was denied.
		res.redirect('/prepare-transaction?error=access_denied')
		return
	}
	res.locals.message = err.message
	res.locals.error = err

	logger.error(`${err.message}`)

	// render the error page
	res.status(err.status || 500)
	res.render('error', {
		user: req.oidc && req.oidc.user,
	})
})

createServer(app).listen(PORT || APP_PORT, () => {
	logger.info(`WEB APP listening on port: ${APP_URL}`)
})
