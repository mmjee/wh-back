const Redis = require('warehouse/utils/redis')
const GOREMain = require('warehouse/libgore/gore-main')

async function getHomepageDesc (req, res) {
  const o = await Redis.getKey(Redis.MAGIC_KEYS.HOMEPAGE_GORE)
  const g = new GOREMain()
  await g.handleRequest(o, res)
}

module.exports = {
  getHomepageDesc
}
