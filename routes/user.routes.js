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
} = require('../controllers/video.controller');

router.get('/getAll', authMiddleware, async (req, res) => {
  try {
    const { me, role, canBeAssigned, fieldsInTheResponse } = req.query;

    const userId = req.user.id;

    let users = await getAllUsers({
      me: JSON.parse(me),
      userId,
      role,
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
      amountPerVideo,
      country,
      paymentInfo,
      canBeAssigned,
    } = req.body;

    const { roleUsersForResponse } = req.query;

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
      ...(amountPerVideo && { amountPerVideo }),
      ...(country && { country }),
      ...(paymentInfo && {
        paymentInfo,
      }),
      ...((role === 'author' || role === 'worker' || role === 'stringer') && {
        balance: 0,
      }),
      ...(typeof canBeAssigned === 'boolean' && {
        canBeAssigned,
      }),
    };

    await createUser(objDB);

    let apiData;

    if (roleUsersForResponse) {
      apiData = await getAllUsers({
        me: true,
        userId: null,
        role: roleUsersForResponse,
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

    return res.status(200).json({
      message: 'Congratulations on registering on the service!',
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

router.patch('/updateOne', authMiddleware, async (req, res) => {
  try {
    const { userId, roleUsersForResponse } = req.query;

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
      amountPerVideo,
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
      ...(amountPerVideo && { amountPerVideo }),
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

    if (roleUsersForResponse) {
      apiData = await getAllUsers({
        me: true,
        userId: null,
        role: roleUsersForResponse,
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
  const { role } = req.query;

  try {
    const { allUsersWithRefreshStat, sumCountUsersValue } =
      await updateStatForUsers(role);

    return res.status(200).json({
      message: 'Users with updated statistics received',
      status: 'success',
      apiData: {
        users: allUsersWithRefreshStat,
        sumValues: sumCountUsersValue,
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

      console.log(salesDateLimit, 867878);

      const salesSumAmountDateLimit = salesDateLimit.reduce((acc, sale) => {
        return +(
          acc +
          sale.amountToResearchers / sale.researchers.length
        ).toFixed(2);
      }, 0);

      const sales = await getSalesByUserId(user._id, null);

      const earnedForYourself = sales.reduce(
        (a, sale) =>
          a + +(sale.amountToResearchers / sale?.researchers?.length),
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
    const { vbFormUid, authorEmail, videoId, amountToTopUp } = req.body;

    if (!vbFormUid || !authorEmail || !videoId) {
      return res.status(200).json({
        message: "Missing parameter to top up the author's balance",
        status: 'warning',
      });
    }

    const vbForm = await findOne({ searchBy: 'formId', param: vbFormUid });

    if (!vbForm) {
      return res.status(200).json({
        message: `VB form with id "${vbFormUid}" not found`,
        status: 'warning',
      });
    }

    const author = await getUserBy({ param: 'email', value: authorEmail });

    if (!author) {
      return res.status(200).json({
        message: `Author with email "${authorEmail}" not found`,
        status: 'warning',
      });
    }

    if (vbForm.sender.toString() !== author._id.toString()) {
      return res.status(200).json({
        message: `The sender of the vb form and the author differ`,
        status: 'warning',
      });
    }

    const salesWithThisVideoId = await getAllSales({
      videoId,
      paidFor: { 'vbFormInfo.paidFor': false },
    });

    if (
      !salesWithThisVideoId.length &&
      vbForm.advancePaymentReceived &&
      vbForm.advancePaymentReceived === true
    ) {
      return res.status(200).json({
        message: `No sales to pay for`,
        status: 'warning',
      });
    }

    let totalAmount = 0;

    if (author.amountPerVideo && vbForm.advancePaymentReceived === false) {
      await updateVbFormBy({
        updateBy: '_id',
        value: vbForm._id,
        dataForUpdate: { advancePaymentReceived: true },
      });

      totalAmount = author.amountPerVideo;
    }

    if (author.percentage) {
      const authorEarnedAmountForVideoSales = salesWithThisVideoId.reduce(
        (acc, sale) => acc + (sale.amount * author.percentage) / 100,
        0
      );

      totalAmount += authorEarnedAmountForVideoSales;
    }

    console.log(Math.ceil(totalAmount), Math.ceil(amountToTopUp));

    if (Math.ceil(totalAmount) !== Math.ceil(amountToTopUp)) {
      return res.status(200).json({
        message: `The totals for the payment do not converge`,
        status: 'warning',
      });
    }

    if (salesWithThisVideoId.length) {
      const dataForUpdateSales = {
        $set: { 'vbFormInfo.paidFor': true },
      };

      await updateSalesBy({
        updateBy: 'videoId',
        value: videoId,
        dataForUpdate: dataForUpdateSales,
      });
    }

    const dataForUpdateUser = {
      lastPaymentDate: moment().toDate(),
    };

    const dataForUpdateUserInc = {
      balance: amountToTopUp,
    };

    await updateUser(author._id, dataForUpdateUser, dataForUpdateUserInc);

    return res.status(200).json({
      message: `the author's balance has been successfully replenished by $${amountToTopUp}`,
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

module.exports = router;
