const _ = require('lodash')
const Joi = require('joi')

// eslint-disable-next-line node/handle-callback-err
function handleError (err, res) {
  res.status(400).send({
    error: true,
    errorMessage: 'VALIDATION_FAILED',
    errorDetails: err.details.map(d => d.message)
  })
}

exports.validateWithSchema = function validateWithSchema (req, res, schema) {
  if (!_.isPlainObject(req.body)) {
    res.status(400).send({
      error: true,
      errorMessage: 'NOT_AN_OBJECT'
    })
    return false
  }

  try {
    const r = schema.validate(req.body)

    if (r.error) {
      handleError(r.error, res)
      return false
    }
  } catch (e) {
    if (!Joi.isError(e)) {
      throw e
    }

    handleError(e, res)
    return false
  }

  return true
}
