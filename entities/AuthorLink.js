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
    required: false,
  },
  videoId: {
    type: String,
    required: false,
  },
  formLink: {
    type: String,
    required: false,
  },
  formId: {
    type: String,
    required: false,
  },
  used: {
    type: Boolean,
    default: false,
  },
});

module.exports = model('AuthorLink', schema);
