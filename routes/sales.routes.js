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
  findUsersByValueList,
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
          amountToResearchers: (amount * 0.4).toFixed(2),
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
                param: videoDb?.uploadData?.vbCode
                  ? videoDb.uploadData.vbCode
                  : null,
              });

              if (!videoDb) {
                return {
                  videoId: obj.videoId,
                  status: 'notFound',
                };
              } else {
                const videoResearchers = videoDb.trelloData.researchers;
                const amount = +(+obj.amount).toFixed(2);
                const amountToResearchers = +(amount * 0.4).toFixed(2);

                return {
                  researchers: videoResearchers.map((researcher) => {
                    return {
                      email: researcher.email,
                      name: researcher.name,
                    };
                  }),
                  videoId: obj.videoId,
                  ...(vbForm && {
                    vbForm: vbForm._id,
                  }),
                  ...(obj.usage && { usage: obj.usage }),
                  amount,
                  videoTitle: videoDb.videoData.title,
                  company: resCompany,
                  amountToResearchers: amountToResearchers,
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
                const videoResearchers = videoDb.trelloData.researchers;
                const amount = +(+obj.amount).toFixed(2);
                const amountToResearchers = +(amount * 0.4).toFixed(2);

                return {
                  researchers: videoResearchers.map((researcher) => {
                    return {
                      email: researcher.email,
                      name: researcher.name,
                    };
                  }),
                  videoId: videoDb.videoData.videoId,
                  ...(vbForm && {
                    vbForm: vbForm._id,
                  }),
                  ...(obj.usage && { usage: obj.usage }),
                  amount,
                  videoTitle: obj.title,
                  company: resCompany,
                  amountToResearchers: amountToResearchers,
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
        console.log(obj.researchers);

        const users = await findUsersByValueList({
          param: 'email',
          valueList: obj.researchers.map((researcher) => {
            return researcher.email;
          }),
        });

        const amount = +obj.amount;
        const amountForAllResearchers = obj.amountToResearchers;

        console.log(obj.vbForm);

        const objDB = {
          researchers: users.map((el) => {
            return {
              id: el._id,
              name: el.name,
            };
          }),
          videoId: obj.videoId,
          ...(obj.vbForm && {
            vbFormInfo: {
              uid: obj.vbForm,
              paidFor: false,
            },
          }),
          amount,
          amountToResearchers: amountForAllResearchers,
          date: moment().format('ll'),
          ...(obj.usage && { usage: obj.usage }),
          manual: obj.saleId ? false : true,
          videoTitle: obj.videoTitle,
          company: obj.company,
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
    const {
      count,
      company,
      date,
      videoId,
      researcher,
      personal,
      relatedToTheVbForm,
    } = req.query;

    let userId = null;

    if (researcher) {
      const user = await getUserBy({ param: 'name', value: researcher });

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
      ...(relatedToTheVbForm &&
        typeof JSON.parse(relatedToTheVbForm) === 'boolean' && {
          relatedToTheVbForm: JSON.parse(relatedToTheVbForm),
        }),
    });

    const sumAmount = sales.reduce((acc, item) => {
      return acc + item.amount;
    }, 0);

    const sumAmountResearcher = sales.reduce((acc, item) => {
      return acc + item.amountToResearchers;
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

router.get('/getStatisticsOnAuthors', authMiddleware, async (req, res) => {
  const { group } = req.query;

  try {
    const salesRelatedToTheVbForm = await getAllSales({
      relatedToTheVbForm: true,
    });

    let authorsSalesStatistics = await Promise.all(
      salesRelatedToTheVbForm.map(async (sale) => {
        const vbForm = await findOne({
          searchBy: '_id',
          param: sale.vbFormInfo.uid,
        });

        const authorRelatedWithVbForm = await getUserBy({
          param: '_id',
          value: vbForm.sender,
        });

        return {
          authorEmail: authorRelatedWithVbForm.email,
          ...(authorRelatedWithVbForm.percentage && {
            percentage: authorRelatedWithVbForm.percentage,
          }),
          ...(typeof vbForm.advancePaymentReceived === 'boolean' &&
            authorRelatedWithVbForm.amountPerVideo && {
              advance:
                vbForm.advancePaymentReceived === false
                  ? authorRelatedWithVbForm.amountPerVideo
                  : 0,
            }),
          videoId: sale.videoId,
          videoTitle: sale.videoTitle,
          paymentInfo:
            authorRelatedWithVbForm.paymentInfo.variant === undefined
              ? false
              : true,
          amount: authorRelatedWithVbForm.percentage
            ? (sale.amount * authorRelatedWithVbForm.percentage) / 100
            : 0,
          ...(typeof vbForm.advancePaymentReceived === 'boolean' &&
            authorRelatedWithVbForm.amountPerVideo && {
              advancePaymentReceived: vbForm.advancePaymentReceived,
            }),
          vbFormUid: vbForm.formId,
        };
      })
    );

    let groupedStatisticsByAuthor = [];

    authorsSalesStatistics.reduce((res, saleData) => {
      if (!res[saleData.videoId]) {
        res[saleData.videoId] = {
          videoId: saleData.videoId,
          amount: 0,
          authorEmail: saleData.authorEmail,
          percentage: saleData.percentage ? saleData.percentage : 0,
          advance: {
            value: saleData.advance ? saleData.advance : 0,
            ...(typeof saleData.advancePaymentReceived === 'boolean' && {
              paid: saleData.advancePaymentReceived,
            }),
          },
          authorEmail: saleData.authorEmail,
          sales: 0,
          paymentInfo: saleData.paymentInfo,
          videoTitle: saleData.videoTitle,
          vbFormUid: saleData.vbFormUid,
        };
        groupedStatisticsByAuthor.push(res[saleData.videoId]);
      }
      res[saleData.videoId].amount += +saleData.amount.toFixed(2);
      res[saleData.videoId].sales += 1;
      return res;
    }, {});

    groupedStatisticsByAuthor = groupedStatisticsByAuthor.map(
      (videoSaleData) => {
        if (videoSaleData.advance.value) {
          return {
            ...videoSaleData,
            amount: +(
              videoSaleData.amount + videoSaleData.advance.value
            ).toFixed(2),
          };
        } else {
          return videoSaleData;
        }
      }
    );

    groupedStatisticsByAuthor = groupedStatisticsByAuthor.reduce(
      (res, videoSaleData) => {
        if (
          videoSaleData.paymentInfo &&
          ((videoSaleData.advance.paid &&
            videoSaleData.advance.paid === false) ||
            videoSaleData.amount > 75)
        ) {
          res['ready'].push(videoSaleData);
        }
        if (
          !videoSaleData.paymentInfo &&
          ((videoSaleData.advance.paid &&
            videoSaleData.advance.paid === false) ||
            videoSaleData.amount > 75)
        ) {
          res['noPayment'].push(videoSaleData);
        }
        if (videoSaleData.advance.value === 0 || videoSaleData.amount <= 75) {
          res['other'].push(videoSaleData);
        }
        return res;
      },
      { ready: [], noPayment: [], other: [] }
    );

    return res.status(200).json({
      status: 'success',
      message: "authors' sales statistics are obtained",
      apiData:
        group === 'ready'
          ? groupedStatisticsByAuthor.ready
          : group === 'noPayment'
          ? groupedStatisticsByAuthor.noPayment
          : groupedStatisticsByAuthor.other,
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

  console.log(saleId, videoId);

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
      return acc + item.amountToResearchers;
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
