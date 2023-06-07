const express = require('express');
const router = express.Router();

const {
  sendAgreementToClientMail,
  sendSurveyInfoToServiceMail,
} = require('../controllers/sendEmail.controller');

router.post('/clientAgreement', sendAgreementToClientMail);

router.post('/surveyInfo', sendSurveyInfoToServiceMail);

module.exports = router;
