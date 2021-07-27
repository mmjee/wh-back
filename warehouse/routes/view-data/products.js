const _ = require('lodash')
const pMap = require('p-map')

const { Product } = require('warehouse/db/models')
const { maskProductForPublicDisplay } = require('warehouse/db/public-display-utils')
const { getQuantityAvailable } = require('warehouse/db/product-utils')

function translateQueryToFilter (query) {
  const filter = {}

  if (_.isArray(query.priceRange) && query.priceRange.length === 2) {
    filter.price = {
      $gte: query.priceRange[0],
      $lte: query.priceRange[1]
    }
  }

  if (_.isString(query.category) && query.category.length === 24) {
    filter.category = query.category
  }

  return filter
}

async function getProductById (req, res) {
  if (!req.query.id) {
    res.status(400).send({
      error: true,
      errorCode: 'NO_ID_SUPPLIED'
    })
    return
  }
  const p = await Product.findById(req.query.id).populate('category')
  if (!p) {
    res.status(404).send({
      error: true,
      errorCode: 'NO_OBJECT_FOUND'
    })
    return
  }
  const outProduct = maskProductForPublicDisplay(p)
  outProduct.availableQuantity = await getQuantityAvailable(p)

  res.send({
    ok: true,
    product: outProduct
  })
}

async function listProducts (req, res) {
  const QF = translateQueryToFilter(req.query)
  let pl
  try {
    pl = await Product.find(QF).sort({
      orders7d: 1
    }).populate('category')
  } catch (e) {
    res.status(500).send({
      error: true,
      errorCode: 'UNHANDLED_ERROR'
    })
    return
  }

  res.send({
    ok: true,
    list: await pMap(pl, async (p) => {
      const out = maskProductForPublicDisplay(p)
      out.availableQuantity = await getQuantityAvailable(p)
      return out
    })
  })
}

module.exports = {
  getProductById,
  listProducts
}
