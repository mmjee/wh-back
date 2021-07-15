const { Queue, QueueScheduler, Worker } = require('bullmq')

const ConfigManager = require('warehouse/utils/config')
const Razorpay = require('warehouse/utils/razorpay')
const { emailTransport } = require('warehouse/utils/email-service')
const { Order, ProductCodes, User } = require('warehouse/db/models')

const ConnectionInfo = ConfigManager.getKey('services.redis', process.env.WH_REDIS_URL || 'redis://localhost:6379')
const DividerLine = (new Array(15)).fill('-').join('') + '\n'

// Deliver after Order stuff
const DeliverAfterOrderQ = new Queue('DELIVER_AFTER_ORDER', {
  connection: ConnectionInfo,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
})

async function handleDelivery (job) {
  if (job.stacktrace.length !== 0) {
    console.log('Stacktrace:', job.stacktrace)
  }
  console.log('Attempting to deliver order:', job.data.id)
  const order = await Order.findById(job.data.id)
  await order.populate('orderCreator').populate('items.product').execPopulate()
  const email = order.orderCreator.email

  const selectedProductCodes = []
  for (const cartProduct of order.items) {
    if (cartProduct.product.type === 'MANUALLY_DELIVERED') {
      const adminUser = await User.findOne({
        privilegeLevel: {
          $gte: 3
        }
      }).sort({
        createdAt: -1
      })
      if (!adminUser) {
        console.warn('NO USER FOUND WITH A PRIVILEGE LEVEL GTE 3')
        continue
      }
      await emailTransport.sendMail({
        to: adminUser.email,
        subject: `Order received for ${cartProduct.product.name} x ${cartProduct.quantity}`,
        text: 'Please ship order to ' + email
      })
      // Send email to the business owner somehow?! Show in Warehouse??
    } else if (cartProduct.product.type === 'AUTOMATICALLY_DELIVERED') {
      const codes = await ProductCodes.find({
        product: cartProduct.product,
        redeemed: false
      }).limit(cartProduct.quantity)

      if (codes.length !== cartProduct.quantity) {
        // Notify that items are out of stock, cancelling order.
        await Razorpay.payments.refund(order.paymentAttempt.paymentId)
        await emailTransport.sendMail({
          to: email,
          subject: 'Order could not be satisfied due to lack of stock.',
          text: 'Your order could not be satisfied due to lack of stock. A refund has been issued to your original payment method.'
        })
        order.status = 'DELIVERED'
        await order.save()
        return
      }

      selectedProductCodes.push({
        cartProduct,
        codes
      })
    }
  }

  // Send Email to order.orderCreator.email with an product code, etc
  for (const productCodeSet of selectedProductCodes) {
    let messageData = `Here are the codes for ${productCodeSet.cartProduct.product.name}.\n` + DividerLine
    for (const code of productCodeSet.codes) {
      messageData += code.code + '\n'
    }
    messageData += DividerLine

    await emailTransport.sendMail({
      to: email,
      subject: 'Your codes for ' + productCodeSet.cartProduct.product.name,
      text: messageData
    })
    await Promise.all(productCodeSet.codes.map(async code => {
      code.redeemed = true
      await code.save()
    }))
  }

  order.status = 'DELIVERED'
  await order.save()
}

exports.deliverAfterOrder = DeliverAfterOrderQ
exports.deliverAfterOrderScheduler = new QueueScheduler('DELIVER_AFTER_ORDER', {
  connection: ConnectionInfo
})
exports.deliverAfterOrderWorker = new Worker('DELIVER_AFTER_ORDER', async (...args) => {
  try {
    return handleDelivery(...args)
  } catch (e) {
    console.error(e)
    throw e
  }
}, {
  connection: ConnectionInfo
})

// Check Pending Transaction and stuff
const CheckPendingTxQ = new Queue('CHECK_PENDING_TX', {
  connection: ConnectionInfo,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
})

exports.checkPendingTransaction = CheckPendingTxQ
exports.checkPendingTransactionScheduler = new QueueScheduler('CHECK_PENDING_TX', {
  connection: ConnectionInfo
})

exports.checkPendingTransactionWorker = new Worker('CHECK_PENDING_TX', async (job) => {
  const relevantOrder = await Order.findById(job.data.id)
  const payment = await Razorpay.payments.fetch(relevantOrder.paymentAttempt.paymentId)
  relevantOrder.paymentAttempt.status = payment.status
  if (payment.status === 'authorized' || payment.status === 'captured') {
    relevantOrder.status = 'PAID_AWAITING_SHIPMENT'
    await exports.deliverAfterOrder.add(relevantOrder.id, {
      id: relevantOrder.id
    })
  } else if (payment.status === 'refunded' || payment.status === 'failed') {
    await CheckPendingTxQ.remove(job.id)
  }
  await relevantOrder.save()
}, {
  connection: ConnectionInfo
})
