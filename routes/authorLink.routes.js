const express = require("express");
const router = express.Router();

const { errorsHandler } = require("../handlers/error.handler");

const { generateHash } = require("random-hash");

const authMiddleware = require("../middleware/auth.middleware");

const { getUserById } = require("../controllers/user.controller");

const {
  createCardInTrello,
  getMemberTrelloById,
} = require("../controllers/trello.controller");

const {
  conversionIncorrectLinks,

  findLinkBy,
} = require("../controllers/links.controller");

const {
  findAuthorLinkByVideoId,
  findOneRefFormByParam,
  createNewAuthorLink,
} = require("../controllers/authorLink.controller");

router.post("/create", authMiddleware, async (req, res) => {
  const {
    percentage,
    advancePayment,
    videoLink: reqVideoLink,
    confirmDeletion,
    confirmIncorrect,
    exclusivity,
    trelloCardTitle,
    trelloCardNickname,
  } = req.body;

  if (!reqVideoLink && (!percentage || !advancePayment)) {
    return res.status(200).json({
      message: "Missing parameters for link generation",
      status: "warning",
    });
  }

  if (!exclusivity && !advancePayment && !percentage) {
    return res.status(200).json({
      message: "The percent/advance cannot be empty in this case",
      status: "warning",
    });
  }

  try {
    const user = await getUserById(req.user.id);

    if (!user) {
      return res.status(200).json({
        message: "User not found",
        status: "warning",
      });
    }

    const convertedLink = conversionIncorrectLinks(reqVideoLink);

    //const videoLink = await findBaseUrl(convertedLink);

    //if (!videoLink) {
    //  return res
    //    .status(200)
    //    .json({ message: 'Link is invalid', status: 'warning' });
    //}

    //const videoId = await pullIdFromUrl(convertedLink);

    //if (!videoId) {
    //  return res
    //    .status(200)
    //    .json({ message: 'Link is invalid', status: 'warning' });
    //}

    const authorLink = await findOneRefFormByParam({
      searchBy: "videoLink",
      value: convertedLink,
    });

    if (!!authorLink) {
      if (confirmDeletion === false) {
        return res.status(200).json({
          message:
            "A unique form has already been generated for this video. Generate a new one?",
          status: "await",
          type: "repeat",
        });
      }
    }

    const link = await findLinkBy({ searchBy: "link", value: convertedLink });

    if (!link) {
      if (confirmIncorrect === false) {
        return res.status(200).json({
          message:
            "There is no Trello card for this video. Are you sure that this link is correct?",
          status: "await",
          type: "incorrect",
        });
      } else {
        if (!trelloCardTitle || !trelloCardNickname) {
          return res.status(200).json({
            message: "Missing values for creating trello card",
            status: "warning",
          });
        }

        const trelloMember = await getMemberTrelloById({
          memberId: user.nickname.replace("@", ""),
        });

        if (!trelloMember) {
          return res.status(200).json({
            message:
              "No employee with your nickname was found in trello. Contact the admin",
            status: "warning",
          });
        }

        await createCardInTrello({
          name: `@${trelloCardNickname} ${trelloCardTitle}`,
          desc: convertedLink,
          idList: process.env.TRELLO_LIST_DOING_ID,
          idMembers: [trelloMember.id],
          idLabels: [process.env.TRELLO_LABEL_IN_PROGRESS],
        });
      }
    }

    const formHash = generateHash({ length: 7 });

    const bodyForNewAuthorLink = {
      percentage: percentage ? percentage : 0,
      advancePayment: advancePayment ? advancePayment : 0,
      researcher: user._id,
      formHash,
      formLink: `${process.env.CLIENT_URI}/submitVideos/${formHash}`,
      videoLink: convertedLink,
      convertedLink,
      exclusivity,
      paid: true,

      ...(link?.trelloCardUrl && { trelloCardUrl: link.trelloCardUrl }),
      ...(link?.trelloCardId && { trelloCardId: link.trelloCardId }),
    };

    const newAuthorLink = await createNewAuthorLink(bodyForNewAuthorLink);

    res.status(200).json({
      message: "The link was successfully generated",
      status: "success",
      apiData: newAuthorLink,
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "authorLink.create" }));
    return res.status(500).json({
      message: "Server side error",
      status: "error",
    });
  }
});

router.get("/findOne/:value", async (req, res) => {
  const { value } = req.params;
  const { searchBy } = req.query;

  if (!value || !searchBy) {
    return res.status(200).json({
      message: `Missing parameters for form search`,
      status: "warning",
    });
  }

  try {
    const authorLinkForm = await findOneRefFormByParam({ searchBy, value });

    if (!authorLinkForm) {
      return res.status(200).json({
        message: `Form not found in the database`,
        status: "warning",
        code: 404,
      });
    }

    return res.status(200).json({
      message: `The referral form data is obtained from the database`,
      status: "success",
      apiData: authorLinkForm,
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "authorLink.findOne" }));
    return res.status(500).json({
      message: "Server side error",
      status: "error",
    });
  }
});

module.exports = router;
