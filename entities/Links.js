const { Schema, model } = require('mongoose');
const schema = new Schema({
  email: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  nick: {
    type: String,
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
});
module.exports = model('Links', schema);
