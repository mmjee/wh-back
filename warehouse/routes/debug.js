const Redis = require('warehouse/utils/redis')

async function debugReadRedis (req, res) {
  res.send(await Redis.getKey(req.query.key))
}

async function debugWriteRedis (req, res) {
  await Redis.setKey(req.query.key, req.body)
  res.send('OK')
}

module.exports = {
  debugReadRedis,
  debugWriteRedis
}
