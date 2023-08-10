const { Schema, model } = require('mongoose');
const schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    purpose: {
      type: Array,
      required: true,
    },
    amount: {
      advance: {
        type: Number,
        required: false,
      },
      percentage: {
        type: Number,
        required: false,
      },
      extra: {
        type: Number,
        required: false,
      },
      type: Object,
      required: true,
    },
  },
  { timestamps: { createdAt: 'createdAt' } }
);
module.exports = model('Payment', schema);
