const winston = require('winston')

// instantiate a new Winston Logger with the settings defined above

const myFormat = winston.format.printf(
	({ level, message, label, timestamp }) => {
		return `${timestamp} [${label}] ${level}: ${message}`
	}
)

const logger = new winston.createLogger({
	level: 'debug',
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.label({ label: 'api' }),
		myFormat
	),
	timestamp: true,
	transports: [new winston.transports.Console()],
})

// create a stream object with a 'write' function that will be used by `morgan`
logger.stream = {
	write: function (message) {
		// use the 'info' log level so the output will be picked up by transports (console in our case)
		logger.info(message)
	},
}

module.exports = logger
