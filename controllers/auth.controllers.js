const { sign, verify } = require('jsonwebtoken');

const generateTokens = ({ userId, userRole }) => {
  const accessToken = sign(
    { id: userId, role: userRole },
    'admin video application',
    {
      expiresIn: '30m',
    }
  );
  const refreshToken = sign(
    { id: userId, role: userRole },
    'admin video application',
    {
      expiresIn: '30d',
    }
  );

  return { accessToken, refreshToken };
};

const validateRefreshToken = (refreshToken) => {
  const isValidate = verify(refreshToken, 'admin video application');

  return isValidate;
};

module.exports = { generateTokens, validateRefreshToken };
