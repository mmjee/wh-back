const { Order } = require('warehouse/db/models')

async function getAllOrders (req, res) {
  const orders = await Order.find().populate('orderCreator').populate('items.product').sort({
    createdAt: -1
  })

  res.send({
    ok: true,
    orders
  })
}

exports.getAllOrders = getAllOrders
