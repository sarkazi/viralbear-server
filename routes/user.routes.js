const express = require('express');
const router = express.Router();
const { genSalt, hash: hashBcrypt } = require('bcryptjs');
const moment = require('moment');

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
} = require('../controllers/user.controller.js');

const {
  findOne,
  updateVbFormByFormId,
} = require('../controllers/uploadInfo.controller');

const { getCountLinksByUserEmail } = require('../controllers/links.controller');

const { getSalesByUserEmail } = require('../controllers/sales.controller');

const {
  getCountApprovedTrelloCardByNickname,
} = require('../controllers/moveFromReview.controller');

const { sendEmail } = require('../controllers/sendEmail.controller');

const {
  getCountAcquiredVideoByUserEmail,
} = require('../controllers/video.controller');

router.get('/getAll', authMiddleware, async (req, res) => {
  try {
    const { me, nameWithCountry, role } = req.query;

    const userId = req.user.id;

    let users = await getAllUsers(JSON.parse(me), userId, role);

    if (JSON.parse(nameWithCountry) === true) {
      users = users.map((obj) => {
        return {
          ...obj._doc,
          name: `${obj.name}${obj.country ? ` | ${obj.country}` : ''}`,
        };
      });
    }

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

router.get('/getWorkerById', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);

    if (!user) {
      return res
        .status(200)
        .json({ message: 'Worker is not found', status: 'warning' });
    }

    return res.status(200).json(user);
  } catch (err) {
    console.log(err);
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
    } = req.body;

    const { roleUsersForResponse } = req.query;

    const isValidate = validationForRequiredInputDataInUserModel(
      role,
      req.body
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
    };

    await createUser(objDB);

    let apiData;

    //if (roleUsersForResponse) {
    //  apiData = await getAllUsers(true, null, roleUsersForResponse);
    //} else {
    //  apiData = await getUserById(userId);
    //}

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
    const { refHash, password: reqPassword } = req.body;

    if (!refHash) {
      return res.status(200).json({
        message:
          'There is no referral hash. Contact your administrator or try again',
        status: 'warning',
      });
    }

    const objToSearchVbForm = {
      searchBy: 'refHash',
      refHash,
    };

    const vbForm = await findOne(objToSearchVbForm);

    if (!vbForm) {
      return res.status(200).json({
        message:
          'The form was not found. Contact your administrator or try again',
        status: 'warning',
      });
    }

    const candidate = await getUserByEmail(vbForm.email);

    if (candidate) {
      return res.status(200).json({
        message: 'A user with this email already exists',
        status: 'warning',
      });
    }

    const salt = await genSalt(10);

    const objForCreateUAuthor = {
      name: vbForm.name,
      email: vbForm.email,
      password: await hashBcrypt(reqPassword, salt),
      referer: vbForm.researcher.email,
      role: 'author',
      balance: 0,
    };

    const newUser = await createUser(objForCreateUAuthor);

    const objForUpdateVbForm = {
      activatedPersonalAccount: true,
    };

    const refreshVbForm = await updateVbFormByFormId(
      vbForm.formId,
      objForUpdateVbForm
    );

    const { password, ...userData } = newUser._doc;

    return res.status(200).json({
      message: 'Congratulations on registering on the service!',
      status: 'success',
      apiData: userData,
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
    const { userId } = req.query;

    const userIdToUpdate = userId ? userId : req.user.id;

    const user = await getUserById(userIdToUpdate);

    if (!user) {
      return res.status(200).json({
        message: 'User not found',
        status: 'warning',
      });
    }

    const { roleUsersForResponse } = req.query;

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
      ...(balance && { lastPaymentDate: moment().toDate() }),
    };

    objDBForIncrement = {
      ...(balance && { balance }),
    };

    await updateUser(userIdToUpdate, objDB, objDBForIncrement);

    let apiData;

    if (roleUsersForResponse) {
      apiData = await getAllUsers(true, null, roleUsersForResponse);
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

      const salesDateLimit = await getSalesByUserEmail(user.email, 30);

      const salesSumAmountDateLimit = salesDateLimit.reduce((acc, sale) => {
        return +(
          acc +
          sale.amountToResearcher / sale.researchers.emails.length
        ).toFixed(2);
      }, 0);

      const sales = await getSalesByUserEmail(user.email, null);

      const earnedForYourself = sales.reduce(
        (a, sale) =>
          a + +(sale.amountToResearcher / sale?.researchers?.emails?.length),
        0
      );

      const earnedTillNextPayment = earnedForYourself - user.balance;

      const linksCount = await getCountLinksByUserEmail(user.email, null);

      const acquiredVideoCount = await getCountAcquiredVideoByUserEmail(
        user.email,
        null
      );

      const approvedTrelloCardCount =
        await getCountApprovedTrelloCardByNickname(user.nickname, null);

      const dataDBForUpdateUser = {
        'sentVideosCount.total': linksCount,
        'earnedForYourself.dateLimit': +salesSumAmountDateLimit.toFixed(2),
        'earnedForYourself.total': +earnedForYourself.toFixed(2),
        'acquiredVideosCount.total': acquiredVideoCount,
        'approvedVideosCount.total': approvedTrelloCardCount,
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

    users = await getAllUsers(true, null, roleUsersForResponse);

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

module.exports = router;
