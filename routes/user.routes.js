const express = require('express');
const router = express.Router();
const { genSalt, hash: hashBcrypt } = require('bcryptjs');
const moment = require('moment');
const jwt = require('jsonwebtoken');

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
  updateStatForUsers,
  getUserBySearchValue,
  findUsersByValueList,
  getUserBy,
} = require('../controllers/user.controller.js');

const { generateTokens } = require('../controllers/auth.controllers');

const {
  findOne,
  updateVbFormByFormId,
  updateVbFormBy,
} = require('../controllers/uploadInfo.controller');

const { getCountLinksByUserEmail } = require('../controllers/links.controller');

const {
  getSalesByUserId,
  getAllSales,
  updateSalesBy,
  updateSaleBy,
  findSaleById,
} = require('../controllers/sales.controller');

const { sendEmail } = require('../controllers/sendEmail.controller');

const {
  getCountAcquiredVideoByUserEmail,
  getAllVideos,
  findVideoByValue,
  getCountAcquiredVideosBy,
} = require('../controllers/video.controller');

router.get('/getAll', authMiddleware, async (req, res) => {
  try {
    const { me, roles, canBeAssigned, fieldsInTheResponse } = req.query;

    const userId = req.user.id;

    let users = await getAllUsers({
      me: JSON.parse(me),
      userId,
      roles,
      ...(canBeAssigned !== undefined &&
        (JSON.parse(canBeAssigned) === true ||
          JSON.parse(canBeAssigned) === false) && {
          canBeAssigned: JSON.parse(canBeAssigned),
        }),
      ...(fieldsInTheResponse && {
        fieldsInTheResponse,
      }),
    });

    return res.status(200).json({
      status: 'success',
      message: 'The list of workers has been received',
      apiData: users,
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ status: 'error', message: 'Server side error' });
  }
});

//вернуть middleware

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
    const {
      email,
      password,
      nickname,
      name,
      role,
      percentage,
      advancePayment,
      country,
      paymentInfo,
      canBeAssigned,
    } = req.body;

    const { rolesUsersForResponse } = req.query;

    const isValidate = validationForRequiredInputDataInUserModel(
      role,
      req.body,
      null
    );

    if (!isValidate) {
      return res
        .status(200)
        .json({ message: 'Missing data to create a user', status: 'warning' });
    }

    const candidate = await getUserByEmail(email);

    if (candidate) {
      return res.status(200).json({
        message: 'A user with this email already exists',
        status: 'warning',
      });
    }

    const salt = await genSalt(10);

    const objDB = {
      ...(nickname && { nickname }),
      name,
      email: email,
      password: await hashBcrypt(password, salt),
      role,
      ...(percentage && { percentage }),
      ...(advancePayment && { advancePayment }),
      ...(country && { country }),
      ...(paymentInfo && {
        paymentInfo,
      }),
      ...((role === 'author' ||
        role === 'researcher' ||
        role === 'stringer') && {
        balance: 0,
      }),
      ...(typeof canBeAssigned === 'boolean' && {
        canBeAssigned,
      }),
    };

    await createUser(objDB);

    let apiData;

    if (rolesUsersForResponse) {
      apiData = await getAllUsers({
        me: true,
        userId: null,
        roles: rolesUsersForResponse,
        canBeAssigned: null,
      });
    } else {
      apiData = await getUserById(userId);
    }

    return res.status(200).json({
      message: 'A new user has been successfully created',
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

router.post('/authorRegister', async (req, res) => {
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

    const objForUpdateUAuthor = {
      password: await hashBcrypt(reqPassword, salt),
      activatedTheAccount: true,
    };

    await updateUser(vbForm.sender, objForUpdateUAuthor, {});

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

router.post('/sendPassword', sendPassword);

router.post('/recoveryPassword', recoveryPassword);

router.patch('/updateOne', authMiddleware, async (req, res) => {
  try {
    const { userId, rolesUsersForResponse } = req.query;

    const userIdToUpdate = userId ? userId : req.user.id;

    const user = await getUserById(userIdToUpdate);

    if (!user) {
      return res.status(200).json({
        message: 'User not found',
        status: 'warning',
      });
    }

    const {
      name,
      nickname,
      role,
      email,
      percentage,
      advancePayment,
      country,
      balance,
      paymentInfo,
      canBeAssigned,
    } = req.body;

    if (user.role === 'author') {
      const isValidate = validationForRequiredInputDataInUserModel(
        user.role,
        req.body,
        'update'
      );

      if (!isValidate) {
        return res.status(200).json({
          message: 'Missing value for update payment information',
          status: 'warning',
        });
      }
    }

    objDB = {
      ...(name && { name }),
      ...(nickname && { nickname: `@${nickname}` }),
      ...(role && { role }),
      ...(email && { email }),
      ...(percentage && { percentage }),
      ...(advancePayment && { advancePayment }),
      ...(country && { country }),
      ...(paymentInfo && { paymentInfo }),
      ...(typeof canBeAssigned === 'boolean' && {
        canBeAssigned,
      }),
      ...(balance && { lastPaymentDate: moment().toDate() }),
    };

    objDBForIncrement = {
      ...(balance && { balance }),
    };

    await updateUser(userIdToUpdate, objDB, objDBForIncrement);

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
});

router.patch('/updateStatisticsForUsers', authMiddleware, async (req, res) => {
  const { roles } = req.query;

  try {
    const { employeeStat, totalSumOfStatFields } = await updateStatForUsers({
      roles,
    });

    return res.status(200).json({
      message: 'Users with updated statistics received',
      status: 'success',
      apiData: {
        users: employeeStat,
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

router.patch(
  '/updateStatisticsForOneResearcher',
  authMiddleware,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await getUserById(userId);

      if (!user) {
        return res.status(200).json({
          message: 'The user with this id was not found',
          status: 'warning',
        });
      }

      const salesDateLimit = await getSalesByUserId(user._id, 30);

      const salesSumAmountDateLimit = salesDateLimit.reduce((acc, sale) => {
        return +(acc + sale.amountToResearcher).toFixed(2);
      }, 0);

      const sales = await getSalesByUserId(user._id, null);

      const earnedForYourself = sales.reduce(
        (a, sale) => a + +sale.amountToResearcher,
        0
      );

      const earnedTillNextPayment = earnedForYourself - user.balance;

      const linksCount = await getCountLinksByUserEmail(user.email, null);

      const acquiredVideoCount = await getCountAcquiredVideoByUserEmail(
        user.email,
        null
      );

      //const approvedTrelloCardCount =
      //  await getCountApprovedTrelloCardByNickname(user.nickname, null);

      const dataDBForUpdateUser = {
        'sentVideosCount.total': linksCount,
        'earnedForYourself.dateLimit': +salesSumAmountDateLimit.toFixed(2),
        'earnedForYourself.total': +earnedForYourself.toFixed(2),
        'acquiredVideosCount.total': acquiredVideoCount,
        //'approvedVideosCount.total': approvedTrelloCardCount,
        earnedTillNextPayment: +earnedTillNextPayment.toFixed(2),
      };

      await updateUser(user._id, dataDBForUpdateUser, {});

      const refreshUser = await getUserById(userId);

      return res.status(200).json({
        message: 'User statistics updated',
        status: 'success',
        apiData: refreshUser,
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

router.delete('/deleteUser/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;
  const { roleUsersForResponse } = req.query;
  try {
    await deleteUser(userId);

    users = await getAllUsers({
      me: true,
      userId: null,
      role: roleUsersForResponse,
    });

    return res.status(200).json({
      message: 'The user has been successfully deleted',
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

router.post('/topUpBalance', authMiddleware, async (req, res) => {
  try {
    const { balance, userId } = req.body;

    const { roleUsersForResponse } = req.query;

    if (!balance || !userId) {
      return res.status(200).json({
        message: "Missing parameter for adding funds to the user's balance",
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

    objDB = {
      ...(balance && { lastPaymentDate: moment().toDate() }),
    };

    objDBForIncrement = {
      ...(balance && { balance }),
    };

    await updateUser(userId, objDB, objDBForIncrement);

    //const fromEmail = 'Vladislav Starostenko';
    //const toEmail = user.email;
    //const subjectEmail = 'Replenishment of the balance from ViralBear';
    //const htmlEmail = `
    //<b>A payment of $${balance} has been sent to you</b>
    //`;

    //await sendEmail(fromEmail, toEmail, subjectEmail, htmlEmail);

    const { allUsersWithRefreshStat, sumCountUsersValue } =
      await updateStatForUsers(roleUsersForResponse);

    return res.status(200).json({
      message: 'The workers"s balance has been successfully replenished',
      status: 'success',
      apiData: {
        allUsersWithRefreshStat,
        sumCountUsersValue,
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

router.post('/topUpAuthorBalance', authMiddleware, async (req, res) => {
  try {
    const { videoId, amountToTopUp } = req.body;
    const { paymentFor } = req.query;

    console.log(videoId, amountToTopUp, paymentFor);

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
      searchBy: 'formId',
      param: video.uploadData.vbCode,
    });

    if (!vbForm) {
      return res.status(200).json({
        message: `VB form with id "${video.uploadData.vbCode}" not found`,
        status: 'warning',
      });
    }

    const author = await getUserBy({ param: '_id', value: vbForm.sender });

    if (!author) {
      return res.status(200).json({
        message: `Author with id "${vbForm.sender}" not found`,
        status: 'warning',
      });
    }

    if (paymentFor === 'advance') {
      if (author.advancePayment && vbForm.advancePaymentReceived === true) {
        return res.status(200).json({
          message: `An advance has already been paid for this vb form`,
          status: 'warning',
        });
      }

      if (
        !author.advancePayment ||
        typeof vbForm.advancePaymentReceived !== 'boolean'
      ) {
        return res.status(200).json({
          message: `There is no advance payment for this vb form`,
          status: 'warning',
        });
      }

      advanceAmount = author.advancePayment;

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

      const dataForUpdateUser = {
        lastPaymentDate: moment().toDate(),
      };

      const dataForUpdateUserInc = {
        balance: amountToTopUp,
      };

      await updateUser(author._id, dataForUpdateUser, dataForUpdateUserInc);

      return res.status(200).json({
        message: `Percentage of $${advanceAmount} was credited to the author's balance`,
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

      if (!author.percentage) {
        return res.status(200).json({
          message: `There is no percentage provided for this vb form`,
          status: 'warning',
        });
      }

      const percentAmount = salesWithThisVideoId.reduce(
        (acc, sale) => acc + (sale.amount * author.percentage) / 100,
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

      const dataForUpdateUser = {
        lastPaymentDate: moment().toDate(),
      };

      const dataForUpdateUserInc = {
        balance: amountToTopUp,
      };

      await updateUser(author._id, dataForUpdateUser, dataForUpdateUserInc);

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

      if (!author.percentage) {
        return res.status(200).json({
          message: `There is no percentage provided for this vb form`,
          status: 'warning',
        });
      }

      if (author.advancePayment && vbForm.advancePaymentReceived === true) {
        return res.status(200).json({
          message: `An advance has already been paid for this vb form`,
          status: 'warning',
        });
      }

      if (
        !author.advancePayment ||
        typeof vbForm.advancePaymentReceived !== 'boolean'
      ) {
        return res.status(200).json({
          message: `There is no advance payment for this vb form`,
          status: 'warning',
        });
      }

      advanceAmount = author.advancePayment;

      percentAmount = salesWithThisVideoId.reduce(
        (acc, sale) => acc + (sale.amount * author.percentage) / 100,
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

      const dataForUpdateUser = {
        lastPaymentDate: moment().toDate(),
      };

      const dataForUpdateUserInc = {
        balance: amountToTopUp,
      };

      await updateUser(author._id, dataForUpdateUser, dataForUpdateUserInc);

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

router.get('/collectStatOnAuthorsVideo', authMiddleware, async (req, res) => {
  try {
    const { group } = req.query;

    const videosWithVbCode = await getAllVideos({
      vbCode: {
        'uploadData.vbCode': { $exists: true, $ne: '' },
      },
      isApproved: { isApproved: false },
    });

    if (videosWithVbCode.length) {
      let authorsVideoStatistics = await Promise.all(
        videosWithVbCode.map(async (video) => {
          const vbForm = await findOne({
            searchBy: 'formId',
            param: video.uploadData.vbCode,
          });

          const authorRelatedWithVbForm = await getUserBy({
            param: '_id',
            value: vbForm.sender,
          });

          const salesOfThisVideo = await getAllSales({
            videoId: video.videoData.videoId,
          });

          let percentAmount = 0;
          let advanceAmount = 0;
          let toBePaid = 0;
          let totalBalance = 0;

          if (
            authorRelatedWithVbForm.advancePayment &&
            typeof vbForm.advancePaymentReceived === 'boolean' &&
            !vbForm.advancePaymentReceived
          ) {
            advanceAmount = authorRelatedWithVbForm.advancePayment;
            toBePaid = authorRelatedWithVbForm.advancePayment;
          }

          if (
            authorRelatedWithVbForm.advancePayment &&
            typeof vbForm.advancePaymentReceived === 'boolean' &&
            vbForm.advancePaymentReceived
          ) {
            totalBalance = authorRelatedWithVbForm.advancePayment * -1;
          }

          if (authorRelatedWithVbForm.percentage) {
            salesOfThisVideo.map((sale) => {
              if (sale.vbFormInfo.paidFor === false) {
                percentAmount +=
                  (sale.amount * authorRelatedWithVbForm.percentage) / 100;
                toBePaid +=
                  (sale.amount * authorRelatedWithVbForm.percentage) / 100;
              } else {
                totalBalance +=
                  (sale.amount * authorRelatedWithVbForm.percentage) / 100;
              }
            });
          }

          return {
            authorEmail: authorRelatedWithVbForm.email,
            percentage: authorRelatedWithVbForm.percentage
              ? authorRelatedWithVbForm.percentage
              : 0,
            advance: {
              value:
                typeof vbForm.advancePaymentReceived === 'boolean' &&
                authorRelatedWithVbForm.advancePayment
                  ? authorRelatedWithVbForm.advancePayment
                  : 0,
              paid:
                typeof vbForm.advancePaymentReceived !== 'boolean' &&
                !authorRelatedWithVbForm.advancePayment
                  ? '-'
                  : vbForm.advancePaymentReceived === true
                  ? 'yes'
                  : 'no',
            },
            videoId: video.videoData.videoId,
            videoTitle: video.videoData.title,
            paymentInfo:
              authorRelatedWithVbForm.paymentInfo.variant === undefined
                ? 'no'
                : 'yes',
            amount: {
              percent: +percentAmount.toFixed(2),
              advance: +advanceAmount.toFixed(2),
              toBePaid: +toBePaid.toFixed(2),
              totalBalance: +totalBalance.toFixed(2),
            },
            vbFormUid: vbForm.formId,
            salesCount: salesOfThisVideo.length,
          };
        })
      );

      authorsVideoStatistics = authorsVideoStatistics.reduce(
        (res, videoData) => {
          if (
            videoData.paymentInfo &&
            (videoData.advance.paid === 'no' || videoData.amount.toBePaid > 75)
          ) {
            res['ready'].push(videoData);
          }
          if (
            !videoData.paymentInfo &&
            (videoData.advance.paid === 'no' || videoData.amount.toBePaid > 75)
          ) {
            res['noPayment'].push(videoData);
          }
          if (
            videoData.advance.value === 0 ||
            videoData.amount.toBePaid <= 75
          ) {
            res['other'].push(videoData);
          }
          return res;
        },
        { ready: [], noPayment: [], other: [] }
      );

      const defineApiData = () => {
        switch (group) {
          case 'ready':
            return authorsVideoStatistics.ready;
          case 'noPayment':
            return authorsVideoStatistics.noPayment;
          case 'other':
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
  }
});

router.get('/test', async (req, res) => {
  try {
    const acquiredVideosCountLast7Days = await getCountAcquiredVideosBy({
      searchBy: 'trelloData.researchers',
      value: 'rintin@viralbear.media',
      forLastDays: null,
    });

    return res.status(200).json({ mes: 'збс' });
  } catch (err) {
    console.log(err);
  }
});

module.exports = router;
