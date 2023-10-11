const MovedFromReviewListSchema = require('../entities/MovedFromReviewList');

const moment = require('moment');

const writeNewMoveFromReview = async ({
  researcherId,
  listAfter,
  trelloCardId,
}) => {
  return await MovedFromReviewListSchema.create({
    researcherId,
    trelloCardId,
    listAfter,
  });
};

const findTheRecordOfTheCardMovedFromReview = async (trelloCardId) => {
  return await MovedFromReviewListSchema.findOne({
    trelloCardId,
  });
};

const getCountApprovedTrelloCardBy = async ({
  searchBy,
  value,
  forLastDays,
}) => {
  return await MovedFromReviewListSchema.find({
    [searchBy]: value,
    ...(forLastDays && {
      createdAt: {
        $gte: moment().utc().subtract(forLastDays, 'd').startOf('d').valueOf(),
      },
    }),
  })
    .countDocuments()
    .sort({ $natural: -1 });
};

const getApprovedTrelloCardBy = async ({ searchBy, value, forLastDays }) => {
  return await MovedFromReviewListSchema.find({
    [searchBy]: value,
    ...(forLastDays && {
      createdAt: {
        $gte: moment().utc().subtract(forLastDays, 'd').startOf('d').valueOf(),
      },
    }),
  }).sort({ $natural: -1 });
};

module.exports = {
  writeNewMoveFromReview,
  findTheRecordOfTheCardMovedFromReview,
  getCountApprovedTrelloCardBy,
  getApprovedTrelloCardBy,
};
