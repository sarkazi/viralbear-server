const { Schema, model } = require('mongoose');
const schema = new Schema(
  {
    email: {
      type: String,
      required: true,
    },
    hash: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);
module.exports = model('RecoveryLinks', schema);
