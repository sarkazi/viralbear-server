const express = require('express');
const router = express.Router();
const { genSalt, hash: hashBcrypt } = require('bcryptjs');

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
} = require('../controllers/user.controller.js');

const {
  updateCustomFieldByTrelloCard,
} = require('../controllers/trello.controller');

router.get('/getWorkers', authMiddleware, async (req, res) => {
  try {
    const workers = await getWorkers();

    if (!workers) {
      return res
        .status(404)
        .json({ message: 'Workers not found', status: 'error', code: 404 });
    }

    return res.status(200).json(workers);
  } catch (err) {
    console.log(err);
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
    } = req.body;

    console.log(amountPerVideo, percentage);

    if (!email || !password || !nickname || !name || !role) {
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

    const { name, nickname, role, email, percentage, amountPerVideo } =
      req.body;

    objDB = {
      name,
      nickname: `@${nickname}`,
      role,
      email,
      percentage,
      amountPerVideo,
    };

    await updateUser(userId, objDB);

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
