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
  getUserByEmail,
  createUser,
  getUserById,
} = require('../controllers/user.controller');

const {
  markRefFormAsUsed,
  findOneRefFormByParam,
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
        formHash,
      } = req?.body;

      const { videos } = req.files;

      if (!videos && !videoLink) {
        return res.status(200).json({
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
        return res.status(200).json({
          message: 'Missing parameter or non-inserted checkbox',
          status: 'warning',
        });
      }

      const authorLinkWithThisHash = await findOneRefFormByParam(
        'formHash',
        formHash
      );

      if (formHash && !authorLinkWithThisHash) {
        return res.status(200).json({
          message: 'Invalid link for the form. Request another one...',
          status: 'warning',
        });
      }

      if (formHash && authorLinkWithThisHash.used === true) {
        return res.status(200).json({
          message: 'A video has already been added to this link',
          status: 'warning',
        });
      }

      let author = await getUserByEmail(email);

      if (!author) {
        const objDbForCreateUser = {
          name: `${name} ${lastName}`,
          email,
          role: 'author',
          ...(authorLinkWithThisHash &&
            authorLinkWithThisHash.percentage && {
              percentage: authorLinkWithThisHash.percentage,
            }),
          ...(authorLinkWithThisHash &&
            authorLinkWithThisHash?.advancePayment && {
              amountPerVideo: authorLinkWithThisHash?.advancePayment,
            }),
          balance: 0,
          activatedTheAccount: false,
          specifiedPaymentDetails: false,
        };

        author = await createUser(objDbForCreateUser);
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
        sender: author._id,
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
        ...(authorLinkWithThisHash &&
          authorLinkWithThisHash.advancePayment && {
            advancePaymentReceived: false,
          }),
        formId: `VB${vbCode}`,
        ip,
        submittedDate: moment().utc(),
        ...(formHash && { refFormId: authorLinkWithThisHash._id }),
      };

      const newVbForm = await createNewVbForm(objDB);

      const { _id, __v, updatedAt, agreementLink, ...resData } = newVbForm._doc;

      if (formHash) {
        await markRefFormAsUsed(authorLinkWithThisHash._id, { used: true });
      }

      return res.status(200).send({
        message:
          'The data has been uploaded successfully. The agreement has been sent to the post office.',
        apiData: {
          ...resData,
          name,
          lastName,
          email,
          ...(authorLinkWithThisHash &&
            authorLinkWithThisHash.advancePayment && {
              advancePayment: authorLinkWithThisHash.advancePayment,
            }),
          ...(authorLinkWithThisHash &&
            authorLinkWithThisHash.percentage && {
              percentage: authorLinkWithThisHash.percentage,
            }),
        },
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
    const { searchBy, param } = req.query;

    if (!searchBy || !param) {
      return res.status(200).json({
        message: `The missing parameter for searching`,
        status: 'warning',
      });
    }

    const objDB = {
      searchBy,
      param:
        searchBy === 'formId' && !param.includes('VB') ? `VB${param}` : param,
    };

    const form = await findOne(objDB);

    if (!form) {
      return res.status(200).json({
        message: `Form found in the database`,
        status: 'warning',
      });
    }

    res.status(200).json({
      message: `Form found in the database`,
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
        param: formId,
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

      const author = await getUserById(vbForm.sender);

      if (!author) {
        return res.status(200).json({
          message: 'The user with this id was not found',
          status: 'warning',
        });
      }

      const refForm = await findOneRefFormByParam('_id', vbForm.refFormId);
      const referer = await getUserById(refForm?.researcher);

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
        name: author.name,
        clientEmail: author.email,
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
        ...(refForm &&
          refForm.advancePayment && { advancePayment: refForm.advancePayment }),
        ...(refForm &&
          refForm.percentage && { percentage: refForm.percentage }),
        ...(referer && {
          researcherEmail: referer.email,
        }),
        agreementLink: agreementLink,
        formId: vbForm.formId,
        refForm: vbForm.refFormId ? true : false,
      };

      console.log(dataForSendingMainInfo, 8888);

      const dataForSendingAgreement = {
        name: author.name,
        agreementLink,
        email: author.email,
        ...(refForm && {
          linkToPersonalAccount: `${process.env.CLIENT_URI}/licensors/?unq=${vbForm._id}`,
        }),
      };

      if (vbForm.refFormId) {
        const linkData = await findLinkByVideoId(refForm.videoId);

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

router.patch;

module.exports = router;
