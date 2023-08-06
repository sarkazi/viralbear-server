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
  });
};

module.exports = {
  writeNewMoveToDone,
  findTheRecordOfTheCardMovedToDone,
};
