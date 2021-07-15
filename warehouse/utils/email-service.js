const nodemailer = require('nodemailer')
const ConfigManager = require('warehouse/utils/config')

const smtpUrl = ConfigManager.getKey('services.emailURL', process.env.WH_SMTP_URL)
const FromURL = ConfigManager.getKey('services.emailAddress', process.env.WH_SMTP_FROM)

if (!smtpUrl || !FromURL) {
  console.error('SMTP URL or FROM address not found, exiting.')
} else {
  exports.emailTransport = nodemailer.createTransport(smtpUrl, {
    from: FromURL
  })
}
