const { Schema, model } = require('mongoose');
const schema = new Schema({
  worker: {
    nickname: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
  },
  advancePayment: {
    type: Number,
    required: false,
  },
  percentage: {
    type: Number,
    required: false,
  },
  videoLink: {
    type: String,
    required: true,
  },
  videoId: {
    type: String,
    required: true,
  },
  formLink: {
    type: String,
    required: true,
  },
  formId: {
    type: String,
    required: true,
  },
  used: {
    type: Boolean,
    default: false,
  },
  exclusivity: {
    type: Boolean,
    required: true,
  },
});

module.exports = model('AuthorLink', schema);
