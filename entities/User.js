const { Schema, model } = require('mongoose');

const roles = ['admin', 'worker', 'author', 'editor'];

const schema = new Schema({
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  name: {
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
  referer: {
    type: String,
    required: false,
  },
  percentage: {
    type: Number,
    required: true,
    default: 0,
  },
  amountPerVideo: {
    type: Number,
    required: true,
    default: 0,
  },
  country: {
    type: String,
    required: false,
  },
  balance: {
    type: Number,
    required: true,
    default: 0,
  },
  earnedForCompany: {
    type: Number,
    required: true,
    default: 0,
  },
  earnedTotal: {
    type: Number,
    required: true,
    default: 0,
  },
  earnedForYourself: {
    total: {
      type: Number,
      required: true,
      default: 0,
    },
    dateLimit: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  sentVideosCount: {
    total: {
      type: Number,
      required: true,
      default: 0,
    },
    dateLimit: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  approvedVideosCount: {
    total: {
      type: Number,
      required: true,
      default: 0,
    },
    dateLimit: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  acquiredVideosCount: {
    total: {
      type: Number,
      required: true,
      default: 0,
    },
    dateLimit: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  lastPaymentDate: {
    type: Date,
    required: false,
  },
  defaultPaymentAmount: {
    type: Number,
    required: true,
    default: 0,
  },
  earnedTillNextPayment: {
    type: Number,
    required: true,
    default: 0,
  },
});
module.exports = model('User', schema);
