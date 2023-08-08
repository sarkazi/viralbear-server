const { Schema, model } = require('mongoose');
const schema = new Schema(
  {
    researcher: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorsNick: {
      type: String,
      required: false,
    },
    title: {
      type: String,
      required: false,
    },
    link: {
      type: String,
      required: true,
    },
    unixid: {
      type: String,
      required: true,
    },
    trelloCardUrl: {
      type: String,
      required: true,
    },
    trelloCardId: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);
module.exports = model('Links', schema);
