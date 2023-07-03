const { Schema, model } = require('mongoose');
const schema = new Schema(
  {
    videoId: {
      type: Number,
      required: true,
    },
    vbForm: { type: Schema.Types.ObjectId, ref: 'UploadInfo' },
    company: {
      type: String,
      required: true,
    },
    researchers: [
      {
        id: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        name: {
          name: String,
        },
        type: Object,
      },
    ],
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
    amountToResearchers: {
      type: Number,
      required: true,
    },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);
module.exports = model('Sales', schema);
