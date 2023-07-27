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
  getAllUsers,
  getUserBy,
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
  sendEmail,
} = require('../controllers/sendEmail.controller');

const { findLinkByVideoId } = require('../controllers/links.controller');

const {
  getCardDataByCardId,
  updateCustomFieldByTrelloCard,
} = require('../controllers/trello.controller');
const UploadInfo = require('../entities/UploadInfo');

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
      return res.status(200).json({
        message: "It looks like you've already filled out this form...",
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
      return res.status(200).json({
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

      const users = await getAllUsers({
        roles: ['researcher', 'admin', 'editor'],
        fieldsInTheResponse: ['email'],
      });

      if (users.find((value) => value.email === email)) {
        return res.status(200).json({
          message: 'this email is not allowed',
          status: 'warning',
        });
      }

      const authorLinkWithThisHash = await findOneRefFormByParam({
        searchBy: 'formHash',
        value: formHash,
      });

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

      const isFormImpliesAnAdvancePayment =
        authorLinkWithThisHash && !!authorLinkWithThisHash.advancePayment;

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
        formId: `VB${vbCode}`,
        ip,
        ...(formHash && {
          refFormId: authorLinkWithThisHash._id,
        }),
        ...(isFormImpliesAnAdvancePayment && {
          advancePaymentReceived: false,
        }),
      };

      await createNewVbForm(objDB);

      const newVbForm = await findOne({
        searchBy: 'formId',
        param: `VB${vbCode}`,
      });

      if (formHash) {
        await markRefFormAsUsed(authorLinkWithThisHash._id, { used: true });
      }

      const apiData = {
        name,
        lastName,
        email,
        videoLinks: newVbForm.videoLinks,
        ip: newVbForm.ip,
        vbFormId: newVbForm.formId,
        ...(formHash && {
          exclusivity: newVbForm.refFormId.exclusivity,
          percentage: newVbForm.refFormId.percentage,
          advancePayment: newVbForm.refFormId.advancePayment,
        }),
      };

      return res.status(200).send({
        message:
          'The data has been uploaded successfully. The agreement has been sent to the post office.',
        apiData,
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

    const apiData = {
      ...form._doc,
      exclusivity: !form.refFormId
        ? true
        : form.refFormId.exclusivity
        ? true
        : false,
    };

    res.status(200).json({
      message: `Form found in the database`,
      status: 'success',
      apiData,
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
        return res.status(200).json({
          message: `Form with id "${formId}" not found`,
          status: 'warning',
        });
      }

      if (vbForm.agreementLink) {
        return res.status(200).json({
          message: 'The agreement link already exists',
          status: 'warning',
        });
      }

      if (!vbForm.sender) {
        return res.status(200).json({
          message: 'The sender of the vb form was not found in the database',
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
        return res.status(200).json({
          message: 'Error when uploading pdf file to storage',
          status: 'warning',
        });
      }

      const accountActivationLink = vbForm?.refFormId
        ? `${process.env.CLIENT_URI}/licensors/?unq=${vbForm._id}`
        : '';

      await updateVbFormByFormId(formId, {
        agreementLink,
        ...(accountActivationLink && {
          accountActivationLink,
        }),
      });

      const dataForSendingMainInfo = {
        name: vbForm.sender.name,
        clientEmail: vbForm.sender.email,
        videoLinks: vbForm.videoLinks,
        didYouRecord: vbForm.didYouRecord,
        ...(vbForm.operator && { operator: vbForm.operator }),
        ...(vbForm.resources.length > 0 && { resources: vbForm.resources }),
        over18YearOld: vbForm.over18YearOld,
        agreedWithTerms: vbForm.agreedWithTerms,
        noSubmitAnywhere: vbForm.noSubmitAnywhere,
        didNotGiveRights: vbForm.didNotGiveRights,
        ip: vbForm.ip,
        createdAt: vbForm.createdAt,
        agreementLink: agreementLink,
        formId: vbForm.formId,
        refForm: vbForm.refFormId ? true : false,
        ...(vbForm?.refFormId?.advancePayment && {
          advancePayment: vbForm.refFormId.advancePayment,
        }),
        ...(vbForm?.refFormId?.percentage && {
          percentage: vbForm.refFormId.percentage,
        }),
        ...(vbForm?.refFormId?.researcher && {
          researcherEmail: vbForm?.refFormId?.researcher?.email,
        }),
      };

      const dataForSendingAgreement = {
        name: vbForm.sender.name,
        agreementLink,
        email: vbForm.sender.email,
        ...(accountActivationLink && {
          accountActivationLink,
        }),
      };

      if (vbForm.refFormId) {
        const linkData = await findLinkByVideoId(vbForm.refFormId.videoId);

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

      if (vbForm?.refFormId?.researcher?.email) {
        await sendEmail({
          emailFrom: '"«VIRALBEAR» LLC" <info@viralbear.media>',
          emailTo: vbForm.refFormId.researcher.email,
          subject: `Link to the personal account of the author`,
          html: `
          Hello ${vbForm.refFormId.researcher.name}.<br/>
          This is a link to the personal account of the author ${vbForm?.sender?.name} with email ${vbForm?.sender?.email}:<br/>
          ${accountActivationLink}<br/>
          Have a nice day!
          `,
        });
      }

      return res.status(200).json({
        message: `The agreement was uploaded to the storage and sent to "${vbForm?.sender?.email}"`,
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
