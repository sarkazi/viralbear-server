const express = require("express");
const router = express.Router();

const socketInstance = require("../socket.instance");

const { getUserBy } = require("../controllers/user.controller");

const { errorsHandler } = require("../handlers/error.handler");
const {
  writeNewMoveToDone,
  findTheRecordOfTheCardMovedToDone,
} = require("../controllers/movedToDoneList.controller");

const {
  writeNewMoveFromReview,
  findTheRecordOfTheCardMovedFromReview,
} = require("../controllers/movedFromReviewList.controller");

const {
  findOne,
  deleteVbFormsBy,
} = require("../controllers/uploadInfo.controller");

const {
  getPriorityCardByCardId,
  getCardLabelsByCardId,
  updateTrelloCard,
  addNewCommentToTrelloCard,
} = require("../controllers/trello.controller");

const {
  deleteVideoById,
  findVideoBy,
} = require("../controllers/video.controller");

const { findLinkBy } = require("../controllers/links.controller");

router.post("/trello/doneList", async (req, res) => {
  try {
    //const allNecessaryLabelsForDoneCard = [
    //  process.env.TRELLO_LABEL_NOT_PUBLISHED,
    //  process.env.TRELLO_LABEL_IG_GROUP,
    //  process.env.TRELLO_LABEL_DONE,
    //];

    const changedData = req.body;

    //if (
    //  changedData.action?.type === 'updateCard' &&
    //  !changedData.action?.appCreator &&
    //  changedData.action?.display?.translationKey ===
    //    'action_move_card_from_list_to_list' &&
    //  changedData.action?.data?.listAfter?.name === 'Done'
    //) {
    //  console.log(`webhook "${changedData.webhook.description}" сработал`);

    //  //проверяем, существует ли уже запись в базе с этой карточкой

    //  const recordInTheDatabaseAboutTheMovedCard =
    //    await findTheRecordOfTheCardMovedToDone(
    //      changedData.action.data.card.id
    //    );

    //  //если не существует - записываем
    //  if (!recordInTheDatabaseAboutTheMovedCard) {
    //    const researcherUsernameInTrello =
    //      changedData.action.memberCreator.username;

    //    const researcherInDatabase = await getUserBy({
    //      param: 'nickname',
    //      value: `@${researcherUsernameInTrello}`,
    //    });

    //    //записываем событие о перемещенной карточке в базу
    //    await writeNewMoveToDone({
    //      researcherId: researcherInDatabase._id,
    //      listBefore: changedData.action.data.listBefore.name,
    //      trelloCardId: changedData.action.data.card.id,
    //    });
    //  }

    //  const cardId = changedData.action.data.card.id;

    //  //ищем все наклейки карточки
    //  const cardLabels = await getCardLabelsByCardId(cardId);

    //  //если нет ни одной наклейки в trello
    //  if (
    //    allNecessaryLabelsForDoneCard.some((necessaryLabel) => {
    //      return !cardLabels.find(
    //        (cardLabel) => cardLabel.id === necessaryLabel
    //      );
    //    })
    //  ) {
    //    //проставляем все необходимые наклейки
    //    await updateTrelloCard(cardId, {
    //      idLabels: allNecessaryLabelsForDoneCard,
    //    });
    //  }

    //  //const { priority } = await getPriorityCardByCardId(cardId);

    //  //socketInstance.io().emit('triggerForAnUpdateInPublishing', {
    //  //  priority,
    //  //  event: 'new card in done',
    //  //});
    //}

    if (
      changedData.action?.type === "updateCard" &&
      (changedData.action?.display?.translationKey ===
        "action_moved_card_lower" ||
        changedData.action?.display?.translationKey ===
          "action_moved_card_higher")
    ) {
      const cardId = changedData.action.data.card.id;

      const { priority } = await getPriorityCardByCardId(cardId);

      socketInstance.io().emit("triggerForAnUpdateInPublishing", {
        priority,
        event: "new card in done",
      });
    }

    return res.status(200).json({ status: "success" });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "webhookTrello.doneList" }));
    return res.status(200).json({ status: "error" });
  }
});

router.post("/trello/reviewList", async (req, res) => {
  try {
    const changedData = req.body;

    if (
      !!changedData?.action?.data?.listAfter &&
      !!changedData?.action?.data?.listBefore &&
      changedData.webhook.idModel === process.env.TRELLO_LIST_REVIEW_ID &&
      changedData?.action?.data?.listBefore?.name
        ?.toLowerCase()
        ?.includes("review")
    ) {
      console.log(`webhook "${changedData.webhook.description}" сработал`);

      //проверяем, существует ли уже запись в базе с этой карточкой

      const recordInTheDatabaseAboutTheMovedCard =
        await findTheRecordOfTheCardMovedFromReview(
          changedData.action.data.card.id
        );

      //если не существует - записываем
      if (!recordInTheDatabaseAboutTheMovedCard) {
        const trelloCardId = changedData.action.data.card.id;

        const addedTrelloCard = await findLinkBy({
          searchBy: "trelloCardId",
          value: trelloCardId,
        });

        let cardCreatorId = null;

        if (addedTrelloCard) {
          cardCreatorId = addedTrelloCard.researcher._id;
        } else {
          const researcher = await getUserBy({
            searchBy: "nickname",
            value: `@${changedData.action.memberCreator.username}`,
          });

          cardCreatorId = researcher?._id;
        }

        //записываем событие о перемещенной карточке в базу
        await writeNewMoveFromReview({
          researcherId: cardCreatorId,
          listAfter: changedData.action.data.listAfter.name,
          trelloCardId: changedData.action.data.card.id,
        });
      }
    }

    return res.status(200).json({ status: "success" });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "webhookTrello.reviewList" }));
  }
});

router.post("/trello/allBoard", async (req, res) => {
  try {
    const changedData = req.body;

    if (
      changedData?.action?.type === "updateCustomFieldItem" &&
      changedData?.action?.data?.customField?.id ===
        process.env.TRELLO_CUSTOM_FIELD_VB_CODE &&
      !!changedData?.action?.data?.customFieldItem?.value
    ) {
      const vbCode = changedData.action.data.customFieldItem.value.number;
      const cardId = changedData.action.data.card.id;

      const vbForm = await findOne({
        searchBy: "formId",
        param: `VB${vbCode}`,
      });

      if (!!vbForm?.refFormId) {
        const linkMarkup = vbForm.videoLinks
          .map((link, index) => {
            return `${link}${index + 1 !== vbForm.videoLinks.length && `\n`}`;
          })
          .join(``);

        const renderTermsOfTheAgreement = () => {
          if (vbForm.refFormId.percentage && vbForm.refFormId.advancePayment) {
            return `${vbForm.refFormId.advancePayment}$ + ${vbForm.refFormId.percentage}%`;
          } else if (
            vbForm.refFormId.percentage &&
            !vbForm.refFormId.advancePayment
          ) {
            return `${vbForm.refFormId.percentage}%`;
          } else if (
            !vbForm.refFormId.percentage &&
            vbForm.refFormId.advancePayment
          ) {
            return `${vbForm.refFormId.advancePayment}%`;
          } else {
            return "";
          }
        };

        const contentComment = `
          ${linkMarkup}\n
          ${renderTermsOfTheAgreement()}
        `;

        await addNewCommentToTrelloCard({
          textComment: contentComment,
          cardId,
        });

        const surveyKeys = {
          whereFilmed: "Where filmed",
          whenFilmed: "When filmed",
          whoAppears: "Who appears",
          whyDecide: "Why decide",
          whatHappen: "What happen",
        };

        if (
          Object.keys(vbForm._doc).some((key) => {
            return Object.keys(surveyKeys).includes(key);
          })
        ) {
          const { whereFilmed, whenFilmed, whoAppears, whyDecide, whatHappen } =
            vbForm;

          const arrInfo = [
            ...(whereFilmed
              ? [`${surveyKeys.whereFilmed}: ${whereFilmed}`]
              : []),
            ...(whenFilmed ? [`${surveyKeys.whenFilmed}: ${whenFilmed}`] : []),
            ...(whoAppears ? [`${surveyKeys.whoAppears}: ${whoAppears}`] : []),
            ...(whyDecide ? [`${surveyKeys.whyDecide}: ${whyDecide}`] : []),
            ...(whatHappen ? [`${surveyKeys.whatHappen}: ${whatHappen}`] : []),
          ];

          const surveyComment = `
  ${arrInfo
    .map((value, index) => {
      return `${value}${index + 1 !== arrInfo.length ? `\n` : ``}`;
    })
    .join(``)}
  `;

          await addNewCommentToTrelloCard({
            textComment: surveyComment,
            cardId,
          });
        }
      }
    }

    if (
      changedData?.action?.display?.translationKey ===
        "action_add_label_to_card" &&
      !changedData?.action?.appCreator &&
      changedData?.action?.data?.text === "Done"
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

        const researcherInDatabase = await getUserBy({
          searchBy: "nickname",
          value: `@${researcherUsernameInTrello}`,
        });

        if (!!researcherInDatabase) {
          //записываем событие о перемещенной карточке в базу
          await writeNewMoveToDone({
            researcherId: researcherInDatabase._id,
            trelloCardId: changedData.action.data.card.id,
          });
        }
      }

      //const cardId = changedData.action.data.card.id;

      ////ищем все наклейки карточки
      //const cardLabels = await getCardLabelsByCardId(cardId);

      ////если нет ни одной наклейки в trello
      //if (
      //  allNecessaryLabelsForDoneCard.some((necessaryLabel) => {
      //    return !cardLabels.find(
      //      (cardLabel) => cardLabel.id === necessaryLabel
      //    );
      //  })
      //) {
      //  //проставляем все необходимые наклейки
      //  await updateTrelloCard(cardId, {
      //    idLabels: allNecessaryLabelsForDoneCard,
      //  });
      //}
    }

    //if (
    //  changedData?.action?.display?.translationKey === 'action_archived_card' &&
    //  changedData?.webhook?.idModel === process.env.TRELLO_BOARD_ID
    //) {
    //  console.log(`The webhook for archiving the card in trello worked`);

    //  const trelloCardId = changedData.action.data.card.id;

    //  const video = await findVideoBy({
    //    searchBy: 'trelloData.trelloCardId',
    //    value: trelloCardId,
    //  });

    //  if (video) {
    //    await deleteVideoById(video.videoData.videoId);

    //    socketInstance.io().emit('triggerForAnUpdateInPublishing', {
    //      priority: null,
    //      event: null,
    //    });
    //  }
    //}

    return res.status(200).json({ status: "success" });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "webhookTrello.allBoard" }));
  }
});

module.exports = router;
