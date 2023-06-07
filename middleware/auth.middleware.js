const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const token = req.header('Authorization');

    if (!token)
      return res
        .status(401)
        .send({ message: 'Access denied', status: 'error', code: 401 });

    const decoded = jwt.verify(token.split(' ')[1], 'admin video application');

    req.user = decoded;
    next();
  } catch (error) {
    console.log(error);
    return res
      .status(401)
      .json({ message: 'Access denied', status: 'error', code: 401 });
  }
};
