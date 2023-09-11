const MovedToDoneListSchema = require('../entities/MovedToDoneList');

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
  }).populate({
    path: 'researcherId',
    select: {
      nickname: 1,
      name: 1,
      email: 1,
      avatarUrl: 1,
      hiddenForEditor: 1,
    },
  });
};

module.exports = {
  writeNewMoveToDone,
  findTheRecordOfTheCardMovedToDone,
};
