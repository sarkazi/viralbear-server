const { Schema, model } = require('mongoose');
const schema = new Schema({
  researcher: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  researcherIsSelectedByAuthor: {
    type: Boolean,
    default: false,
  },
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
  formHash: {
    type: String,
    required: false,
  },
  paid: {
    type: Boolean,
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
