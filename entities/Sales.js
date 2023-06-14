const { Schema, model } = require('mongoose');
const schema = new Schema(
  {
    researchers: {
      names: {
        type: Array,
        required: true,
      },
      emails: {
        type: Array,
        required: true,
      },
    },
    videoId: {
      type: String,
      required: true,
    },
    company: {
      type: String,
      required: true,
    },
    videoTitle: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    usage: {
      type: String,
      required: false,
    },
    manual: {
      type: Boolean,
      required: true,
    },
    amountToResearcher: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);
module.exports = model('Sales', schema);
