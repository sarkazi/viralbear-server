const express = require('express');
const router = express.Router();

const multer = require('multer');
const xlsx = require('xlsx');

const {
  createNewSale,
  findSaleBySaleId,
} = require('../controllers/sales.controller');

const determinationCompanyDataBasedOnPairedReport = require('../utils/determinationCompanyDataBasedOnPairedReport');

const storage = multer.memoryStorage();

const {
  findById,
  findVideoByTitle,
} = require('../controllers/video.controller');

const moment = require('moment');

const authMiddleware = require('../middleware/auth.middleware');

router.post('/manualGenerationPreSale', authMiddleware, async (req, res) => {
  try {
    const { company, videoId, amount, usage } = req.body;

    if (!company || !videoId || !amount || !usage) {
      return res.status(200).json({
        status: 'warning',
        message: 'Missing parameter',
      });
    }

    const videoDb = await findById(videoId);

    if (!videoDb) {
      return res.status(200).json({
        status: 'warning',
        message: `Video with id "${videoId}" not found`,
      });
    }

    const apiData = {
      suitable: [
        {
          researchers: videoDb.trelloData.researchers,
          videoId,
          usage,
          amount,
          videoTitle: videoDb.videoData.title,
          company,
          amountToResearcher: (amount * 0.4).toFixed(2),
          date: moment().toString(),
          author: null,
          advance: null,
          percentage: null,
        },
      ],
      type: 'manual',
    };

    return res.status(200).json({
      apiData,
      status: 'success',
      message: 'The data has been processed successfully',
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      status: 'error',
      message: err?.message ? err.message : 'Server side error',
    });
  }
});

router.post(
  '/fileGenerationPreSale',
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

    console.log(processingData.data, 877787);

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
                amount: +(+obj.amount).toFixed(2),
                videoTitle: videoDb.videoData.title,
                company: resCompany,
                amountToResearcher: +(+obj.amount * 0.4).toFixed(2),
                date: moment().toString(),
                status: 'found',
                author: null,
                advance: null,
                percentage: null,
                saleId: obj.saleId,
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
                amount: +(+obj.amount).toFixed(2),
                videoTitle: obj.title,
                company: resCompany,
                amountToResearcher: +(+obj.amount * 0.4).toFixed(2),
                date: moment().format('ll'),
                status: 'found',
                author: null,
                advance: null,
                percentage: null,
                saleId: obj.saleId,
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

router.post('/create', authMiddleware, async (req, res) => {
  try {
    const body = req.body;

    const promiseAfterCreated = await Promise.all(
      body.map(async (obj) => {
        if (obj.saleId) {
          const sale = await findSaleBySaleId(obj.saleId);

          if (sale) {
            return {
              status: 'existed',
              videoId: obj.videoId,
            };
          }
        }

        const objDB = {
          researchers: obj.researchers,
          videoId: obj.videoId,
          amount: obj.amount,
          date: moment().format('ll'),
          usage: obj.usage,
          ...(obj.saleId && { saleId: obj.saleId }),
          manual: obj.saleId ? false : true,
        };

        await createNewSale(objDB);

        return {
          status: 'created',
          videoId: obj.videoId,
        };
      })
    );

    const salesInfo = promiseAfterCreated.reduce(
      (res, item) => {
        res[item.status === 'existed' ? 'existed' : 'created'].push(item);
        return res;
      },
      { existed: [], created: [] }
    );

    console.log(salesInfo, 9987);

    return res.status(200).json({
      status: salesInfo.existed.length ? 'warning' : 'success',
      message: salesInfo.existed.length
        ? `Sales with video ${salesInfo.existed
            .map((obj) => {
              return obj.videoId;
            })
            .join(',')} previously added to the database${
            salesInfo.created.length
              ? `, ${salesInfo.created
                  .map((obj) => {
                    return obj.videoId;
                  })
                  .join(',')} have been added`
              : ''
          }`
        : `Sales with video ${salesInfo.created
            .map((obj) => {
              return obj.videoId;
            })
            .join(',')} has been added to the database`,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      status: 'error',
      message: err?.message ? err.message : 'Server side error',
    });
  }
});

module.exports = router;
