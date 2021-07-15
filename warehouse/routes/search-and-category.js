const Joi = require('joi')

const { Category } = require('warehouse/db/models')
const { maskCategoryForPublicDisplay } = require('warehouse/db/public-display-utils')

const { validateWithSchema } = require('warehouse/utils/validate')

async function listCategory (req, res) {
  const cat = await Category.find()

  res.send({
    ok: true,
    categories: cat.map(c => maskCategoryForPublicDisplay(c))
  })
}

const CNCSchema = Joi.object({
  categoryName: Joi.string().min(1).max(128).required(),
  parentCategory: Joi.string().length(24).optional().allow(null)
}).required()

async function createNewCategory (req, res) {
  if (!validateWithSchema(req, res, CNCSchema)) {
    return
  }
  const C = new Category(req.body)
  await C.save()

  res.send({
    ok: true,
    categoryID: C.id
  })
}

exports.listCategory = listCategory
exports.createNewCategory = createNewCategory
