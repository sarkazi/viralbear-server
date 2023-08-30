const express = require('express');
const router = express.Router();

const multer = require('multer');
const xlsx = require('xlsx');

const mongoose = require('mongoose');

var Mutex = require('async-mutex').Mutex;
const mutex = new Mutex();

const {
  createNewSale,
  deleteSaleById,
  getAllSales,
  findSaleById,
  getSaleBy,
} = require('../controllers/sales.controller');

const {
  findUsersByEmails,
  updateUserByIncrement,
  getUserBy,
  findUsersByValueList,
} = require('../controllers/user.controller');

const { findOne } = require('../controllers/uploadInfo.controller');

const { updateVideoBy } = require('../controllers/video.controller');

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

router.post('/manualAddition', authMiddleware, async (req, res) => {
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
        author = await getUserBy({ searchBy: '_id', value: vbForm.sender });
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
  '/parsingFromFile',
  authMiddleware,
  multer({ storage: storage }).fields([
    {
      name: 'csv',
      maxCount: 1,
    },
  ]),
  async (req, res) => {
    const { csv } = req.files;
    const { revShare } = req.body;
    const { confirmDownload } = req.query;

    if (!csv) {
      return res.status(200).json({
        status: 'warning',
        message: 'The file for parsing was not found',
      });
    }

    try {
      const sellingThisReport = await getSaleBy({
        searchBy: 'report',
        value: csv[0].originalname,
      });

      if (sellingThisReport && !JSON.parse(confirmDownload)) {
        return res.status(200).json({
          message:
            'You already ingested this report before. Are you sure you want to proceed?',
          status: 'await',
        });
      }

      const workbook = xlsx.read(csv[0].buffer, {
        type: 'buffer',
        sheetStubs: true,
      });

      const fileHeaderValues = xlsx.utils
        .sheet_to_json(
          workbook.Sheets[
            workbook.SheetNames[workbook.SheetNames.length === 1 ? 0 : 1]
          ],
          { header: 1 }
        )
        .shift();

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

      if (companyName === 'kameraone' && !revShare) {
        return res.status(200).json({
          status: 'warning',
          message: 'Missing value for the kameraone report: "rev share"',
        });
      }

      let totalSumFromKameraOne = null;

      const sheetNameList = workbook.SheetNames;

      const parseReport = xlsx.utils.sheet_to_row_object_array(
        workbook.Sheets[
          companyName === 'kameraone' ? sheetNameList[1] : sheetNameList[0]
        ]
      );

      if (companyName === 'kameraone') {
        totalSumFromKameraOne =
          parseReport[parseReport.length - 1][' EUR/clip'];
      }

      if (companyName === 'kameraone' && totalSumFromKameraOne === null) {
        return res.status(200).json({
          status: 'warning',
          message:
            'The total amount for the month for the kameraone report was not found',
        });
      }

      const filterParseReport = removeValuesWithoutKeyFieldInPairedReport({
        parseReport: parseReport,
        companyName,
      });

      const processingData = await pullOutProcessingDataFromPairedReport({
        parseReport: filterParseReport,
        companyName,
        ...(companyName === 'kameraone' && {
          revShare: +revShare,
          totalSumFromKameraOne,
        }),
      });

      // массив для определения актуального баланса видео
      let temporaryStorage = [];

      let newReport = await Promise.all(
        processingData.data.map(async (obj, index) => {
          return await mutex.runExclusive(async () => {
            //если это продажи, определенные по videoId
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
                  let amount = 0;

                  //ресечеры видео
                  const videoResearchers = videoDb.trelloData.researchers;

                  //если массив для баланса содержит это видео
                  if (
                    temporaryStorage.find(
                      (videoInfo) => videoInfo.videoId === obj.videoId
                    )
                  ) {
                    temporaryStorage.map((videoInfo, index) => {
                      //если это текущее видео
                      if (videoInfo.videoId === obj.videoId) {
                        //если баланс меньше нуля, но текущая сумма продажи выбивает его в положительно число...
                        if (
                          videoInfo.videoBalance < 0 &&
                          videoInfo.videoBalance + obj.amount > 0
                        ) {
                          //тогда записываем этот остаток к данному видео
                          videoInfo.left = videoInfo.videoBalance + obj.amount;
                        } else {
                          videoInfo.left = 0;
                        }
                        //обновляем баланс текущего видео
                        videoInfo.videoBalance =
                          videoInfo.videoBalance + obj.amount;
                      } else {
                        return videoInfo;
                      }
                    });

                    //иначе добавляем запись о текущем видео
                  } else {
                    temporaryStorage.push({
                      videoId: obj.videoId,
                      videoBalance: videoDb.balance + obj.amount,
                      left: 0,
                    });
                  }

                  //положительный ли баланс во временном массиве
                  const thereIsPositiveBalanceInArray =
                    temporaryStorage.find(
                      (videoInfo) => videoInfo.videoId === obj.videoId
                    )?.videoBalance > 0;

                  //содержит ли остаток
                  const containsRemainderInArray =
                    temporaryStorage.find(
                      (videoInfo) => videoInfo.videoId === obj.videoId
                    )?.left > 0;

                  //остаток
                  const remainderInArray = temporaryStorage.find(
                    (videoInfo) => videoInfo.videoId === obj.videoId
                  )?.left;

                  //баланс текущего видео
                  const videoBalanceInArray = temporaryStorage.find(
                    (videoInfo) => videoInfo.videoId === obj.videoId
                  )?.videoBalance;

                  //если баланс текущего видео положительный или есть остаток
                  if (
                    thereIsPositiveBalanceInArray ||
                    containsRemainderInArray
                  ) {
                    //сумма продажи
                    amount = containsRemainderInArray
                      ? +remainderInArray.toFixed(2)
                      : +(+obj.amount).toFixed(2);

                    //процент автора
                    const percentToAuthor =
                      (amount * videoDb?.vbForm?.refFormId?.percentage) / 100;

                    //предусмотрена ли выплата процента автора с данного видео
                    const percentageProvidedToAuthor =
                      !!videoDb?.vbForm?.refFormId?.percentage;

                    //если нет ресечеров у видео
                    if (!videoResearchers.length) {
                      amountToResearcher = 0;

                      //если список ресечеров у видео более 1
                    } else if (videoResearchers.length > 1) {
                      const percentToResearcher =
                        amount * (0.4 / videoResearchers.length);

                      amountToResearcher = percentageProvidedToAuthor
                        ? +(
                            (amount - percentToAuthor) *
                            (0.4 / videoResearchers.length)
                          ).toFixed(2)
                        : +percentToResearcher.toFixed(2);

                      //если список ресечеров у видео равно 1
                    } else {
                      const researcher = await getUserBy({
                        searchBy: 'email',
                        value: videoResearchers[0].email,
                      });

                      if (!researcher) {
                        amountToResearcher = 0;
                      } else {
                        //если ресечеру предусмотрен процент
                        if (researcher.percentage) {
                          //сумма для ресечера
                          const percentToResearcher =
                            (amount * researcher.percentage) / 100;

                          amountToResearcher = percentageProvidedToAuthor
                            ? +(
                                ((amount - percentToAuthor) *
                                  researcher.percentage) /
                                100
                              ).toFixed(2)
                            : +percentToResearcher.toFixed(2);
                          //если ресечеру не предусмотрен процент
                        } else {
                          const percentToResearcher = amount * 0.4;

                          amountToResearcher = percentageProvidedToAuthor
                            ? +((amount - percentToAuthor) * 0.4).toFixed(2)
                            : +percentToResearcher.toFixed(2);
                        }
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

                    videoBalance: +videoBalanceInArray.toFixed(2),
                    amount: {
                      notConsideringTheBalance: obj.amount,
                      consideringTheBalance: amount,
                    },
                    amountToResearcher: amountToResearcher,
                    videoTitle: videoDb.videoData.title,
                    company: processingData.company,

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
                    report: csv[0].originalname,
                    repaymentOfNegativeBalance: containsRemainderInArray
                      ? 'partially'
                      : thereIsPositiveBalanceInArray
                      ? 'none'
                      : 'fully',
                  };
                }
              }
              //если это продажи, определенные по videoTitle
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
                  let amount = 0;
                  const videoResearchers = videoDb.trelloData.researchers;

                  if (
                    temporaryStorage.find(
                      (videoInfo) => videoInfo.videoTitle === obj.title
                    )
                  ) {
                    temporaryStorage.map((videoInfo, index) => {
                      if (videoInfo.videoTitle === obj.title) {
                        if (
                          videoInfo.videoBalance < 0 &&
                          videoInfo.videoBalance + obj.amount > 0
                        ) {
                          videoInfo.left = videoInfo.videoBalance + obj.amount;
                        } else {
                          videoInfo.left = 0;
                        }
                        videoInfo.videoBalance =
                          videoInfo.videoBalance + obj.amount;
                      } else {
                        return videoInfo;
                      }
                    });
                  } else {
                    temporaryStorage.push({
                      videoTitle: obj.title,
                      videoBalance: videoDb.balance + obj.amount,
                      left: 0,
                    });
                  }

                  //положительный ли баланс во временном массиве
                  const thereIsPositiveBalanceInArray =
                    temporaryStorage.find(
                      (videoInfo) => videoInfo.videoTitle === obj.title
                    )?.videoBalance > 0;

                  //содержит ли остаток
                  const containsRemainderInArray =
                    temporaryStorage.find(
                      (videoInfo) => videoInfo.videoTitle === obj.title
                    )?.left > 0;

                  //остаток
                  const remainderInArray = temporaryStorage.find(
                    (videoInfo) => videoInfo.videoTitle === obj.title
                  )?.left;

                  //баланс текущего видео
                  const videoBalanceInArray = temporaryStorage.find(
                    (videoInfo) => videoInfo.videoTitle === obj.title
                  )?.videoBalance;

                  //если баланс текущего видео положительный или есть остаток
                  if (
                    thereIsPositiveBalanceInArray ||
                    containsRemainderInArray
                  ) {
                    //сумма продажи
                    amount = containsRemainderInArray
                      ? +remainderInArray.toFixed(2)
                      : +(+obj.amount).toFixed(2);

                    //процент автора
                    const percentToAuthor =
                      (amount * videoDb?.vbForm?.refFormId?.percentage) / 100;

                    console.log(percentToAuthor, 88);

                    //предусмотрена ли выплата процента автора с данного видео
                    const percentageProvidedToAuthor =
                      !!videoDb?.vbForm?.refFormId?.percentage;

                    //если нет ресечеров у видео
                    if (!videoResearchers.length) {
                      amountToResearcher = 0;

                      //если список ресечеров у видео более 1
                    } else if (videoResearchers.length > 1) {
                      const percentToResearcher =
                        amount * (0.4 / videoResearchers.length);

                      amountToResearcher = percentageProvidedToAuthor
                        ? +(
                            (amount - percentToAuthor) *
                            (0.4 / videoResearchers.length)
                          ).toFixed(2)
                        : +percentToResearcher.toFixed(2);

                      //если список ресечеров у видео равно 1
                    } else {
                      const researcher = await getUserBy({
                        searchBy: 'email',
                        value: videoResearchers[0].email,
                      });

                      if (!researcher) {
                        amountToResearcher = 0;
                      } else {
                        //если ресечеру предусмотрен процент
                        if (researcher.percentage) {
                          //сумма для ресечера
                          const percentToResearcher =
                            (amount * researcher.percentage) / 100;

                          amountToResearcher = percentageProvidedToAuthor
                            ? +(
                                ((amount - percentToAuthor) *
                                  researcher.percentage) /
                                100
                              ).toFixed(2)
                            : +percentToResearcher.toFixed(2);
                          //если ресечеру не предусмотрен процент
                        } else {
                          const percentToResearcher = amount * 0.4;

                          amountToResearcher = percentageProvidedToAuthor
                            ? +((amount - percentToAuthor) * 0.4).toFixed(2)
                            : +percentToResearcher.toFixed(2);
                        }
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

                    report: csv[0].originalname,
                    videoTitle: obj.title,
                    company: processingData.company,
                    videoBalance: +videoBalanceInArray.toFixed(2),
                    amount: {
                      notConsideringTheBalance: obj.amount,
                      consideringTheBalance: amount,
                    },
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
                    repaymentOfNegativeBalance: containsRemainderInArray
                      ? 'partially'
                      : thereIsPositiveBalanceInArray
                      ? 'none'
                      : 'fully',
                  };
                }
              }
            }
          });
        })
      );

      newReport = newReport.reduce(
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
      );

      const apiData = {
        emptyKeyField: parseReport.length - filterParseReport.length,
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

router.post('/ingestInSystem', authMiddleware, async (req, res) => {
  try {
    const body = req.body;

    const promiseAfterIngestInSystem = await Promise.all(
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
                  paidFor:
                    obj.repaymentOfNegativeBalance === 'fully' ? true : false,
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
          report: obj.report,
          amountToResearcher,
          date: moment().format('ll'),
          ...(obj.usage && { usage: obj.usage }),
          manual: obj.saleId ? false : true,
          videoTitle: obj.videoTitle,
          company: obj.company,
        };

        await createNewSale(objDB);

        return {
          videoId: obj.videoId,
          balance: obj.videoBalance,
        };
      })
    );

    newReport = promiseAfterIngestInSystem.reduce((res, video) => {
      if (!Object.hasOwn(res, video.videoId)) {
        res[video.videoId] = [];
      }
      res[video.videoId].push(video.balance);
      return res;
    }, {});

    newReport = Object.entries(newReport).reduce((res, [key, value]) => {
      res[key] = Math.max.apply(null, value);
      return res;
    }, {});

    await Promise.all(
      Object.entries(newReport).map(async ([key, value]) => {
        await updateVideoBy({
          searchBy: 'videoData.videoId',
          searchValue: +key,
          dataToUpdate: { balance: +value },
        });
      })
    );

    return res.status(200).json({
      status: 'success',
      message: 'sales have been successfully added to the system',
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
      forLastDays,
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
      const user = await getUserBy({ searchBy: 'name', value: researcher });

      userId = user._id;
    }

    if (personal && JSON.parse(personal) === true) {
      userId = mongoose.Types.ObjectId(req.user.id);
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
      ...(forLastDays && { forLastDays }),
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
            searchBy: '_id',
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
  const { forLastDays, limit } = req.query;

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
      {
        $limit: typeof JSON.parse(limit) === 'number' ? JSON.parse(limit) : 10,
      },
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
            ...(typeof vbForm?.refFormId?.percentage === 'number' && {
              percentage: vbForm.refFormId.percentage,
            }),
            ...(typeof vbForm?.refFormId?.advancePayment === 'number' && {
              advancePayment: vbForm.refFormId.advancePayment,
            }),
            amount: Math.round(obj.amount),
          };
        } else {
          return {
            ...obj,
            amount: Math.round(obj.amount),
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
