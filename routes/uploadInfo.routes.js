const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middleware/auth.middleware');
const calcVbCode = require('../utils/calcVbCode');
const socketInstance = require('../socket.instance');
const { v4: createUniqueHash } = require('uuid');
const path = require('path');
const moment = require('moment');

const {
  findLastAddedVbForm,
  createNewVbForm,
  updateVbFormByFormId,
} = require('../controllers/uploadInfo.controller');

const {
  markAsUsed,
  findOneByFormId,
} = require('../controllers/authorLink.controller');

const { findOne } = require('../controllers/uploadInfo.controller');

const { uploadFileToStorage } = require('../controllers/storage.controller');

const {
  sendMainInfoByVBToServiceMail,
  sendAgreementToClientMail,
  sendSurveyInfoToServiceMail,
} = require('../controllers/sendEmail.controller');

const { findLinkByVideoId } = require('../controllers/links.controller');

const {
  getCardDataByCardId,
  updateCustomFieldByTrelloCard,
} = require('../controllers/trello.controller');

const storage = multer.memoryStorage();

router.patch('/addAdditionalInfo', async (req, res) => {
  try {
    const {
      formId,
      whereFilmed,
      whenFilmed,
      whoAppears,
      whyDecide,
      whatHappen,
    } = req.body;

    if (!formId) {
      return res.status(404).json({
        message: 'Responses can only be uploaded once',
        status: 'warning',
      });
    }

    if (
      !whereFilmed &&
      !whenFilmed &&
      !whoAppears &&
      !whyDecide &&
      !whatHappen
    ) {
      return res.status(200).json({
        message: 'There is no data to update the form',
        status: 'warning',
      });
    }

    const vbForm = await findOne(formId.replace('VB', ''));

    if (!vbForm) {
      return res.status(404).json({
        message: `No such form was found`,
        status: 'warning',
      });
    }

    const objDB = {
      ...(whereFilmed && { whereFilmed }),
      ...(whenFilmed && { whenFilmed }),
      ...(whoAppears && { whoAppears }),
      ...(whyDecide && { whyDecide }),
      ...(whatHappen && { whatHappen }),
      refForm: vbForm.refHash ? true : false,
      ...(vbForm.refHash && { researcherEmail: vbForm.researcher.email }),
    };

    await updateVbFormByFormId(formId, objDB);

    await sendSurveyInfoToServiceMail({ ...objDB, formId });

    return res.status(200).json({
      message: `The form has been successfully updated, updates have been sent to the mail`,
      status: 'success',
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ message: 'Server-side error', status: 'error' });
  }
});

router.post(
  '/create',
  multer({ storage: storage }).fields([{ name: 'videos' }]),
  async (req, res) => {
    try {
      const {
        videoLink,
        name,
        lastName,
        email,
        didYouRecord,
        operator,
        noSubmitAnywhere,
        resources,
        over18YearOld,
        agreedWithTerms,
        didNotGiveRights,
        ip,
        advancePayment,
        percentage,
        researcherNickname,
        researcherEmail,
        hashLink,
        exclusivity,
      } = req?.body;

      const { videos } = req.files;

      if (!videos && !videoLink) {
        return res.status(404).json({
          message: 'Enter a link or upload a video',
          status: 'warning',
        });
      }

      if (
        !name ||
        !lastName ||
        !email ||
        (didYouRecord === false && !operator) ||
        (noSubmitAnywhere === false && !resources) ||
        (noSubmitAnywhere === false && !JSON.parse(resources.length)) ||
        over18YearOld === false ||
        agreedWithTerms === false ||
        didNotGiveRights === false ||
        !ip
      ) {
        return res.status(404).json({
          message: 'Missing parameter or non-inserted checkbox',
          status: 'warning',
        });
      }

      if (hashLink) {
        const authorLinkWithThisHash = await findOneByFormId(hashLink);

        if (!authorLinkWithThisHash) {
          return res.status(404).json({
            message: 'Invalid link for the form. Request another one...',
            status: 'warning',
          });
        }

        if (authorLinkWithThisHash.used === true) {
          return res.status(400).json({
            message: 'A video has already been added to this link',
            status: 'warning',
          });
        }
      }

      const lastAddedVbForm = await findLastAddedVbForm();

      const vbCode = calcVbCode(lastAddedVbForm);

      let videoLinks = [];

      if (videoLink) {
        videoLinks = [...videoLinks, videoLink];
      }

      const uploadingVideosToStorage = async () => {
        if (!videos) {
          return [
            {
              message: 'No upload video found',
              status: 'warning',
            },
          ];
        } else {
          return await Promise.all(
            videos?.map(async (file) => {
              return await new Promise(async (resolve, reject) => {
                await uploadFileToStorage(
                  file.originalname,
                  'client-videos',
                  `${createUniqueHash()}-${vbCode}`,
                  file.buffer,
                  file.mimetype,
                  path.extname(file.originalname),
                  resolve,
                  reject,
                  'progressUploadByStorage',
                  'Uploading the video to the storage'
                );
              });
            })
          );
        }
      };

      const resStorage = await uploadingVideosToStorage();

      socketInstance.io().emit('progressUploadByStorage', {
        event: 'Just a little bit left',
        file: null,
      });

      if (resStorage.every((obj) => obj.status === 'success')) {
        await Promise.all(
          resStorage.map(async (res) => {
            videoLinks = [...videoLinks, res.response.Location];
          })
        );
      }

      const objDB = {
        name,
        lastName,
        email,
        videoLinks,
        didYouRecord,
        ...(operator && { operator }),
        noSubmitAnywhere,
        ...(resources && {
          resources: JSON.parse(resources).map((el) => {
            return el.trim();
          }),
        }),
        over18YearOld,
        agreedWithTerms,
        didNotGiveRights,
        formId: `VB${vbCode}`,
        ip,
        submittedDate: moment().utc(),
        ...(advancePayment && { advancePayment }),
        ...(percentage && { percentage }),
        ...((JSON.parse(exclusivity) === false ||
          JSON.parse(exclusivity) === true) && { exclusivity }),
        ...(researcherNickname &&
          researcherEmail && {
            researcher: {
              email: researcherEmail,
              nickname: researcherNickname,
            },
          }),
        ...(hashLink && { refHash: hashLink }),
      };

      const newFVbForm = await createNewVbForm(objDB);

      const { _id, __v, updatedAt, agreementLink, ...resData } =
        newFVbForm._doc;

      if (hashLink) {
        //await markAsUsed(hashLink, { used: true });
      }

      return res.status(200).send({
        message: 'Data uploaded successfully',
        apiData: resData,
        status: 'success',
      });
    } catch (err) {
      console.log(err);
      return res.status(500).json({
        message: err?.message ? err?.message : 'Server-side error',
        status: 'error',
      });
    }
  }
);

router.get('/findOne', async (req, res) => {
  try {
    const { searchBy, formId, refHash } = req.query;

    console.log(req.query);

    if (!searchBy) {
      return res.status(200).json({
        message: `The search parameter is missing`,
        status: 'warning',
      });
    }

    if (!formId && !refHash) {
      return res.status(200).json({
        message: `Missing search value`,
        status: 'warning',
      });
    }

    if (formId && refHash) {
      return res.status(200).json({
        message: `There can only be one value to search for`,
        status: 'warning',
      });
    }

    const objDB = {
      searchBy,
      ...(formId && { formId }),
      ...(refHash && { refHash }),
    };

    const form = await findOne(objDB);

    if (!form) {
      return res.status(200).json({
        message: formId
          ? `The form with the vb code ${formId} was not found in the database`
          : `The form with the referral hash ${refHash} was not found in the database`,
        status: 'warning',
      });
    }

    res.status(200).json({
      message: formId
        ? `Form with the vb code ${formId} found in the database`
        : `Form with the referral hash ${refHash} found in the database`,
      status: 'success',
      apiData: form,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Server side error', status: 'error' });
  }
});

router.post(
  '/saveAgreement',
  multer({ storage: storage }).fields([{ name: 'pdf' }]),
  async (req, res) => {
    try {
      const { pdf } = req.files;
      const { formId } = req.body;

      if (!pdf) {
        return res.status(400).json({
          message: 'missing pdf file',
          status: 'error',
        });
      }

    

      if (!pdf.length > 1) {
        return res.status(400).json({
          message: 'A maximum of 1 pdf file is expected',
          status: 'warning',
        });
      }

      if (!formId) {
        return res.status(404).json({
          message: `missing form id value`,
          status: 'error',
        });
      }

      const objToSearchVbForm = {
        searchBy: 'formId',
        formId: formId.replace('VB', ''),
      };

      const vbForm = await findOne(objToSearchVbForm);

      

      if (!vbForm) {
        return res.status(404).json({
          message: `Form with id "${formId}" not found`,
          status: 'warning',
        });
      }

      if (vbForm.agreementLink) {
        return res.status(400).json({
          message: 'The agreement link already exists',
          status: 'warning',
        });
      }

      const resStorage = await new Promise(async (resolve, reject) => {
        await uploadFileToStorage(
          pdf[0].originalname,
          'agreement',
          `${createUniqueHash()}-${formId.replace('VB', '')}`,
          pdf[0].buffer,
          pdf[0].mimetype,
          path.extname(pdf[0].originalname),
          resolve,
          reject,
          'progressUploadByStorage',
          'Uploading the agreement to the storage'
        );
      });

      const agreementLink = resStorage.response.Location;

      if (!agreementLink) {
        return res.status(400).json({
          message: 'Error when uploading pdf file to storage',
          status: 'error',
        });
      }

      await updateVbFormByFormId(formId, {
        agreementLink,
      });

      const dataForSendingMainInfo = {
        firstName: vbForm.name,
        lastName: vbForm.lastName,
        clientEmail: vbForm.email,
        videoLinks: vbForm.videoLinks,
        didYouRecord: vbForm.didYouRecord,
        ...(vbForm.operator && { operator: vbForm.operator }),
        ...(vbForm.resources.length > 0 && { resources: vbForm.resources }),
        over18YearOld: vbForm.over18YearOld,
        agreedWithTerms: vbForm.agreedWithTerms,
        noSubmitAnywhere: vbForm.noSubmitAnywhere,
        didNotGiveRights: vbForm.didNotGiveRights,
        ip: vbForm.ip,
        submittedDate: vbForm.submittedDate,
        ...(vbForm.advancePayment && { advancePayment: vbForm.advancePayment }),
        ...(vbForm.percentage && { percentage: vbForm.percentage }),
        ...(vbForm.researcher && { researcher: vbForm.researcher }),
        agreementLink: agreementLink,
        formId: vbForm.formId,
        refForm: vbForm.refHash ? true : false,
        ...(vbForm.refHash && { researcherEmail: vbForm.researcher.email }),
      };

      const dataForSendingAgreement = {
        name: vbForm.name,
        agreementLink: agreementLink,
        email: vbForm.email,
        ...(vbForm.refHash && {
          linkToPersonalAccount: `${process.env.CLIENT_URI}/licensors/?unq=${vbForm.refHash}`,
        }),
      };

      if (vbForm.refHash) {
        const authorLinkForm = await findOneByFormId(vbForm.refHash);
        const linkData = await findLinkByVideoId(authorLinkForm.videoId);

        if (linkData) {
          const trelloCard = await getCardDataByCardId(linkData.trelloCardId);

          await updateCustomFieldByTrelloCard(
            trelloCard.id,
            process.env.TRELLO_CUSTOM_FIELD_VB_CODE,
            {
              value: {
                number: vbForm.formId.replace('VB', ''),
              },
            }
          );
        }
      }

      await sendMainInfoByVBToServiceMail(dataForSendingMainInfo);
      await sendAgreementToClientMail(dataForSendingAgreement);

      return res.status(200).json({
        message: `The agreement was uploaded to the storage and sent to "${vbForm.email}"`,
        status: 'success',
      });
    } catch (err) {
      console.log(err);
      return res
        .status(500)
        .json({ message: 'Server-side error', status: 'error' });
    }
  }
);

module.exports = router;
