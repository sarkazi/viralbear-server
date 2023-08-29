const { Schema, model } = require('mongoose');

const roles = [
  'admin',
  'researcher',
  'author',
  'editor',
  'stringer',
  'observer',
];
const paymentMethods = ['other', 'payPal', 'bankTransfer'];

const schema = new Schema({
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: false,
  },
  name: {
    type: String,
    required: true,
  },
  avatarUrl: {
    type: String,
    required: false,
  },
  nickname: {
    type: String,
    required: false,
  },
  role: {
    type: String,
    required: true,
    enum: roles,
  },
  position: {
    type: String,
    required: false,
  },
  percentage: {
    type: Number,
    required: false,
  },
  canBeAssigned: {
    type: Boolean,
    required: false,
  },
  displayOnTheSite: {
    type: Boolean,
    default: false,
    required: false,
  },
  advancePayment: {
    type: Number,
    required: false,
  },
  country: {
    type: String,
    required: false,
  },
  specifiedPaymentDetails: {
    type: Boolean,
    required: false,
  },
  sales: [{ type: Schema.Types.ObjectId, ref: 'Sales' }],

  balance: {
    type: Number,
    required: true,
    default: 0,
  },
  note: {
    type: Number,
    required: true,
    default: 0,
  },
  gettingPaid: {
    type: Number,
    required: true,
    default: 0,
  },

  paymentInfo: {
    required: false,
    variant: {
      type: String,
      enum: paymentMethods,
      required: false,
    },
    phoneNumber: {
      type: Number,
      required: false,
    },
    email: {
      type: String,
      required: false,
    },
    address: {
      type: String,
      required: false,
    },
    zipCode: {
      type: String,
      required: false,
    },
    bankName: {
      type: String,
      required: false,
    },
    fullName: {
      type: String,
      required: false,
    },
    iban: {
      type: String,
      required: false,
    },
    payPalEmail: {
      type: String,
      required: false,
    },
    value: {
      type: String,
      required: false,
    },
  },

  lastPaymentDate: {
    type: Date,
    required: false,
  },

  activatedTheAccount: {
    type: Boolean,
    required: false,
  },
});

module.exports = model('User', schema);
