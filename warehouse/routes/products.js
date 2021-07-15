const Joi = require('joi')
const _ = require('lodash')
const pMap = require('p-map')

const { Product, ProductCodes, Category } = require('warehouse/db/models')
const { maskProductForPublicDisplay } = require('warehouse/db/public-display-utils')
const { getQuantityAvailable } = require('warehouse/db/product-utils')
const { validateWithSchema } = require('warehouse/utils/validate')

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

async function getTopTwentyProducts (req, res) {
  const QF = translateQueryToFilter(req.query)
  let pl
  try {
    pl = await Product.find(QF).sort({
      orders7d: 1
    }).limit(20).populate('category')
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

async function getAllProductsForAdmin (req, res) {
  const products = await Product.find({})
  res.send({
    ok: true,
    products
  })
}

const ACTPSchema = Joi.object({
  selectedProduct: Joi.binary().length(12).encoding('hex').required(),
  codes: Joi.string().required()
}).required()

async function addCodesToProduct (req, res) {
  if (!validateWithSchema(req, res, ACTPSchema)) {
    return
  }
  const { body } = req

  const product = await Product.findById(body.selectedProduct)
  if (!product) {
    res.send({
      error: true,
      errorCode: 'INVALID_PRODUCT'
    })
    return
  }

  await Promise.all(body.codes.split('\n').map(async (code) => {
    await ProductCodes.create({
      product,
      code
    })
  }))
  res.send({
    ok: true,
    added: true
  })
}

const CNPSchema = Joi.object({
  name: Joi.string().min(1).max(128).required(),
  type: Joi.string().required(),
  productPhoto: Joi.string().required(),
  price: Joi.number().required(),
  skuNo: Joi.string().min(1).required(),
  upperTagline: Joi.string().min(1).required(),
  lowerDescription: Joi.string().min(1).required(),
  category: Joi.string().length(24).required()
}).required()

async function createNewProduct (req, res) {
  if (!validateWithSchema(req, res, CNPSchema)) {
    return
  }
  const { body } = req

  const cat = await Category.findById(body.category)
  if (!cat) {
    res.send({
      error: true,
      errorCode: 'INVALID_CATEGORY'
    })
    return
  }

  const P = new Product({
    ...body,
    category: cat
  })
  await P.save()

  res.send({
    ok: true,
    productID: P.id
  })
}

module.exports = {
  getProductById,
  getAllProductsForAdmin,
  addCodesToProduct,
  getTopTwentyProducts,
  createNewProduct
}
