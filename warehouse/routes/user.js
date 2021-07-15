const Joi = require('joi')
const { timingSafeEqual, randomBytes } = require('crypto')
const differenceInDays = require('date-fns/differenceInDays')
const differenceInHours = require('date-fns/differenceInHours')

const { User, ForgotPasswordToken } = require('warehouse/db/models')
const { maskUserForPublicDisplay } = require('warehouse/db/public-display-utils')
const { validateWithSchema } = require('warehouse/utils/validate')

async function whoami (req, res) {
  res.send({
    ok: true,
    user: maskUserForPublicDisplay(req.user)
  })
}

const RUASchema = Joi.object({
  fullName: Joi.string().min(1).max(128).required(),
  email: Joi.string().email().required(),
  publicKey: Joi.binary().encoding('base64').length(32).required()
}).required()

async function registerUserAccount (req, res) {
  if (!validateWithSchema(req, res, RUASchema)) {
    return
  }

  const cnt = await User.countDocuments({
    email: req.body.email
  }).exec()
  if (cnt !== 0) {
    res.send({
      error: true,
      errorCode: 'ACCOUNT_ALREADY_REGISTERED',
      errorMessage: 'Account already registered with this given email.'
    })
    return
  }

  const u = new User({
    fullName: req.body.fullName,
    email: req.body.email,
    publicKey: Buffer.from(req.body.publicKey, 'base64'),
    privilegeLevel: 1
  })
  await u.save()

  res.send({
    ok: true,
    userCreated: u.id
  })
}

async function requestEmailVerificationEmailAgain (req, res) {
  if (req.user.email_verified) {
    res.send({
      error: true,
      errorCode: 'EMAIL_ALREADY_VERIFIED'
    })
    return
  }

  if (differenceInDays(new Date(), req.user.lastEmailVerificationSent) <= 1) {
    res.send({
      error: true,
      errorCode: 'INELIGIBLE_TOO_SOON'
    })
    return
  }
  // TODO
  // VerificationEmailQueue.add(req.user.toJSON())
  res.send({
    ok: true
  })
}

const VEWTSchema = Joi.object({
  userID: Joi.string().length(24).required(),
  tokenID: Joi.string().length(32).required()
}).required()

async function verifyEmailWithToken (req, res) {
  if (!validateWithSchema(req, res, VEWTSchema)) {
    return
  }

  const { body: data } = req
  const u = await User.findById(data.userID)
  if (!u) {
    res.send({
      error: true,
      errorCode: 'USER_ID_INVALID'
    })
    return
  }

  if (u.email_verified) {
    res.send({
      error: true,
      errorCode: 'EMAIL_ALREADY_VERIFIED'
    })
    return
  }

  if (!timingSafeEqual(Buffer.from(data.tokenID), Buffer.from(u.emailVerificationToken))) {
    res.send({
      error: true,
      errorCode: 'TOKEN_ID_INVALID'
    })
    return
  }

  u.email_verified = true
  u.emailVerificationToken = randomBytes(16).toString('hex')
  await u.save()
  res.send({
    ok: true,
    emailVerified: true
  })
}

const RFPSchema = Joi.object({
  userID: Joi.string().required()
}).required()

async function requestForgotPassword (req, res) {
  if (!validateWithSchema(req, res, RFPSchema)) {
    return
  }

  const { body: data } = req
  const u = await User.findOne({
    email: data.userID
  })
  if (!u) {
    res.send({
      error: true,
      errorCode: 'USER_ID_INVALID'
    })
    return
  }

  if (!u.email_verified) {
    res.send({
      error: true,
      errorCode: 'EMAIL_NOT_VERIFIED'
    })
    return
  }

  if (u.lastRequestPasswordRequest && differenceInHours(new Date(), u.lastRequestPasswordRequest) < 1) {
    res.send({
      error: true,
      errorCode: 'REQUESTED_LESS_THAN_ONE_HOUR_AGO'
    })
    return
  }

  u.lastRequestPasswordRequest = new Date()
  await u.save()

  await ForgotPasswordToken.deleteMany({
    user: u
  })
  const fpt = await ForgotPasswordToken.create({
    user: u,
    tokenSecret: randomBytes(16)
  })
  /* ForgotPWQueue.add({
    tokenId: fpt.id,
    tokenSecret: fpt.tokenSecret.toString('hex'),
    tgtEmail: u.email
  }) */

  res.send({
    ok: true,
    tokenId: fpt.id
  })
}

const FPSchema = Joi.object({
  tokenID: Joi.string().length(24).required(),
  tokenSecret: Joi.binary().encoding('hex').length(16).required(),

  proposedPublicKey: Joi.binary().encoding('base64').length(32).required()
}).required()

async function redeemForgotPasswordToken (req, res) {
  if (!validateWithSchema(req, res, FPSchema)) {
    return
  }

  const { body: data } = req
  const token = await ForgotPasswordToken.findById(data.tokenID)
  if (!token) {
    res.send({
      error: true,
      errorCode: 'TOKEN_NOT_FOUND'
    })
    return
  }

  const secretBuf = Buffer.from(data.tokenSecret, 'hex')

  if (!timingSafeEqual(secretBuf, token.tokenSecret)) {
    res.send({
      error: true,
      errorCode: 'INVALID_SECRET'
    })
    return
  }

  await token.populate('user').execPopulate()
  token.user.publicKey = Buffer.from(data.proposedPublicKey, 'base64')
  await token.user.save()
  await token.delete()
  res.send({
    ok: true,
    passwordUpdated: true
  })
}

exports.whoami = whoami
exports.verifyEmailWithToken = verifyEmailWithToken
exports.requestEmailVerificationEmailAgain = requestEmailVerificationEmailAgain
exports.requestForgotPassword = requestForgotPassword
exports.redeemForgotPasswordToken = redeemForgotPasswordToken
exports.registerUserAccount = registerUserAccount
