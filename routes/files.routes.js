const express = require('express');
const router = express.Router();
const multer = require('multer');

const authMiddleware = require('../middleware/auth.middleware');

const storage = multer.memoryStorage();

router.post(
  '/reportCompanyParsing',
  authMiddleware,
  multer({ storage: storage }).fields([
    {
      name: 'csv',
      maxCount: 1,
    },
  ]),
  async (req, res) => {
    const { csv } = req.files;

    console.log(csv);

    try {
      return res.status(200).json({
        status: 'success',
        message: 'Video added and sent',
      });
    } catch (err) {
      console.log(err);
      return res
        .status(500)
        .json({ status: 'error', message: 'Server side error' });
    }
  }
);

module.exports = router;
