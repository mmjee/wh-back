const Joi = require('joi')
const _ = require('lodash')

const { validateWithSchema } = require('warehouse/utils/validate')
const { maskProductForPublicDisplay } = require('warehouse/db/public-display-utils')

const { Product, CartProduct } = require('warehouse/db/models')

const ADTCSchema = Joi.object({
  productId: Joi.binary().length(12).encoding('hex').required(),
  quantity: Joi.number().positive().required()
}).required()

// NB: needs authentication
async function addProductToCart (req, res) {
  if (!validateWithSchema(req, res, ADTCSchema)) {
    return
  }

  const { user, body } = req

  const product = await Product.findById(body.productId)
  if (!product) {
    res.send({
      error: true,
      errorCode: 'NO_PRODUCT_FOUND'
    })
    return
  }

  let cp = await CartProduct.findOne({
    user,
    product
  })
  if (cp) {
    cp.quantity += body.quantity
    await cp.save()
  } else {
    cp = await CartProduct.create({
      user,
      product,
      quantity: body.quantity
    })
  }

  res.send({
    ok: true,
    // Created Or Updated Cart Product ID -> COUPCPID
    COUPCPID: cp.id
  })
}

async function getProductsInCart (req, res) {
  const productsInCart = await CartProduct.find({
    user: req.user
  }).populate('product')
  const allCartProducts = productsInCart.map(cartProduct => {
    return {
      id: cartProduct.id,
      syncedQuantity: cartProduct.quantity,
      quantity: cartProduct.quantity,
      product: maskProductForPublicDisplay(cartProduct.product)
    }
  })

  res.send({
    ok: true,
    products: allCartProducts,
    totalPrice: _.sumBy(allCartProducts, cartProduct => {
      return cartProduct.product.price * cartProduct.quantity
    })
  })
}

const UQSchema = Joi.object({
  CPID: Joi.binary().length(12).encoding('hex').required(),
  quantity: Joi.number().positive().required()
}).required()

async function updateQuantity (req, res) {
  if (!validateWithSchema(req, res, UQSchema)) {
    return
  }

  const { body, user } = req
  const cp = await CartProduct.findById(body.CPID)
  if (!cp.user.equals(user._id)) {
    res.status(401).send({
      error: true,
      errorCode: 'YOU_ARE_UNAUTHORIZED'
    })
    return
  }

  cp.quantity = body.quantity
  await cp.save()
  res.send({
    ok: true,
    COUPCPID: cp.id
  })
}

const DCPSchema = Joi.object({
  CPID: Joi.binary().length(12).encoding('hex').required(),
}).required()

async function deleteCartProduct (req, res) {
  if (!validateWithSchema(req, res, DCPSchema)) {
    return
  }

  const { body, user } = req
  const cp = await CartProduct.findById(body.CPID)
  if (!cp.user.equals(user._id)) {
    res.status(401).send({
      error: true,
      errorCode: 'YOU_ARE_UNAUTHORIZED'
    })
    return
  }

  await cp.delete()
  res.send({
    ok: true,
    deleted: true
  })
}

exports.deleteCartProduct = deleteCartProduct
exports.updateQuantity = updateQuantity
exports.addProductToCart = addProductToCart
exports.getProductsInCart = getProductsInCart
