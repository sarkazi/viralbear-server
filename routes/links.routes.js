const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");

const ObjectId = mongoose.Types.ObjectId;
const { errorsHandler } = require("../handlers/error.handler");

const authMiddleware = require("../middleware/auth.middleware");

const {
  findBaseUrl,
  createNewLink,
  conversionIncorrectLinks,
  findLinkBy,
  pullIdFromUrl,
} = require("../controllers/links.controller");

const {
  getUserBy,
  findUsersByValueList,
} = require("../controllers/user.controller");

const {
  createCardInTrello,
  findWorkersTrelloIds,
  getCardDataByCardId,
  updateCustomFieldByTrelloCard,
  definingValueOfCustomFieldReminderInTrello,
} = require("../controllers/trello.controller");

router.post("/sendLinkToTrello", authMiddleware, async (req, res) => {
  const { list, workers, reminders, title, authorNickname, link, priority } =
    req.body;

  const finalLink = conversionIncorrectLinks(link);

  try {
    let response = await findBaseUrl(finalLink);
    let unixid = null;

    if (response.status === "success" && response.href.includes("tiktok")) {
      unixid = response.href;
    } else {
      unixid = pullIdFromUrl(finalLink);
    }

    if (!unixid) {
      return res.status(200).json({
        status: "warning",
        message: "Could not determine unixid. Contact the administrator",
      });
    }

    const linkInfo = await findLinkBy({
      searchBy: "unixid",
      value: unixid,
    });

    if (!!linkInfo) {
      const trelloCardData = await getCardDataByCardId(linkInfo.trelloCardId);

      return res.status(200).json({
        status: "warning",
        message: "This video has already been added",
        apiData: {
          trelloCardData,
        },
      });
    }

    const selfWorker = await getUserBy({
      searchBy: "_id",
      value: new ObjectId(req.user.id),
    });

    if (!selfWorker) {
      return res
        .status(200)
        .json({ message: "Worker not found", status: "warning" });
    }

    const foundWorkers = await findUsersByValueList({
      param: "name",
      valueList: [...workers, selfWorker.name],
    });

    console.log(foundWorkers);

    if (!foundWorkers.length) {
      return res.status(200).json({
        message: 'Not a single user with the role of "worker" was found',
        status: "warning",
      });
    }

    const foundWorkersTrelloIds = await findWorkersTrelloIds(foundWorkers);

    console.log(foundWorkersTrelloIds);

    if (!foundWorkersTrelloIds.length) {
      return res.status(200).json({
        message: "Not a single employee was found in trello",
        status: "warning",
      });
    }

    const defineTrelloCardName = () => {
      if (!!authorNickname && !!title) {
        return `@${authorNickname} ${title}`;
      } else if (!authorNickname && title) {
        return `${title}`;
      } else if (authorNickname && !title) {
        return `@${authorNickname}`;
      }
    };

    const defineListId = () => {
      switch (list) {
        case "Review":
          return process.env.TRELLO_LIST_REVIEW_ID;
        case "In progress":
          return process.env.TRELLO_LIST_DOING_ID;
        case "To do":
          return process.env.TRELLO_LIST_TODO_ID;
      }
    };

    const trelloResponseAfterCreatingCard = await createCardInTrello({
      name: defineTrelloCardName(),
      desc: finalLink,
      idList: defineListId(),
      idMembers: foundWorkersTrelloIds,
      ...(list === "In progress" && {
        idLabels: [process.env.TRELLO_LABEL_IN_PROGRESS],
      }),
    });

    if (JSON.parse(priority)) {
      //меняем кастомное поле "priority" в карточке trello
      await updateCustomFieldByTrelloCard(
        trelloResponseAfterCreatingCard.id,
        process.env.TRELLO_CUSTOM_FIELD_PRIORITY,
        {
          idValue: "62c7e0032a86d7161f8cadb2",
        }
      );
    }

    if (reminders) {
      const reminderCustomFieldValue =
        await definingValueOfCustomFieldReminderInTrello(
          process.env.TRELLO_CUSTOM_FIELD_REMINDER,
          reminders
        );

      await updateCustomFieldByTrelloCard(
        trelloResponseAfterCreatingCard.id,
        process.env.TRELLO_CUSTOM_FIELD_REMINDER,
        { idValue: reminderCustomFieldValue.id }
      );
    }

    const bodyForCreateLink = {
      researcher: selfWorker._id,
      authorsNick: authorNickname,
      unixid,
      title,
      link: finalLink,
      trelloCardUrl: trelloResponseAfterCreatingCard.url,
      trelloCardId: trelloResponseAfterCreatingCard.id,
      listInTrello: list,
      ...(!!reminders && { reminderDate: new Date() }),
    };

    await createNewLink({ bodyForCreateLink });

    return res.status(200).json({
      status: "success",
      message: "Video added and sent",
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "link.sendLinkToTrello" }));
    return res
      .status(400)
      .json({ status: "error", message: "Server side error" });
  }
});

module.exports = router;
