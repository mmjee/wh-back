const Razorpay = require('razorpay')
const ConfigManager = require('warehouse/utils/config')

const KID = ConfigManager.getKey('services.rzpId', process.env.RZP_KEY_ID)

if (KID) {
  module.exports = new Razorpay({
    key_id: KID,
    key_secret: ConfigManager.getKey('services.rzpKey', process.env.RZP_KEY_SECRET)
  })
  global.Razorpay = module.exports
}
