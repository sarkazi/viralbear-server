const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const { sendEmail } = require("../controllers/sendEmail.controller");

const {
  sendAgreementToClientMail,
  sendSurveyInfoToServiceMail,
} = require("../controllers/sendEmail.controller");

router.post("/", authMiddleware, async (req, res) => {
  const { bugInfo, emailTo, subject } = req.query;
  const { attachment } = req.body;

  try {
    let buffer = null;

    if (attachment) {
      buffer = Buffer.from(attachment);
    }

    sendEmail({
      emailFrom: '"«VIRALBEAR» LLC" <info@viralbear.media>',
      emailTo: bugInfo ? process.env.DEVELOPER_EMAIL : emailTo,
      subject,
      ...(buffer && {
        attachment: buffer,
      }),
    });

    return res.status(200).json({
      status: "success",
      message: "The error message was sent to the developer's email",
    });
  } catch (err) {
    console.log(err);

    return res.status(400).json({
      status: "error",
      message: "Server-side error",
    });
  }
});

router.post("/clientAgreement", sendAgreementToClientMail);

router.post("/surveyInfo", sendSurveyInfoToServiceMail);

module.exports = router;
