const { Schema, model } = require('mongoose');
const schema = new Schema(
  {
    researchers: {
      type: Array,
      required: true,
    },
    videoId: {
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
      required: true,
    },
    saleId: {
      type: String,
      required: false,
    },
    manual: {
      type: Boolean,
      required: true,
    },
  },
  { timestamps: true }
);
module.exports = model('Sales', schema);
