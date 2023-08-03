const { Schema, model } = require('mongoose');
const schema = new Schema({
  researcher: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  advancePayment: {
    type: Number,
    required: true,
  },
  percentage: {
    type: Number,
    required: true,
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
  trelloCardUrl: {
    type: String,
    required: false,
  },
});

module.exports = model('AuthorLink', schema);
