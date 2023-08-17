const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth.middleware');

const { validationResult, check } = require('express-validator');

const { compare } = require('bcryptjs');

const {
  getUserByEmail,
  getUserById,
} = require('../controllers/user.controller');
const {
  generateTokens,
  validateRefreshToken,
} = require('../controllers/auth.controllers');
const { sign } = require('jsonwebtoken');

router.post(
  '/login',
  [
    check('email', 'Please enter a valid email').normalizeEmail().isEmail(),
    check('password', 'Enter password').exists(),
  ],
  async (req, res) => {
    const { email, password } = req.body;

    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          errors: errors.array(),
          message: 'Incorrect login information',
          status: 'warning',
        });
      }

      const user = await getUserByEmail(email);

      if (!user) {
        return res
          .status(404)
          .json({ message: 'User is not found', status: 'warning', code: 404 });
      }

      const isMatch = await compare(password, user.password);

      if (!isMatch) {
        return res.status(403).json({
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
      console.log(err);
    }
  }
);

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
    console.log(err);
    return res.status(500).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

router.post('/authenticate', authMiddleware, async (req, res) => {
  if (req?.user?.role) {
    const user = await getUserById(req?.user?.id);

    return res.status(200).json({
      apiData: { role: req.user.role, userId: req.user.id, name: user?.name },
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
