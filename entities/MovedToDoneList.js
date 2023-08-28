const { Schema, model } = require('mongoose');

const schema = new Schema(
  {
    trelloCardId: {
      type: String,
      required: true,
    },
    //listBefore: {
    //  type: String,
    //  required: true,
    //},
    researcherId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);
module.exports = model('MovedToDoneList', schema);
