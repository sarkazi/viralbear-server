module.exports = {
  isAdmin: (req, res, next) => {
    if (req.user.role === "admin" || req.user.role === "researcher") {
      next();
    } else {
      res.status(403).send();
    }
  },
};
