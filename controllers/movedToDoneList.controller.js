const MovedToDoneListSchema = require('../entities/MovedToDoneList');

const moment = require('moment');

const writeNewMoveToDone = async ({
  researcherId,
  listBefore,
  trelloCardId,
}) => {
  return await MovedToDoneListSchema.create({
    researcherId,
    trelloCardId,
    listBefore,
  });
};

const findTheRecordOfTheCardMovedToDone = async (trelloCardId) => {
  return await MovedToDoneListSchema.findOne({
    trelloCardId,
  });
};

const getCountApprovedTrelloCardBy = async ({
  searchBy,
  value,
  forLastDays,
}) => {
  return await MovedToDoneListSchema.find({
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

module.exports = {
  writeNewMoveToDone,
  findTheRecordOfTheCardMovedToDone,
  getCountApprovedTrelloCardBy,
};
