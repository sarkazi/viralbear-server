const express = require('express');
const router = express.Router();
const { genSalt, hash: hashBcrypt } = require('bcryptjs');
const moment = require('moment');

const authMiddleware = require('../middleware/auth.middleware');

const {
  getWorkers,
  deleteUser,
  sendPassword,
  createUser,
  recoveryPassword,
  getUserById,
  updateUser,
  getUserByEmail,
  updateStatForAllResearchers,
} = require('../controllers/user.controller.js');

const { getCountLinksByUserEmail } = require('../controllers/links.controller');

const { getSalesByUserEmail } = require('../controllers/sales.controller');

const {
  getCountApprovedTrelloCardByNickname,
} = require('../controllers/moveFromReview.controller');

const { sendEmail } = require('../controllers/sendEmail.controller');

const {
  getCountAcquiredVideoByUserEmail,
} = require('../controllers/video.controller');

router.get('/getWorkers', authMiddleware, async (req, res) => {
  try {
    const { me, nameWithCountry } = req.query;

    const userId = req.user.id;

    let workers = await getWorkers(JSON.parse(me), userId);

    if (!workers) {
      return res
        .status(404)
        .json({ message: 'Workers not found', status: 'error', code: 404 });
    }

    if (JSON.parse(nameWithCountry) === true) {
      workers = workers.map((obj) => {
        return {
          ...obj._doc,
          name: `${obj.name}${obj.country ? ` | ${obj.country}` : ''}`,
        };
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'The list of workers has been received',
      apiData: workers,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ status: 'error' });
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
    } = req.body;

    console.log(amountPerVideo, percentage);

    if (!email || !password || !nickname || !name || !role || !country) {
      return res
        .status(404)
        .json({ message: 'Missing data to create a user', status: 'warning' });
    }

    const candidate = await getUserByEmail(email);

    if (candidate) {
      return res.status(400).json({
        message: 'A user with this email already exists',
        status: 'warning',
      });
    }

    const salt = await genSalt(10);

    const objDB = {
      nickname,
      name,
      email: email,
      password: await hashBcrypt(password, salt),
      role,
      percentage,
      amountPerVideo,
      percentage,
      amountPerVideo,
      country,
    };

    const newUser = await createUser(objDB);

    const allWorkers = await getWorkers();

    return res.status(200).json({
      message: 'A new user has been successfully created',
      status: 'success',
      apiData: allWorkers,
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

router.patch('/updateOne/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const {
      name,
      nickname,
      role,
      email,
      percentage,
      amountPerVideo,
      country,
      balance,
    } = req.body;

    objDB = {
      ...(name && { name }),
      ...(nickname && { nickname: `@${nickname}` }),
      ...(role && { role }),
      ...(email && { email }),
      ...(percentage && { percentage }),
      ...(amountPerVideo && { amountPerVideo }),
      ...(country && { country }),
      ...(balance && { lastPaymentDate: moment().toDate() }),
    };

    objDBForIncrement = {
      ...(balance && { balance }),
    };

    await updateUser(userId, objDB, objDBForIncrement);

    const allWorkers = await getWorkers();

    return res.status(200).json({
      message: 'User data has been successfully updated',
      status: 'success',
      apiData: allWorkers,
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
  '/updateStatisticsForAllResearchers',
  authMiddleware,
  async (req, res) => {
    try {
      const { allWorkersWithRefreshStat, sumCountWorkersValue } =
        await updateStatForAllResearchers();

      return res.status(200).json({
        message: 'Users with updated statistics received',
        status: 'success',
        apiData: {
          workers: allWorkersWithRefreshStat,
          sumValues: sumCountWorkersValue,
        },
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
  try {
    await deleteUser(userId);

    allWorkers = await getWorkers();

    return res.status(200).json({
      message: 'The user has been successfully deleted',
      status: 'success',
      apiData: allWorkers,
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

    const { allWorkersWithRefreshStat, sumCountWorkersValue } =
      await updateStatForAllResearchers();

    return res.status(200).json({
      message: 'The workers"s balance has been successfully replenished',
      status: 'success',
      apiData: {
        allWorkersWithRefreshStat,
        sumCountWorkersValue,
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
