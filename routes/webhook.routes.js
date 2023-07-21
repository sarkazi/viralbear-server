const express = require('express');
const router = express.Router();

const socketInstance = require('../socket.instance');

const { getUserBy } = require('../controllers/user.controller');
const {
  writeNewMoveToDone,
  findTheRecordOfTheCardMovedToDone,
} = require('../controllers/movedToDoneList.controller');

const {
  getTrelloCardsFromDoneListByApprovedAndNot,
  getPriorityCardByCardId,
  getCardLabelsByCardId,
  updateTrelloCard,
} = require('../controllers/trello.controller');

router.post('/trello/doneList', async (req, res) => {
  try {
    const allNecessaryLabelsForDoneCard = [
      process.env.TRELLO_LABEL_NOT_PUBLISHED,
      process.env.TRELLO_LABEL_IG_GROUP,
      process.env.TRELLO_LABEL_DONE,
    ];

    const changedData = req.body;

    //-----------------------------ловим перемещение в done list из любого другого-----------------------------------

    if (
      changedData?.action?.data?.listAfter &&
      changedData?.action?.data?.listBefore &&
      changedData.webhook.idModel === process.env.TRELLO_LIST_DONE_ID &&
      changedData?.action?.data?.listAfter?.name === 'Done'
    ) {
      console.log(`webhook "${changedData.webhook.description}" сработал`);

      //проверяем, существует ли уже запись в базе с этой карточкой

      const recordInTheDatabaseAboutTheMovedCard =
        await findTheRecordOfTheCardMovedToDone(
          changedData.action.data.card.id
        );

      //если не существует - записываем
      if (!recordInTheDatabaseAboutTheMovedCard) {
        const researcherUsernameInTrello =
          changedData.action.memberCreator.username;

        const researcherInDatabase = await getUserBy(
          'nickname',
          `@${researcherUsernameInTrello}`
        );

        //записываем событие о перемещенной карточке в базу
        await writeNewMoveToDone({
          researcherId: researcherInDatabase._id,
          listBefore: changedData.action.data.listBefore.name,
          trelloCardId: changedData.action.data.card.id,
        });
      }

      const cardId = changedData.action.data.card.id;

      //ищем все наклейки карточки
      const cardLabels = await getCardLabelsByCardId(cardId);

      //если нет ни одной наклейки в trello
      if (!cardLabels.length) {
        //проставляем все необходимые наклейки
        await updateTrelloCard(cardId, {
          idLabels: allNecessaryLabelsForDoneCard,
        });
      }

      //обновляем список для отправки на клиент
      const { doneTasks, approvedTasks } =
        await getTrelloCardsFromDoneListByApprovedAndNot();

      const { priority } = await getPriorityCardByCardId(cardId);

      socketInstance
        .io()
        .emit('movingCardToDone', { doneTasks, approvedTasks, priority });
    }

    //---------------------------------------------------------------------------------------------------------------

    return res.status(200).json({ status: 'success' });
  } catch (err) {
    console.log(err);
    return res.status(200).json({ status: 'error' });
  }
});

module.exports = router;