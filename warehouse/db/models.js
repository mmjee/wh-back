const mongoose = require('mongoose')
const crypto = require('crypto')

const ConfigManager = require('warehouse/utils/config')

const DEFAULT_MODEL_OPTIONS = {
  timestamps: true
}

const User = mongoose.model('User', new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  email_verified: { type: Boolean, default: false },
  publicKey: { type: Buffer, required: true },
  // Privilege levels:
  // 1 - Normal user
  // 2 - ??? Lower level shipment-management people?
  // 3 - Midlevel "trusted" people to finalize orders?
  // 4 - The store owner
  privilegeLevel: { type: Number, required: true, min: 0, max: 4 },

  emailVerificationToken: { type: String, default: () => crypto.randomBytes(16).toString('hex') },
  lastEmailVerificationSent: { type: Date, required: false },
  lastRequestPasswordRequest: { type: Date, required: false }
}, DEFAULT_MODEL_OPTIONS))

const Category = mongoose.model('Category', new mongoose.Schema({
  categoryName: { type: String, required: true },
  parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: false },

  categorySales1d: { type: Number, default: 0 },
  categorySales7d: { type: Number, default: 0 },
  categorySales1m: { type: Number, default: 0 }
}, DEFAULT_MODEL_OPTIONS))

const ForgotPasswordToken = mongoose.model('ForgotPasswordToken', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tokenSecret: { type: Buffer, required: true }
}, DEFAULT_MODEL_OPTIONS))

const Product = mongoose.model('Product', new mongoose.Schema({
  // ProductType can be: MANUALLY_DELIVERED, AUTOMATICALLY_DELIVERED
  type: { type: String, required: true },

  name: { type: String, required: true },
  skuNo: { type: String, required: true },
  upperTagline: { type: String, required: true },
  lowerDescription: { type: String, required: true },
  // Maybe a image, maybe HTML?
  additionalInformation: { type: mongoose.Schema.Types.Mixed, required: false },

  // URL to product photo
  productPhoto: { type: String, required: true },

  price: { type: mongoose.Schema.Types.Number, required: true, default: 1 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  // WarehouseID: Number
  availabilityByWarehouse: { type: mongoose.Schema.Types.Mixed, default: {} },

  orders1d: { type: Number, required: false, default: 0 },
  orders7d: { type: Number, required: false, default: 0 },
  orders1m: { type: Number, required: false, default: 0 }
}, DEFAULT_MODEL_OPTIONS))

const ProductCodes = mongoose.model('ProductCode', new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  redeemed: { type: Boolean, default: false },
  code: { type: String, required: true }
}))

const CartProduct = mongoose.model('CartProduct', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: 1 },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: 1 },
  quantity: { type: Number, required: true }
}, DEFAULT_MODEL_OPTIONS))

const Order = mongoose.model('Order', new mongoose.Schema({
  orderCreator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // hash of order data
  // HOOD: { type: String, maxlength: 32, required: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true }
  }],
  total: { type: Number, required: true },
  paymentOrderID: { type: String, required: true },
  paymentAttempt: {
    type: new mongoose.Schema({
      provider: { type: String, required: true },
      paymentId: { type: String, required: true },
      // Status Code? in text? RZP's docs are useful
      status: { type: String, required: true }
    }),
    required: false
  },
  // can be either AWAITING_PAYMENT, PAYMENT_NOT_CONFIRMED, PAID_AWAITING_SHIPMENT, SHIPPED, DELIVERED, ARCHIVED (?)
  status: { type: String, required: true },
  shipments: [{
    // null for now
    internalId: { type: mongoose.Schema.Types.Mixed, required: false },
    shippingCompany: { type: String, required: false },
    trackingID: { type: String, required: false }
  }],

  // Warehouse-only keys
  assignedWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' }
}, DEFAULT_MODEL_OPTIONS))

function initialize () {
  console.log('Connecting to MongoDB.')
  if (process.env.NODE_ENV !== 'production') {
    mongoose.set('debug', true)
  }
  return mongoose.connect(ConfigManager.getKey('services.mongodb', false) || process.env.WH_MONGODB_URL || 'mongodb://127.0.0.1:29001/whb', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true
  }).catch(e => {
    console.log('Caught err during MongoDB connection:', e)
    console.log('Exiting.')
    process.exit(1)
  }).then(k => console.log('Done connecting.'))
}

module.exports = {
  initialize,
  User,
  ForgotPasswordToken,
  Category,
  Order,
  Product,
  ProductCodes,
  CartProduct
}
