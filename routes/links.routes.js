const express = require('express');
const router = express.Router();
const moment = require('moment');

const authMiddleware = require('../middleware/auth.middleware');

const socketInstance = require('../socket.instance');

const {
  findBaseUrl,
  pullIdFromUrl,
  findLinkByVideoId,
  createNewLink,
  conversionIncorrectLinks,
} = require('../controllers/links.controller');

const {
  getUserById,
  updateUserByIncrement,
  getAllUsers,
  updateStatForUsers,
} = require('../controllers/user.controller');

const {
  createCardInTrello,
  findWorkersTrelloIds,
  getCardDataByCardId,
  updateCustomFieldByTrelloCard,
  definingValueOfCustomFieldReminderInTrello,
  calculatingTimeUntilNextReminder,
  updateTrelloCard,
} = require('../controllers/trello.controller');

const { findWorkersForCard } = require('../controllers/user.controller');

router.post('/sendLinkToTrello', authMiddleware, async (req, res) => {
  const { list, workers, reminders, title, authorNickname, link } = req.body;

  console.log(req.body, 888);

  const convertedLink = conversionIncorrectLinks(link);

  try {
    //const videoLink = await findBaseUrl(convertedLink);

    //if (!videoLink) {
    //  return res
    //    .status(400)
    //    .json({ message: 'Link is invalid', status: 'error' });
    //}

    const videoId = await pullIdFromUrl(convertedLink);

    if (!videoId) {
      return res
        .status(400)
        .json({ message: 'Link is invalid', status: 'error' });
    }

    const linkInfo = await findLinkByVideoId(videoId);

    if (linkInfo) {
      const trelloCardData = await getCardDataByCardId(linkInfo.trelloCardId);

      return res.status(200).json({
        status: 'warning',
        message: 'This video has already been added',
        apiData: {
          trelloCardData,
        },
      });
    }

    const selfWorker = await getUserById(req.user.id);

    if (!selfWorker) {
      return res
        .status(404)
        .json({ message: 'Worker not found', status: 'error' });
    }

    const foundWorkers = await findWorkersForCard(workers, selfWorker.name);

    if (!foundWorkers.length) {
      return res.status(404).json({
        message: 'Not a single user with the role of "worker" was found',
        status: 'error',
      });
    }

    const foundWorkersTrelloIds = await findWorkersTrelloIds(foundWorkers);

    if (!foundWorkersTrelloIds.length) {
      return res.status(404).json({
        message: 'Not a single employee was found in trello',
        status: 'error',
      });
    }

    const trelloResponseAfterCreatingCard = await createCardInTrello(
      authorNickname,
      title,
      convertedLink,
      list,
      foundWorkersTrelloIds
    );

    //if (reminders) {
    //  const reminderCustomFieldValue =
    //    await definingValueOfCustomFieldReminderInTrello(
    //      process.env.TRELLO_CUSTOM_FIELD_REMINDER,
    //      reminders
    //    );

    //  await updateCustomFieldByTrelloCard(
    //    trelloResponseAfterCreatingCard.id,
    //    process.env.TRELLO_CUSTOM_FIELD_REMINDER,
    //    { idValue: reminderCustomFieldValue.id }
    //  );

    //  const dateMlscUntilNextReminder = await calculatingTimeUntilNextReminder(
    //    reminderCustomFieldValue
    //  );

    //  const currentTime = moment().valueOf();

    //  await updateTrelloCard(trelloResponseAfterCreatingCard.id, {
    //    due: +dateMlscUntilNextReminder + +currentTime,
    //  });
    //}

    await createNewLink(
      selfWorker.email,
      selfWorker.name,
      selfWorker.nickname,
      title,
      authorNickname,
      convertedLink,
      videoId,
      trelloResponseAfterCreatingCard.url,
      trelloResponseAfterCreatingCard.id
    );

    return res.status(200).json({
      status: 'success',
      message: 'Video added and sent',
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ status: 'error', message: 'Server side error' });
  }
});

module.exports = router;
