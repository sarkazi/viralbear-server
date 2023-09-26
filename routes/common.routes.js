const express = require('express');
const router = express.Router();

router.get('/googleCallback', async (req, res) => {
  res.status(200).json({
    code: req.query.code,
    status: 'success',
    message: 'Copy the code and paste it on the website page',
  });
});

module.exports = router;
