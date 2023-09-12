const express = require('express');
const router = express.Router();

router.get('/googleCallback', async (req, res) => {
  console.log(req.query, 88);

  return res.status(200).json({
    status: 'success',
  });
});

module.exports = router;
