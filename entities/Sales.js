const { Schema, model } = require('mongoose');
const schema = new Schema(
  {
    videoId: {
      type: String,
      required: true,
    },
    company: {
      type: String,
      required: true,
    },
    researchers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
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
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);
module.exports = model('Sales', schema);
