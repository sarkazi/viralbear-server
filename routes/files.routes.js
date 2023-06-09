const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const {
  findById,
  findVideoByTitle,
} = require('../controllers/video.controller');
const moment = require('moment');

const determinationCompanyDataBasedOnPairedReport = require('../utils/determinationCompanyDataBasedOnPairedReport');

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
    const { company: resCompany } = req.body;

    if (!resCompany || !csv) {
      return res.status(200).json({
        status: 'warning',
        message: 'Missing values: "company" or "csv file"',
      });
    }

    const workbook = xlsx.read(csv[0].buffer, {
      type: 'buffer',
    });

    const parseDocument = await Promise.all(
      workbook.SheetNames.map(async (sheetName) => {
        return xlsx.utils.sheet_to_row_object_array(workbook.Sheets[sheetName]);
      })
    );

    const processingData = await determinationCompanyDataBasedOnPairedReport(
      parseDocument[0]
    );

    if (resCompany !== processingData.company) {
      return res.status(200).json({
        status: 'warning',
        message: 'The report and the company are not comparable',
      });
    }

    const newReport = await Promise.all(
      processingData.data.suitable.map(async (obj) => {
        if (obj.videoId) {
          if (obj.videoId < 1460) {
            return {
              videoId: obj.videoId,
              status: 'lessThen1460',
            };
          } else {
            const videoDb = await findById(obj.videoId);

            if (!videoDb) {
              return {
                videoId: obj.videoId,
                status: 'notFound',
              };
            } else {
              return {
                researchers: videoDb.trelloData.researchers,
                videoId: obj.videoId,
                ...(obj.usage && { usage: obj.usage }),
                amount: (+obj.amount).toFixed(2),
                videoTitle: videoDb.videoData.title,
                company: resCompany,
                amountToResearcher: (+obj.amount * 0.4).toFixed(2),
                date: moment().toString(),
                status: 'found',
                author: null,
                advance: null,
                percentage: null,
              };
            }
          }
        } else {
          const videoDb = await findVideoByTitle(obj.title);

          if (!videoDb) {
            return {
              videoId: obj.title,
              status: 'notFound',
            };
          } else {
            if (videoDb.videoData.videoId < 1460) {
              return {
                videoId: obj.videoId,
                status: 'lessThen1460',
              };
            } else {
              return {
                researchers: videoDb.trelloData.researchers,
                videoId: videoDb.videoData.videoId,
                ...(obj.usage && { usage: obj.usage }),
                amount: (+obj.amount).toFixed(2),
                videoTitle: obj.title,
                company,
                amountToResearcher: (+obj.amount * 0.4).toFixed(2),
                date: moment().toString(),
                status: 'found',
                author: null,
                advance: null,
                percentage: null,
              };
            }
          }
        }
      })
    ).then((arr) =>
      arr.reduce(
        (res, item) => {
          res[
            item.status === 'found'
              ? 'suitable'
              : item.status === 'lessThen1460'
              ? 'lessThen1460'
              : 'notFounded'
          ].push(item);
          return res;
        },
        { suitable: [], notFounded: [], lessThen1460: [] }
      )
    );

    const apiData = {
      emptyVideoId: processingData.data.emptyField.length,
      idLess1460: newReport.lessThen1460.length,
      suitable: newReport.suitable,
      notFounded: newReport.notFounded.length,
      type: 'file',
    };

    try {
      return res.status(200).json({
        status: 'success',
        message: 'The data has been processed successfully',
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
