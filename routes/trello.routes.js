const express = require('express');
const router = express.Router();
const moment = require('moment');
const trelloInstance = require('../api/trello.instance');

const {
  getAllCommentsByBoard,
  getTrelloCardsFromDoneListByApprovedAndNot,
  getAllCardsByListId,
  getAllMembers,
  getCardDataByCardId,
} = require('../controllers/trello.controller');
const { getUserById, getAllUsers } = require('../controllers/user.controller');
const {
  getAllViewedMentionsByUser,
} = require('../controllers/viewedMention.controller');

const { findOne } = require('../controllers/uploadInfo.controller');

const authMiddleware = require('../middleware/auth.middleware');

router.get('/findMentionsByEmployee', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);

    if (!user) {
      return res
        .status(200)
        .json({ message: 'Worker is not found', status: 'warning' });
    }

    const responseTrello = await getAllCommentsByBoard();

    if (responseTrello.data.length === 0) {
      return res
        .status(responseTrello.status)
        .json({ message: 'No comments found in trello', status: 'warning' });
    }

    const allViewedMentionsCurrentUser = await getAllViewedMentionsByUser(
      user.nickname
    );

    const commentsMentioningByUser = responseTrello.data
      .filter((comment) => {
        return comment.data.text.includes(user.nickname);
      })
      .map((comment) => {
        return {
          actionId: comment.id,
          textOfComment: comment.data.text.replace(user.nickname, ''),
          cardId: comment.data.card.id,
          cardUrl: `https://trello.com/c/${comment.data.card.shortLink}/`,
        };
      })
      .filter((comment) => {
        return allViewedMentionsCurrentUser.every((viewMention) => {
          return viewMention.actionTrelloId !== comment.actionId;
        });
      });

    return res.status(200).json({
      message: `${commentsMentioningByUser.length} cards with the mention of ${user.nickname} were found`,
      status: 'success',
      apiData: {
        cards: commentsMentioningByUser,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      message: 'server side error',
      status: 'error',
    });
  }
});

router.get('/findCardsFromDoneList', authMiddleware, async (req, res) => {
  try {
    const cards = await getTrelloCardsFromDoneListByApprovedAndNot();

    return res.status(200).json({
      message: 'Cards from the "done" list have been received',
      status: 'success',
      apiData: cards,
    });
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      message: 'Error when receiving cards from the "done" list',
      status: 'error',
    });
  }
});

router.get(
  '/findOverdueCardsFromDoneList',
  authMiddleware,
  async (req, res) => {
    try {
      const currentUserId = req.user.id;

      const doneCardsFromTrello = await getAllCardsByListId(
        process.env.TRELLO_LIST_DONE_ID
      );

      const currentWorker = await getUserById(currentUserId);

      if (!currentWorker) {
        return res.status(404).json({
          message: 'User not found',
          status: 'error',
        });
      }

      const overdueCards = doneCardsFromTrello.filter((card) => {
        return (
          card.due &&
          card.dueComplete === false &&
          moment(card.due).toDate() < moment().toDate() &&
          card.members.find(
            (member) =>
              member.username === currentWorker.nickname.replace('@', '')
          )
        );
      });

      return res.status(200).json({
        message: 'Expired cards have been received',
        status: 'success',
        apiData: overdueCards,
      });
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        message: 'Server side error',
        status: 'error',
      });
    }
  }
);

router.get('/findOne/:trelloCardId', authMiddleware, async (req, res) => {
  try {
    const { trelloCardId } = req.params;

    const trelloCard = await getCardDataByCardId(trelloCardId);

    const trelloNicknames = trelloCard.members.map((el) => {
      return `@${el.username}`;
    });

    const researchers = await getAllUsers({
      me: true,
      roles: ['researcher'],
      fieldsInTheResponse: ['nickname', 'name'],
      nicknames: trelloNicknames,
    });

    let vbForm = null;
    const vbCode = trelloCard.customFieldItems.find(
      (customField) => customField.idCustomField === '63e659f754cea8f9978e3b63'
    )?.value?.number;

    if (vbCode) {
      vbForm = await findOne({ searchBy: 'formId', param: `VB${vbCode}` });
    }

    const apiData = {
      ...(vbForm && {
        vbCode: +vbForm.formId.replace('VB', ''),
        agreementLink: vbForm.agreementLink,
        ...(vbForm?.sender && { authorEmail: vbForm.sender.email }),
        ...(vbForm?.whereFilmed && { whereFilmed: vbForm.whereFilmed }),
        ...(vbForm?.whyDecide && { whyDecide: vbForm.whyDecide }),
        ...(vbForm?.whatHappen && { whatHappen: vbForm.whatHappen }),
        ...(vbForm?.whenFilmed && { whenFilmed: vbForm.whenFilmed }),
        ...(vbForm?.whoAppears && { whoAppears: vbForm.whoAppears }),

        ...(vbForm?.refFormId && {
          percentage: vbForm.refFormId.percentage,
          advancePayment: vbForm.refFormId.advancePayment,
        }),
      }),
      url: trelloCard.url,
      id: trelloCard.id,
      name: trelloCard.name,
      desc: trelloCard.desc,
      priority: trelloCard.customFieldItems.find(
        (el) => el.idValue === '62c7e0032a86d7161f8cadb2'
      )
        ? true
        : false,
      researchers: researchers.map((researcher) => {
        return researcher.name;
      }),
      exclusivity: !vbForm?.refFormId
        ? true
        : vbForm.refFormId.exclusivity
        ? true
        : false,
    };

    return res.status(200).json({
      message: 'Trello card data received',
      status: 'success',
      apiData,
    });
  } catch (err) {
    console.log(err);
    return res.status(400).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.get('/getAllNicknamesByMembers', async (req, res) => {
  try {
    const allMembers = await getAllMembers();

    const nicknames = allMembers.map((member) => {
      return member.username;
    });

    return res.status(200).json({
      message: 'The nicknames of trello members have been received',
      status: 'status',
      apiData: nicknames,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

module.exports = router;
