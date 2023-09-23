const { Schema, model } = require('mongoose');

//const partners = [
//  'kameraone',
//  'tmb',
//  'aflo',
//  'videoelephant',
//  'newsflare',
//  'reuters',
//  'stringershub',
//];

const schema = new Schema(
  {
    videoId: {
      type: Number,
      required: false,
    },
    vbFormInfo: {
      uid: {
        type: Schema.Types.ObjectId,
        ref: 'UploadInfo',
        required: false,
      },
      paidFor: {
        type: Boolean,
        required: false,
      },
      amount: {
        type: Number,
        required: false,
      },
    },
    company: {
      type: String,
      required: false,
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
        paidFor: {
          name: Boolean,
          default: false,
        },
        type: Object,
      },
    ],
    videoTitle: {
      type: String,
      required: false,
    },
    amount: {
      type: Number,
      required: false,
    },
    report: {
      type: String,
      required: false,
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
      required: false,
    },
    toOverlapTheRemainder: {
      type: Boolean,
      default: false,
    },
    amountToResearcher: {
      type: Number,
      required: true,
    },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);
module.exports = model('Sales', schema);
