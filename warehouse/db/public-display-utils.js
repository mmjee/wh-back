const _ = require('lodash')

exports.maskProductForPublicDisplay = (pro) => {
  const picked = _.pick(pro, [
    'id',
    'name',
    'upperTagline',
    'lowerDescription',
    'additionalInformation',
    'price',
    'productPhoto'
  ])
  picked.category = pro.category ? exports.maskCategoryForPublicDisplay(pro.category) : pro.category
  return picked
}

exports.maskCategoryForPublicDisplay = (cat) => {
  return _.pick(cat, [
    'id',
    'categoryName',
    'parentCategory'
  ])
}

exports.maskUserForPublicDisplay = (user) => {
  return _.pick(user.toJSON(), [
    'id',
    'fullName',
    'email',
    'email_verified',
    'publicKey',
    'privilegeLevel'
  ])
}

exports.maskOrderForPublicDisplay = (order) => {
  const o = _.pick(order.toJSON(), [
    '_id',
    'orderCreator',
    'total',
    'paymentOrderID',
    'paymentAttempts',
    'status',
    'shipments',
    'createdAt'
  ])
  o.items = order.items.map((i) => {
    const i2 = i.toJSON()
    _.unset(i2, 'product')
    return {
      product: exports.maskProductForPublicDisplay(i.product),
      ...i2
    }
  })
  return o
}
