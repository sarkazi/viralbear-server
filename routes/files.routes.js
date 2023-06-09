const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { findById } = require('../controllers/video.controller');
const moment = require('moment');
const CC = require('currency-converter-lt');

const currencyConverter = new CC();

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

    const parseData = await Promise.all(
      workbook.SheetNames.map(async (sheetName) => {
        return xlsx.utils.sheet_to_row_object_array(workbook.Sheets[sheetName]);
      })
    ).then((arr) =>
      arr[0].filter(
        (obj) => obj['Partner Video Id'] && obj['Partner Video Id'] >= 1460
      )
    );

    const newReport = await Promise.all(
      parseData.map(async (obj) => {
        const earnings = obj['Your Earnings'];

        const videoDb = await findById(obj['Partner Video Id']);

        if (videoDb) {
          const researchers = videoDb.trelloData.researchers;

          const convertedAmount = await currencyConverter
            .from('GBP')
            .to('USD')
            .amount(earnings)
            .convert();

          return {
            researchers,
            videoId: obj['Partner Video Id'],
            usage: obj['Sale Type'],
            amount: +convertedAmount.toFixed(2),
            videoTitle: videoDb.videoData.title,
            company,
            amountToResearcher: +(convertedAmount / researchers.length).toFixed(
              2
            ),
            date: moment().toString(),
            status: 'found',
          };
        } else {
          return {
            videoId: obj['Partner Video Id'],
            status: 'not found',
          };
        }
      })
    ).then((arr) =>
      arr.reduce(
        (res, item) => {
          res[item.status === 'found' ? 'founded' : 'notFounded'].push(item);
          return res;
        },
        { founded: [], notFounded: [] }
      )
    );

    try {
      return res.status(200).json({
        status: 'success',
        message: 'Video added and sent',
        apiData: newReport,
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
