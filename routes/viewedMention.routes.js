const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth.middleware');

const {
  addMentionView,
  findMentionByActionIn,
} = require('../controllers/viewedMention.controller');

const { getUserById } = require('../controllers/user.controller');

router.post('/add', authMiddleware, async (req, res) => {
  const { actionTrelloIds, trelloCardId } = req.body;

  try {
    const currentWorker = await getUserById(req.user.id);

    if (!currentWorker) {
      return res
        .status(404)
        .json({ message: 'Worker not found', status: 'error' });
    }

    const freshActionTrelloIds = await Promise.all(
      actionTrelloIds.map(async (actionId) => {
        const mention = await findMentionByActionIn(actionId);
        if (!mention) {
          return actionId;
        }
      })
    );

    const newViewedMentions = await Promise.all(
      freshActionTrelloIds.map(async (actionId) => {
        return await addMentionView(
          actionId,
          currentWorker.nickname,
          trelloCardId
        );
      })
    );

    res.status(200).json({
      message: `Information about viewing the card "${trelloCardId}" has been added to the database`,
      status: 'success',
      apiData: { newViewedMentions },
    });
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.get('/findOne/:actionId', async (req, res) => {
  const { actionId } = req.params;

  try {
    const mention = await findMentionByActionIn(actionId);

    if (!mention) {
      return res.status(404).json({
        message: `Comment with action "${actionId}" not found`,
        status: 'warning',
      });
    }

    return res.status(200).json({
      message: `comment with id ${actionId} found`,
      status: 'success',
      apiData: mention,
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.post('/markEverythingAsRead', authMiddleware, async (req, res) => {
  try {
    const currentWorker = await getUserById(req.user.id);

    if (!currentWorker) {
      return res
        .status(404)
        .json({ message: 'Worker not found', status: 'error' });
    }

    const mentionsCards = req.body;

    const responseAfterMarkingAllAsRead = await Promise.all(
      mentionsCards.map(async (card) => {
        return await addMentionView(
          card.actionId,
          currentWorker.nickname,
          card.cardId
        );
      })
    );

    res
      .status(200)
      .json({ message: 'All mentions are marked as read', status: 'success' });
  } catch (err) {
    console.log(err);
    res.status(400).json({ message: 'Server side error', status: 'error' });
  }
});

module.exports = router;
