const express = require('express');
const router = express.Router();

const {
  getAllUsers,

  getUserBy,
} = require('../controllers/user.controller.js');

const { errorsHandler } = require('../handlers/error.handler');

router.get('/getAll', async (req, res) => {
  try {
    const { roles } = req.query;

    fieldsInTheResponse = [
      'email',
      'avatarUrl',
      'email',
      'role',
      'name',
      'canBeAssigned',
    ];

    const users = await getAllUsers({
      roles,
      fieldsInTheResponse,
    });

    return res.status(200).json({
      status: 'success',
      message: 'The list of workers has been received',
      apiData: users,
    });
  } catch (err) {
    console.log(errorsHandler(err));
    return res
      .status(500)
      .json({ status: 'error', message: 'Server side error' });
  }
});

router.get('/getBy', async (req, res) => {
  try {
    const { searchBy, value } = req.query;

    if (!searchBy || !value) {
      return res.status(200).json({
        message: 'Missing parameters for user search',
        status: 'warning',
      });
    }

    const user = await getUserBy({ searchBy, value });

    if (!user) {
      return res
        .status(200)
        .json({ message: 'User is not found', status: 'warning' });
    }

    return res.status(200).json({ apiData: user, status: 'success' });
  } catch (err) {
    console.log(errorsHandler(err));
  }
});

module.exports = router;
