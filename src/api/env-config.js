const path = require("path")
require("dotenv").config({
  path: path.join(__dirname, "../../.env"),
})
const {
  PKJWT_ISSUER,
  ISSUER_BASE_URL,
  API_PORT,
  PORT,
  API_URL,
  BANK_AUDIENCE,
  BANK_AUD_SCOPES,
  AUDIENCE,
  SCOPE,
  REQUIRED_SCOPES,
} = process.env

function checkUrl() {
  return (req, res, next) => {
    let host = req.headers.host
    if (!API_URL.includes(host)) {
      return res.status(301).redirect(API_URL)
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
console.log(`AUDIENCE: ${AUDIENCE}`)
console.log(`API_URL: ${API_URL}`)
console.log(`API_PORT: ${API_PORT}`)
console.log(`PORT: ${PORT}`)
console.log(`REQUIRED_SCOPES: ${SCOPE}`)
console.log(`BANK_ISSUER: ${PKJWT_ISSUER}`)
console.log(`REQUIRED_BANK_AUD: ${BANK_AUDIENCE}`)
console.log(`REQUIRED_BANK_SCOPES: ${BANK_AUD_SCOPES}`)
console.log("----------------------------------\n")

module.exports = {
  checkUrl,
  ISSUER_BASE_URL: ISSUER_BASE_URL,
  AUDIENCE: AUDIENCE,
  API_URL: removeTrailingSlashFromUrl(API_URL),
  API_PORT: API_PORT,
  PORT: PORT,
  REQUIRED_SCOPES: REQUIRED_SCOPES,
  BANK_ISSUER: PKJWT_ISSUER,
  REQUIRED_BANK_AUD: BANK_AUDIENCE,
  REQUIRED_BANK_SCOPES: BANK_AUD_SCOPES,
}
