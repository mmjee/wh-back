const _ = require('lodash')
const Joi = require('joi')

const Razorpay = require('warehouse/utils/razorpay')
const Redis = require('warehouse/utils/redis')

const { maskOrderForPublicDisplay } = require('warehouse/db/public-display-utils')
const { getQuantityAvailable } = require('warehouse/db/product-utils')
const { Order, CartProduct } = require('warehouse/db/models')
const { validateWithSchema } = require('warehouse/utils/validate')
const { checkPendingTransaction, deliverAfterOrder } = require('warehouse/jobs')

async function createOrder (req, res) {
  const allCartProducts = await CartProduct.find({
    user: req.user
  }).populate('product')
  if (allCartProducts.length === 0) {
    res.send({
      error: true,
      errorCode: 'NO_PRODUCTS_IN_CART'
    })
    return
  }

  const areAllProductsSatisfiable = await Promise.all(allCartProducts.map(async cp => {
    const availableQuantity = await getQuantityAvailable(cp.product)
    if (availableQuantity === -1) {
      return true
    }
    return _.gte(availableQuantity, cp.quantity)
  }))

  // If any product is unsatisfiable, send error
  if (!_.every(areAllProductsSatisfiable, Boolean)) {
    res.send({
      error: true,
      errorCode: 'PRODUCT_UNSATISFIABLE'
    })
    return
  }

  await CartProduct.deleteMany({
    user: req.user
  })

  const totalPrice = _.sumBy(allCartProducts, cartProduct => {
    return cartProduct.product.price * cartProduct.quantity
  }) * 100
  const GCFG = await Redis.getGlobalConfig()

  const rzpOrder = await Razorpay.orders.create({
    amount: totalPrice, // amount in the smallest currency unit
    currency: GCFG.storeCurrency
  })

  const dbOrder = await Order.create({
    orderCreator: req.user,
    total: totalPrice,
    items: allCartProducts.map(cp => ({
      product: cp.product,
      price: cp.product.price,
      quantity: cp.quantity
    })),
    paymentOrderID: rzpOrder.id,
    status: 'AWAITING_PAYMENT'
  })

  res.send({
    ok: true,
    totalPrice,
    paymentOrderID: rzpOrder.id,
    whOrderID: dbOrder.id
  })
}

const HPSchema = Joi.object({
  orderID: Joi.binary().length(12).encoding('hex').required(),
  paymentID: Joi.string().required()
}).required()

async function handlePayment (req, res) {
  if (!validateWithSchema(req, res, HPSchema)) {
    return
  }
  const { orderID, paymentID } = req.body

  const order = await Order.findById(orderID)
  if (!order) {
    res.send({
      error: true,
      errorCode: 'ORDER_NOT_FOUND'
    })
    return
  }
  if (!order.orderCreator.equals(req.user._id)) {
    res.send({
      error: true,
      errorCode: 'ORDER_NOT_OWNED'
    })
    return
  }

  if (order.paymentAttempt) {
    res.send({
      error: true,
      errorCode: 'PAYMENT_ALREADY_ADDED'
    })
    return
  }
  order.paymentAttempt = {
    provider: 'Razorpay',
    paymentId: paymentID,
    status: null
  }
  order.markModified('paymentAttempt')
  const payment = order.paymentAttempt

  const rzp = await Razorpay.payments.fetch(paymentID)
  payment.status = rzp.status

  if (rzp.status === 'authorized' || rzp.status === 'captured') {
    order.status = 'PAID_AWAITING_SHIPMENT'
    await deliverAfterOrder.add(order.id, {
      id: order.id
    })
  } else {
    order.status = 'PAYMENT_NOT_CONFIRMED'
    await checkPendingTransaction.add(order.id, {
      id: order.id
    }, {
      repeat: {
        cron: '*/20 * * * *'
      }
    })
  }
  await order.save()

  res.send({
    ok: true,
    newStatus: order.status
  })
}

async function getOrderById (req, res) {
  if (!req.query.id) {
    res.send({
      error: true,
      errorCode: 'ID_MISSING'
    })
    return
  }
  let order
  try {
    order = await Order.findById(req.query.id).populate('items.product')
  } catch (e) {
    res.send({
      error: true,
      errorCode: 'INVALID_ORDER'
    })
    return
  }

  if (!order || !order.orderCreator.equals(req.user._id)) {
    res.send({
      error: true,
      errorCode: 'ORDER_NOT_OWNED'
    })
    return
  }

  res.send({
    ok: true,
    order: maskOrderForPublicDisplay(order)
  })
}

async function listOrder (req, res) {
  res.send({
    ok: true,
    orders: await Promise.all((await Order.find({
      orderCreator: req.user._id
    }).sort({
      createdAt: -1
    }).populate('items').populate('items.product')).map(maskOrderForPublicDisplay))
  })
}

exports.createOrder = createOrder
exports.handlePayment = handlePayment
exports.getOrderByID = getOrderById
exports.listOrder = listOrder
