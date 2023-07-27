const express = require('express');
const router = express.Router();
const moment = require('moment');
const trelloInstance = require('../api/trello.instance');

const {
  getAllCommentsByBoard,
  getAllCardsByListId,
  getAllMembers,
  getCardDataByCardId,
} = require('../controllers/trello.controller');
const { getUserById, getAllUsers } = require('../controllers/user.controller');
const {
  getAllViewedMentionsByUser,
} = require('../controllers/viewedMention.controller');

const { findOne } = require('../controllers/uploadInfo.controller');

const {
  findReadyForPublication,
  findByFixed,
} = require('../controllers/video.controller');

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
    const prePublishingVideos = await findReadyForPublication();
    const videosWithUnfixedEdits = await findByFixed();

    const doneCardsFromTrello = await getAllCardsByListId(
      process.env.TRELLO_LIST_DONE_ID
    );

    const requiredCards = doneCardsFromTrello.filter((card) => {
      return (
        card.labels.some((label) => label.id === '61a1d74565c249483548bf9a') &&
        card.labels.some((label) => label.id === '6243c7bd3718c276cb21e2cb')
      );
    });

    let summaryData = await Promise.all(
      requiredCards.map(async (card) => {
        let vbForm = null;

        if (
          card.customFieldItems.find(
            (el) => el.idCustomField === '63e659f754cea8f9978e3b63'
          )
        ) {
          const vbFormId = card.customFieldItems.find(
            (el) => el.idCustomField === '63e659f754cea8f9978e3b63'
          ).value.number;

          vbForm = await findOne({
            searchBy: 'formId',
            param: `VB${vbFormId}`,
          });
        }

        return {
          id: card.id,
          name:
            card.name.length >= 20
              ? card.name.substring(0, 20) + '...'
              : card.name,
          priority: card.customFieldItems.find(
            (customField) => customField.idValue === '62c7e0032a86d7161f8cadb2'
          )
            ? true
            : false,

          hasAdvance:
            vbForm && vbForm?.refFormId?.advancePayment ? true : false,
          list: card.customFieldItems.find(
            (customField) => customField.idValue === '6360c514c95f85019ca4d612'
          )
            ? 'approve'
            : 'done',
          url: card.url,
        };
      })
    );

    summaryData = summaryData.reduce(
      (res, card) => {
        res[card.list === 'approve' ? 'approve' : 'done'].push(card);
        return res;
      },
      { approve: [], done: [] }
    );

    const apiData = {
      doneTasks: summaryData.done,
      approvedTasks: summaryData.approve
        .filter((approvedCard) => {
          return prePublishingVideos.every((video) => {
            return approvedCard.id !== video.trelloData.trelloCardId;
          });
        })
        .filter((approvedCard) => {
          return videosWithUnfixedEdits.every((video) => {
            return approvedCard.id !== video.trelloData.trelloCardId;
          });
        }),
    };

    return res.status(200).json({
      message: 'Cards from the "done" list have been received',
      status: 'success',
      apiData,
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
