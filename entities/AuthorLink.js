const { Schema, model } = require('mongoose');
const schema = new Schema({
  researcher: { type: Schema.Types.ObjectId, ref: 'User', required: true },
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
  formHash: {
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
