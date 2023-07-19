const { Schema, model } = require('mongoose');

const roles = ['admin', 'researcher', 'author', 'editor', 'stringer'];
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
  nickname: {
    type: String,
    required: false,
  },
  role: {
    type: String,
    required: true,
    enum: roles,
  },
  percentage: {
    type: Number,
    required: false,
  },
  canBeAssigned: {
    type: Boolean,
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

  //earnedForCompany: {
  //  type: Number,
  //  required: true,
  //  default: 0,
  //},
  //earnedTotal: {
  //  type: Number,
  //  //required: true,
  //  //default: 0,
  //},
  //earnedForYourself: {
  //  total: {
  //    type: Number,
  //    required: true,
  //    default: 0,
  //  },
  //  dateLimit: {
  //    type: Number,
  //    required: true,
  //    default: 0,
  //  },
  //},
  //sentVideosCount: {
  //  total: {
  //    type: Number,
  //    required: true,
  //    default: 0,
  //  },
  //  dateLimit: {
  //    type: Number,
  //    required: true,
  //    default: 0,
  //  },
  //},
  //approvedVideosCount: {
  //  total: {
  //    type: Number,
  //    required: true,
  //    default: 0,
  //  },
  //  dateLimit: {
  //    type: Number,
  //    required: true,
  //    default: 0,
  //  },
  //},
  //acquiredVideosCount: {
  //  total: {
  //    type: Number,
  //    required: true,
  //    default: 0,
  //  },
  //  dateLimit: {
  //    type: Number,
  //    required: true,
  //    default: 0,
  //  },
  //},
  //defaultPaymentAmount: {
  //  type: Number,
  //  required: true,
  //  default: 0,
  //},
  //earnedTillNextPayment: {
  //  type: Number,
  //  required: true,
  //  default: 0,
  //},
});

module.exports = model('User', schema);
