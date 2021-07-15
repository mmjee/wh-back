const _ = require('lodash')
const pMap = require('p-map')

// GORE representations
const ProductGORE = require('./product-gore')
const CategoryGORE = require('./category-gore')

const GORE_TYPES = {
  // Container Types
  BOX_IN_ARRAY: 'BOX_IN_ARRAY',

  // Data Types
  TOP10_SELLING_PRODUCT: 'TOP10_SELLING_PRODUCT',
  CATEGORY_SIDENAV: 'CATEGORY_SIDENAV'
}

class GOREError extends Error {}

class GOREMain {
  GORE_TYPES = GORE_TYPES
  constructor (options) {
    this.options = options
  }

  async hydrateIndividualGore (input, output) {
    switch (input.type) {
      case GORE_TYPES.TOP10_SELLING_PRODUCT:
        return ProductGORE.handleTop10SellingProduct(input, output)
      case GORE_TYPES.CATEGORY_SIDENAV:
        return {
          type: 'cat-nav',
          children: await CategoryGORE.getBaseCategories()
        }
      default:
        console.error('Invalid GORE_TYPE found. Input:', input, 'Output:', output)
        throw new Error('Invalid GORE_TYPE found.')
    }
  }

  hydrate = async (goreConfig) => {
    console.log('GoreConfig:', goreConfig)
    if (!_.isPlainObject(goreConfig)) {
      throw new GOREError('SRCGORE_NOT_OBJECT')
    }
    let nextGore = _.cloneDeep(goreConfig)

    nextGore = this.hydrateIndividualGore(goreConfig, nextGore)

    if (_.isPlainObject(goreConfig.children)) {
      nextGore.children = await this.hydrate(goreConfig.children)
    } else if (_.isArray(goreConfig.children) && goreConfig.children.length !== 0) {
      nextGore.children = await pMap(goreConfig.children, this.hydrate)
    } else if (goreConfig.children) {
      console.error('Invalid GORE children:', goreConfig)
      throw new Error('GORE children is not a object or an array')
    }
    nextGore.ok = true

    return nextGore
  }

  async handleRequest (goreConfig, res) {
    try {
      res.send(await this.hydrate(goreConfig))
    } catch (e) {
      console.error(e)
      res.send({
        error: true,
        errorCode: e.message,
        errorMessage: 'Errored while trying to render GORE'
      })
    }
  }
}

module.exports = GOREMain
