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

    if (!company || !csv) {
      return res.status(200).json({
        status: 'warning',
        message: 'Missing values: "company" or "csv file"',
      });
    }

    const workbook = xlsx.read(csv[0].buffer, {
      type: 'buffer',
    });

    const parseData = await Promise.all(
      workbook.SheetNames.map(async (sheetName) => {
        return xlsx.utils.sheet_to_row_object_array(workbook.Sheets[sheetName]);
      })
    ).then((arr) =>
      arr[0].reduce(
        (res, item) => {
          res[
            !item['Partner Video Id']
              ? 'emptyVideoId'
              : item['Partner Video Id'] < 1460
              ? 'idLess1460'
              : 'suitable'
          ].push(item);
          return res;
        },
        { suitable: [], idLess1460: [], emptyVideoId: [] }
      )
    );

    const newReport = await Promise.all(
      parseData.suitable.map(async (obj) => {
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
            amountToResearcher: (+convertedAmount * 0.4).toFixed(2),
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
          res[item.status === 'found' ? 'suitable' : 'notFounded'].push(item);
          return res;
        },
        { suitable: [], notFounded: [] }
      )
    );

    const apiData = {
      idLess1460: parseData.idLess1460.length,
      emptyVideoId: parseData.emptyVideoId.length,
      suitable: newReport.suitable,
      notFounded: newReport.notFounded.length,
    };

    try {
      return res.status(200).json({
        status: 'success',
        message: 'The data has been processed successfully.',
        apiData,
      });
    } catch (err) {
      console.log(err);

      return res.status(500).json({
        status: 'error',
        message: err?.message ? err.message : 'Server side error',
      });
    }
  }
);

module.exports = router;
