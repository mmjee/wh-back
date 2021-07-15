const redis = require('warehouse/utils/redis')
const ConfigManager = require('warehouse/utils/config')

async function getGlobalConfig (req, res) {
  const resp = await redis.getKey(redis.MAGIC_KEYS.GLOBAL_CONFIG)
  if (process.env.NODE_ENV === 'debug') {
    resp.debugEnabled = true
  }
  res.send({
    ...resp,
    razorpayKeyId: ConfigManager.getKey('services.rzpId', process.env.RZP_KEY_ID)
  })
}

exports.getGlobalConfig = getGlobalConfig
