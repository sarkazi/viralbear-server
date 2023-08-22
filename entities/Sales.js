const { Schema, model } = require('mongoose');

const partners = [
  'kameraone',
  'tmb',
  'aflo',
  'videoelephant',
  'newsflare',
  'reuters',
  'stringershub',
];

const schema = new Schema(
  {
    videoId: {
      type: Number,
      required: true,
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
    },
    company: {
      type: String,
      required: true,
      enum: partners,
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
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    report: {
      type: String,
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
