const { Category } = require('warehouse/db/models')
const { maskCategoryForPublicDisplay } = require('warehouse/db/public-display-utils')

class CategoryGORE {
  async getBaseCategories () {
    const cat = await Category.find({
      parentCategory: null
    })

    return cat.map(maskCategoryForPublicDisplay)
  }
}

module.exports = new CategoryGORE()
