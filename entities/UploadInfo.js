const { Schema, model, now } = require('mongoose');
const schema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    videoLinks: {
      type: [String],
      required: true,
    },
    didYouRecord: {
      type: Boolean,
      required: true,
    },
    operator: {
      type: String,
      required: false,
    },
    advancePaymentReceived: {
      type: Boolean,
      required: false,
    },
    noSubmitAnywhere: {
      type: Boolean,
      required: true,
    },
    resources: {
      type: Array,
      required: false,
    },
    over18YearOld: {
      type: Boolean,
      required: true,
    },
    agreedWithTerms: {
      type: Boolean,
      required: true,
    },
    didNotGiveRights: {
      type: Boolean,
      required: true,
    },
    ip: {
      type: String,
      required: true,
    },
    formId: {
      type: String,
      required: true,
    },

    agreementLink: {
      type: String,
      required: false,
    },
    whereFilmed: {
      type: String,
      required: false,
    },

    whenFilmed: {
      type: String,
      required: false,
    },
    whoAppears: {
      type: String,
      required: false,
    },
    whyDecide: {
      type: String,
      required: false,
    },
    whatHappen: {
      type: String,
      required: false,
    },
    refFormId: {
      type: Schema.Types.ObjectId,
      ref: 'AuthorLink',
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = model('UploadInfo', schema);
