const Razorpay = require('razorpay')
const ConfigManager = require('warehouse/utils/config')

module.exports = new Razorpay({
  key_id: ConfigManager.getKey('services.rzpId', process.env.RZP_KEY_ID),
  key_secret: ConfigManager.getKey('services.rzpKey', process.env.RZP_KEY_SECRET)
})
global.Razorpay = module.exports
