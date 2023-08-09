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

const pullOutProcessingDataFromPairedReport = require('../utils/pullOutProcessingDataFromPairedReport');
const definitionThePartnerCompanyByFileHeader = require('../utils/definitionThePartnerCompanyByFileHeader');
const removeValuesWithoutKeyFieldInPairedReport = require('../utils/removeValuesWithoutKeyFieldInPairedReport');

const storage = multer.memoryStorage();

const {
  findById,

  findVideoByValue,
} = require('../controllers/video.controller');

const moment = require('moment');

const authMiddleware = require('../middleware/auth.middleware');
const Sales = require('../entities/Sales');

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

    const researchers = videoDb.trelloData.researchers;

    if (!videoDb) {
      return res.status(200).json({
        status: 'warning',
        message: `Video with id "${videoId}" not found`,
      });
    }

    let author = null;

    if (videoDb.vbForm) {
      const vbForm = await findOne({
        searchBy: '_id',
        param: videoDb.vbForm,
      });

      if (vbForm && vbForm.sender) {
        author = await getUserBy({ param: '_id', value: vbForm.sender });
      }
    }

    const apiData = {
      suitable: [
        {
          ...(researchers.length && {
            researchers: researchers.map((researcher) => {
              return {
                email: researcher.email,
                name: researcher.name,
              };
            }),
          }),

          videoId,
          usage,
          amount,
          videoTitle: videoDb.videoData.title,
          company,
          amountToResearcher: researchers.length
            ? +((amount * 0.4) / researchers.length).toFixed(2)
            : '-',
          date: moment().toString(),
          authorEmail: author ? author.email : '-',
          advance: !author
            ? '-'
            : author.advancePayment
            ? author.advancePayment
            : 0,
          percentage: !author ? '-' : author.percentage ? author.percentage : 0,
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

    if (!csv) {
      return res.status(200).json({
        status: 'warning',
        message: 'The file for parsing was not found',
      });
    }

    try {
      const workbook = xlsx.read(csv[0].buffer, {
        type: 'buffer',
        sheetStubs: true,
      });

      const fileHeaderValues = xlsx.utils
        .sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 })
        .shift();

      const parseReport = await Promise.all(
        workbook.SheetNames.map(async (sheetName) => {
          return xlsx.utils.sheet_to_row_object_array(
            workbook.Sheets[sheetName]
          );
        })
      );

      const companyName = definitionThePartnerCompanyByFileHeader({
        fileHeaderValues,
      });

      if (!companyName) {
        return res.status(200).json({
          status: 'warning',
          message:
            'It was not possible to determine which partner company owns the report',
        });
      }

      const filterParseReport = removeValuesWithoutKeyFieldInPairedReport({
        parseReport: parseReport[0],
        companyName,
      });

      const processingData = await pullOutProcessingDataFromPairedReport({
        parseReport: filterParseReport,
        companyName,
      });

      const newReport = await Promise.all(
        processingData.data.map(async (obj, index) => {
          if (!!obj.videoId) {
            if (obj.videoId < 1460) {
              return {
                videoId: obj.videoId,
                status: 'lessThen1460',
              };
            } else {
              const videoDb = await findVideoByValue({
                searchBy: 'videoData.videoId',
                value: obj.videoId,
              });

              if (!videoDb) {
                return {
                  videoId: obj.videoId,
                  status: 'notFound',
                };
              } else {
                let amountToResearcher = 0;

                const videoResearchers = videoDb.trelloData.researchers;
                const amount = +(+obj.amount).toFixed(2);

                if (!videoResearchers.length) {
                  amountToResearcher = 0;
                } else if (videoResearchers.length > 1) {
                  amountToResearcher = +(
                    amount *
                    (0.4 / videoResearchers.length)
                  ).toFixed(2);
                } else {
                  const researcher = await getUserBy({
                    param: 'email',
                    value: videoResearchers[0].email,
                  });

                  if (!researcher) {
                    amountToResearcher = 0;
                  } else {
                    if (researcher.percentage) {
                      amountToResearcher = +(
                        (amount * researcher.percentage) /
                        100
                      ).toFixed(2);
                    } else {
                      amountToResearcher = +(amount * 0.4).toFixed(2);
                    }
                  }
                }

                return {
                  researchers: videoResearchers.length
                    ? videoResearchers.map((researcher) => {
                        return {
                          email: researcher.email,
                          name: researcher.name,
                        };
                      })
                    : [],
                  videoId: obj.videoId,
                  ...(!!videoDb?.vbForm && {
                    vbForm: videoDb.vbForm._id,
                  }),
                  usage: obj.usage ? obj.usage : null,
                  amount,
                  videoTitle: videoDb.videoData.title,
                  company: processingData.company,
                  amountToResearcher: amountToResearcher,
                  date: moment().format('ll'),
                  status: 'found',
                  authorEmail: videoDb?.vbForm?.sender?.email
                    ? videoDb.vbForm.sender.email
                    : null,
                  advance: !videoDb?.vbForm?.refFormId
                    ? null
                    : !videoDb.vbForm.refFormId?.advancePayment
                    ? 0
                    : videoDb.vbForm.refFormId.advancePayment,
                  percentage: !videoDb?.vbForm?.refFormId
                    ? null
                    : !videoDb.vbForm.refFormId?.percentage
                    ? 0
                    : videoDb.vbForm.refFormId.percentage,
                  saleIdForClient: index + 1,
                };
              }
            }
          } else {
            const videoDb = await findVideoByValue({
              searchBy: 'videoData.title',
              value: obj.title,
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
                let amountToResearcher = 0;

                const videoResearchers = videoDb.trelloData.researchers;
                const amount = +(+obj.amount).toFixed(2);

                if (!videoResearchers.length) {
                  amountToResearcher = 0;
                } else if (videoResearchers.length > 1) {
                  amountToResearcher = +(
                    amount *
                    (0.4 / videoResearchers.length)
                  ).toFixed(2);
                } else {
                  const researcher = await getUserBy({
                    param: 'email',
                    value: videoResearchers[0].email,
                  });

                  if (!researcher) {
                    amountToResearcher = 0;
                  } else {
                    if (researcher.percentage) {
                      amountToResearcher = +(
                        (amount * researcher.percentage) /
                        100
                      ).toFixed(2);
                    } else {
                      amountToResearcher = +(amount * 0.4).toFixed(2);
                    }
                  }
                }

                return {
                  researchers: videoResearchers.length
                    ? videoResearchers.map((researcher) => {
                        return {
                          email: researcher.email,
                          name: researcher.name,
                        };
                      })
                    : [],
                  videoId: videoDb.videoData.videoId,
                  ...(!!videoDb?.vbForm && {
                    vbForm: videoDb.vbForm._id,
                  }),
                  usage: obj.usage ? obj.usage : null,
                  amount,
                  videoTitle: obj.title,
                  company: processingData.company,
                  amountToResearcher: amountToResearcher,
                  date: moment().format('ll'),
                  status: 'found',
                  authorEmail: videoDb?.vbForm?.sender?.email
                    ? videoDb.vbForm.sender.email
                    : null,
                  advance: !videoDb?.vbForm?.refFormId
                    ? null
                    : !videoDb.vbForm.refFormId?.advancePayment
                    ? 0
                    : videoDb.vbForm.refFormId.advancePayment,
                  percentage: !videoDb?.vbForm?.refFormId
                    ? null
                    : !videoDb.vbForm.refFormId?.percentage
                    ? 0
                    : videoDb.vbForm.refFormId.percentage,
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
        emptyKeyField: parseReport[0].length - filterParseReport.length,
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
        const users = obj.researchers.length
          ? await findUsersByValueList({
              param: 'email',
              valueList: obj.researchers.map((researcher) => {
                return researcher.email;
              }),
            })
          : [];

        const amount = +obj.amount;
        const amountToResearcher = obj.amountToResearcher;

        const objDB = {
          researchers: users.length
            ? users.map((el) => {
                return {
                  id: el._id,
                  name: el.name,
                  paidFor: false,
                };
              })
            : [],
          videoId: obj.videoId,
          ...(obj.vbForm && {
            vbFormInfo: {
              uid: obj.vbForm,
              paidFor: false,
            },
          }),
          amount,
          amountToResearcher,
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

    if (
      relatedToTheVbForm &&
      typeof JSON.parse(relatedToTheVbForm) === 'boolean' &&
      !videoId
    ) {
      return res.status(200).json({
        status: 'warning',
        message: 'missing parameter "videoId"',
      });
    }

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
      return acc + item.amountToResearcher;
    }, 0);

    const apiData = {
      sales,
      sumAmount: +sumAmount.toFixed(2),
      sumAmountResearcher: +sumAmountResearcher.toFixed(2),
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

    if (salesRelatedToTheVbForm.length) {
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
              authorRelatedWithVbForm.advancePayment && {
                advance: authorRelatedWithVbForm.advancePayment,
                advancePaymentReceived: vbForm.advancePaymentReceived,
              }),
            videoId: sale.videoId,
            videoTitle: sale.videoTitle,
            paymentInfo:
              authorRelatedWithVbForm.paymentInfo.variant === undefined
                ? false
                : true,
            amount:
              sale.vbFormInfo.paidFor === true
                ? 0
                : authorRelatedWithVbForm.percentage
                ? (sale.amount * authorRelatedWithVbForm.percentage) / 100
                : 0,

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
          if (
            videoSaleData.advance.value &&
            videoSaleData.advance.paid === false
          ) {
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
    } else {
      return res.status(200).json({
        status: 'success',
        message: "authors' sales statistics are obtained",
        apiData: [],
      });
    }
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

router.get('/getTop', authMiddleware, async (req, res) => {
  const { forLastDays } = req.query;

  try {
    const pipeline = [
      {
        $match: {
          ...(forLastDays && {
            createdAt: {
              $gte: new Date(
                moment().subtract(forLastDays, 'd').startOf('d').toISOString()
              ),
            },
          }),
        },
      },

      {
        $group: {
          _id: '$videoId',
          amount: { $sum: '$amount' },
          numberOfSales: { $sum: 1 },
          videoId: { $first: '$videoId' },
          title: { $first: '$videoTitle' },
          researchers: { $first: '$researchers' },
          vbForm: { $first: '$vbFormInfo' },
        },
      },

      {
        $sort: { amount: -1 },
      },
      { $limit: 10 },
    ];

    let salesGroup = [];

    const aggregationResult = await Sales.aggregate(pipeline);

    for await (const doc of aggregationResult) {
      salesGroup.push(doc);
    }

    salesGroup = await Promise.all(
      salesGroup.map(async (obj) => {
        if (obj.vbForm) {
          const vbForm = await findOne({
            searchBy: '_id',
            param: obj.vbForm.uid,
          });

          return {
            ...obj,
            ...(vbForm?.sender?.email && { authorEmail: vbForm.sender.email }),
            ...(typeof vbForm?.vbFormId?.percentage === 'number' && {
              percentage: vbForm.vbFormId.percentage,
            }),
            ...(typeof vbForm?.vbFormId?.advancePayment === 'number' && {
              advancePayment: vbForm.vbFormId.advancePayment,
            }),
            amount: +obj.amount.toFixed(2),
          };
        } else {
          return {
            ...obj,
            amount: +obj.amount.toFixed(2),
          };
        }
      })
    );

    return res.status(200).json({
      status: 'success',
      message: 'List of top sales received',
      apiData: salesGroup,
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
