const MoveFromReview = require('../entities/MoveFromReview');
const moment = require('moment');

const createNewMove = async (objDB) => {
  return await MoveFromReview.create(objDB);
};

const getCountApprovedTrelloCardByNickname = async (userValue, dateLimit) => {
  return await MoveFromReview.find({
    user: userValue,
    createdAt: {
      $gte: moment().utc().subtract(dateLimit, 'd').startOf('d').valueOf(),
    },
  })
    .countDocuments()
    .sort({ pubDate: -1 });
};

module.exports = { createNewMove, getCountApprovedTrelloCardByNickname };
