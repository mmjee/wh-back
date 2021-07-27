const {
  Product,
  ProductCodes,
  Category
} = require('warehouse/db/models')
const Joi = require('joi')
const { validateWithSchema } = require('warehouse/utils/validate')

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

exports.createNewProduct = createNewProduct
exports.addCodesToProduct = addCodesToProduct
exports.getAllProductsForAdmin = getAllProductsForAdmin
