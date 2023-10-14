const express = require('express');
const router = express.Router();
const multer = require('multer');

const calcVbCode = require('../utils/calcVbCode');
const socketInstance = require('../socket.instance');
const { v4: createUniqueHash } = require('uuid');
const path = require('path');
const moment = require('moment');

const pdfConverter = require('html-pdf');

const { errorsHandler } = require('../handlers/error.handler');

const {
  generatingTextOfAgreement,
} = require('../utils/vbForm/generatingTextOfAgreement.util');

const {
  findLastAddedVbForm,
  createNewVbForm,
  updateVbFormByFormId,
  deleteVbFormBy,
  deleteVbFormsBy,
  findAllVbForms,
} = require('../controllers/uploadInfo.controller');

const {
  getUserByEmail,
  createUser,
  getUserById,
  getAllUsers,
  getUserBy,
  updateUserBy,
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

const {
  findLinkByVideoId,
  findLinkBy,
} = require('../controllers/links.controller');

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
    console.log(errorsHandler({ err, trace: 'uploadinfo.addAdditionalInfo' }));
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
        ipData: reqIPData,
        formHash,
        formHashSimple,
        researcherName,
        localeForAgreement,
        signatureUrl,
        signatureArray,
        signatureIsEmpty,
        socketId,
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
        !reqIPData ||
        !signatureUrl ||
        !localeForAgreement
      ) {
        return res.status(200).json({
          message: 'Missing parameters for saving the form',
          status: 'warning',
        });
      }

      const ipData = JSON.parse(reqIPData);

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

        if (!authorLinkWithThisHash) {
          return res.status(200).json({
            message: 'Invalid link for the form. Request another one...',
            status: 'warning',
          });
        }

        if (authorLinkWithThisHash.used === true) {
          return res.status(200).json({
            message: 'A video has already been added to this link',
            status: 'warning',
          });
        }

        await deleteVbFormsBy({
          deleteBy: 'refFormId',
          value: authorLinkWithThisHash._id,
        });
      }

      const lastAddedVbForm = await findLastAddedVbForm();

      const vbCode = calcVbCode(lastAddedVbForm);

      const videoLinks = [...(!!videoLink ? [videoLink] : [])];

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
                socketInfo: {
                  userId: socketId,
                  socketEmitName: 'sendingVbForm',
                  fileName: file.originalname,
                  eventName: 'Uploading videos to storage',
                },
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
        ...(ipData.status === 'success' && {
          ipAddress: ipData.resData,
        }),
        dynamicSignature: signatureUrl,
        name,
        lastName,
        email,
      };

      const resAfterPdfGenerate = await new Promise(async (resolve, reject) => {
        socketInstance.io().sockets.in(socketId).emit('sendingVbForm', {
          event: 'Generating an agreement',
          file: null,
        });

        pdfConverter
          .create(generatingTextOfAgreement(dynamicDataForAgreement), {
            format: 'A4',
            childProcessOptions: {
              env: {
                OPENSSL_CONF: '/dev/null',
              },
            },
            border: {
              bottom: '30px',
              top: '30px',
              left: '30px',
              right: '30px',
            },
          })
          .toBuffer(async (err, buffer) => {
            if (err) {
              console.log(
                errorsHandler({ err, trace: 'uploadinfo.convertAgreement' })
              );
              resolve({
                status: 'error',
                event: 'pdfGenerate',
                message: 'Error at the agreement generation stage. Try again.',
              });
            }
            if (buffer) {
              await uploadFileToStorage({
                folder: 'agreement',
                name: `${createUniqueHash()}-${vbCode}`,
                buffer,
                type: 'application/pdf',
                extension: '.pdf',
                resolve,
                socketInfo: {
                  userId: socketId,
                  socketEmitName: 'sendingVbForm',
                  eventName: 'Saving the agreement to the repository',
                },
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

      socketInstance.io().sockets.in(socketId).emit('sendingVbForm', {
        event: 'Saving data...',
        file: null,
      });

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
        !!authorLinkWithThisHash?.advancePayment;

      let authorLinkForConnectWithResearcher = null;

      if (!!formHashSimple) {
        const researcher = await getUserBy({
          searchBy: 'name',
          value: formHashSimple,
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
            researcherIsSelectedByAuthor: true,
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
        ...(ipData.status === 'success' && {
          ip: ipData.resData,
        }),
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

      if (ipData.status === 'error') {
        console.log({
          vbCode: newVbForm.formId,
          defineIPError: ipData.errData,
          authorEmail: author.email,
        });
      }

      const defineAccountActivationLink = () => {
        if (!newVbForm?.refFormId) {
          return {
            accountActivationLink: null,
            annotation: 'noRefForm',
          };
        } else {
          if (!newVbForm.refFormId.paid) {
            return {
              accountActivationLink: null,
              annotation: 'noPaidRefForm',
            };
          } else {
            if (!!newVbForm.sender?.activatedTheAccount) {
              return {
                accountActivationLink: null,
                annotation: 'accountAlreadyActivated',
              };
            } else {
              if (!newVbForm.sender?.accountActivationLink) {
                return {
                  accountActivationLink: `${process.env.CLIENT_URI}/login/?auth_hash=${newVbForm._id}`,
                  annotation: 'activationLinkGenerated',
                };
              } else {
                return {
                  accountActivationLink: newVbForm.sender.accountActivationLink,
                  annotation: 'activationLinkAlreadyExist',
                };
              }
            }
          }
        }
      };

      const { annotation, accountActivationLink } =
        defineAccountActivationLink();

      const defineTextForAuthor = () => {
        switch (annotation) {
          case 'noRefForm':
          case 'noPaidRefForm':
            return `
              Hello ${newVbForm.sender.name}.<br/>
              Thank you for uploading the video to our platform. The agreement file is in the attachment of this email.<br/>
              Have a nice day!
              `;
          case 'accountAlreadyActivated':
            return `
                Hello ${newVbForm.sender.name}.<br/>
                Thank you for uploading the video to our platform.<br/>
                Log in to viralbear.media with your details: ${process.env.CLIENT_URI}/login. The agreement file is in the attachment of this email.<br/>
                Have a nice day!
                `;
          case 'activationLinkGenerated':
          case 'activationLinkAlreadyExist':
            return `
                Hello ${newVbForm.sender.name}.<br/>
                Thank you for uploading the video to our platform.<br/>
                Follow the links and set the password for the viralbear.media personal account: ${accountActivationLink}. The agreement file is in the attachment of this email.<br/>
                Have a nice day!
                `;
        }
      };

      if (annotation === 'activationLinkGenerated') {
        await updateUserBy({
          updateBy: '_id',
          value: newVbForm.sender._id,
          objDBForSet: {
            accountActivationLink,
          },
        });
      }

      const dataForSendingMainInfo = {
        vbForm: newVbForm,
        ...(!!accountActivationLink && { accountActivationLink }),
      };

      const dataForSendingAgreement = {
        name: newVbForm.sender.name,
        agreementLink: newVbForm.agreementLink,
        email: newVbForm.sender.email,
        text: defineTextForAuthor(),
      };

      if (!!newVbForm.refFormId?.paid) {
        const linkData = await findLinkBy({
          searchBy: 'unixid',
          value: newVbForm.refFormId.videoId,
        });

        if (!!linkData?.trelloCardId && process.env.MODE === 'production') {
          const trelloCard = await getCardDataByCardId(linkData.trelloCardId);

          await updateCustomFieldByTrelloCard(
            trelloCard.id,
            process.env.TRELLO_CUSTOM_FIELD_VB_CODE,
            {
              value: {
                number: newVbForm.formId.replace('VB', ''),
              },
            }
          );
        }
      }

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

      sendMainInfoByVBToServiceMail(dataForSendingMainInfo);
      sendAgreementToClientMail(dataForSendingAgreement);

      return res.status(200).json({
        message:
          'The data has been uploaded successfully. The agreement has been sent to the post office.',
        apiData,
        status: 'success',
      });
    } catch (err) {
      console.log(errorsHandler({ err, trace: 'uploadinfo.create' }));
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
    console.log(errorsHandler({ err, trace: 'uploadinfo.findOne' }));
    res.status(500).json({ message: 'Server side error', status: 'error' });
  }
});

module.exports = router;
