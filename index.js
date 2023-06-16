const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const mongoose = require('mongoose');
const dotenv = require('dotenv').config();
const cookieParser = require('cookie-parser');
const socketInstance = require('./socket.instance');
const moment = require('moment');

const {
  getTrelloCardsFromDoneListByApprovedAndNot,
  getPriorityCardByCardId,
  getCardDataByCardId,
  getTrelloCardsFromMonthlyGoalsList,
  createNewAttachmentForTrelloCard,
  createNewChecklistItemForTrelloCard,
  getAllChecklistsByTrelloCardId,
  getAllCommentsByBoard,
  getCardLabelsByCardId,
  updateTrelloCard,
  calculatingTimeUntilNextReminder,
  removeLabelFromTrelloCard,
  getCustomField,
  getTrelloMemberById,
} = require('./controllers/trello.controller');

const { createNewMove } = require('./controllers/moveFromReview.controller');

const {
  updateUserByIncrement,
  getWorkers,
} = require('./controllers/user.controller');

mongoose.set('strictQuery', false);

const videoRouter = require('./routes/video.routes');
const uploadInfoRouter = require('./routes/uploadInfo.routes');
const sendMailRouter = require('./routes/sendEmail.routes');
const userRouter = require('./routes/user.routes');
const LinksRouter = require('./routes/links.routes');
const trelloRouter = require('./routes/trello.routes');
const authRouter = require('./routes/auth.routes');
const viewedMentionsRouter = require('./routes/viewedMention.routes');
const authorLinkRouter = require('./routes/authorLink.routes');
const salesRouter = require('./routes/sales.routes');
const locationRouter = require('./routes/location.routes');

app.use(cors());

app.use(express.static('mrssFiles'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
app.use(express.json({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, 'ejs'));
app.use(express.static(path.join(__dirname, 'build')));

const socketServer = require('http').createServer(app);

socketInstance.initialize(socketServer);

//socketInstance.io().on('connection', (socket) => {
//  console.log('client connected: ', socket.id);

//  socket.on('disconnect', (reason) => {
//    console.log(reason);
//  });
//});

socketInstance.io().sockets.on('connection', (socket) => {
  socket.on('createRoom', (data) => {
    socket.join(data.userId);
    console.log(socketInstance.io().sockets.adapter.rooms, 'rooms');
  });
});

socketServer.listen(9999, () => {
  console.log(`listening`);
});

app.use(cookieParser());

app.use('/video', videoRouter);
app.use('/uploadInfo', uploadInfoRouter);
app.use('/sendEmail', sendMailRouter);
app.use('/users', userRouter);
app.use('/links', LinksRouter);
app.use('/trello', trelloRouter);
app.use('/auth', authRouter);
app.use('/viewedMentions', viewedMentionsRouter);
app.use('/authorLink', authorLinkRouter);
app.use('/sales', salesRouter);
app.use('/location', locationRouter);

app.post('/trelloCallback', async (req, res) => {
  const allNecessaryLabelsForDoneCard = [
    process.env.TRELLO_LABEL_NOT_PUBLISHED,
    process.env.TRELLO_LABEL_IG_GROUP,
    process.env.TRELLO_LABEL_DONE,
  ];

  try {
    //ловим проставление наклейки "done" в карточке
    if (
      req?.body?.action?.type === 'addLabelToCard' &&
      req?.body?.action?.data?.label?.name === 'Done'
    ) {
      const cardId = req.body.action.data.card.id;

      //перемещаем карточку в лист "done" и проставляем все необходимые наклейки
      await updateTrelloCard(cardId, {
        idList: process.env.TRELLO_LIST_DONE_ID,
        idLabels: [
          process.env.TRELLO_LABEL_NOT_PUBLISHED,
          process.env.TRELLO_LABEL_IG_GROUP,
          process.env.TRELLO_LABEL_DONE,
        ],
      });

      //обновляем карточки для "done" и "approved" для клиента
      const { doneTasks, approvedTasks } =
        await getTrelloCardsFromDoneListByApprovedAndNot();

      //узнаем "priority" карточки

      const { priority } = await getPriorityCardByCardId(
        req.body.action.data.card.id
      );

      socketInstance
        .io()
        .emit('movingCardToDone', { doneTasks, approvedTasks, priority });
    }
    //ловим попадание карточки в лист "done" из любого другого списка
    if (
      req?.body?.action?.data?.listAfter &&
      req?.body?.action?.data?.listAfter?.name === 'Done' &&
      req?.body?.model?.name === 'Done'
    ) {
      const cardId = req.body.action.data.card.id;

      //ищем все наклейки карточки
      const cardLabels = await getCardLabelsByCardId(cardId);

      //если нет ни одной наклейки в trello
      if (!cardLabels.length) {
        //проставляем все необходимые наклейки
        await updateTrelloCard(cardId, {
          idLabels: allNecessaryLabelsForDoneCard,
        });

        const { doneTasks, approvedTasks } =
          await getTrelloCardsFromDoneListByApprovedAndNot();

        const { priority } = await getPriorityCardByCardId(cardId);

        socketInstance
          .io()
          .emit('movingCardToDone', { doneTasks, approvedTasks, priority });
      }

      //если есть все необходимые наклейки
      if (
        cardLabels.every((cardLabel) => {
          return allNecessaryLabelsForDoneCard.find((label) => {
            return label === cardLabel.id;
          });
        })
      ) {
        const { doneTasks, approvedTasks } =
          await getTrelloCardsFromDoneListByApprovedAndNot();

        const { priority } = await getPriorityCardByCardId(cardId);

        socketInstance
          .io()
          .emit('movingCardToDone', { doneTasks, approvedTasks, priority });
      }

      ////ищем месячную карточку работника, который переместил карточку в done

      //const initiatorId = req.body.action.memberCreator.id;

      //const cardsInMonthlyGoalsList =
      //  await getTrelloCardsFromMonthlyGoalsList();

      //const foundMonthlyCardByInitiator = cardsInMonthlyGoalsList.find(
      //  (card) => card.members[0].id === initiatorId
      //);

      ////определяем id перемещенной карточки

      //const newCardId = req.body.action.data.card.id;

      ////определяем url перемещенной карточки

      //const newCardLink = `https://trello.com/c/${req.body.action.data.card.shortLink}/`;

      ////определяем url месячной карточки работника

      //const bodyForAttachment = {
      //  url: foundMonthlyCardByInitiator.url,
      //};

      ////устанавливаем связь в перемещенной карточке с месячной карточкой (attachment)

      //const newAttachment = await createNewAttachmentForTrelloCard(
      //  newCardId,
      //  bodyForAttachment
      //);

      ////ищем все чеклисты в месячной карточке работника

      //const allChecklistsByMonthlyCard = await getAllChecklistsByTrelloCardId(
      //  foundMonthlyCardByInitiator.id
      //);

      ////ищем нужный чеклист (который содержит ссылки на все перемещенные работником видео)

      //const targetChecklist = allChecklistsByMonthlyCard.find((checklist) =>
      //  checklist.name.includes('per month')
      //);

      ////проставляем в найденном чеклисте ссылку на перемещенную карточку

      //const newChecklistItem = await createNewChecklistItemForTrelloCard(
      //  targetChecklist.id,
      //  newCardLink
      //);
    }

    //ловим смену статуса в кастомном поле "status" в листе "done"
    if (req?.body?.action?.data?.customField?.name === 'Status') {
      const cardId = req.body.action.data.card.id;

      const cardData = await getCardDataByCardId(cardId);

      if (cardData.idList === '61a1c05f03075c0ea01b62af') {
        const cardLabels = await getCardLabelsByCardId(cardId);

        if (
          cardLabels.every((cardLabel) => {
            return allNecessaryLabelsForDoneCard.find((label) => {
              return label === cardLabel.id;
            });
          })
        ) {
          const { doneTasks, approvedTasks } =
            await getTrelloCardsFromDoneListByApprovedAndNot();

          socketInstance
            .io()
            .emit('changingStatusInCustomField', { doneTasks, approvedTasks });
        }
      }
    }

    //ловим проставление приоритета в кастомном поле "priority" в листе "done"
    if (req?.body?.action?.data?.customField?.name === 'Priority') {
      const cardId = req.body.action.data.card.id;

      const cardData = await getCardDataByCardId(cardId);
      if (cardData.idList === process.env.TRELLO_LIST_DONE_ID) {
        const cardLabels = await getCardLabelsByCardId(cardId);

        if (
          cardLabels.every((cardLabel) => {
            return allNecessaryLabelsForDoneCard.find((label) => {
              return label === cardLabel.id;
            });
          })
        ) {
          const { doneTasks, approvedTasks } =
            await getTrelloCardsFromDoneListByApprovedAndNot();

          const priority =
            req.body.action.data.old.idValue === null ? true : false;

          socketInstance.io().emit('changingPriorityInCustomField', {
            doneTasks,
            approvedTasks,
            priority,
          });
        }
      }
    }

    //ловим снятие наклейки "not published" в листе "done"
    if (
      req?.body?.action?.type === 'removeLabelFromCard' &&
      req?.body?.action?.data?.text === 'Not published'
    ) {
      const cardData = await getCardDataByCardId(req.body.action.data.card.id);

      if (cardData.idList === '61a1c05f03075c0ea01b62af') {
        const { doneTasks, approvedTasks } =
          await getTrelloCardsFromDoneListByApprovedAndNot();

        socketInstance.io().emit('changingNotPublishedLabel', {
          doneTasks,
          approvedTasks,
        });
      }
    }

    //ловим перемещение карточки из листа "done" в другой
    if (
      req?.body?.action?.data?.listBefore &&
      req?.body?.action?.data?.listBefore?.name === 'Done' &&
      req?.body?.action?.data?.listAfter &&
      req?.body?.action?.data?.listAfter?.name !== 'Done' &&
      req?.body?.model?.name === 'Done'
    ) {
      const { doneTasks, approvedTasks } =
        await getTrelloCardsFromDoneListByApprovedAndNot();

      socketInstance.io().emit('movingFromDone', {
        doneTasks,
        approvedTasks,
      });
    }

    //ловим перемещение карточки из листа "Your videos for review" в другой
    if (
      req?.body?.action?.data?.listBefore &&
      req?.body?.action?.data?.listBefore?.id ===
        process.env.TRELLO_LIST_REVIEW_ID &&
      req?.body?.action?.data?.listAfter &&
      req?.body?.action?.data?.listAfter?.id !==
        process.env.TRELLO_LIST_REVIEW_ID
    ) {
      const memberCreatorId = req.body.action.memberCreator.id;

      console.log(memberCreatorId, 8789);

      const memberCreatorData = await getTrelloMemberById(memberCreatorId);

      const objDB = {
        user: `@${memberCreatorData.username}`,
      };

      await createNewMove(objDB);

      //await updateUserByIncrement(
      //  'nickname',
      //  [`@${memberCreatorData.username}`],
      //  {
      //    approvedVideosCount: 1,
      //  }
      //);

      //const workers = await getWorkers(true, null);

      //socketInstance.io().emit('changeUsersStatistics', workers);
    }

    //ловим архивирование карточки в листе "done"
    if (
      req?.body?.action?.data?.card?.closed === true &&
      req?.body?.model?.name === 'Done'
    ) {
      const cardData = await getCardDataByCardId(req.body.action.data.card.id);

      if (cardData.idList === '61a1c05f03075c0ea01b62af') {
        const { doneTasks, approvedTasks } =
          await getTrelloCardsFromDoneListByApprovedAndNot();

        socketInstance.io().emit('archivingTheCard', {
          doneTasks,
          approvedTasks,
        });
      }
    }

    //ловим новый комментарий в карточке
    if (
      req?.body?.action?.type === 'commentCard' &&
      req?.body?.action?.data?.text.includes('@')
    ) {
      socketInstance.io().emit('addNewComment', {
        textOfComment: req.body.action.data.text,
        cardId: req.body.action.data.card.id,
        actionId: req.body.action.id,
        cardUrl: `https://trello.com/c/${req.body.action.data.card.shortLink}`,
      });
    }

    //ловим удаление комментария в карточке
    if (req?.body?.action?.type === 'deleteComment') {
      socketInstance.io().emit('deleteComment', req?.body?.action);
    }

    //ловим удаление комментария в карточке
    if (req?.body?.action?.type === 'deleteComment') {
      socketInstance.io().emit('deleteComment', req?.body?.action);
    }

    //if (
    //  req?.body?.action?.type === 'addLabelToCard' &&
    //  req?.body?.action?.data?.label?.name === 'Expired'
    //) {
    //  const cardId = req.body.action.data.card.id;

    //  const trelloCard = await getCardDataByCardId(cardId);

    //  const CustomFieldReminderInTrelloCard = trelloCard.customFieldItems.find(
    //    (customField) =>
    //      customField.idCustomField === process.env.TRELLO_CUSTOM_FIELD_REMINDER
    //  );

    //  if (CustomFieldReminderInTrelloCard) {
    //    const dueCardInMlsc = moment(trelloCard.due).valueOf();

    //    const customFieldData = await getCustomField(
    //      CustomFieldReminderInTrelloCard.idCustomField
    //    );

    //    const customFieldOption = customFieldData.options.find(
    //      (option) => option.id === CustomFieldReminderInTrelloCard.idValue
    //    );

    //    const dateMlscUntilNextReminder =
    //      await calculatingTimeUntilNextReminder(customFieldOption);

    //    await updateTrelloCard(cardId, {
    //      due: +dueCardInMlsc + +dateMlscUntilNextReminder,
    //    });

    //    await removeLabelFromTrelloCard(
    //      cardId,
    //      process.env.TRELLO_LABEL_EXPIRED
    //    );

    //    socketInstance.io().emit('newReminder', trelloCard);
    //  }
    //}

    res.status(200).json({ message: 'changes in trello have been detected' });
  } catch (err) {
    console.log(err, 'trelloCallback');
  }
});

let PORT = process.env.PORT || 8888;

(async () => {
  try {
    await mongoose.connect(
      `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}`,
      {}
    );
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (e) {
    console.log(e);
  }
})();
