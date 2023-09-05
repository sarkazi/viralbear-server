const mongoose = require('mongoose');

const convertInMongoIdFormat = ({ string }) => {
  return mongoose.Types.ObjectId(string);
};

module.exports = { convertInMongoIdFormat };
