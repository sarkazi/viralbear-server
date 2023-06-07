const ViewedMention = require('../entities/ViewedMention');

const addMentionView = async (actionTrelloId, workerNickname, trelloCardId) => {
  const newViewedMention = await ViewedMention.create({
    actionTrelloId,
    workerNickname,
    trelloCardId,
  });

  return newViewedMention;
};

const getAllViewedMentionsByUser = async (workerNickname) => {
  const viewedMentions = await ViewedMention.find({ workerNickname });

  return viewedMentions;
};

const findMentionByActionIn = async (actionTrelloId) => {
  const mention = await ViewedMention.findOne({ actionTrelloId });

  return mention;
};

module.exports = {
  addMentionView,
  getAllViewedMentionsByUser,
  findMentionByActionIn,
};
