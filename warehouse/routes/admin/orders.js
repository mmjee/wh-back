const { Order } = require('warehouse/db/models')

async function getAllOrders (req, res) {
  const orders = await Order.find()

  res.send({
    ok: true,
    orders
  })
}

exports.getAllOrders = getAllOrders
