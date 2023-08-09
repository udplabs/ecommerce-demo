const path = require("path")
require("dotenv").config({
  path: path.join(__dirname, "../../.env"),
})
const {
  ISSUER_BASE_URL,
  CLIENT_ID,
  CLIENT_SECRET,
  RESPONSE_TYPE,
  AUDIENCE,
  BANK_AUDIENCE,
  SCOPE,
  BANK_AUD_SCOPES,
  SESSION_SECRET,
  API_PORT,
  APP_PORT,
  API_URL,
  PKJWT_ISSUER,
  PKJWT_CLIENT_ID,
  PVT_KEY,
} = process.env
let { APP_URL } = process.env

if (!APP_URL) {
  APP_URL = `http://localhost:${APP_PORT}`
}

const PKJWT_REDIRECT_URI = `${APP_URL}/resume-transaction`

function checkUrl() {
  return (req, res, next) => {
    let host = req.headers.host
    if (!APP_URL.includes(host)) {
      return res.status(301).redirect(APP_URL)
    }
    return next()
  }
}

function removeTrailingSlashFromUrl(url) {
  if (!url || !url.endsWith("/")) return url

  return url.substring(0, url.length - 1)
}

console.log("\n----------------------------------")
console.log("Environment Settings:")
console.log(`ISSUER_BASE_URL: ${ISSUER_BASE_URL}`)
console.log(`CLIENT_ID: ${CLIENT_ID}`)
if (CLIENT_SECRET) {
    console.log('CLIENT_SECRET: Has Value')
} else {
    console.log('CLIENT_SECRET: Not Set')
}
console.log(`RESPONSE_TYPE: ${RESPONSE_TYPE}`)
console.log(`AUDIENCE: ${AUDIENCE}`)
console.log(`SCOPE: ${SCOPE}`)
if (SESSION_SECRET) {
    console.log('SESSION_SECRET: Has Value')
} else {
    console.log('SESSION_SECRET: Not Set')
}
console.log(`API_PORT: ${API_PORT}`)
console.log(`APP_PORT: ${APP_PORT}`)
console.log(`APP_URL: ${APP_URL}`)
console.log(`API_URL: ${API_URL}`)

console.log("----------------------------------\n")

module.exports = {
  checkUrl,
  ISSUER_BASE_URL: removeTrailingSlashFromUrl(ISSUER_BASE_URL),
  CLIENT_ID: CLIENT_ID,
  CLIENT_SECRET: CLIENT_SECRET,
  AUDIENCE: AUDIENCE,
  RESPONSE_TYPE: RESPONSE_TYPE,
  SCOPE: SCOPE,
  SESSION_SECRET: SESSION_SECRET,
  API_PORT: API_PORT,
  APP_PORT: APP_PORT,
  APP_URL: APP_URL,
  API_URL: removeTrailingSlashFromUrl(API_URL),
  PKJWT_ISSUER: PKJWT_ISSUER,
  PKJWT_CLIENT_ID: PKJWT_CLIENT_ID,
  PKJWT_REDIRECT_URI: PKJWT_REDIRECT_URI,
  PVT_KEY: PVT_KEY,
  BANK_AUDIENCE: BANK_AUDIENCE,
  BANK_AUD_SCOPES: BANK_AUD_SCOPES,
}
