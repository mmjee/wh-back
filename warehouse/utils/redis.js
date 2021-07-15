const Redis = require('ioredis')
const ConfigManager = require('warehouse/utils/config')

const MAGIC_KEYS = {
  GLOBAL_CONFIG: 'GC',
  ADMIN_EMAIL: 'AE',
  HOMEPAGE_GORE: 'HG'
}

class RedisClient {
  redis = null
  MAGIC_KEYS = MAGIC_KEYS

  initialize () {
    this.redis = new Redis(ConfigManager.getKey('services.redis', process.env.WH_REDIS_URL || 'redis://localhost:6379'))
  }

  async getKey (k) {
    const v = await this.redis.get(k)
    // TODO add more logic, msgpack if needed, etc
    return JSON.parse(v)
  }

  getGlobalConfig () {
    return this.getKey(this.MAGIC_KEYS.GLOBAL_CONFIG)
  }

  async setKey (k, v) {
    await this.redis.set(k, JSON.stringify(v))
  }
}
const rc = new RedisClient()
module.exports = rc
