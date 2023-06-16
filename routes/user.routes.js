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
  updateUserByIncrement,
  getUserByEmail,
} = require('../controllers/user.controller.js');

const { getCountLinksByUserEmail } = require('../controllers/links.controller');

const { getSalesByUserEmail } = require('../controllers/sales.controller');

const {
  getCountApprovedTrelloCardByNickname,
} = require('../controllers/moveFromReview.controller');

const {
  updateCustomFieldByTrelloCard,
} = require('../controllers/trello.controller');

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

    //if (Object.keys(objDB).length) {
    //  await updateUser(userId, objDB);
    //}

    await updateUser(userId, objDB, objDBForIncrement);

    //if (Object.keys(objDBForIncrement).length) {
    //  await updateUserByIncrement('_id', [userId], objDBForIncrement);
    //}

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
      const allWorkers = await getWorkers(true, null);

      await Promise.all(
        allWorkers.map(async (user) => {
          const salesDateLimit = await getSalesByUserEmail(user.email, 30);

          const salesSumAmountDateLimit = salesDateLimit.reduce((acc, sale) => {
            return +(
              acc +
              sale.amountToResearcher / sale.researchers.emails.length
            ).toFixed(2);
          }, 0);

          const sales = await getSalesByUserEmail(user.email, null);

          const salesSumAmount = sales.reduce((acc, sale) => {
            return +(
              acc +
              sale.amountToResearcher / sale.researchers.emails.length
            ).toFixed(2);
          }, 0);

          const linksCountDateLimit = await getCountLinksByUserEmail(
            user.email,
            30
          );

          const linksCount = await getCountLinksByUserEmail(user.email, null);

          const acquiredVideoCountDateLimit =
            await getCountAcquiredVideoByUserEmail(user.email, 5);

          const acquiredVideoCount = await getCountAcquiredVideoByUserEmail(
            user.email,
            null
          );

          const approvedTrelloCardCountDateLimit =
            await getCountApprovedTrelloCardByNickname(user.nickname, 30);

          const approvedTrelloCardCount =
            await getCountApprovedTrelloCardByNickname(user.nickname, null);

          const dataDBForUpdateUser = {
            'sentVideosCount.dateLimit': linksCountDateLimit,
            'sentVideosCount.total': linksCount,
            'earnedForYourself.dateLimit': salesSumAmountDateLimit,
            'earnedForYourself.total': salesSumAmount,
            'acquiredVideosCount.dateLimit': acquiredVideoCountDateLimit,
            'acquiredVideosCount.total': acquiredVideoCount,
            'approvedVideosCount.dateLimit': approvedTrelloCardCountDateLimit,
            'approvedVideosCount.total': approvedTrelloCardCount,
          };

          await updateUser(user._id, dataDBForUpdateUser);
        })
      );

      const allWorkersWithRefreshStat = await getWorkers(true, null);

      return res.status(200).json({
        message: 'Users with updated statistics received',
        status: 'success',
        apiData: allWorkersWithRefreshStat,
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

module.exports = router;
