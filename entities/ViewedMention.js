const { Schema, model } = require('mongoose');
const schema = new Schema({
  actionTrelloId: {
    type: String,
    required: true,
  },
  workerNickname: {
    type: String,
    required: true,
  },
  trelloCardId: {
    type: String,
    required: true,
  },
});
module.exports = model('ViewedMention', schema);
