const { ProductCodes } = require('./models')

exports.getQuantityAvailable = async (product) => {
  if (product.type === 'MANUALLY_DELIVERED') {
    return -1
  }
  return ProductCodes.countDocuments({
    product,
    redeemed: false
  })
}
