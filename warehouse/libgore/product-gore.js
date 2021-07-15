const { Product } = require('warehouse/db/models')

class ProductGORE {
  handleTop10SellingProduct (input, output) {
    output.children = Product.find({}).sort({
      orders7d: 'desc'
    }).limit(10)
  }
}

module.exports = new ProductGORE()
