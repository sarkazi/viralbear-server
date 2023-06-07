const { sign, verify } = require('jsonwebtoken');

const generateTokens = (user) => {
  const accessToken = sign(
    { id: user.id, role: user.role },
    'admin video application',
    {
      expiresIn: '30m',
    }
  );
  const refreshToken = sign(
    { id: user.id, role: user.role },
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
