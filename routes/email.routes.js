const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const { sendEmail } = require("../controllers/sendEmail.controller");
const { Buffer } = require("node:buffer");

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
      buffer = Buffer.from(JSON.parse(attachment));
    }

    console.log(buffer);

    sendEmail({
      emailFrom,
      emailTo: bugInfo ? process.env.DEVELOPER_EMAIL : emailTo,
      subject,
      ...(buffer && {
        attachment: buffer,
      }),
    });
  } catch (err) {
    console.log(err);
  }
});

router.post("/clientAgreement", sendAgreementToClientMail);

router.post("/surveyInfo", sendSurveyInfoToServiceMail);

module.exports = router;
