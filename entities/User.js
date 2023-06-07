const { Schema, model } = require('mongoose');

const roles = ['admin', 'worker', 'author', 'editor'];

const schema = new Schema({
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: false,
  },
  nickname: {
    type: String,
    required: false,
  },
  role: {
    type: String,
    required: true,
    enum: roles,
  },
  percentage: {
    type: Number,
    required: false,
  },
  amountPerVideo: {
    type: Number,
    required: false,
  },
});
module.exports = model('User', schema);
