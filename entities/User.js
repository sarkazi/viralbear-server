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
    required: true,
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
  earnedForYourself: {
    type: Number,
    required: true,
    default: 0,
  },
  sentVideosCount: {
    type: Number,
    required: true,
    default: 0,
  },
  approvedVideosCount: {
    type: Number,
    required: true,
    default: 0,
  },
  acquiredVideosCount: {
    type: Number,
    required: true,
    default: 0,
  },
});
module.exports = model('User', schema);
