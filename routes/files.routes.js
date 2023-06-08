const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');

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
    const { company } = req.body;

    const workbook = xlsx.read(csv[0].buffer, {
      type: 'buffer',
    });

    workbook.SheetNames.forEach((sheetName) => {
      const parseData = xlsx.utils.sheet_to_row_object_array(
        workbook.Sheets[sheetName]
      );
    });

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
