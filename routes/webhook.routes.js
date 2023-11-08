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
  getCardDataByCardId,
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
    const changedData = req.body;

    if (
      changedData?.action?.type === "updateCard" &&
      changedData?.action?.display?.translationKey ===
        "action_move_card_from_list_to_list" &&
      changedData?.action?.data?.listAfter?.id ===
        process.env.TRELLO_LIST_DONE_ID
    ) {
      const cardId = changedData.action.data.card.id;

      const cardData = await getCardDataByCardId(cardId);

      const cardIsPriority = Boolean(
        cardData.customFieldItems.find(
          (customField) => customField.idValue === "62c7e0032a86d7161f8cadb2"
        )
      );

      const cardVbCode = cardData.customFieldItems.find(
        (customField) =>
          customField.idCustomField === "63e659f754cea8f9978e3b63"
      )?.value?.number;

      let hasAdvance = false;

      if (cardVbCode) {
        const vbForm = await findOne({
          searchBy: "formId",
          param: `VB${cardVbCode}`,
        });

        if (!!vbForm?.refFormId?.advancePayment) {
          hasAdvance = true;
        }
      }

      socketInstance.io().emit("trelloDoneChange", {
        event: "cardAdd",
        socketData: {
          priority: cardIsPriority,
          hasAdvance,
          url: cardData.url,
          name: cardData.name,
          id: cardData.id,
        },
      });
    }

    if (changedData?.action?.data?.text?.includes("approved this card")) {
      const cardId = changedData.action.data.card.id;

      const cardData = await getCardDataByCardId(cardId);

      const cardIsPriority = Boolean(
        cardData.customFieldItems.find(
          (customField) => customField.idValue === "62c7e0032a86d7161f8cadb2"
        )
      );

      const cardVbCode = cardData.customFieldItems.find(
        (customField) =>
          customField.idCustomField === "63e659f754cea8f9978e3b63"
      )?.value?.number;

      let hasAdvance = false;

      if (cardVbCode) {
        const vbForm = await findOne({
          searchBy: "formId",
          param: `VB${cardVbCode}`,
        });

        if (!!vbForm?.refFormId?.advancePayment) {
          hasAdvance = true;
        }
      }

      socketInstance.io().emit("trelloDoneChange", {
        event: "cardApproved",
        socketData: {
          priority: cardIsPriority,
          hasAdvance,
          url: cardData.url,
          name: cardData.name,
          id: cardData.id,
        },
      });
    }

    if (
      changedData?.action?.type === "updateCard" &&
      changedData?.action?.display?.translationKey ===
        "action_move_card_from_list_to_list" &&
      changedData?.action?.data?.listAfter?.id !==
        process.env.TRELLO_LIST_DONE_ID
    ) {
      const cardId = changedData.action.data.card.id;

      socketInstance.io().emit("trelloDoneChange", {
        event: "cardMove",
        socketData: {
          id: cardId,
        },
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
    }

    return res.status(200).json({ status: "success" });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "webhookTrello.allBoard" }));
  }
});

module.exports = router;
