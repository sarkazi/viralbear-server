const express = require('express');
const router = express.Router();
const { genSalt, hash: hashBcrypt } = require('bcryptjs');
const moment = require('moment');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');

const authMiddleware = require('../middleware/auth.middleware');

const validationForRequiredInputDataInUserModel = require('../utils/validationForRequiredInputDataInUserModel');

const {
  getAllUsers,
  deleteUser,
  sendPassword,
  createUser,
  recoveryPassword,
  getUserById,
  updateUser,
  getUserByEmail,
  getUserBySearchValue,
  findUsersByValueList,
  getUserBy,
} = require('../controllers/user.controller.js');

const { createNewPayment } = require('../controllers/payment.controller');

const { generateTokens } = require('../controllers/auth.controllers');

const {
  findOne,
  updateVbFormByFormId,
  updateVbFormBy,
} = require('../controllers/uploadInfo.controller');

const {
  getCountLinksByUserEmail,
  getCountLinks,
} = require('../controllers/links.controller');

const {
  getSalesByUserId,
  getAllSales,
  updateSalesBy,
  updateSaleBy,
  findSaleById,
  markEmployeeOnSalesHavingReceivePercentage,
} = require('../controllers/sales.controller');

const { sendEmail } = require('../controllers/sendEmail.controller');

const { findAllAuthorLinks } = require('../controllers/authorLink.controller');

const {
  getCountAcquiredVideoByUserEmail,
  getAllVideos,
  findVideoByValue,
  getCountVideosBy,
  updateVideosBy,
  markVideoEmployeeAsHavingReceivedAnAdvance,
} = require('../controllers/video.controller');

const {
  getCountApprovedTrelloCardBy,
} = require('../controllers/movedFromReviewList.controller');

const { inviteMemberOnBoard } = require('../controllers/trello.controller');

const { uploadFileToStorage } = require('../controllers/storage.controller');

const storage = multer.memoryStorage();

router.get('/getAll', authMiddleware, async (req, res) => {
  try {
    const {
      me,
      roles,
      canBeAssigned,
      fieldsInTheResponse,
      sortByPosition,
      page,
      limit,
    } = req.query;

    const userId = req.user.id;

    let count = 0;
    let pageCount = 0;

    let users = await getAllUsers({
      me,
      userId,
      roles: roles ? roles : [],
      canBeAssigned,
      ...(fieldsInTheResponse && {
        fieldsInTheResponse,
      }),
    });

    if (sortByPosition && typeof JSON.parse(sortByPosition)) {
      const defineDescForUsers = ({ position, country }) => {
        if (position.includes('owner') || position.includes('ceo')) {
          return 'Owner and CEO';
        } else if (
          position.includes('researcher') &&
          !position.includes('senior')
        ) {
          return `Researcher${country ? ` | ${country}` : ''}`;
        } else if (
          position.includes('researcher') &&
          position.includes('senior')
        ) {
          return `Senior researcher${country ? ` | ${country}` : ''}`;
        } else {
          return position;
        }
      };

      users = users
        .reduce(
          (res, item) => {
            res[
              !item.position.includes('ceo') || !item.position.includes('owner')
                ? 'first'
                : !item.position.includes('researcher')
                ? 'third'
                : 'second'
            ].push(item);
            return res;
          },
          { first: [], second: [], third: [] }
        )
        .map((user) => {
          return {
            id: user._id,
            name: user.name,
            avatarUrl: user?.avatarUrl ? user.avatarUrl : null,
            description: defineDescForUsers({
              position: user.position,
              country: user.country,
            }),
            canBeAssigned: user.canBeAssigned,
          };
        });

      users = {
        first: users.first,
        second: users.second,
        third: users.third.sort(cur, (next) => {
          if (cur.position.includes('senior')) {
            return cur - next;
          }
        }),
      };

      console.log(users, 8989);
    }

    if (limit && page) {
      count = users.length;
      pageCount = Math.ceil(count / limit);

      const skip = (page - 1) * limit;

      users = await getAllUsers({
        me,
        userId,
        roles: roles ? roles : [],
        canBeAssigned,
        ...(fieldsInTheResponse && {
          fieldsInTheResponse,
        }),
        skip,
        limit,
      });
    }

    const apiData = {
      ...(limit &&
        page && {
          pagination: {
            count,
            pageCount,
          },
        }),
      users,
    };

    return res.status(200).json({
      status: 'success',
      message: 'The list of employees has been received',
      apiData,
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ status: 'error', message: 'Server side error' });
  }
});

router.get('/findToDisplayOnTheSite', async (req, res) => {
  try {
    let users = await getAllUsers({
      exist: ['position'],
      displayOnTheSite: true,
    });

    users = users.reduce(
      (res, item) => {
        res[
          item.position.toLowerCase().includes('ceo') ||
          item.position.toLowerCase().includes('owner')
            ? 'first'
            : item.position.toLowerCase().includes('researcher')
            ? 'third'
            : 'second'
        ].push(item);
        return res;
      },
      { first: [], second: [], third: [] }
    );

    users = {
      first: users.first.map((user) => {
        return {
          id: user._id,
          name: user.name,
          email: user.email,
          avatarUrl: user?.avatarUrl ? user.avatarUrl : null,
          ...(user?.position && { position: user?.position }),
          ...(user?.country && { country: user?.country }),
        };
      }),
      second: users.second.map((user) => {
        return {
          id: user._id,
          name: user.name,
          email: user.email,
          avatarUrl: user?.avatarUrl ? user.avatarUrl : null,
          ...(user?.position && { position: user?.position }),
          ...(user?.country && { country: user?.country }),
        };
      }),

      third: users.third
        .sort((cur, next) => {
          if (cur.position.toLowerCase().includes('senior')) {
            return cur - next;
          }
        })
        .map((user) => {
          return {
            id: user._id,
            name: user.name,
            email: user.email,
            avatarUrl: user?.avatarUrl ? user.avatarUrl : null,
            ...(user?.position && { position: user?.position }),
            ...(user?.country && { country: user?.country }),
          };
        }),
    };

    return res.status(200).json({
      status: 'success',
      message: 'The list of employees has been received',
      apiData: users,
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ status: 'error', message: 'Server side error' });
  }
});

router.get('/getById/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await getUserById(userId);

    if (!user) {
      return res
        .status(200)
        .json({ message: 'User is not found', status: 'warning' });
    }

    return res.status(200).json({ apiData: user, status: 'success' });
  } catch (err) {
    console.log(err);
  }
});

router.get('/getBy/:value', authMiddleware, async (req, res) => {
  try {
    const { param, fieldsInTheResponse } = req.query;
    const { value } = req.params;

    const user = await getUserBy({
      param,
      value,
      ...(fieldsInTheResponse && {
        fieldsInTheResponse,
      }),
    });

    if (!user) {
      return res
        .status(200)
        .json({ message: 'User is not found', status: 'warning' });
    }

    return res.status(200).json({ apiData: user, status: 'success' });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.post('/createOne', authMiddleware, async (req, res) => {
  try {
    const body = req.body;

    const isValidate = validationForRequiredInputDataInUserModel(
      body.role,
      body,
      null
    );

    if (!isValidate) {
      return res
        .status(200)
        .json({ message: 'Missing data to create a user', status: 'warning' });
    }

    const candidate = await getUserByEmail(body.email);

    if (candidate) {
      return res.status(200).json({
        message: 'A user with this email already exists',
        status: 'warning',
      });
    }

    let paymentInfo = null;

    if (body?.paymentMethod) {
      if (body.paymentMethod === 'bankTransfer') {
        if (
          !body?.phoneBankTransfer ||
          !body?.emailBankTransfer ||
          !body?.addressBankTransfer ||
          !body?.zipCodeBankTransfer ||
          !body?.bankNameBankTransfer ||
          !body?.fullNameBankTransfer ||
          !body?.accountNumberBankTransfer
        ) {
          return res.status(200).json({
            message: 'Missing parameters for changing payment data',
            status: 'warning',
          });
        }

        paymentInfo = {
          paymentInfo: {
            variant: body.paymentMethod,
            phoneNumber: body.phoneBankTransfer,
            email: body.emailBankTransfer,
            address: body.addressBankTransfer,
            zipCode: body.zipCodeBankTransfer,
            bankName: body.bankNameBankTransfer,
            fullName: body.fullNameBankTransfer,
            iban: body.accountNumberBankTransfer,
          },
        };
      }

      if (body.paymentMethod === 'payPal') {
        if (!body?.payPalEmail) {
          return res.status(200).json({
            message: 'Missing parameters for changing payment data',
            status: 'warning',
          });
        }

        paymentInfo = {
          paymentInfo: {
            variant: body.paymentMethod,
            payPalEmail: body.payPalEmail,
          },
        };
      }

      if (body.paymentMethod === 'other') {
        if (!body?.textFieldOther) {
          return res.status(200).json({
            message: 'Missing parameters for changing payment data',
            status: 'warning',
          });
        }

        paymentInfo = {
          paymentInfo: {
            variant: body.paymentMethod,
            value: body.textFieldOther,
          },
        };
      }
    }

    const salt = await genSalt(10);

    const objDB = {
      name: body.name,
      ...(body?.position && { position: body.position }),
      password: await hashBcrypt(body.password, salt),
      ...(body?.nickname && { nickname: `@${body.nickname}` }),
      role: body.role,
      email: body.email,
      ...(body?.percentage && { percentage: body.percentage }),
      ...(body?.advancePayment && { advancePayment: body.advancePayment }),
      ...(body?.country && { country: body.country }),
      ...(paymentInfo && paymentInfo),

      ...(typeof body?.canBeAssigned === 'boolean' && {
        canBeAssigned: body.canBeAssigned,
      }),
      ...(typeof body?.displayOnTheSite === 'boolean' && {
        displayOnTheSite: body.displayOnTheSite,
      }),
      ...((body.role === 'author' ||
        body.role === 'researcher' ||
        body.role === 'stringer') && {
        balance: 0,
      }),
    };

    await createUser(objDB);

    return res.status(200).json({
      message: 'A new user has been successfully created',
      status: 'success',
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.post('/sendPassword', sendPassword);

router.post('/recoveryPassword', recoveryPassword);

router.patch(
  '/updateOne',
  authMiddleware,
  multer({ storage: storage }).fields([
    {
      name: 'avatarFile',
      maxCount: 1,
    },
  ]),
  async (req, res) => {
    try {
      const files = req.files;

      const { userId, rolesUsersForResponse } = req.query;

      const userIdToUpdate = userId ? userId : req.user.id;

      if (!userIdToUpdate) {
        return res.status(200).json({
          message: 'Empty user ID',
          status: 'warning',
        });
      }

      const user = await getUserById(userIdToUpdate);

      const body = req.body;

      if (!user) {
        return res.status(200).json({
          message: 'User not found',
          status: 'warning',
        });
      }

      if (!body?.paymentMethod && !!user?.paymentInfo) {
        await updateUser({
          userId: userIdToUpdate,
          objDBForUnset: { paymentInfo: 1 },
          objDBForSet: {},
          objDBForIncrement: {},
        });
      }

      let paymentInfo = null;

      if (body?.paymentMethod) {
        if (body.paymentMethod === 'bankTransfer') {
          if (
            !body?.phoneBankTransfer ||
            !body?.emailBankTransfer ||
            !body?.addressBankTransfer ||
            !body?.zipCodeBankTransfer ||
            !body?.bankNameBankTransfer ||
            !body?.fullNameBankTransfer ||
            !body?.accountNumberBankTransfer
          ) {
            return res.status(200).json({
              message: 'Missing parameters for changing payment data',
              status: 'warning',
            });
          }

          paymentInfo = {
            paymentInfo: {
              variant: body.paymentMethod,
              phoneNumber: body.phoneBankTransfer,
              email: body.emailBankTransfer,
              address: body.addressBankTransfer,
              zipCode: body.zipCodeBankTransfer,
              bankName: body.bankNameBankTransfer,
              fullName: body.fullNameBankTransfer,
              iban: body.accountNumberBankTransfer,
            },
          };
        }

        if (body.paymentMethod === 'payPal') {
          if (!body?.payPalEmail) {
            return res.status(200).json({
              message: 'Missing parameters for changing payment data',
              status: 'warning',
            });
          }

          paymentInfo = {
            paymentInfo: {
              variant: body.paymentMethod,
              payPalEmail: body.payPalEmail,
            },
          };
        }

        if (body.paymentMethod === 'other') {
          if (!body?.textFieldOther) {
            return res.status(200).json({
              message: 'Missing parameters for changing payment data',
              status: 'warning',
            });
          }

          paymentInfo = {
            paymentInfo: {
              variant: body.paymentMethod,
              value: body.textFieldOther,
            },
          };
        }
      }

      if (user.role === 'author') {
        const isValidate = validationForRequiredInputDataInUserModel(
          user.role,
          body,
          'update'
        );

        if (!isValidate) {
          return res.status(200).json({
            message: 'Missing value for update payment information',
            status: 'warning',
          });
        }
      }

      let avatarUrl = null;

      if (files?.avatarFile) {
        const { response } = await new Promise(async (resolve, reject) => {
          await uploadFileToStorage(
            null,
            'avatarsOfUsers',
            `avatar-${userId}`,
            files.avatarFile[0].buffer,
            files.avatarFile[0].mimetype,
            path.extname(files.avatarFile[0].originalname),
            resolve,
            reject,
            null,
            null,
            userId
          );
        });

        avatarUrl = response?.Location;
      }

      objDBForSet = {
        ...(body?.name && { name: body.name }),
        ...(body?.position && { position: body.position }),
        ...(body?.nickname && { nickname: `@${body.nickname}` }),
        ...(body?.role && { role: body.role }),
        ...(body?.email && { email: body.email }),
        ...(body?.percentage && { percentage: body.percentage }),
        ...(body?.advancePayment && { advancePayment: body.advancePayment }),
        ...(body?.country && { country: body.country }),
        ...(paymentInfo && paymentInfo),
        ...(avatarUrl && { avatarUrl }),
        ...(typeof body?.canBeAssigned === 'boolean' && {
          canBeAssigned: body.canBeAssigned,
        }),
        ...(typeof body?.displayOnTheSite === 'boolean' && {
          displayOnTheSite: body.displayOnTheSite,
        }),
        ...(body?.balance && { lastPaymentDate: moment().toDate() }),
      };

      objDBForIncrement = {
        ...(body?.balance && { balance: body.balance }),
      };

      await updateUser({
        userId: userIdToUpdate,
        objDBForUnset: {},
        objDBForSet,
        objDBForIncrement: {},
      });

      let apiData;

      if (rolesUsersForResponse) {
        apiData = await getAllUsers({
          me: true,
          userId: null,
          role: rolesUsersForResponse,
        });
      } else {
        apiData = await getUserById(userId);
      }

      return res.status(200).json({
        message: 'User data has been successfully updated',
        status: 'success',
        apiData,
      });
    } catch (err) {
      console.log(err);
      return res.status(500).json({
        message: 'Server side error',
        status: 'error',
      });
    }
  }
);

router.get('/collectStatForEmployees', authMiddleware, async (req, res) => {
  const { roles } = req.query;

  try {
    const users = await getAllUsers({
      me: true,
      userId: null,
      roles,
    });

    const employeeStat = await Promise.all(
      users.map(async (user) => {
        //-----------------------------------------------------------------------------------------------------

        const salesLast30Days = await getSalesByUserId({
          userId: user._id,
          dateLimit: 30,
        });

        const salesTotal = await getSalesByUserId({
          userId: user._id,
          dateLimit: null,
        });

        const earnedYourselfLast30Days = salesLast30Days.reduce((acc, sale) => {
          return acc + sale.amountToResearcher;
        }, 0);

        const earnedYourselfTotal = salesTotal.reduce(
          (a, sale) => a + +sale.amountToResearcher,
          0
        );
        const earnedTotal = salesTotal.reduce(
          (a, sale) => a + +(sale.amount / sale.researchers.length),
          0
        );

        const earnedCompanies = salesTotal.reduce(
          (a, sale) => a + ((sale.amount / sale.researchers.length) * 60) / 100,
          0
        );

        const linksCountLast30Days = await getCountLinksByUserEmail(
          user.email,
          30
        );

        const linksCountLast7Days = await getCountLinksByUserEmail(
          user.email,
          7
        );

        const linksCount = await getCountLinksByUserEmail(user.email, null);

        const acquiredVideosCountLast30DaysMainRole = await getCountVideosBy({
          forLastDays: 30,
          isApproved: true,
          user: {
            value: user.email,
            purchased: true,
            searchBy: 'email',
          },
        });

        const acquiredVideosCountLast30DaysNoMainRole = await getCountVideosBy({
          forLastDays: 30,
          isApproved: true,
          user: {
            value: user.email,
            purchased: false,
            searchBy: 'email',
          },
        });

        const acquiredVideosCountLast7DaysMainRole = await getCountVideosBy({
          forLastDays: 7,
          isApproved: true,
          user: {
            value: user.email,
            purchased: true,
            searchBy: 'email',
          },
        });

        const acquiredVideosCountLast7DaysNoMainRole = await getCountVideosBy({
          forLastDays: 7,
          isApproved: true,
          user: {
            value: user.email,
            purchased: false,
            searchBy: 'email',
          },
        });

        const acquiredVideosCountMainRole = await getCountVideosBy({
          isApproved: true,
          user: {
            value: user.email,
            purchased: true,
            searchBy: 'email',
          },
        });

        const acquiredVideosCountNoMainRole = await getCountVideosBy({
          isApproved: true,
          user: {
            value: user.email,
            purchased: false,
            searchBy: 'email',
          },
        });

        const acquiredExclusivityVideosCountLast30Days = await getCountVideosBy(
          {
            forLastDays: 30,
            isApproved: true,
            exclusivity: true,
            user: {
              value: user.email,
              searchBy: 'email',
              purchased: true,
            },
          }
        );
        const acquiredNoExclusivityVideosCountLast30Days =
          await getCountVideosBy({
            forLastDays: 30,
            isApproved: true,
            exclusivity: false,
            user: {
              value: user.email,
              searchBy: 'email',
              purchased: true,
            },
          });
        const acquiredExclusivityVideosCount = await getCountVideosBy({
          isApproved: true,
          exclusivity: true,
          user: {
            value: user.email,
            searchBy: 'email',
            purchased: true,
          },
        });

        const acquiredNoExclusivityVideosCount = await getCountVideosBy({
          isApproved: true,
          exclusivity: false,
          user: {
            value: user.email,
            searchBy: 'email',
            purchased: true,
          },
        });

        const videosCountSentFromReviewLast30Days =
          await getCountApprovedTrelloCardBy({
            searchBy: 'researcherId',
            value: user._id,
            forLastDays: 30,
          });

        const videosCountSentFromReview = await getCountApprovedTrelloCardBy({
          searchBy: 'researcherId',
          value: user._id,
          forLastDays: null,
        });

        const videosCountSentToReview = await getCountLinks({
          researcherId: user._id,
          list: 'Review',
        });

        const videosCountSentToReviewLast30Days = await getCountLinks({
          researcherId: user._id,
          list: 'Review',
          forLastDays: 30,
        });

        let amountOfAdvancesToAuthors = 0;

        const referralFormsUsed = await findAllAuthorLinks({
          userId: user._id,
          used: true,
        });

        if (referralFormsUsed.length) {
          await Promise.all(
            referralFormsUsed.map(async (refForm) => {
              const vbForm = await findOne({
                searchBy: 'refFormId',
                param: refForm._id,
              });

              if (
                vbForm &&
                vbForm?.advancePaymentReceived === true &&
                vbForm?.refFormId?.advancePayment
              ) {
                amountOfAdvancesToAuthors += vbForm.refFormId.advancePayment;
              }
            })
          );
        }

        //-----------------------------------------------------------------------------------------------------

        let advance = 0;
        let percentage = 0;

        const videosCountWithUnpaidAdvance = await getCountVideosBy({
          isApproved: true,
          user: {
            value: user.email,
            purchased: true,
            searchBy: 'email',
            advanceHasBeenPaid: false,
          },
        });

        advance = !user?.advancePayment
          ? 0
          : videosCountWithUnpaidAdvance * user.advancePayment;

        const unpaidSales = await getSalesByUserId({
          userId: user._id,
          dateLimit: null,
          paidFor: false,
        });

        if (unpaidSales.length) {
          percentage = unpaidSales.reduce(
            (acc, sale) => acc + sale.amountToResearcher,
            0
          );
        }

        const paymentSubject = () => {
          if (advance > percentage) {
            return {
              tooltip: `advance payment for ${videosCountWithUnpaidAdvance} videos`,
              paymentFor: 'advance',
            };
          } else if (
            advance < percentage ||
            (advance === percentage && advance > 0 && percentage > 0)
          ) {
            return {
              tooltip: `percentage for ${unpaidSales.length} sales`,
              paymentFor: 'percent',
            };
          } else {
            return {
              tooltip: null,
              paymentFor: null,
            };
          }
        };

        return {
          ...user._doc,
          balance: Math.round(user.balance),
          gettingPaid: Math.round(user.gettingPaid),
          sentVideosCount: {
            total: linksCount,
            last30Days: linksCountLast30Days,
            last7Days: linksCountLast7Days,
          },
          acquiredVideosCount: {
            noMainRole: {
              total: acquiredVideosCountNoMainRole,
              last30Days: acquiredVideosCountLast30DaysNoMainRole,
              last7Days: acquiredVideosCountLast7DaysNoMainRole,
            },
            mainRole: {
              total: acquiredVideosCountMainRole,
              last30Days: acquiredVideosCountLast30DaysMainRole,
              last7Days: acquiredVideosCountLast7DaysMainRole,
            },
          },
          percentageOfExclusivityToNonExclusivityVideos: {
            total: acquiredNoExclusivityVideosCount
              ? Math.round(
                  (acquiredExclusivityVideosCount /
                    acquiredNoExclusivityVideosCount) *
                    100
                )
              : 0,
            last30Days: acquiredNoExclusivityVideosCountLast30Days
              ? Math.round(
                  (acquiredExclusivityVideosCountLast30Days /
                    acquiredNoExclusivityVideosCountLast30Days) *
                    100
                )
              : 0,
          },
          approvedRateAfterReview: {
            total: videosCountSentToReview
              ? Math.round(
                  (videosCountSentFromReview * 100) / videosCountSentToReview
                )
              : 0,
            last30Days: videosCountSentToReviewLast30Days
              ? Math.round(
                  (videosCountSentFromReviewLast30Days * 100) /
                    videosCountSentToReviewLast30Days
                )
              : 0,
          },
          earnedYourself: {
            total: Math.round(earnedYourselfTotal),
            last30Days: Math.round(earnedYourselfLast30Days),
          },
          earnedCompanies: Math.round(earnedCompanies),
          earnedTotal: Math.round(earnedTotal),
          amountOfAdvancesToAuthors: Math.round(amountOfAdvancesToAuthors),
          amountToBePaid: advance > percentage ? advance : percentage,
          paymentSubject: paymentSubject(),
        };
      })
    );

    const totalSumOfStatFields = employeeStat.reduce(
      (acc = {}, user = {}) => {
        //суммарный баланс работников
        acc.balance = Math.round(acc.balance + user.balance);
        acc.gettingPaid = Math.round(acc.gettingPaid + user.gettingPaid);
        acc.amountOfAdvancesToAuthors = Math.round(
          acc.amountOfAdvancesToAuthors + user.amountOfAdvancesToAuthors
        );

        //суммарный личный заработок работников
        acc.earnedYourself = {
          //за 30 дней
          last30Days: Math.round(
            acc.earnedYourself.last30Days + user.earnedYourself.last30Days
          ),
          //всего
          total: Math.round(
            acc.earnedYourself.total + user.earnedYourself.total
          ),
        };

        //суммарный общий заработок работников
        acc.earnedTotal = Math.round(acc.earnedTotal + user.earnedTotal);
        //суммарный заработок компании
        acc.earnedCompanies = Math.round(
          acc.earnedCompanies + user.earnedCompanies
        );

        //суммарное количество отправленных работниками в трелло видео
        acc.sentVideosCount = {
          //общий
          total: acc.sentVideosCount.total + user.sentVideosCount.total,
          //за 30 дней
          last30Days:
            acc.sentVideosCount.last30Days + user.sentVideosCount.last30Days,
          // за 7 дней
          last7Days:
            acc.sentVideosCount.last7Days + user.sentVideosCount.last7Days,
        };

        //суммарное количество опубликованных на сайте видео, где присутствуют работники
        acc.acquiredVideosCount = {
          //общий
          total:
            acc.acquiredVideosCount.total +
            user.acquiredVideosCount.noMainRole.total +
            user.acquiredVideosCount.mainRole.total,
          //за 30 дней
          last30Days:
            acc.acquiredVideosCount.last30Days +
            user.acquiredVideosCount.noMainRole.last30Days +
            user.acquiredVideosCount.mainRole.last30Days,
          // за 7 дней
          last7Days:
            acc.acquiredVideosCount.last7Days +
            user.acquiredVideosCount.noMainRole.last7Days +
            user.acquiredVideosCount.mainRole.last7Days,
        };

        return acc;
      },
      {
        balance: 0,
        gettingPaid: 0,
        amountOfAdvancesToAuthors: 0,
        earnedYourself: {
          last30Days: 0,
          total: 0,
        },
        earnedTotal: 0,
        earnedCompanies: 0,
        sentVideosCount: {
          total: 0,
          last30Days: 0,
          last7Days: 0,
        },
        acquiredVideosCount: {
          total: 0,
          last30Days: 0,
          last7Days: 0,
        },
      }
    );

    return res.status(200).json({
      message: 'Users with updated statistics received',
      status: 'success',
      apiData: {
        users: employeeStat.sort((prev, next) => {
          return (
            next.acquiredVideosCount.mainRole.last30Days -
            prev.acquiredVideosCount.mainRole.last30Days
          );
        }),
        sumValues: totalSumOfStatFields,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.get('/collectStatForEmployee', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await getUserById(userId);

    if (!user) {
      return res.status(200).json({
        message: 'The user with this id was not found',
        status: 'warning',
      });
    }

    const sales = await getSalesByUserId({
      userId: user._id,
      dateLimit: null,
    });

    const salesDateLimit = await getSalesByUserId({
      userId: user._id,
      dateLimit: 30,
    });

    const earnedYourselfLast30Days = salesDateLimit.reduce((acc, sale) => {
      return acc + +sale.amountToResearcher;
    }, 0);

    const earnedForYourself = sales.reduce(
      (acc, sale) => acc + +sale.amountToResearcher,
      0
    );

    const linksCountLast30Days = await getCountLinksByUserEmail(user.email, 30);

    const linksCount = await getCountLinksByUserEmail(user.email, null);

    const acquiredVideosCountLast30DaysMainRole = await getCountVideosBy({
      forLastDays: 30,
      isApproved: true,
      user: {
        value: user.email,
        purchased: true,
        searchBy: 'email',
      },
    });

    const acquiredVideosCountLast30DaysNoMainRole = await getCountVideosBy({
      forLastDays: 30,
      isApproved: true,
      user: {
        value: user.email,
        purchased: false,
        searchBy: 'email',
      },
    });

    const acquiredVideosCountMainRole = await getCountVideosBy({
      isApproved: true,
      user: {
        value: user.email,
        purchased: true,
        searchBy: 'email',
      },
    });

    const acquiredVideosCountNoMainRole = await getCountVideosBy({
      isApproved: true,
      user: {
        value: user.email,
        purchased: false,
        searchBy: 'email',
      },
    });

    const acquiredExclusivityVideosCountLast30Days = await getCountVideosBy({
      forLastDays: 30,
      isApproved: true,
      exclusivity: true,
      user: {
        value: user.email,
        searchBy: 'email',
        purchased: true,
      },
    });

    const acquiredNoExclusivityVideosCountLast30Days = await getCountVideosBy({
      forLastDays: 30,
      isApproved: true,
      exclusivity: false,
      user: {
        value: user.email,
        searchBy: 'email',
        purchased: true,
      },
    });
    const acquiredExclusivityVideosCount = await getCountVideosBy({
      isApproved: true,
      exclusivity: true,
      user: {
        value: user.email,
        searchBy: 'email',
        purchased: true,
      },
    });

    const acquiredNoExclusivityVideosCount = await getCountVideosBy({
      isApproved: true,
      exclusivity: false,
      user: {
        value: user.email,
        searchBy: 'email',
        purchased: true,
      },
    });

    const approvedVideosCountLast30Days = await getCountApprovedTrelloCardBy({
      searchBy: 'researcherId',
      value: user._id,
      forLastDays: 30,
    });

    const approvedVideosCount = await getCountApprovedTrelloCardBy({
      searchBy: 'researcherId',
      value: user._id,
      forLastDays: null,
    });

    let amountOfAdvancesToAuthors = 0;

    const referralFormsUsed = await findAllAuthorLinks({
      userId: user._id,
      used: true,
    });

    if (referralFormsUsed.length) {
      await Promise.all(
        referralFormsUsed.map(async (refForm) => {
          const vbForm = await findOne({
            searchBy: 'refFormId',
            param: refForm._id,
          });

          if (
            vbForm &&
            vbForm?.advancePaymentReceived === true &&
            vbForm?.refFormId?.advancePayment
          ) {
            amountOfAdvancesToAuthors += vbForm.refFormId.advancePayment;
          }
        })
      );
    }

    const apiData = {
      balance: Math.round(user.balance),
      gettingPaid: Math.round(user.gettingPaid),
      earnedForYourself: {
        allTime: Math.round(earnedForYourself),
        last30Days: Math.round(earnedYourselfLast30Days),
      },
      sentVideosCount: {
        allTime: linksCount,
        last30Days: linksCountLast30Days,
      },
      acquiredVideosCount: {
        noMainRole: {
          allTime: acquiredVideosCountNoMainRole,
          last30Days: acquiredVideosCountLast30DaysNoMainRole,
        },
        mainRole: {
          allTime: acquiredVideosCountMainRole,
          last30Days: acquiredVideosCountLast30DaysMainRole,
        },
      },
      percentageOfExclusivityToNonExclusivityVideos: {
        allTime: acquiredNoExclusivityVideosCount
          ? Math.round(
              (acquiredExclusivityVideosCount /
                acquiredNoExclusivityVideosCount) *
                100
            )
          : 0,
        last30Days: acquiredNoExclusivityVideosCountLast30Days
          ? Math.round(
              (acquiredExclusivityVideosCountLast30Days /
                acquiredNoExclusivityVideosCountLast30Days) *
                100
            )
          : 0,
      },
      approvedVideosCount: {
        allTime: approvedVideosCount,
        last30Days: approvedVideosCountLast30Days,
      },
      percentage: user.percentage ? user.percentage : 0,
      advancePayment: user.advancePayment ? user.advancePayment : 0,
      amountOfAdvancesToAuthors: Math.round(amountOfAdvancesToAuthors),
      name: user.name,
    };

    return res.status(200).json({
      message: 'User statistics updated',
      status: 'success',
      apiData,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.delete('/deleteUser/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;
  try {
    await deleteUser(userId);

    return res.status(200).json({
      message: 'The user has been successfully deleted',
      status: 'success',
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.post('/topUpEmployeeBalance', authMiddleware, async (req, res) => {
  try {
    const { userId, paymentFor, mainPayment, extraPayment, amount } = req.body;

    if (!amount || !userId || (!mainPayment && !extraPayment)) {
      return res.status(200).json({
        message: "Missing parameter for adding funds to the user's balance",
        status: 'warning',
      });
    }

    if (!!paymentFor && !mainPayment) {
      return res.status(200).json({
        message: 'The amount of the main payment is not specified',
        status: 'warning',
      });
    }

    const user = await getUserById(userId);

    if (!user) {
      return res.status(200).json({
        message: 'The user with this id was not found',
        status: 'warning',
      });
    }

    let balance = 0;
    let gettingPaid = 0;

    if (paymentFor === 'advance') {
      const videosCountWithUnpaidAdvance = await getCountVideosBy({
        isApproved: true,
        user: {
          value: user.email,
          purchased: true,
          searchBy: 'email',
          advanceHasBeenPaid: false,
        },
      });

      if (
        (typeof user?.advancePayment === 'number' &&
          videosCountWithUnpaidAdvance * user.advancePayment !== mainPayment) ||
        (typeof user?.advancePayment !== 'number' &&
          videosCountWithUnpaidAdvance * 10 !== mainPayment)
      ) {
        return res.status(200).json({
          message: `The totals for the payment do not converge`,
          status: 'warning',
        });
      }

      await markVideoEmployeeAsHavingReceivedAnAdvance({
        researcherEmail: user.email,
      });

      balance = -mainPayment;
      gettingPaid = mainPayment;
    }

    if (paymentFor === 'percent') {
      let percentage = 0;

      const unpaidSales = await getSalesByUserId({
        userId: user._id,
        dateLimit: null,
        paidFor: false,
      });

      if (unpaidSales.length) {
        percentage = unpaidSales.reduce(
          (acc, sale) => acc + sale.amountToResearcher,
          0
        );
      }

      if (percentage !== mainPayment) {
        return res.status(200).json({
          message: `The totals for the payment do not converge`,
          status: 'warning',
        });
      }

      await markEmployeeOnSalesHavingReceivePercentage({
        researcherId: user._id,
      });

      balance = mainPayment;
      gettingPaid = mainPayment;
    }

    if (!!extraPayment) {
      balance -= extraPayment;
      gettingPaid += extraPayment;
    }

    objDBForSet = {
      lastPaymentDate: moment().toDate(),
    };

    objDBForIncrement = {
      balance,
      gettingPaid,
    };

    await updateUser({
      userId,
      objDBForUnset: {},
      objDBForSet,
      objDBForIncrement,
    });

    await createNewPayment({
      user: userId,
      purpose: [
        ...(!!paymentFor ? [paymentFor] : []),
        ...(!!extraPayment ? ['extra'] : []),
      ],
      amount: {
        ...(paymentFor === 'advance' && {
          advance: mainPayment,
        }),
        ...(paymentFor === 'percentage' && {
          percentage: mainPayment,
        }),
        ...(!!extraPayment && {
          extra: extraPayment,
        }),
      },
    });

    return res.status(200).json({
      message: `The employee's balance has been replenished by $${amount}`,
      status: 'success',
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.post('/findByValueList', async (req, res) => {
  try {
    const { emailList } = req.body;

    const users = await findUsersByValueList({
      param: 'email',
      valueList: emailList,
    });

    return res.status(200).json({
      message: 'The workers"s balance has been successfully replenished',
      status: 'success',
      apiData: users,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.get('/authors/collectStatOnVideo', authMiddleware, async (req, res) => {
  try {
    const { group } = req.query;

    const videosWithVbCode = await getAllVideos({
      vbFormExists: true,
      isApproved: true,
    });

    if (videosWithVbCode.length) {
      let authorsVideoStatistics = await Promise.all(
        videosWithVbCode.map(async (video) => {
          const vbForm = await findOne({
            searchBy: '_id',
            param: video.vbForm,
          });

          const salesOfThisVideo = await getAllSales({
            videoId: video.videoData.videoId,
          });

          if (vbForm) {
            if (vbForm?.sender) {
              if (vbForm?.refFormId) {
                let percentAmount = 0;
                let advanceAmount = 0;
                let toBePaid = 0;
                let totalBalance = 0;

                if (
                  vbForm.refFormId?.advancePayment &&
                  typeof vbForm.advancePaymentReceived === 'boolean' &&
                  !vbForm.advancePaymentReceived
                ) {
                  advanceAmount = vbForm.refFormId.advancePayment;
                  toBePaid = vbForm.refFormId.advancePayment;
                }

                if (
                  vbForm.refFormId?.advancePayment &&
                  typeof vbForm.advancePaymentReceived === 'boolean' &&
                  vbForm.advancePaymentReceived
                ) {
                  totalBalance = vbForm.refFormId.advancePayment * -1;
                }

                if (vbForm.refFormId?.percentage) {
                  salesOfThisVideo.map((sale) => {
                    if (sale.vbFormInfo.paidFor === false) {
                      percentAmount +=
                        (sale.amount * vbForm.refFormId.percentage) / 100;
                      toBePaid +=
                        (sale.amount * vbForm.refFormId.percentage) / 100;
                    } else {
                      totalBalance +=
                        (sale.amount * vbForm.refFormId.percentage) / 100;
                    }
                  });
                }

                return {
                  status: 'All right',
                  authorEmail: vbForm.sender.email,
                  percentage: vbForm.refFormId.percentage
                    ? vbForm.refFormId.percentage
                    : 0,
                  advance: {
                    value:
                      typeof vbForm.advancePaymentReceived === 'boolean' &&
                      vbForm.refFormId.advancePayment
                        ? vbForm.refFormId.advancePayment
                        : 0,
                    paid:
                      typeof vbForm.advancePaymentReceived !== 'boolean' &&
                      !vbForm.refFormId?.advancePayment
                        ? null
                        : vbForm.advancePaymentReceived === true
                        ? true
                        : false,
                  },
                  videoId: video.videoData.videoId,
                  videoTitle: video.videoData.title,
                  paymentInfo: !vbForm.sender
                    ? null
                    : !vbForm.sender?.paymentInfo?.variant
                    ? false
                    : true,
                  amount: {
                    percent: +percentAmount.toFixed(2),
                    advance: +advanceAmount.toFixed(2),
                    toBePaid: +toBePaid.toFixed(2),
                    totalBalance: +totalBalance.toFixed(2),
                  },
                  vbFormUid: vbForm.formId,
                  researchers: video.trelloData?.researchers?.length
                    ? video.trelloData?.researchers
                        .map((researcher) => {
                          return researcher.name;
                        })
                        .join(', ')
                    : null,
                  salesCount: salesOfThisVideo.length,
                };
              } else {
                return {
                  status: 'VB form without referral link',
                  authorEmail: null,
                  percentage: null,
                  advance: {
                    value: null,
                    paid: null,
                  },
                  videoId: video.videoData.videoId,
                  videoTitle: video.videoData.title,
                  paymentInfo: null,
                  amount: {
                    percent: null,
                    advance: null,
                    toBePaid: null,
                    totalBalance: null,
                  },
                  vbFormUid: vbForm.formId,
                  researchers: video.trelloData?.researchers?.length
                    ? video.trelloData?.researchers
                        .map((researcher) => {
                          return researcher.name;
                        })
                        .join(', ')
                    : null,
                  salesCount: salesOfThisVideo.length,
                };
              }
            } else {
              return {
                status: 'VB form without sender',
                authorEmail: null,
                percentage: null,
                advance: {
                  value: null,
                  paid: null,
                },
                videoId: video.videoData.videoId,
                videoTitle: video.videoData.title,
                paymentInfo: null,
                amount: {
                  percent: null,
                  advance: null,
                  toBePaid: null,
                  totalBalance: null,
                },
                vbFormUid: vbForm.formId,
                researchers: video.trelloData?.researchers?.length
                  ? video.trelloData?.researchers
                      .map((researcher) => {
                        return researcher.name;
                      })
                      .join(', ')
                  : null,
                salesCount: salesOfThisVideo.length,
              };
            }
          } else {
            return {
              status: 'VB form not found',
              authorEmail: null,
              percentage: null,
              advance: {
                value: null,
                paid: null,
              },
              videoId: video.videoData.videoId,
              videoTitle: video.videoData.title,
              paymentInfo: null,
              amount: {
                percent: null,
                advance: null,
                toBePaid: null,
                totalBalance: null,
              },
              vbFormUid: null,
              researchers: video.trelloData?.researchers?.length
                ? video.trelloData?.researchers
                    .map((researcher) => {
                      return researcher.name;
                    })
                    .join(', ')
                : null,
              salesCount: salesOfThisVideo.length,
            };
          }
        })
      );

      authorsVideoStatistics = authorsVideoStatistics.reduce(
        (res, videoData) => {
          if (!!videoData.amount.percent && videoData.amount.percent < 75) {
            res['other'].push(videoData);
          }
          if (
            (videoData.paymentInfo === false && !!videoData.amount.advance) ||
            (videoData.paymentInfo === false && videoData.amount.percent >= 75)
          ) {
            res['noPayment'].push(videoData);
          }
          if (
            (!!videoData.paymentInfo && !!videoData.amount.advance) ||
            (!!videoData.paymentInfo && videoData.amount.percent >= 75)
          ) {
            res['ready'].push(videoData);
          }
          return res;
        },
        { ready: [], noPayment: [], other: [] }
      );

      const defineApiData = () => {
        if (group === 'ready') {
          return authorsVideoStatistics.ready;
        }
        if (group === 'noPayment') {
          return authorsVideoStatistics.noPayment;
        }
        if (group === 'other') {
          return authorsVideoStatistics.other;
        }
      };

      return res.status(200).json({
        status: 'success',
        message: 'Statistics on authors have been successfully collected',
        apiData: defineApiData(),
      });
    } else {
      return res.status(200).json({
        status: 'success',
        message: 'Statistics on authors have been successfully collected',
        apiData: [],
      });
    }
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.get('/authors/getPaymentDetails', authMiddleware, async (req, res) => {
  try {
    const { searchBy, value } = req.query;

    const author = await getUserBy({ param: searchBy, value });

    if (!author) {
      return res.status(200).json({
        status: 'warning',
        message: 'Author not found',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Statistics on authors have been successfully collected',
      apiData: author?.paymentInfo ? author.paymentInfo : {},
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.post('/authors/topUpBalance', authMiddleware, async (req, res) => {
  try {
    const { videoId, amountToTopUp } = req.body;
    const { paymentFor } = req.query;

    if (!paymentFor) {
      return res.status(200).json({
        message: 'missing parameter "paymentFor"',
        status: 'warning',
      });
    }

    if (!videoId) {
      return res.status(200).json({
        message: "Missing parameter to top up the author's balance",
        status: 'warning',
      });
    }

    const video = await findVideoByValue({
      searchBy: 'videoData.videoId',
      value: videoId,
    });

    if (!video) {
      return res.status(200).json({
        message: `Video with id "${videoId}" not found`,
        status: 'warning',
      });
    }

    const vbForm = await findOne({
      searchBy: '_id',
      param: video.vbForm,
    });

    if (!vbForm) {
      return res.status(200).json({
        message: `VB form with id "${video.vbForm}" not found`,
        status: 'warning',
      });
    }

    if (!vbForm?.sender?.email) {
      return res.status(200).json({
        message: `Author not found`,
        status: 'warning',
      });
    }

    if (!vbForm?.refFormId) {
      return res.status(200).json({
        message: `Referral form not found`,
        status: 'warning',
      });
    }

    if (paymentFor === 'advance') {
      if (
        vbForm.refFormId.advancePayment &&
        vbForm.advancePaymentReceived === true
      ) {
        return res.status(200).json({
          message: `An advance has already been paid for this vb form`,
          status: 'warning',
        });
      }

      if (
        !vbForm.refFormId?.advancePayment ||
        typeof vbForm.advancePaymentReceived !== 'boolean'
      ) {
        return res.status(200).json({
          message: `There is no advance payment for this vb form`,
          status: 'warning',
        });
      }

      advanceAmount = vbForm.refFormId.advancePayment;

      if (Math.ceil(advanceAmount) !== Math.ceil(amountToTopUp)) {
        return res.status(200).json({
          message: `The totals for the payment do not converge`,
          status: 'warning',
        });
      }

      await updateVbFormBy({
        updateBy: '_id',
        value: vbForm._id,
        dataForUpdate: { advancePaymentReceived: true },
      });

      const objDBForSet = {
        lastPaymentDate: moment().toDate(),
      };

      const objDBForIncrement = {
        balance: amountToTopUp,
      };

      await updateUser({
        userId: vbForm.sender._id,
        objDBForUnset: {},
        objDBForSet,
        objDBForIncrement,
      });

      return res.status(200).json({
        message: `Advance payment of $${advanceAmount} was credited to the author's balance`,
        status: 'success',
      });
    }

    if (paymentFor === 'percent') {
      const salesWithThisVideoId = await getAllSales({
        videoId,
        paidFor: { 'vbFormInfo.paidFor': false },
      });

      if (!salesWithThisVideoId.length) {
        return res.status(200).json({
          message: `The video sales list is empty`,
          status: 'warning',
        });
      }

      if (!vbForm.refFormId.percentage) {
        return res.status(200).json({
          message: `There is no percentage provided for this vb form`,
          status: 'warning',
        });
      }

      const percentAmount = salesWithThisVideoId.reduce(
        (acc, sale) => acc + (sale.amount * vbForm.refFormId.percentage) / 100,
        0
      );

      if (Math.ceil(percentAmount) !== Math.ceil(amountToTopUp)) {
        return res.status(200).json({
          message: `The totals for the payment do not converge`,
          status: 'warning',
        });
      }

      const dataForUpdateSales = {
        $set: { 'vbFormInfo.paidFor': true },
      };

      await updateSalesBy({
        updateBy: 'videoId',
        value: videoId,
        dataForUpdate: dataForUpdateSales,
      });

      const objDBForSet = {
        lastPaymentDate: moment().toDate(),
      };

      const objDBForIncrement = {
        balance: amountToTopUp,
      };

      await updateUser({
        userId: vbForm.sender._id,
        objDBForUnset: {},
        objDBForSet,
        objDBForIncrement,
      });

      return res.status(200).json({
        message: `Percentage of $${percentAmount} was credited to the author's balance`,
        status: 'success',
      });
    }

    if (paymentFor === 'mixed') {
      const salesWithThisVideoId = await getAllSales({
        videoId,
        paidFor: { 'vbFormInfo.paidFor': false },
      });

      if (!salesWithThisVideoId.length) {
        return res.status(200).json({
          message: `The video sales list is empty`,
          status: 'warning',
        });
      }

      if (!vbForm.refFormId.percentage) {
        return res.status(200).json({
          message: `There is no percentage provided for this vb form`,
          status: 'warning',
        });
      }

      if (
        vbForm.refFormId.advancePayment &&
        vbForm.advancePaymentReceived === true
      ) {
        return res.status(200).json({
          message: `An advance has already been paid for this vb form`,
          status: 'warning',
        });
      }

      if (
        !vbForm.refFormId.advancePayment ||
        typeof vbForm.advancePaymentReceived !== 'boolean'
      ) {
        return res.status(200).json({
          message: `There is no advance payment for this vb form`,
          status: 'warning',
        });
      }

      advanceAmount = vbForm.refFormId.advancePayment;

      percentAmount = salesWithThisVideoId.reduce(
        (acc, sale) => acc + (sale.amount * vbForm.refFormId.percentage) / 100,
        0
      );

      if (
        Math.ceil(advanceAmount + percentAmount) !== Math.ceil(amountToTopUp)
      ) {
        return res.status(200).json({
          message: `The totals for the payment do not converge`,
          status: 'warning',
        });
      }

      await updateVbFormBy({
        updateBy: '_id',
        value: vbForm._id,
        dataForUpdate: { advancePaymentReceived: true },
      });

      const objDBForSet = {
        lastPaymentDate: moment().toDate(),
      };

      const objDBForIncrement = {
        balance: amountToTopUp,
      };

      await updateUser({
        userId: vbForm.sender._id,
        objDBForUnset: {},
        objDBForSet,
        objDBForIncrement,
      });

      const dataForUpdateSales = {
        $set: { 'vbFormInfo.paidFor': true },
      };

      await updateSalesBy({
        updateBy: 'videoId',
        value: videoId,
        dataForUpdate: dataForUpdateSales,
      });

      return res.status(200).json({
        message: `An advance of $${advanceAmount} and a percentage of $${percentAmount} was credited to the author's balance`,
        status: 'success',
      });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.post('/authors/register', async (req, res) => {
  try {
    const { vbFormId, password: reqPassword } = req.body;

    if (!vbFormId) {
      return res.status(200).json({
        message:
          'There is no referral hash. Contact your administrator or try again',
        status: 'warning',
      });
    }

    const objToSearchVbForm = {
      searchBy: '_id',
      param: vbFormId,
    };

    const vbForm = await findOne(objToSearchVbForm);

    if (!vbForm) {
      return res.status(200).json({
        message:
          'The form was not found. Contact your administrator or try again',
        status: 'warning',
      });
    }

    const candidate = await getUserById(vbForm.sender);

    if (!candidate) {
      return res.status(200).json({
        message: 'A user with this email not found',
        status: 'warning',
      });
    }

    const salt = await genSalt(10);

    const objDBForSet = {
      password: await hashBcrypt(reqPassword, salt),
      activatedTheAccount: true,
    };

    await updateUser({
      userId: vbForm.sender,
      objDBForUnset: {},
      objDBForSet,
      objDBForIncrement: {},
    });

    const { accessToken, refreshToken } = generateTokens(candidate);

    return res.status(200).json({
      apiData: { accessToken, refreshToken, role: candidate.role },
      status: 'success',
      message: 'Congratulations on registering on the service!',
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.get(
  '/researchers/collectStatOnAcquiredVideos',
  authMiddleware,
  async (req, res) => {
    const userId = req.user.id;

    try {
      const { forLastDays } = req.query;

      let acquiredVideosStat = [];

      const videosWithVbCode = await getAllVideos({
        vbFormExists: true,
        isApproved: true,
        researcher: {
          searchBy: 'id',
          value: userId,
        },
        ...(forLastDays && { forLastDays }),
      });

      if (videosWithVbCode.length) {
        acquiredVideosStat = await Promise.all(
          videosWithVbCode.map(async (video) => {
            const vbForm = await findOne({
              searchBy: '_id',
              param: video.vbForm,
            });

            if (vbForm) {
              if (vbForm?.sender) {
                if (vbForm?.refFormId) {
                  return {
                    status: 'All right',
                    authorData: {
                      id: vbForm.sender._id,
                      email: vbForm.sender.email,
                    },
                    percentage: vbForm.refFormId.percentage
                      ? vbForm.refFormId.percentage
                      : 0,
                    advance: {
                      value:
                        typeof vbForm.advancePaymentReceived === 'boolean' &&
                        vbForm.refFormId.advancePayment
                          ? vbForm.refFormId.advancePayment
                          : 0,
                      paid:
                        typeof vbForm.advancePaymentReceived !== 'boolean' &&
                        !vbForm.refFormId.advancePayment
                          ? null
                          : vbForm.advancePaymentReceived === true
                          ? true
                          : false,
                    },
                    videoId: video.videoData.videoId,
                    videoTitle: video.videoData.title,
                    paymentInfo:
                      vbForm.sender?.paymentInfo?.variant === undefined
                        ? false
                        : true,
                    vbFormUid: vbForm.formId,
                  };
                } else {
                  return {
                    status: 'VB form without referral link',
                    authorData: {
                      id: vbForm.sender._id,
                      email: vbForm.sender.email,
                    },
                    percentage: null,
                    advance: {
                      value: null,
                      paid: null,
                    },
                    videoId: video.videoData.videoId,
                    videoTitle: video.videoData.title,
                    paymentInfo:
                      vbForm.sender?.paymentInfo?.variant === undefined
                        ? false
                        : true,
                    vbFormUid: vbForm.formId,
                  };
                }
              } else {
                return {
                  status: 'VB form without sender',
                  authorData: {
                    id: null,
                    email: null,
                  },
                  percentage: null,
                  advance: {
                    value: null,
                    paid: null,
                  },
                  videoId: video.videoData.videoId,
                  videoTitle: video.videoData.title,
                  paymentInfo: null,
                  vbFormUid: vbForm.formId,
                };
              }
            } else {
              return {
                status: 'VB form not found',
                authorData: {
                  id: null,
                  email: null,
                },
                percentage: null,
                advance: {
                  value: null,
                  paid: null,
                },
                videoId: video.videoData.videoId,
                videoTitle: video.videoData.title,
                paymentInfo: null,
                vbFormUid: null,
              };
            }
          })
        );
      }

      return res.status(200).json({
        status: 'success',
        message: 'Employee statistics on purchased videos received',
        apiData: acquiredVideosStat,
      });
    } catch (err) {
      console.log(err);

      return res.status(500).json({
        message: 'Server side error',
        status: 'error',
      });
    }
  }
);

module.exports = router;
