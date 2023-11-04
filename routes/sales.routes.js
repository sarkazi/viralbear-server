const express = require("express");
const router = express.Router();

const multer = require("multer");
const xlsx = require("xlsx");
const { errorsHandler } = require("../handlers/error.handler");

const mongoose = require("mongoose");

const fs = require("fs");

const { ObjectId } = mongoose.Types;

var Mutex = require("async-mutex").Mutex;
const mutex = new Mutex();

const {
  createNewSale,
  deleteSaleById,
  getAllSales,
  findSaleById,
  getSaleBy,
  getCountSales,
} = require("../controllers/sales.controller");

const {
  findUsersByEmails,
  updateUserByIncrement,
  getUserBy,
  findUsersByValueList,
  updateUser,
  updateUserBy,
} = require("../controllers/user.controller");

const { findOne } = require("../controllers/uploadInfo.controller");

const pullOutProcessingDataFromPairedReport = require("../utils/pullOutProcessingDataFromPairedReport");
const definitionThePartnerCompanyByFileHeader = require("../utils/definitionThePartnerCompanyByFileHeader");
const removeValuesWithoutKeyFieldInPairedReport = require("../utils/removeValuesWithoutKeyFieldInPairedReport");

const storage = multer.memoryStorage();

const {
  findById,
  updateVideoBy,
  findVideoBy,
} = require("../controllers/video.controller");

const moment = require("moment");

const authMiddleware = require("../middleware/auth.middleware");
const Sales = require("../entities/Sales");

router.post("/manualAddition", authMiddleware, async (req, res) => {
  try {
    const { company, videoId, amount: reqAmount, usage } = req.body;

    if (!company || !videoId || !reqAmount || !usage) {
      return res.status(200).json({
        status: "warning",
        message: "Missing parameter",
      });
    }

    const videoDb = await findVideoBy({
      searchBy: "videoData.videoId",
      value: videoId,
    });

    if (!videoDb) {
      return res.status(200).json({
        status: "warning",
        message: "Video not found",
      });
    }

    // массив для определения актуального баланса работника
    let userBalanceStorage = [];
    // массив для определения актуального баланса видео
    let videoBalanceStorage = [];

    videoBalanceStorage.push({
      videoId: videoDb.videoData.videoId,
      videoBalance: videoDb.balance + reqAmount,
      left:
        videoDb.balance + reqAmount > 0 && videoDb.balance < 0
          ? videoDb.balance + reqAmount
          : 0,
    });

    let amountToResearcher = 0;
    let amountToAuthor = 0;
    let amount = 0;

    let videoResearchers = videoDb.trelloData.researchers;

    if (videoResearchers.length) {
      videoResearchers = await Promise.all(
        videoResearchers.map(async (dataResearcherInVideoDB) => {
          return await getUserBy({
            searchBy: "email",
            value: dataResearcherInVideoDB.researcher.email,
            fieldsInTheResponse: ["balance", "nickname", "name", "email"],
          });
        })
      );
    }

    const remainder =
      videoDb.balance < 0 && videoDb.balance + reqAmount > 0
        ? videoDb.balance + reqAmount
        : 0;

    if (videoDb.balance + reqAmount > 0) {
      amount = remainder ? +remainder.toFixed(2) : +(+reqAmount).toFixed(2);

      //процент автора
      const percentToAuthor = !!videoDb?.vbForm?.refFormId?.percentage
        ? (amount * videoDb?.vbForm?.refFormId?.percentage) / 100
        : 0;

      amountToAuthor = percentToAuthor;

      //предусмотрена ли выплата процента автора с данного видео
      const percentageProvidedToAuthor =
        !!videoDb?.vbForm?.refFormId?.percentage;

      //если нет ресечеров у видео
      if (!videoResearchers.length) {
        amountToResearcher = 0;

        //если список ресечеров у видео более 1
      } else if (videoResearchers.length > 1) {
        const percentToResearcher = amount * (0.4 / videoResearchers.length);

        amountToResearcher = percentageProvidedToAuthor
          ? +(
              (amount - percentToAuthor) *
              (0.4 / videoResearchers.length)
            ).toFixed(2)
          : +percentToResearcher.toFixed(2);

        //если список ресечеров у видео равно 1
      } else {
        const researcher = await getUserBy({
          searchBy: "email",
          value: videoResearchers[0].email,
        });

        if (!researcher) {
          amountToResearcher = 0;
        } else {
          //если ресечеру предусмотрен процент
          if (researcher.percentage) {
            //сумма для ресечера
            const percentToResearcher = (amount * researcher.percentage) / 100;

            amountToResearcher = percentageProvidedToAuthor
              ? +(
                  ((amount - percentToAuthor) * researcher.percentage) /
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

    userBalanceStorage = videoResearchers.map((researcher) => {
      return {
        nickname: researcher.nickname,
        id: researcher._id,
        balance:
          researcher.balance + amountToResearcher > 0 && researcher.balance < 0
            ? 0
            : +(researcher.balance + amountToResearcher).toFixed(2),

        name: researcher.name,
        left:
          researcher.balance + amountToResearcher > 0 && researcher.balance < 0
            ? +(researcher.balance + amountToResearcher).toFixed(2)
            : 0,
      };
    });

    const apiData = {
      suitable: [
        {
          researchers: videoResearchers.length
            ? videoResearchers.map((researcher) => {
                const researcherInUserBalanceStorage = userBalanceStorage.find(
                  (userBalanceObj) => {
                    return userBalanceObj.nickname === researcher.nickname;
                  }
                );

                return {
                  id: researcher._id,
                  email: researcher.email,
                  name: researcher.name,
                  paidFor:
                    researcherInUserBalanceStorage.balance <= 0 ? true : false,
                  ...(researcherInUserBalanceStorage.left > 0 && {
                    leftAmountValue: researcherInUserBalanceStorage.left,
                  }),
                };
              })
            : [],

          videoId,
          ...(!!videoDb?.vbForm && {
            vbForm: videoDb.vbForm._id,
          }),
          usage,
          videoBalance: videoDb.balance + reqAmount,
          amount: {
            notConsideringTheBalance: reqAmount,
            consideringTheBalance: +(+amount).toFixed(2),
          },
          videoTitle: videoDb.videoData.title,
          company,
          amountToAuthor,
          amountToResearcher: amountToResearcher,
          date: moment().toString(),
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
          repaymentOfNegativeBalance:
            videoDb.balance < 0 && videoDb.balance + reqAmount > 0
              ? "partially"
              : videoDb.balance >= 0 && videoDb.balance + reqAmount > 0
              ? "none"
              : "fully",
        },
      ],
      storageInfo: {
        userBalanceStorage,
        videoBalanceStorage,
      },
      type: "manual",
    };

    return res.status(200).json({
      apiData,
      status: "success",
      message: "The data has been processed successfully",
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "sale.manualAddition" }));

    return res.status(500).json({
      status: "error",
      message: err?.message ? err.message : "Server side error",
    });
  }
});

router.post(
  "/parsingFromFile",
  authMiddleware,
  multer({ storage: storage }).fields([
    {
      name: "csv",
      maxCount: 1,
    },
  ]),
  async (req, res) => {
    const { csv } = req.files;
    const { revShare } = req.query;
    const { confirmDownload } = req.query;

    if (!csv) {
      return res.status(200).json({
        status: "warning",
        message: "The file for parsing was not found",
      });
    }

    try {
      const sellingThisReport = await getSaleBy({
        searchBy: "report",
        value: csv[0].originalname,
      });

      if (sellingThisReport && !JSON.parse(confirmDownload)) {
        return res.status(200).json({
          message:
            "You already ingested this report before. Are you sure you want to proceed?",
          status: "await",
          awaitReason: "already loaded",
        });
      }

      const workbook = xlsx.read(csv[0].buffer, {
        type: "buffer",
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
          status: "warning",
          message:
            "It was not possible to determine which partner company owns the report",
        });
      }

      if (companyName === "kameraone" && !revShare) {
        return res.status(200).json({
          status: "await",
          message: 'Missing value for the kameraone report: "rev share"',
          awaitReason: "missing value",
        });
      }

      let totalSumFromKameraOne = null;

      const sheetNameList = workbook.SheetNames;

      const parseReport = xlsx.utils.sheet_to_row_object_array(
        workbook.Sheets[
          companyName === "kameraone" ? sheetNameList[1] : sheetNameList[0]
        ]
      );

      if (companyName === "kameraone") {
        totalSumFromKameraOne =
          parseReport[parseReport.length - 1][" EUR/clip"];
      }

      if (companyName === "kameraone" && totalSumFromKameraOne === null) {
        return res.status(200).json({
          status: "warning",
          message:
            "The total amount for the month for the kameraone report was not found",
        });
      }

      const filterParseReport = removeValuesWithoutKeyFieldInPairedReport({
        parseReport: parseReport,
        companyName,
      });

      let processingData = await pullOutProcessingDataFromPairedReport({
        parseReport: filterParseReport,
        companyName,
        ...(companyName === "kameraone" && {
          revShare: +revShare,
          totalSumFromKameraOne,
        }),
      });

      processingData = {
        ...processingData,
        data: processingData.data.filter((value) => value.amount >= 1),
      };

      // массив для определения актуального баланса видео
      let videoBalanceStorage = [];
      // массив для определения актуального баланса работника
      let userBalanceStorage = [];

      let newReport = await Promise.all(
        processingData.data.map(async (obj, index) => {
          return await mutex.runExclusive(async () => {
            //если это продажи, определенные по videoId
            if (!!obj.videoId) {
              if (obj.videoId < 1460) {
                return {
                  videoId: obj.videoId,
                  status: "lessThen1460",
                };
              } else {
                const videoDb = await findVideoBy({
                  searchBy: "videoData.videoId",
                  value: obj.videoId,
                });

                if (!videoDb) {
                  console.log(obj);

                  return {
                    videoId: obj.videoId,
                    status: "notFound",
                  };
                } else {
                  let amountToResearcher = 0;
                  let amountToAuthor = 0;
                  let amount = 0;

                  //ресечеры видео
                  let videoResearchers = videoDb.trelloData.researchers;

                  if (videoResearchers.length) {
                    videoResearchers = await Promise.all(
                      videoResearchers.map(async (dataResearcherInVideoDB) => {
                        return await getUserBy({
                          searchBy: "email",
                          value: dataResearcherInVideoDB.researcher.email,
                          fieldsInTheResponse: [
                            "balance",
                            "nickname",
                            "name",
                            "email",
                          ],
                        });
                      })
                    );
                  }

                  //если массив для баланса содержит это видео
                  if (
                    videoBalanceStorage.find(
                      (videoInfo) => videoInfo.videoId === obj.videoId
                    )
                  ) {
                    videoBalanceStorage.map((videoInfo, index) => {
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
                    videoBalanceStorage.push({
                      videoId: obj.videoId,
                      videoBalance: videoDb.balance + obj.amount,
                      left:
                        videoDb.balance + obj.amount > 0 && videoDb.balance < 0
                          ? videoDb.balance + obj.amount
                          : 0,
                    });
                  }

                  //положительный ли баланс во временном массиве
                  const thereIsPositiveBalanceInArray =
                    videoBalanceStorage.find(
                      (videoInfo) => videoInfo.videoId === obj.videoId
                    )?.videoBalance > 0;

                  //содержит ли остаток
                  const containsRemainderInArray =
                    videoBalanceStorage.find(
                      (videoInfo) => videoInfo.videoId === obj.videoId
                    )?.left > 0;

                  //остаток
                  const remainderInArray = videoBalanceStorage.find(
                    (videoInfo) => videoInfo.videoId === obj.videoId
                  )?.left;

                  //баланс текущего видео
                  const videoBalanceInArray = videoBalanceStorage.find(
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
                    const percentToAuthor = !!videoDb?.vbForm?.refFormId
                      ?.percentage
                      ? (amount * videoDb?.vbForm?.refFormId?.percentage) / 100
                      : 0;

                    amountToAuthor = percentToAuthor;

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
                        searchBy: "email",
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

                  if (videoResearchers.length) {
                    videoResearchers.map((researcherData) => {
                      const researcherInUserBalanceStorage =
                        userBalanceStorage.find((userBalanceObj) => {
                          return (
                            userBalanceObj?.nickname === researcherData.nickname
                          );
                        });

                      if (!!researcherInUserBalanceStorage) {
                        const currentUserBalance =
                          researcherInUserBalanceStorage.balance +
                          amountToResearcher;

                        if (currentUserBalance <= 0) {
                          researcherInUserBalanceStorage.balance +=
                            amountToResearcher;
                        } else {
                          if (researcherInUserBalanceStorage.balance < 0) {
                            researcherInUserBalanceStorage.left =
                              currentUserBalance;
                            researcherInUserBalanceStorage.balance = 0;
                          } else {
                            researcherInUserBalanceStorage.balance +=
                              amountToResearcher;
                          }
                        }
                      } else {
                        userBalanceStorage.push({
                          nickname: researcherData.nickname,
                          id: researcherData._id,
                          balance:
                            researcherData.balance + amountToResearcher > 0 &&
                            researcherData.balance < 0
                              ? 0
                              : +(
                                  researcherData.balance + amountToResearcher
                                ).toFixed(2),

                          name: researcherData.name,
                          left:
                            researcherData.balance + amountToResearcher > 0 &&
                            researcherData.balance < 0
                              ? +(
                                  researcherData.balance + amountToResearcher
                                ).toFixed(2)
                              : 0,
                        });
                      }
                    });
                  }

                  return {
                    researchers: videoResearchers.length
                      ? videoResearchers.map((researcher) => {
                          const researcherInUserBalanceStorage =
                            userBalanceStorage.find((userBalanceObj) => {
                              return (
                                userBalanceObj.nickname === researcher.nickname
                              );
                            });

                          return {
                            id: researcher._id,
                            email: researcher.email,
                            name: researcher.name,
                            paidFor:
                              researcherInUserBalanceStorage.balance <= 0
                                ? true
                                : false,
                            ...(researcherInUserBalanceStorage.left > 0 && {
                              leftAmountValue:
                                researcherInUserBalanceStorage.left,
                            }),
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
                      notConsideringTheBalance: +(+obj.amount).toFixed(2),
                      consideringTheBalance: amount,
                    },
                    amountToAuthor,
                    amountToResearcher: amountToResearcher,

                    videoTitle: videoDb.videoData.title,
                    company: processingData.company,

                    date: moment().format("ll"),
                    status: "found",
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
                      ? "partially"
                      : thereIsPositiveBalanceInArray
                      ? "none"
                      : "fully",
                  };
                }
              }
              //если это продажи, определенные по videoTitle
            } else {
              const videoDb = await findVideoBy({
                searchBy: "videoData.title",
                value: obj.title,
              });
              if (!videoDb) {
                return {
                  videoId: obj.title,
                  status: "notFound",
                };
              } else {
                if (videoDb.videoData.videoId < 1460) {
                  return {
                    videoId: obj.videoId,
                    status: "lessThen1460",
                  };
                } else {
                  let amountToResearcher = 0;
                  let amountToAuthor = 0;
                  let amount = 0;

                  //ресечеры видео
                  let videoResearchers = videoDb.trelloData.researchers;

                  if (videoResearchers.length) {
                    videoResearchers = await Promise.all(
                      videoResearchers.map(async (dataResearcherInVideoDB) => {
                        return await getUserBy({
                          searchBy: "email",
                          value: dataResearcherInVideoDB.researcher.email,
                          fieldsInTheResponse: [
                            "balance",
                            "nickname",
                            "name",
                            "email",
                          ],
                        });
                      })
                    );
                  }

                  if (
                    videoBalanceStorage.find(
                      (videoInfo) => videoInfo.videoTitle === obj.title
                    )
                  ) {
                    videoBalanceStorage.map((videoInfo, index) => {
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
                    videoBalanceStorage.push({
                      videoTitle: obj.title,
                      videoBalance: videoDb.balance + obj.amount,
                      left:
                        videoDb.balance + obj.amount > 0 && videoDb.balance < 0
                          ? videoDb.balance + obj.amount
                          : 0,
                    });
                  }

                  //положительный ли баланс во временном массиве
                  const thereIsPositiveBalanceInArray =
                    videoBalanceStorage.find(
                      (videoInfo) => videoInfo.videoTitle === obj.title
                    )?.videoBalance > 0;

                  //содержит ли остаток
                  const containsRemainderInArray =
                    videoBalanceStorage.find(
                      (videoInfo) => videoInfo.videoTitle === obj.title
                    )?.left > 0;

                  //остаток
                  const remainderInArray = videoBalanceStorage.find(
                    (videoInfo) => videoInfo.videoTitle === obj.title
                  )?.left;

                  //баланс текущего видео
                  const videoBalanceInArray = videoBalanceStorage.find(
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
                    const percentToAuthor = !!videoDb?.vbForm?.refFormId
                      ?.percentage
                      ? (amount * videoDb?.vbForm?.refFormId?.percentage) / 100
                      : 0;

                    amountToAuthor = percentToAuthor;

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
                        searchBy: "email",
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

                  if (videoResearchers.length) {
                    videoResearchers.map((researcherData) => {
                      const researcherInUserBalanceStorage =
                        userBalanceStorage.find((userBalanceObj) => {
                          return (
                            userBalanceObj?.nickname === researcherData.nickname
                          );
                        });

                      if (!!researcherInUserBalanceStorage) {
                        const currentUserBalance =
                          researcherInUserBalanceStorage.balance +
                          amountToResearcher;

                        if (currentUserBalance <= 0) {
                          researcherInUserBalanceStorage.balance +=
                            amountToResearcher;
                        } else {
                          if (researcherInUserBalanceStorage.balance < 0) {
                            researcherInUserBalanceStorage.left =
                              currentUserBalance;
                            researcherInUserBalanceStorage.balance = 0;
                          } else {
                            researcherInUserBalanceStorage.balance +=
                              amountToResearcher;
                          }
                        }
                      } else {
                        userBalanceStorage.push({
                          nickname: researcherData.nickname,
                          id: researcherData._id,
                          balance:
                            researcherData.balance + amountToResearcher > 0 &&
                            researcherData.balance < 0
                              ? 0
                              : +(
                                  researcherData.balance + amountToResearcher
                                ).toFixed(2),

                          name: researcherData.name,
                          left:
                            researcherData.balance + amountToResearcher > 0 &&
                            researcherData.balance < 0
                              ? +(
                                  researcherData.balance + amountToResearcher
                                ).toFixed(2)
                              : 0,
                        });
                      }
                    });
                  }

                  return {
                    researchers: videoResearchers.length
                      ? videoResearchers.map((researcher) => {
                          const researcherInUserBalanceStorage =
                            userBalanceStorage.find((userBalanceObj) => {
                              return (
                                userBalanceObj.nickname === researcher.nickname
                              );
                            });

                          return {
                            id: researcher._id,
                            email: researcher.email,
                            name: researcher.name,
                            paidFor:
                              researcherInUserBalanceStorage.balance <= 0
                                ? true
                                : false,
                            ...(researcherInUserBalanceStorage.left > 0 && {
                              leftAmountValue:
                                researcherInUserBalanceStorage.left,
                            }),
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
                      notConsideringTheBalance: +(+obj.amount).toFixed(2),
                      consideringTheBalance: amount,
                    },
                    amountToResearcher,
                    amountToAuthor,
                    date: moment().format("ll"),
                    status: "found",
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
                      ? "partially"
                      : thereIsPositiveBalanceInArray
                      ? "none"
                      : "fully",
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
            item.status === "found"
              ? "suitable"
              : item.status === "lessThen1460"
              ? "lessThen1460"
              : "notFounded"
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
        type: "file",
        storageInfo: {
          videoBalanceStorage,
          userBalanceStorage,
        },
      };

      return res.status(200).json({
        status: "success",
        message: "The data has been processed successfully",
        apiData,
      });
    } catch (err) {
      console.log(errorsHandler({ err, trace: "sale.parsingFromFile" }));

      const message =
        typeof err === "string"
          ? err
          : typeof err?.message === "string"
          ? err.message
          : typeof err?.response?.data?.message === "string"
          ? err.response.data.message
          : "Server side error";

      return res.status(500).json({
        status: "error",
        message,
      });
    }
  }
);

router.post("/ingestInSystem", authMiddleware, async (req, res) => {
  try {
    const { suitable, storageInfo } = req.body;

    const promiseAfterIngestInSystem = await Promise.all(
      suitable.map(async (obj) => {
        const amount = +obj.amount.consideringTheBalance;
        const amountToResearcher = obj.amountToResearcher;

        const objDB = {
          researchers: obj.researchers.length
            ? obj.researchers.map((researcher) => {
                return {
                  id: new ObjectId(researcher.id),
                  name: researcher.name,
                  paidFor: researcher.paidFor
                    ? true
                    : obj.repaymentOfNegativeBalance === "fully"
                    ? true
                    : false,
                };
              })
            : [],
          videoId: obj.videoId,
          ...(obj.vbForm && {
            vbFormInfo: {
              uid: obj.vbForm,
              paidFor:
                obj.repaymentOfNegativeBalance === "fully" ? true : false,
              amount: obj?.amountToAuthor,
            },
          }),
          amount,
          report: obj.report,
          amountToResearcher,
          date: moment().format("ll"),
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
          searchBy: "videoData.videoId",
          searchValue: +key,
          dataToUpdate: { balance: +value },
        });
      })
    );

    await Promise.all(
      storageInfo.userBalanceStorage.map(async (userBalanceInfo) => {
        await updateUser({
          userId: userBalanceInfo.id,
          objDBForSet: { balance: userBalanceInfo.balance },
        });

        if (userBalanceInfo.left > 0) {
          await createNewSale({
            amountToResearcher: userBalanceInfo.left,
            amount: 0,
            date: moment().format("ll"),
            toOverlapTheRemainder: true,
            researchers: [
              {
                id: new ObjectId(userBalanceInfo.id),
                name: userBalanceInfo.name,
                paidFor: false,
              },
            ],
          });
        }
      })
    );

    return res.status(200).json({
      status: "success",
      message: "sales have been successfully added to the system",
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "sale.ingestInSystem" }));
    return res.status(500).json({
      status: "error",
      message: err?.message ? err.message : "Server side error",
    });
  }
});

router.get("/getAll", authMiddleware, async (req, res) => {
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
      giveQuantity,
    } = req.query;

    if (
      relatedToTheVbForm &&
      typeof JSON.parse(relatedToTheVbForm) === "boolean" &&
      !videoId
    ) {
      return res.status(200).json({
        status: "warning",
        message: 'missing parameter "videoId"',
      });
    }

    let userId = null;

    if (researcher) {
      const user = await getUserBy({ searchBy: "name", value: researcher });

      userId = user._id;
    }

    if (personal && JSON.parse(personal) === true) {
      userId = mongoose.Types.ObjectId(req.user.id);
    }

    let salesCount = null;

    let sales = await getAllSales({
      count,
      ...(company && { company }),
      ...(date && { date }),
      ...(videoId && { videoId }),
      ...(userId && { userId }),
      ...(date && {
        date: date[0] === "null" || date[1] === "null" ? null : date,
      }),
      ...(forLastDays && { forLastDays }),
      ...(relatedToTheVbForm &&
        typeof JSON.parse(relatedToTheVbForm) === "boolean" && {
          relatedToTheVbForm: JSON.parse(relatedToTheVbForm),
        }),
    });

    const sumAmount = sales.reduce((acc, item) => {
      return acc + item.amount;
    }, 0);

    const sumAmountResearcher = sales.reduce((acc, item) => {
      return acc + item.amountToResearcher;
    }, 0);

    if (giveQuantity && !!JSON.parse(giveQuantity)) {
      salesCount = await getCountSales({});
    }

    const apiData = {
      sales,
      sumAmount: +sumAmount.toFixed(2),
      sumAmountResearcher: +sumAmountResearcher.toFixed(2),
      ...(typeof salesCount === "number" && { salesCount }),
    };

    return res.status(200).json({
      status: "success",
      message: count
        ? `The last ${count} sales have been received`
        : "All sales have been received",
      apiData,
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "sale.getAll" }));
    return res.status(500).json({
      status: "error",
      message: err?.message ? err.message : "Server side error",
    });
  }
});

router.get("/getStatisticsOnAuthors", authMiddleware, async (req, res) => {
  const { group } = req.query;

  try {
    const salesRelatedToTheVbForm = await getAllSales({
      relatedToTheVbForm: true,
    });

    if (salesRelatedToTheVbForm.length) {
      let authorsSalesStatistics = await Promise.all(
        salesRelatedToTheVbForm.map(async (sale) => {
          const vbForm = await findOne({
            searchBy: "_id",
            param: sale.vbFormInfo.uid,
          });

          const authorRelatedWithVbForm = await getUserBy({
            searchBy: "_id",
            value: vbForm.sender,
          });

          return {
            authorEmail: authorRelatedWithVbForm.email,
            ...(authorRelatedWithVbForm.percentage && {
              percentage: authorRelatedWithVbForm.percentage,
            }),
            ...(typeof vbForm.advancePaymentReceived === "boolean" &&
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
              ...(typeof saleData.advancePaymentReceived === "boolean" && {
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
            res["ready"].push(videoSaleData);
          }
          if (
            !videoSaleData.paymentInfo &&
            ((videoSaleData.advance.paid &&
              videoSaleData.advance.paid === false) ||
              videoSaleData.amount > 75)
          ) {
            res["noPayment"].push(videoSaleData);
          }
          if (videoSaleData.advance.value === 0 || videoSaleData.amount <= 75) {
            res["other"].push(videoSaleData);
          }
          return res;
        },
        { ready: [], noPayment: [], other: [] }
      );

      return res.status(200).json({
        status: "success",
        message: "authors' sales statistics are obtained",
        apiData:
          group === "ready"
            ? groupedStatisticsByAuthor.ready
            : group === "noPayment"
            ? groupedStatisticsByAuthor.noPayment
            : groupedStatisticsByAuthor.other,
      });
    } else {
      return res.status(200).json({
        status: "success",
        message: "authors' sales statistics are obtained",
        apiData: [],
      });
    }
  } catch (err) {
    console.log(errorsHandler({ err, trace: "sale.getStatisticsOnAuthors" }));
    return res.status(500).json({
      status: "error",
      message: err?.message ? err.message : "Server side error",
    });
  }
});

router.delete("/deleteOne/:saleId", authMiddleware, async (req, res) => {
  const { saleId } = req.params;

  const { count, company, date, videoId, researcher } = req.query;

  if (!saleId) {
    return res.status(200).json({
      status: "warning",
      message: `Missing value: "saleId"`,
    });
  }

  try {
    const sale = await findSaleById(saleId);

    if (!sale) {
      return res.status(200).json({
        status: "warning",
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
        date: date[0] === "null" || date[1] === "null" ? null : date,
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
      status: "success",
      message: `The sale with id ${saleId} has been deleted`,
      apiData,
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "sale.deleteOne" }));
    return res.status(500).json({
      status: "error",
      message: err?.message ? err.message : "Server side error",
    });
  }
});

router.get("/getTop", authMiddleware, async (req, res) => {
  const { forLastDays, limit } = req.query;

  try {
    const pipeline = [
      {
        $match: {
          ...(forLastDays && {
            createdAt: {
              $gte: new Date(
                moment().subtract(forLastDays, "d").startOf("d").toISOString()
              ),
            },
          }),
        },
      },

      {
        $group: {
          _id: "$videoId",
          amount: { $sum: "$amount" },
          numberOfSales: { $sum: 1 },
          videoId: { $first: "$videoId" },
          title: { $first: "$videoTitle" },
          researchers: { $first: "$researchers" },
          vbForm: { $first: "$vbFormInfo" },
        },
      },

      {
        $sort: { amount: -1 },
      },
      {
        $limit: typeof JSON.parse(limit) === "number" ? JSON.parse(limit) : 10,
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
            searchBy: "_id",
            param: obj.vbForm.uid,
          });

          return {
            ...obj,
            ...(vbForm?.sender?.email && { authorEmail: vbForm.sender.email }),
            ...(typeof vbForm?.refFormId?.percentage === "number" && {
              percentage: vbForm.refFormId.percentage,
            }),
            ...(typeof vbForm?.refFormId?.advancePayment === "number" && {
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
      status: "success",
      message: "List of top sales received",
      apiData: salesGroup,
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "sale.getTop" }));
    return res.status(500).json({
      status: "error",
      message: err?.message ? err.message : "Server side error",
    });
  }
});

module.exports = router;
