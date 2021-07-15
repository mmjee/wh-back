const _ = require('lodash')
const fs = require('fs')
const json5 = require('json5')

class ConfigManager {
  constructor () {
    try {
      this.config = json5.parse((fs.readFileSync(process.env.WH_CFG || 'config.json5')).toString())
    } catch (e) {
      console.log('Caught error while reading config.')
      console.error(e)
    }
  }

  setConfig (cfg) {
    this.config = cfg
  }

  getConfig () {
    return this.config
  }

  getKey (path, default_) {
    return _.get(this.config, path, default_)
  }
}

const cm = new ConfigManager()
module.exports = cm
