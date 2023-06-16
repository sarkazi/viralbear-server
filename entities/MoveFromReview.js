const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    user: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);
module.exports = model('MovedFromReview', schema);
