const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth.middleware');

const { validationResult, check, isEmail } = require('express-validator');

const { compare, hash } = require('bcryptjs');

const { errorsHandler } = require('../handlers/error.handler');

const {
  getUserByEmail,
  getUserById,
  getUserBy,
} = require('../controllers/user.controller');
const {
  generateTokens,
  validateRefreshToken,
} = require('../controllers/auth.controllers');
const { sign } = require('jsonwebtoken');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res.status(200).json({
      message: 'Missing email',
      status: 'warning',
    });
  }

  if (!password) {
    return res.status(200).json({
      message: 'Missing password',
      status: 'warning',
    });
  }

  try {
    const user = await getUserByEmail(email);

    if (!user) {
      return res
        .status(200)
        .json({ message: 'User is not found', status: 'warning', code: 404 });
    }

    if (!!user.inTheArchive) {
      return res.status(200).json({
        message: 'Your account is blocked. Contact the administrator',
        status: 'warning',
      });
    }

    const isMatch = await compare(password, user.password);

    if (!isMatch) {
      return res.status(200).json({
        message: 'Wrong password, please try again',
        status: 'warning',
        code: 403,
      });
    }

    const { accessToken, refreshToken } = generateTokens({
      userId: user._id,
      userRole: user.role,
    });

    return res.status(200).json({
      apiData: {
        accessToken,
        refreshToken,
        role: user.role,
        name: user.name,
        id: user._id,
      },
      status: 'success',
      code: 200,
    });
  } catch (err) {
    console.log(errorsHandler(err));
  }
});

router.post('/getMe', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const userData = await getUserById(userId);

    if (!userData) {
      return res.status(200).json({
        status: 'warning',
        message: 'User not found',
      });
    }

    return res.status(200).json({
      apiData: userData,
      status: 'success',
      message: 'User data received',
    });
  } catch (err) {
    console.log(errorsHandler(err));
    return res.status(500).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.post('/authenticate', authMiddleware, async (req, res) => {
  if (req?.user?.role) {
    const user = await getUserBy({ searchBy: '_id', value: req?.user?.id });

    return res.status(200).json({
      apiData: {
        role: req.user.role,
        userId: req.user.id,
        name: user?.name,
        email: user.email,
        ...(!!user?.paymentInfo?.variant && {
          paymentInfo: user.paymentInfo,
        }),
        ...(hash && { hash }),
      },
      status: 'success',
      code: 200,
    });
  } else {
    return res
      .status(200)
      .json({ message: 'Access denied', status: 'error', code: 401 });
  }
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  try {
    const isValidate = validateRefreshToken(refreshToken);

    if (!isValidate) {
      return res
        .status(401)
        .json({ message: 'Access denied', status: 'error', code: 401 });
    }

    const newAccessToken = sign(
      { id: isValidate.id, role: isValidate.role },
      'admin video application',
      {
        expiresIn: '30m',
      }
    );

    return res.status(200).json({ newAccessToken });
  } catch (err) {
    return res
      .status(401)
      .json({ message: 'Access denied', status: 'error', code: 401 });
  }
});

module.exports = router;
