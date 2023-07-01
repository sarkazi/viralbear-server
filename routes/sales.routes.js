const express = require('express');
const router = express.Router();

const multer = require('multer');
const xlsx = require('xlsx');

const {
  createNewSale,
  deleteSaleById,
  getAllSales,
  findSaleById,
} = require('../controllers/sales.controller');

const {
  findUsersByEmails,
  updateUserByIncrement,
  getUserBy,
} = require('../controllers/user.controller');

const { findOne } = require('../controllers/uploadInfo.controller');

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
    try {
      const workbook = xlsx.read(csv[0].buffer, {
        type: 'buffer',
      });

      const parseDocument = await Promise.all(
        workbook.SheetNames.map(async (sheetName) => {
          return xlsx.utils.sheet_to_row_object_array(
            workbook.Sheets[sheetName]
          );
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
        processingData.data.suitable.map(async (obj, index) => {
          if (obj.videoId) {
            if (obj.videoId < 1460) {
              return {
                videoId: obj.videoId,
                status: 'lessThen1460',
              };
            } else {
              const videoDb = await findById(obj.videoId);

              const vbForm = await findOne({
                searchBy: 'formId',
                param: videoDb.uploadData.vbCode,
              });

              if (!videoDb) {
                return {
                  videoId: obj.videoId,
                  status: 'notFound',
                };
              } else {
                const emailsOfResearchers = videoDb.trelloData.researchers;
                const amount = +(+obj.amount).toFixed(2);
                const amountToResearchers = +(amount * 0.4).toFixed(2);

                return {
                  researchers: emailsOfResearchers,
                  videoId: obj.videoId,
                  ...(vbForm && {
                    vbForm: vbForm._id,
                  }),
                  ...(obj.usage && { usage: obj.usage }),
                  amount,
                  videoTitle: videoDb.videoData.title,
                  company: resCompany,
                  amountToResearcher: amountToResearchers,
                  date: moment().toString(),
                  status: 'found',
                  author: null,
                  advance: null,
                  percentage: null,
                  saleIdForClient: index + 1,
                };
              }
            }
          } else {
            const videoDb = await findVideoByTitle(obj.title);

            console.log(obj.title);

            const vbForm = await findOne({
              searchBy: 'formId',
              param: videoDb?.uploadData?.vbCode,
            });

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
                const emailsOfResearchers = videoDb.trelloData.researchers;
                const amount = +(+obj.amount).toFixed(2);
                const amountToResearchers = +(amount * 0.4).toFixed(2);

                return {
                  researchers: emailsOfResearchers,
                  videoId: videoDb.videoData.videoId,
                  ...(vbForm && {
                    vbForm: vbForm._id,
                  }),
                  ...(obj.usage && { usage: obj.usage }),
                  amount,
                  videoTitle: obj.title,
                  company: resCompany,
                  amountToResearcher: amountToResearchers,
                  date: moment().format('ll'),
                  status: 'found',
                  author: null,
                  advance: null,
                  percentage: null,
                  saleIdForClient: index + 1,
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
        const namesByUsers = await findUsersByEmails(obj.researchers);

        const emailsOfResearchers = obj.researchers;
        const amount = +obj.amount;
        const amountForAllResearchers = obj.amountToResearcher;
        //const researcherEarnedForCompany = +(
        //  amount / emailsOfResearchers.length
        //).toFixed(2);
        //const researcherEarnedForYourself = +(
        //  amountForAllResearchers / emailsOfResearchers.length
        //).toFixed(2);

        const objDB = {
          //researchers: {
          //  emails: emailsOfResearchers,
          //  names: namesByUsers.map((obj) => {
          //    return obj.name;
          //  }),
          //},
          researchers: namesByUsers.map((el) => {
            return el._id;
          }),
          videoId: obj.videoId,
          ...(obj.vbForm && { vbForm: obj.vbForm }),
          amount,
          amountToResearcher: amountForAllResearchers,
          date: moment().format('ll'),
          ...(obj.usage && { usage: obj.usage }),
          manual: obj.saleId ? false : true,
          videoTitle: obj.videoTitle,
          company: obj.company,
        };

        await createNewSale(objDB);

        //const dataDBForUpdate = {
        //  earnedForCompany: researcherEarnedForCompany,
        //  'earnedForYourself.total': researcherEarnedForYourself,
        //};

        //await updateUserByIncrement(
        //  'email',
        //  emailsOfResearchers,
        //  dataDBForUpdate
        //);

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

router.get('/getAll', authMiddleware, async (req, res) => {
  try {
    const { count, company, date, videoId, researcher, personal } = req.query;

    let userId = null;

    if (researcher) {
      const user = await getUserBy('name', researcher);

      userId = user._id;
    }

    if (personal && JSON.parse(personal) === true) {
      userId = req.user.id;
    }

    let sales = await getAllSales({
      count,
      ...(company && { company }),
      ...(date && { date }),
      ...(videoId && { videoId }),
      ...(userId && { userId }),
      ...(date && {
        date: date[0] === 'null' || date[1] === 'null' ? null : date,
      }),
    });

    const sumAmount = sales.reduce((acc, item) => {
      return acc + item.amount;
    }, 0);

    const sumAmountResearcher = sales.reduce((acc, item) => {
      return acc + item.amountToResearcher;
    }, 0);

    const apiData = {
      sales,
      sumAmount: sumAmount.toFixed(2),
      sumAmountResearcher: sumAmountResearcher.toFixed(2),
    };

    return res.status(200).json({
      status: 'success',
      message: count
        ? `The last ${count} sales have been received`
        : 'All sales have been received',
      apiData,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      status: 'error',
      message: err?.message ? err.message : 'Server side error',
    });
  }
});

//router.get('/updateSalesInfo', authMiddleware, async (req, res) => {
//  try {
//    const { dateLimit } = req.query;

//    const allWorkers = await getWorkers(true, null);

//    await Promise.all(
//      allWorkers.map(async (user) => {
//        const sales = await getSalesByUser(
//          user.email,
//          dateLimit ? +dateLimit : null
//        );

//        const sumAmount = sales.reduce((acc, sale) => {
//          return +(
//            acc +
//            sale.amountToResearcher / sale.researchers.emails.length
//          ).toFixed(2);
//        }, 0);

//        const dataDBForUpdateUser = {
//          'earnedForYourself.dateLimit': sumAmount,
//        };

//        const test = await updateUserByIncrement(
//          'email',
//          [user.email],
//          dataDBForUpdateUser
//        );

//        console.log(test, 87998);
//      })
//    );

//    const researchers = await getWorkers(true, null);

//    console.log(researchers, 9999);

//    return res.status(200).json({
//      status: 'success',
//      message: `The number of sales for each worker received`,
//      apiData: researchers,
//    });
//  } catch (err) {
//    console.log(err);
//    return res.status(500).json({
//      status: 'error',
//      message: err?.message ? err.message : 'Server side error',
//    });
//  }
//});

router.delete('/deleteOne/:saleId', authMiddleware, async (req, res) => {
  const { saleId } = req.params;

  const { count, company, date, videoId, researcher } = req.query;

  if (!saleId) {
    return res.status(200).json({
      status: 'warning',
      message: `Missing value: "saleId"`,
    });
  }

  try {
    const sale = await findSaleById(saleId);

    if (!sale) {
      return res.status(200).json({
        status: 'warning',
        message: `Sales with id ${saleId} not found in the database`,
      });
    }

    await deleteSaleById(saleId);

    const sales = await getAllSales({
      count,
      ...(company && { company }),
      ...(date && { date }),
      ...(videoId && { videoId }),
      ...(researcher && { researcher }),
      ...(date && {
        date: date[0] === 'null' || date[1] === 'null' ? null : date,
      }),
    });

    const sumAmount = sales.reduce((acc, item) => {
      return acc + item.amount;
    }, 0);

    const sumAmountResearcher = sales.reduce((acc, item) => {
      return acc + item.amountToResearcher;
    }, 0);

    const apiData = {
      sales,
      sumAmount,
      sumAmountResearcher,
    };

    return res.status(200).json({
      status: 'success',
      message: `The sale with id ${saleId} has been deleted`,
      apiData,
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
