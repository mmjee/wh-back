const _ = require('lodash')
const app = require('express')()
const fs = require('fs').promises
const json5 = require('json5')

const qs = require('qs')

const betterauthMiddleware = require('warehouse/utils/authentication')

const ConfigManager = require('warehouse/utils/config')
const Database = require('warehouse/db/models')
const Redis = require('warehouse/utils/redis')

app.set('query parser', (queryTxt) => {
  let isJSON = true
  let r

  try {
    r = JSON.parse(decodeURIComponent(queryTxt))
    if (r == null || !(_.isPlainObject(r))) {
      isJSON = false
    }
  } catch (e) {
    isJSON = false
  }

  if (!isJSON) {
    r = qs.parse(queryTxt)
  }

  return r
})
app.use(require('body-parser').json())
app.use(require('morgan')('dev'))
app.use(betterauthMiddleware)
app.use(function (req, res, next) {
  res.header('x-powered-by', 'human tears')
  next()
})

const { getGlobalConfig } = require('warehouse/routes/global-config')
const HomepageRoutes = require('warehouse/routes/homepage')
const DebugRoutes = require('warehouse/routes/debug')
const UserRoutes = require('warehouse/routes/user')
const ProductRoutes = require('warehouse/routes/products')
const SandCRoutes = require('warehouse/routes/search-and-category')
const CartRoutes = require('warehouse/routes/cart-mgmt')
const OrderRoutes = require('warehouse/routes/order-mgmt')

async function main () {
  const globalConfigPath = process.env.WH_CFG || 'config.json5'
  try {
    await fs.access(globalConfigPath)
  } catch (e) {
    app.get('/api/v1/get-global-config', function getGlobalConfig (req, res) {
      res.send({
        needsInitialConfig: true,
        redisURL: ConfigManager.getKey('services.redis', process.env.WH_REDIS_URL || 'redis://localhost:6379'),
        mongoURL: ConfigManager.getKey('services.mongodb', false) || process.env.WH_MONGODB_URL || 'mongodb://127.0.0.1:29001/whb',

        smtpURL: ConfigManager.getKey('services.emailURL', process.env.WH_SMTP_URL),
        smtpFrom: ConfigManager.getKey('services.emailAddress', process.env.WH_SMTP_FROM),

        rzpId: ConfigManager.getKey('services.rzpId', process.env.RZP_KEY_ID),
        rzpKey: ConfigManager.getKey('services.rzpKey', process.env.RZP_KEY_SECRET)
      })
    })
    app.put('/api/v1/set-global-config', async function setGlobalConfig (req, res) {
      if (!_.isPlainObject(req.body.connectionInfo) || !_.isPlainObject(req.body.globalConfig || !_.isString(req.body.adminEmail))) {
        res.status(400).send({
          error: true,
          errorCode: 'INVALID_DATA'
        })
        return
      }
      await fs.writeFile(globalConfigPath, json5.stringify(req.body.connectionInfo))
      ConfigManager.setConfig(req.body.connectionInfo)

      await Redis.initialize()
      await Database.initialize()

      await Redis.setKey(Redis.MAGIC_KEYS.GLOBAL_CONFIG, req.body.globalConfig)
      await Redis.setKey(Redis.MAGIC_KEYS.ADMIN_EMAIL, req.body.adminEmail)

      res.send({
        ok: true
      })
    })
    app.put('/api/v1/create-admin-user', async (req, res) => {
      const email = req.body.email
      const pubKey = req.body.publicKey
      if (!_.isString(email) || !_.isString(pubKey)) {
        res.status(400).send({
          error: true,
          errorCode: 'INVALID_DATA'
        })
        return
      }

      let user
      try {
        user = new Database.User({
          fullName: 'Admin User',
          email,
          publicKey: Buffer.from(pubKey, 'base64'),
          privilegeLevel: 4
        })
        await user.save()
      } catch (e) {
        console.error(e)
        res.status(503).send({
          error: true,
          errorCode: 'ERROR_WHILE_CREATING_USER',
          errorMessage: e.message
        })
        return
      }

      res.send({
        ok: true,
        userId: user._id
      })
    })
    const port = process.env.WH_HTTP_PORT || 3000
    console.log(`No configuration found. Listening on ${port} and will require setup.`)
    // If there's no config, then ???
    app.listen(port)
    return null
  }

  Redis.initialize()
  await Database.initialize()

  if (process.env.NODE_ENV === 'debug') {
    app.get('/api/v1/get-redis-key', DebugRoutes.debugReadRedis)
    app.put('/api/v1/write-redis-key', DebugRoutes.debugWriteRedis)
  }
  app.get('/api/v1/get-global-config', getGlobalConfig)
  app.get('/api/v1/get-homepage-desc', HomepageRoutes.getHomepageDesc)

  // User Management
  app.get('/api/v1/whoami', betterauthMiddleware.authRequired, UserRoutes.whoami)
  app.post('/api/v1/register-user-account', UserRoutes.registerUserAccount)

  // Admin Information
  app.get('/api/v1/admin-dashboard-data', betterauthMiddleware.authRequired, betterauthMiddleware.adminOnly)

  // Category
  app.get('/api/v1/list-category', SandCRoutes.listCategory)
  app.post('/api/v1/admin-create-new-category', betterauthMiddleware.authRequired, betterauthMiddleware.adminOnly, SandCRoutes.createNewCategory)

  // Products
  app.post('/api/v1/admin-create-new-product', betterauthMiddleware.authRequired, betterauthMiddleware.adminOnly, ProductRoutes.createNewProduct)
  app.get('/api/v1/admin-get-all-products', betterauthMiddleware.authRequired, betterauthMiddleware.adminOnly, ProductRoutes.getAllProductsForAdmin)
  app.put('/api/v1/admin-add-codes-to-product', betterauthMiddleware.authRequired, betterauthMiddleware.adminOnly, ProductRoutes.addCodesToProduct)

  app.get('/api/v1/get-product-by-id', ProductRoutes.getProductById)
  app.get('/api/v1/get-top-20-products', ProductRoutes.getTopTwentyProducts)

  // Cart Routes
  app.get('/api/v1/get-cart-products', betterauthMiddleware.authRequired, CartRoutes.getProductsInCart)
  app.post('/api/v1/add-product-to-cart', betterauthMiddleware.authRequired, CartRoutes.addProductToCart)
  app.put('/api/v1/update-cartproduct-quantity', betterauthMiddleware.authRequired, CartRoutes.updateQuantity)
  app.delete('/api/v1/delete-cart-product', betterauthMiddleware.authRequired, CartRoutes.deleteCartProduct)

  // Order Management
  app.post('/api/v1/create-order', betterauthMiddleware.authRequired, OrderRoutes.createOrder)
  app.post('/api/v1/handle-payment', betterauthMiddleware.authRequired, OrderRoutes.handlePayment)
  app.get('/api/v1/get-order-by-id', betterauthMiddleware.authRequired, OrderRoutes.getOrderByID)
  app.get('/api/v1/get-all-orders', betterauthMiddleware.authRequired, OrderRoutes.listOrder)

  app.listen(ConfigManager.getKey('http.port', false) || process.env.WH_HTTP_PORT || 3000)
}

main().catch(e => console.error(e))
