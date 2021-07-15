const _ = require('lodash')

const betterauthMiddleware = require('libbetterauth/express')
const { User } = require('warehouse/db/models')

module.exports = betterauthMiddleware(function (userID) {
  return User.findOne({
    email: userID
  })
}, function (user) {
  return user.publicKey
})
module.exports.authRequired = betterauthMiddleware.authenticationMandatory
module.exports.adminOnly = function (req, res, next) {
  if (_.lt(req.user.privilegeLevel, 3)) {
    res.status(403).send({
      error: true,
      errorCode: 'ADMIN_ONLY'
    })
    return
  }
  next()
}
