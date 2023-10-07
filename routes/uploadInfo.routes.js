const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middleware/auth.middleware');
const calcVbCode = require('../utils/calcVbCode');
const socketInstance = require('../socket.instance');
const { v4: createUniqueHash } = require('uuid');
const path = require('path');
const moment = require('moment');
const fs = require('fs');

const pdfConverter = require('html-pdf');

const htmlPDF = require('puppeteer-html-pdf');

const {
  generatingTextOfAgreement,
} = require('../utils/vbForm/generatingTextOfAgreement.util');

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
  updateManyAuthorLinks,
  createNewAuthorLink,
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

    const vbForm = await findOne({
      searchBy: 'formId',
      param: formId,
    });

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
      refForm: !!vbForm?.refFormId ? true : false,
      ...(!!vbForm?.refFormId?.researcher?.email && {
        researcherEmail: vbForm.refFormId.researcher.email,
      }),
    };

    await updateVbFormByFormId(formId, objDB);

    sendSurveyInfoToServiceMail({ ...objDB, formId });

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
        formHashSimple,
        researcherName,
        localeForAgreement,
        signatureUrl,
        signatureArray,
        signatureIsEmpty,
      } = req?.body;

      if (
        !!JSON.parse(signatureIsEmpty) ||
        !JSON.parse(signatureArray).length
      ) {
        return res.status(200).json({
          message: 'We cannot accept the form without your signature',
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
        !ip ||
        !signatureUrl ||
        !localeForAgreement
      ) {
        return res.status(200).json({
          message: 'Missing parameters for saving the form',
          status: 'warning',
        });
      }

      const parseLocaleText = JSON.parse(localeForAgreement);

      const { videos } = req.files;

      if (!videos && !videoLink) {
        return res.status(200).json({
          message: 'Enter a link or upload a video',
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

      let authorLinkWithThisHash = null;

      if (!!formHash) {
        authorLinkWithThisHash = await findOneRefFormByParam({
          searchBy: 'formHash',
          value: formHash,
        });
      }

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

      const lastAddedVbForm = await findLastAddedVbForm();

      const vbCode = calcVbCode(lastAddedVbForm);

      let videoLinks = [videoLink];

      if (!!videos && videos.length) {
        await Promise.all(
          videos?.map(async (file) => {
            const resStorage = await new Promise(async (resolve, reject) => {
              await uploadFileToStorage({
                folder: 'client-videos',
                name: `${createUniqueHash()}-${vbCode}`,
                buffer: file.buffer,
                type: file.mimetype,
                extension: path.extname(file.originalname),
                resolve,
              });
            });

            if (resStorage.status === 'success') {
              videoLinks.push(resStorage.response.Location);
            } else {
              return res.status(200).json({
                message: 'Error during video upload',
                status: 'warning',
              });
            }
          })
        );
      }

      const dynamicDataForAgreement = {
        parseLocaleText,
        exclusivity: authorLinkWithThisHash?.exclusivity,
        percentage: authorLinkWithThisHash?.percentage,
        advancePayment: authorLinkWithThisHash?.advancePayment,
        videoLinks,
        ipAddress: ip,
        dynamicSignature: signatureUrl,
        name,
        lastName,
        email,
      };

      const resAfterPdfGenerate = await new Promise(async (resolve, reject) => {
        //await htmlPDF.create(
        //  generatingTextOfAgreement(dynamicDataForAgreement),
        //  {
        //    format: 'A4',
        //    margin: {
        //      bottom: '30px',
        //      top: '30px',
        //      left: '30px',
        //      right: '30px',
        //    },
        //  },
        //  async (err, buffer) => {
        //    if (err) {
        //      console.log(err);
        //      resolve({
        //        status: 'error',
        //        event: 'pdfGenerate',
        //        message: 'Error at the agreement generation stage. Try again.',
        //      });
        //    }
        //    if (buffer) {
        //      await uploadFileToStorage({
        //        folder: 'agreement',
        //        name: `${createUniqueHash()}-${vbCode}`,
        //        buffer,
        //        type: 'application/pdf',
        //        extension: '.pdf',
        //        resolve,
        //      });
        //    }
        //  }
        //);

        pdfConverter
          .create(generatingTextOfAgreement(dynamicDataForAgreement), {
            format: 'A4',
            border: {
              bottom: '30px',
              top: '30px',
              left: '30px',
              right: '30px',
            },
          })
          .toBuffer(async (err, buffer) => {
            if (err) {
              console.log(err);
              resolve({
                status: 'error',
                event: 'pdfGenerate',
                message: 'Error at the agreement generation stage. Try again.',
              });
            }
            if (buffer) {
              console.log(buffer, 77);

              await uploadFileToStorage({
                folder: 'agreement',
                name: `${createUniqueHash()}-${vbCode}`,
                buffer,
                type: 'application/pdf',
                extension: '.pdf',
                resolve,
              });
            }
          });
      });

      if (resAfterPdfGenerate.status === 'error') {
        return res.status(200).json({
          message: resAfterPdfGenerate.message,
          status: 'warning',
        });
      }

      const agreementLink = resAfterPdfGenerate.response.Location;

      if (!agreementLink) {
        return res.status(200).json({
          message:
            'Error at the stage of saving the agreement to the repository',
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

      const isFormImpliesAnAdvancePayment =
        authorLinkWithThisHash && !!authorLinkWithThisHash.advancePayment;

      let authorLinkForConnectWithResearcher = null;

      if (!!formHashSimple) {
        const allResearchers = await getAllUsers({ roles: ['researcher'] });

        const researcher = allResearchers.find((researcher) => {
          return researcher._id.toString().includes(formHashSimple);
        });

        if (!!researcher) {
          authorLinkForConnectWithResearcher = await createNewAuthorLink({
            researcher: researcher._id,
            advancePayment: 0,
            percentage: 0,
            exclusivity: true,
            used: true,
            paid: false,
          });
        }
      }

      if (!!researcherName && researcherName !== 'No') {
        const researcher = await getUserBy({
          searchBy: 'name',
          value: researcherName,
        });

        if (!!researcher) {
          authorLinkForConnectWithResearcher = await createNewAuthorLink({
            researcher: researcher._id,
            advancePayment: 0,
            percentage: 0,
            exclusivity: true,
            used: true,
            paid: false,
          });
        }
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
        formId: `VB${vbCode}`,
        ip,
        ...((!!authorLinkWithThisHash ||
          !!authorLinkForConnectWithResearcher) && {
          refFormId: !!authorLinkWithThisHash
            ? authorLinkWithThisHash._id
            : authorLinkForConnectWithResearcher._id,
        }),
        ...(isFormImpliesAnAdvancePayment && {
          advancePaymentReceived: false,
        }),
        agreementLink,
      };

      await createNewVbForm(objDB);

      const newVbForm = await findOne({
        searchBy: 'formId',
        param: `VB${vbCode}`,
      });

      if (!!authorLinkWithThisHash) {
        await updateManyAuthorLinks({
          searchBy: 'videoId',
          searchValue: authorLinkWithThisHash.videoId,
          objForSet: {
            used: true,
          },
        });
      }

      const apiData = {
        vbFormCode: newVbForm.formId,
      };

      return res.status(200).json({
        message:
          'The data has been uploaded successfully. The agreement has been sent to the post office.',
        apiData,
        status: 'success',
      });
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        message: err?.message ? err.message : 'Server-side error',
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
        message: `The form was not found in the database`,
        status: 'warning',
      });
    }

    const apiData = {
      ...form._doc,
      exclusivity: !form?.refFormId
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
      //const { pdf } = req.files;
      //const { formId } = req.body;

      //if (!pdf) {
      //  return res.status(400).json({
      //    message: 'missing pdf file',
      //    status: 'error',
      //  });
      //}

      //if (!pdf.length > 1) {
      //  return res.status(400).json({
      //    message: 'A maximum of 1 pdf file is expected',
      //    status: 'warning',
      //  });
      //}

      //if (!formId) {
      //  return res.status(404).json({
      //    message: `missing form id value`,
      //    status: 'error',
      //  });
      //}

      //const objToSearchVbForm = {
      //  searchBy: 'formId',
      //  param: formId,
      //};

      //const vbForm = await findOne(objToSearchVbForm);

      //if (!vbForm) {
      //  return res.status(200).json({
      //    message: `Form with id "${formId}" not found`,
      //    status: 'warning',
      //  });
      //}

      //if (vbForm.agreementLink) {
      //  return res.status(200).json({
      //    message: 'The agreement link already exists',
      //    status: 'warning',
      //  });
      //}

      //if (!vbForm.sender) {
      //  return res.status(200).json({
      //    message: 'The sender of the vb form was not found in the database',
      //    status: 'warning',
      //  });
      //}

      //const resStorage = await new Promise(async (resolve, reject) => {
      //  await uploadFileToStorage(
      //    pdf[0].originalname,
      //    'agreement',
      //    `${createUniqueHash()}-${formId.replace('VB', '')}`,
      //    pdf[0].buffer,
      //    pdf[0].mimetype,
      //    path.extname(pdf[0].originalname),
      //    resolve,
      //    reject,
      //    'progressUploadByStorage',
      //    'Uploading the agreement to the storage'
      //  );
      //});

      //const agreementLink = resStorage.response.Location;

      //if (!agreementLink) {
      //  return res.status(200).json({
      //    message: 'Error when uploading pdf file to storage',
      //    status: 'warning',
      //  });
      //}

      const accountActivationLink = `${process.env.CLIENT_URI}/login/?auth_hash=${vbForm._id}`;

      const isPaidForm =
        !!vbForm?.refFormId?.advancePayment || !!vbForm?.refFormId?.percentage;

      const isNoPaidForm =
        (!!vbForm?.refFormId && !vbForm?.refFormId?.paid) ||
        (!!vbForm?.refFormId &&
          !vbForm?.refFormId?.advancePayment &&
          !vbForm?.refFormId?.percentage);

      const isRefForm = !!vbForm?.refFormId;

      const sendLinkToActivateYourAccount =
        !!vbForm?.refFormId?.researcher?.email &&
        !vbForm.sender?.activatedTheAccount &&
        isPaidForm;

      const TextOfMailForAuthor =
        !isRefForm || isNoPaidForm
          ? `
      Hello ${vbForm.sender.name}.<br/>
      Thank you for uploading the video to our platform. The agreement file is in the attachment of this email.<br/>
      Have a nice day!
      `
          : !vbForm.sender?.activatedTheAccount
          ? `
        Hello ${vbForm.sender.name}.<br/>
        Thank you for uploading the video to our platform.<br/>
        Follow the links and set the password for the viralbear.media personal account: ${accountActivationLink}. The agreement file is in the attachment of this email.<br/>
        Have a nice day!
        `
          : `
        Hello ${vbForm.sender.name}.<br/>
        Thank you for uploading the video to our platform.<br/>
        Log in to viralbear.media with your details: ${process.env.CLIENT_URI}. The agreement file is in the attachment of this email.<br/>
        Have a nice day!
        `;

      await updateVbFormByFormId(formId, {
        agreementLink,
        ...(vbForm?.refFormId && {
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
        ...(isRefForm && {
          refForm: vbForm.refFormId,
        }),
        ...(sendLinkToActivateYourAccount && {
          accountActivationLink,
        }),
      };

      const dataForSendingAgreement = {
        name: vbForm.sender.name,
        agreementLink,
        email: vbForm.sender.email,
        text: TextOfMailForAuthor,
      };

      if (!!vbForm.refFormId?.paid) {
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

      sendMainInfoByVBToServiceMail(dataForSendingMainInfo);
      sendAgreementToClientMail(dataForSendingAgreement);

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
