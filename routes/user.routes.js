const express = require("express");
const router = express.Router();
const { genSalt, hash: hashBcrypt } = require("bcryptjs");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");

const { errorsHandler } = require("../handlers/error.handler");

const fs = require("fs");

const authMiddleware = require("../middleware/auth.middleware");

const validationForRequiredInputDataInUserModel = require("../utils/validationForRequiredInputDataInUserModel");

const {
  getAllUsers,
  deleteUser,
  sendPassword,
  createUser,
  recoveryPassword,
  getUserById,
  updateUser,
  getUserByEmail,
  getUserBySearchValue,
  findUsersByValueList,
  getUserBy,
  updateUsersBy,
} = require("../controllers/user.controller.js");

const { createNewPayment } = require("../controllers/payment.controller");

const { generateTokens } = require("../controllers/auth.controllers");

const {
  findOne,
  updateVbFormByFormId,
  updateVbFormBy,
} = require("../controllers/uploadInfo.controller");

const {
  getCountLinksBy,
  getCountLinks,
  getLinks,
} = require("../controllers/links.controller");

const {
  getSalesByUserId,
  getAllSales,
  updateSalesBy,
  updateSaleBy,
  findSaleById,
  markEmployeeOnSalesHavingReceivePercentage,
} = require("../controllers/sales.controller");

const { sendEmail } = require("../controllers/sendEmail.controller");

const { findAllAuthorLinks } = require("../controllers/authorLink.controller");

const {
  getCountAcquiredVideoByUserEmail,
  getAllVideos,
  findVideoByValue,
  getCountVideosBy,
  updateVideosBy,
  updateVideoBy,
  markVideoEmployeeAsHavingReceivedAnAdvance,
  getCountVideos,
  findVideoBy,
} = require("../controllers/video.controller");

const {
  getCountApprovedTrelloCardBy,
  getApprovedTrelloCardBy,
} = require("../controllers/movedFromReviewList.controller");

const {
  inviteMemberOnBoard,
  getCardDataByCardId,
} = require("../controllers/trello.controller");

const { uploadFileToStorage } = require("../controllers/storage.controller");

const storage = multer.memoryStorage();

router.get("/getAll", authMiddleware, async (req, res) => {
  try {
    const {
      me,
      roles,
      canBeAssigned,
      fieldsInTheResponse,
      sortByPosition,
      page,
      limit,
      sort,
      test,
    } = req.query;

    const userId = req.user.id;

    let count = 0;
    let pageCount = 0;

    let users = await getAllUsers({
      me,
      userId,
      roles: roles ? roles : [],
      ...(test && { test }),
      canBeAssigned,
      ...(fieldsInTheResponse && {
        fieldsInTheResponse,
      }),
    });

    if (sortByPosition && typeof JSON.parse(sortByPosition)) {
      const defineDescForUsers = ({ position, country }) => {
        if (position.includes("owner") || position.includes("ceo")) {
          return "Owner and CEO";
        } else if (
          position.includes("researcher") &&
          !position.includes("senior")
        ) {
          return `Researcher${country ? ` | ${country}` : ""}`;
        } else if (
          position.includes("researcher") &&
          position.includes("senior")
        ) {
          return `Senior researcher${country ? ` | ${country}` : ""}`;
        } else {
          return position;
        }
      };

      users = users
        .reduce(
          (res, item) => {
            res[
              !item.position.includes("ceo") || !item.position.includes("owner")
                ? "first"
                : !item.position.includes("researcher")
                ? "third"
                : "second"
            ].push(item);
            return res;
          },
          { first: [], second: [], third: [] }
        )
        .map((user) => {
          return {
            id: user._id,
            name: user.name,
            avatarUrl: user?.avatarUrl ? user.avatarUrl : null,
            description: defineDescForUsers({
              position: user.position,
              country: user.country,
            }),
            canBeAssigned: user.canBeAssigned,
          };
        });

      users = {
        first: users.first,
        second: users.second,
        third: users.third.sort(cur, (next) => {
          if (cur.position.includes("senior")) {
            return cur - next;
          }
        }),
      };
    }

    if (limit && page) {
      count = users.length;
      pageCount = Math.ceil(count / limit);

      const skip = (page - 1) * limit;

      users = await getAllUsers({
        me,
        userId,
        roles: roles ? roles : [],
        canBeAssigned,
        ...(fieldsInTheResponse && {
          fieldsInTheResponse,
        }),
        skip,
        limit,
        ...(sort && { sort }),
      });
    }

    const apiData = {
      ...(limit &&
        page && {
          pagination: {
            count,
            pageCount,
          },
        }),
      users,
    };

    return res.status(200).json({
      status: "success",
      message: "The list of employees has been received",
      apiData,
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "user.getAll" }));
    return res
      .status(400)
      .json({ status: "error", message: "Server side error" });
  }
});

router.get("/findToDisplayOnTheSite", async (req, res) => {
  try {
    let users = await getAllUsers({
      exist: ["position"],
      displayOnTheSite: true,
    });

    users = users.reduce(
      (res, item) => {
        res[
          item.position.toLowerCase().includes("ceo") ||
          item.position.toLowerCase().includes("owner")
            ? "first"
            : item.position.toLowerCase().includes("researcher")
            ? "third"
            : "second"
        ].push(item);
        return res;
      },
      { first: [], second: [], third: [] }
    );

    users = {
      first: users.first.map((user) => {
        return {
          id: user._id,
          name: user.name,
          email: user.email,
          avatarUrl: user?.avatarUrl ? user.avatarUrl : null,
          ...(user?.position && { position: user?.position }),
          ...(user?.country && { country: user?.country }),
        };
      }),
      second: users.second.map((user) => {
        return {
          id: user._id,
          name: user.name,
          email: user.email,
          avatarUrl: user?.avatarUrl ? user.avatarUrl : null,
          ...(user?.position && { position: user?.position }),
          ...(user?.country && { country: user?.country }),
        };
      }),

      third: users.third
        .sort((cur, next) => {
          if (cur.position.toLowerCase().includes("senior")) {
            return cur - next;
          }
        })
        .map((user) => {
          return {
            id: user._id,
            name: user.name,
            email: user.email,
            avatarUrl: user?.avatarUrl ? user.avatarUrl : null,
            ...(user?.position && { position: user?.position }),
            ...(user?.country && { country: user?.country }),
          };
        }),
    };

    return res.status(200).json({
      status: "success",
      message: "The list of employees has been received",
      apiData: users,
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "user.findToDisplayOnSite" }));
    return res
      .status(400)
      .json({ status: "error", message: "Server side error" });
  }
});

router.get("/getById/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await getUserById(userId);

    if (!user) {
      return res
        .status(200)
        .json({ message: "User is not found", status: "warning" });
    }

    return res.status(200).json({ apiData: user, status: "success" });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "user.getById" }));

    return res
      .status(400)
      .json({ message: "Server side error", status: "error" });
  }
});

router.get("/getBy", authMiddleware, async (req, res) => {
  try {
    const { searchBy, fieldsInTheResponse, value } = req.query;

    let userId = null;

    if (!value) {
      userId = req.user.id;
    }

    if (!searchBy || (!userId && !value)) {
      return res.status(200).json({
        message: "Missing parameter for user search",
        status: "warning",
      });
    }

    const user = await getUserBy({
      searchBy,
      value: value ? value : userId,
      ...(fieldsInTheResponse && {
        fieldsInTheResponse,
      }),
    });

    if (!user) {
      return res
        .status(200)
        .json({ message: "User is not found", status: "warning" });
    }

    return res.status(200).json({ apiData: user, status: "success" });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "user.getBy" }));
    return res.status(400).json({
      message: "Server side error",
      status: "error",
    });
  }
});

router.post("/createOne", authMiddleware, async (req, res) => {
  try {
    const body = req.body;

    //const isValidate = validationForRequiredInputDataInUserModel(
    //  body.role,
    //  body,
    //  null
    //);

    //if (!isValidate) {
    //  return res
    //    .status(200)
    //    .json({ message: 'Missing data to create a user', status: 'warning' });
    //}

    if (body?.nickname?.includes("@")) {
      return res.status(200).json({
        message: 'Nickname must not contain the "@" character',
        status: "warning",
      });
    }

    const candidate = await getUserByEmail(body.email);

    if (candidate) {
      return res.status(200).json({
        message: "A user with this email already exists",
        status: "warning",
      });
    }

    let paymentInfo = null;

    if (body?.paymentMethod) {
      if (body.paymentMethod === "bankTransfer") {
        if (
          !body?.phoneBankTransfer ||
          !body?.emailBankTransfer ||
          !body?.addressBankTransfer ||
          !body?.zipCodeBankTransfer ||
          !body?.bankNameBankTransfer ||
          !body?.fullNameBankTransfer ||
          !body?.accountNumberBankTransfer
        ) {
          return res.status(200).json({
            message: "Missing parameters for changing payment data",
            status: "warning",
          });
        }

        paymentInfo = {
          paymentInfo: {
            variant: body.paymentMethod,
            phoneNumber: body.phoneBankTransfer,
            email: body.emailBankTransfer,
            address: body.addressBankTransfer,
            zipCode: body.zipCodeBankTransfer,
            bankName: body.bankNameBankTransfer,
            fullName: body.fullNameBankTransfer,
            iban: body.accountNumberBankTransfer,
          },
        };
      }

      if (body.paymentMethod === "payPal") {
        if (!body?.payPalEmail) {
          return res.status(200).json({
            message: "Missing parameters for changing payment data",
            status: "warning",
          });
        }

        paymentInfo = {
          paymentInfo: {
            variant: body.paymentMethod,
            payPalEmail: body.payPalEmail,
          },
        };
      }

      if (body.paymentMethod === "other") {
        if (!body?.textFieldOther) {
          return res.status(200).json({
            message: "Missing parameters for changing payment data",
            status: "warning",
          });
        }

        paymentInfo = {
          paymentInfo: {
            variant: body.paymentMethod,
            value: body.textFieldOther,
          },
        };
      }
    }

    const salt = await genSalt(10);

    const objDB = {
      name: body.name,
      ...(body?.position && { position: body.position }),
      password: await hashBcrypt(body.password, salt),
      ...(body?.nickname && { nickname: `@${body.nickname}` }),
      role: body.role,
      email: body.email,
      ...(body?.percentage && { percentage: body.percentage }),
      ...(body?.advancePayment && { advancePayment: body.advancePayment }),
      ...(body?.country && { country: body.country }),
      ...(paymentInfo && paymentInfo),

      ...(typeof body?.canBeAssigned === "boolean" && {
        canBeAssigned: body.canBeAssigned,
      }),
      ...(typeof body?.displayOnTheSite === "boolean" && {
        displayOnTheSite: body.displayOnTheSite,
      }),
      ...((body.role === "author" ||
        body.role === "researcher" ||
        body.role === "stringer") && {
        balance: 0,
      }),
    };

    await createUser(objDB);

    return res.status(200).json({
      message: "A new user has been successfully created",
      status: "success",
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "user.createOne" }));
    return res.status(400).json({
      message: "Server side error",
      status: "error",
    });
  }
});

router.post("/sendPassword", sendPassword);

router.post("/recoveryPassword", recoveryPassword);

router.patch(
  "/updateOne",
  authMiddleware,
  multer({ storage: storage }).fields([
    {
      name: "avatarFile",
      maxCount: 1,
    },
  ]),
  async (req, res) => {
    try {
      const files = req.files;

      const { userId } = req.query;

      const userIdToUpdate = !!userId ? userId : req.user.id;

      if (!userIdToUpdate) {
        return res.status(200).json({
          message: "Empty user ID",
          status: "warning",
        });
      }

      const user = await getUserById(userIdToUpdate);

      if (!user) {
        return res.status(200).json({
          message: "User not found",
          status: "warning",
        });
      }

      const body = req.body;

      if (!body?.paymentInfo?.paymentMethod && !!user?.paymentInfo) {
        await updateUser({
          userId: userIdToUpdate,
          objDBForUnset: { paymentInfo: 1 },
        });
      }

      let paymentInfo = null;

      if (!!body?.paymentInfo) {
        if (body.paymentInfo.paymentMethod === "bankTransfer") {
          const {
            phoneNumber,
            email,
            address,
            zipCode,
            bankName,
            fullName,
            iban,
            paymentMethod,
          } = body?.paymentInfo;

          if (
            !phoneNumber ||
            !email ||
            !address ||
            !zipCode ||
            !bankName ||
            !fullName ||
            !iban
          ) {
            return res.status(200).json({
              message: "Missing parameters for changing payment data",
              status: "warning",
            });
          }

          paymentInfo = {
            paymentInfo: {
              variant: paymentMethod,
              phoneNumber,
              email,
              address,
              zipCode,
              bankName,
              fullName,
              iban,
            },
          };
        }

        if (body.paymentInfo.paymentMethod === "payPal") {
          const { payPalEmail, paymentMethod } = body?.paymentInfo;

          if (!payPalEmail) {
            return res.status(200).json({
              message: "Missing parameters for changing payment data",
              status: "warning",
            });
          }

          paymentInfo = {
            paymentInfo: {
              variant: paymentMethod,
              payPalEmail,
            },
          };
        }

        if (body.paymentInfo.paymentMethod === "other") {
          const { value, paymentMethod } = body?.paymentInfo;

          if (!value) {
            return res.status(200).json({
              message: "Missing parameters for changing payment data",
              status: "warning",
            });
          }

          paymentInfo = {
            paymentInfo: {
              variant: paymentMethod,
              value,
            },
          };
        }
      }

      console.log(paymentInfo, 77);

      if (user.role === "author") {
        const isValidate = validationForRequiredInputDataInUserModel(
          user.role,
          body,
          "update"
        );

        if (!isValidate) {
          return res.status(200).json({
            message: "Missing value for update payment information",
            status: "warning",
          });
        }
      }

      let avatarUrl = null;

      if (files?.avatarFile) {
        const { response } = await new Promise(async (resolve, reject) => {
          await uploadFileToStorage({
            folder: "avatarsOfUsers",
            name: `avatar-${userId}`,
            buffer: files.avatarFile[0].buffer,
            type: files.avatarFile[0].mimetype,
            extension: path.extname(files.avatarFile[0].originalname),
            resolve,
          });
        });

        avatarUrl = response?.Location;
      }

      objDBForSet = {
        ...(!!body?.name && { name: body.name }),
        ...(!!body?.position && { position: body.position }),
        ...(!!body?.nickname && { nickname: `@${body.nickname}` }),
        ...(!!body?.role && { role: body.role }),
        ...(!!body?.email && { email: body.email }),
        ...(!!body?.percentage && { percentage: body.percentage }),
        ...(!!body?.advancePayment && { advancePayment: body.advancePayment }),
        ...(!!body?.country && { country: body.country }),
        ...(!!body?.inTheArchive && {
          inTheArchive: JSON.parse(body.inTheArchive),
        }),
        ...(!!paymentInfo && paymentInfo),
        ...(!!avatarUrl && { avatarUrl }),
        ...(typeof body?.canBeAssigned === "boolean" && {
          canBeAssigned: body.canBeAssigned,
        }),
        ...(typeof body?.hideForEditor === "boolean" && {
          hideForEditor: body.hideForEditor,
        }),
        ...(typeof body?.displayOnTheSite === "boolean" && {
          displayOnTheSite: body.displayOnTheSite,
        }),
        ...(!!body?.balance && { lastPaymentDate: moment().toDate() }),
      };

      objDBForIncrement = {
        ...(!!body?.balance && { balance: body.balance }),
        ...(!!body?.note && { note: body.note }),
      };

      await updateUser({
        userId: userIdToUpdate,
        objDBForSet,
        objDBForIncrement,
      });

      return res.status(200).json({
        message: "User data has been successfully updated",
        status: "success",
      });
    } catch (err) {
      console.log(errorsHandler({ err, trace: "user.updateOne" }));
      return res.status(400).json({
        message: "Server side error",
        status: "error",
      });
    }
  }
);

router.patch(
  "/updateMany",
  authMiddleware,

  async (req, res) => {
    const { oldUsers, newUsers } = req.body;
    const { updateBy } = req.query;

    try {
      if (oldUsers && newUsers) {
        await Promise.all(
          [oldUsers, newUsers].map(async (obj) => {
            await updateUsersBy({
              updateBy,
              userList: obj.list,
              objDBForSet: obj.objToSet,
            });
          })
        );
      }

      return res.status(200).json({
        message: "Users data has been successfully updated",
        status: "success",
      });
    } catch (err) {
      console.log(errorsHandler({ err, trace: "user.updateMany" }));
      return res.status(400).json({
        message: "Server side error",
        status: "error",
      });
    }
  }
);

router.get(
  "/collectStatForEmployees/enlarged",
  authMiddleware,
  async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(200).json({
        message: "Access denied",
        status: "warning",
      });
    }

    const { roles } = req.query;

    try {
      const users = await getAllUsers({
        me: true,
        userId: null,
        roles,
      });

      const employeeStat = await Promise.all(
        users.map(async (user) => {
          //-----------------------------------------------------------------------------------------------------

          const salesLast30Days = await getSalesByUserId({
            userId: user._id,
            dateLimit: 30,
          });

          const salesTotal = await getSalesByUserId({
            userId: user._id,
            dateLimit: null,
          });

          const earnedYourselfLast30Days = salesLast30Days.reduce(
            (acc, sale) => {
              return acc + sale.amountToResearcher;
            },
            0
          );

          const earnedYourselfTotal = salesTotal.reduce(
            (a, sale) => a + +sale.amountToResearcher,
            0
          );

          const earnedTotal = salesTotal.reduce(
            (a, sale) => a + +(sale.amount / sale.researchers.length),
            0
          );

          const earnedCompanies = salesTotal.reduce(
            (a, sale) =>
              a + ((sale.amount / sale.researchers.length) * 60) / 100,
            0
          );

          const linksCountLast30Days = await getCountLinksBy({
            userId: user._id,
            dateLimit: 30,
          });

          const linksCountLast7Days = await getCountLinksBy({
            userId: user._id,
            dateLimit: 7,
          });

          const linksCount = await getCountLinksBy({
            userId: user._id,
          });

          const acquiredVideosCountLast30DaysMainRole = await getCountVideosBy({
            forLastDays: 30,
            isApproved: true,
            user: {
              value: user._id,
              purchased: true,
              searchBy: "researcher",
            },
          });

          const acquiredVideosCountLast30DaysNoMainRole =
            await getCountVideosBy({
              forLastDays: 30,
              isApproved: true,
              user: {
                value: user._id,
                purchased: false,
                searchBy: "researcher",
              },
            });

          const acquiredVideosCountLast7DaysMainRole = await getCountVideosBy({
            forLastDays: 7,
            isApproved: true,
            user: {
              value: user._id,
              purchased: true,
              searchBy: "researcher",
            },
          });

          const acquiredVideosCountLast7DaysNoMainRole = await getCountVideosBy(
            {
              forLastDays: 7,
              isApproved: true,
              user: {
                value: user._id,
                purchased: false,
                searchBy: "researcher",
              },
            }
          );

          const acquiredVideosCountMainRole = await getCountVideosBy({
            isApproved: true,
            user: {
              value: user._id,
              purchased: true,
              searchBy: "researcher",
            },
          });

          const acquiredVideosCountNoMainRole = await getCountVideosBy({
            isApproved: true,
            user: {
              value: user._id,
              purchased: false,
              searchBy: "researcher",
            },
          });

          const acquiredExclusivityVideosCountLast30Days =
            await getCountVideosBy({
              forLastDays: 30,
              isApproved: true,
              exclusivity: true,
              user: {
                value: user._id,
                searchBy: "researcher",
                purchased: true,
              },
            });

          const acquiredExclusivityVideosCount = await getCountVideosBy({
            isApproved: true,
            exclusivity: true,
            user: {
              value: user._id,
              searchBy: "researcher",
              purchased: true,
            },
          });

          const videosCountReviewedLast30Days =
            await getCountApprovedTrelloCardBy({
              searchBy: "researcherId",
              value: user._id,
              forLastDays: 30,
            });

          const videosCountReviewed = await getCountApprovedTrelloCardBy({
            searchBy: "researcherId",
            value: user._id,
            forLastDays: null,
          });

          const videosCountSentToReview = await getCountLinks({
            researcherId: user._id,
            listInTrello: "Review",
          });

          const videosCountSentToReviewLast30Days = await getCountLinks({
            researcherId: user._id,
            listInTrello: "Review",
            forLastDays: 30,
          });

          let amountOfAdvancesToAuthors = 0;

          const referralFormsUsed = await findAllAuthorLinks({
            userId: user._id,
            used: true,
          });

          if (referralFormsUsed.length) {
            await Promise.all(
              referralFormsUsed.map(async (refForm) => {
                const vbForm = await findOne({
                  searchBy: "refFormId",
                  param: refForm._id,
                });

                if (
                  vbForm &&
                  vbForm?.advancePaymentReceived === true &&
                  vbForm?.refFormId?.advancePayment
                ) {
                  amountOfAdvancesToAuthors += vbForm.refFormId.advancePayment;
                }
              })
            );
          }

          const average = acquiredVideosCountMainRole
            ? Math.round(earnedTotal / acquiredVideosCountMainRole)
            : 0;

          const acquiredVideosMainRole = await getAllVideos({
            isApproved: true,

            researcher: {
              value: user._id,
              searchBy: "researcher",
              isAcquirer: true,
            },
          });

          const profitableVideos = acquiredVideosMainRole.filter((video) => {
            if (!!video.vbForm?.refFormId?.percentage) {
              return (
                video.balance -
                  (video.balance * video.vbForm.refFormId.percentage) / 100 >
                10
              );
            } else {
              return video.balance > 10;
            }
          });

          const percentageOfProfitableVideos = !acquiredVideosCountMainRole
            ? 0
            : (profitableVideos.length / acquiredVideosCountMainRole) * 100;

          //-----------------------------------------------------------------------------------------------------

          let advance = 0;
          let percentage = 0;

          const videosCountWithUnpaidAdvance = await getCountVideosBy({
            isApproved: true,
            user: {
              value: user._id,
              purchased: true,
              searchBy: "researcher",
              advanceHasBeenPaid: false,
            },
          });

          //--------------------------------------------------------

          if (user.name === "Kirill") {
            //const test = await getAllVideos({
            //  isApproved: true,
            //  researcher: {
            //    value: user._id,
            //    searchBy: 'researcher',
            //    isAcquirer: true,
            //    advanceHasBeenPaid: false,
            //  },
            //});
            //Promise.delay = function (t, val) {
            //  return new Promise((resolve) => {
            //    setTimeout(resolve.bind(null, val), t);
            //  });
            //};
            //Promise.raceAll = function (promises, timeoutTime, timeoutVal) {
            //  return Promise.all(
            //    promises.map((p) => {
            //      return Promise.race([
            //        p,
            //        Promise.delay(timeoutTime, timeoutVal),
            //      ]);
            //    })
            //  );
            //};
            //const hh = await Promise.raceAll(
            //  arr.map(async (ll) => {
            //    return await getCardDataByCardId(ll);
            //  }),
            //  6000,
            //  null
            //);
            //const hhhhh = await Promise.all(
            //  testff.map(async (fff) => {
            //    const video = await findVideoBy({
            //      searchBy: 'trelloData.trelloCardId',
            //      value: fff.id,
            //    });
            //    console.log(
            //      video.trelloData.researchers.map((jj) => {
            //        return jj;
            //      })
            //    );
            //    if (!video) {
            //      return {
            //        id: fff.id,
            //        status: 'not found',
            //      };
            //    } else {
            //      return {
            //        researcher: video.trelloData.researchers.find((ydgfyds) => {
            //          ydgfyds.researcher.name === user.name;
            //        }),
            //        id: fff.id,
            //        status: 'found',
            //      };
            //    }
            //  })
            //);
            //fs.writeFile('output.json', JSON.stringify(hhhh), 'utf8', () => {});
          }

          //if (
          //  user.name === 'Apratim' ||
          //  user.name === 'Marina' ||
          //  user.name === 'Maher'
          //) {
          //  if (user.name === 'Marina') {
          //    //const tt = await getApprovedTrelloCardBy({
          //    //  searchBy: 'researcherId',
          //    //  value: user._id,
          //    //});
          //    const yy = await getLinks({
          //      researcherId: user._id,
          //      //listInTrello: 'Review',
          //    });

          //    //const arr = tt.map((el) => {
          //    //  return el.trelloCardId;
          //    //});

          //    //console.log(
          //    //  arr.filter((item, index) => arr.indexOf(item) !== index),
          //    //  55
          //    //);

          //    //fs.writeFile(
          //    //  'movedFromReview_Marina.json',
          //    //  JSON.stringify(tt),
          //    //  'utf8',
          //    //  () => {}
          //    //);
          //    //fs.writeFile(
          //    //  'sendToReview_Marina.json',
          //    //  JSON.stringify(yy),
          //    //  'utf8',
          //    //  () => {}
          //    //);
          //  }
          //}
          //--------------------------------------------------------

          advance = !user?.advancePayment
            ? 0
            : videosCountWithUnpaidAdvance * user.advancePayment;

          const unpaidSales = await getSalesByUserId({
            userId: user._id,
            dateLimit: null,
            paidFor: false,
          });

          if (unpaidSales.length) {
            percentage = unpaidSales.reduce(
              (acc, sale) => acc + sale.amountToResearcher,
              0
            );
          }

          const definePaymentSubject = () => {
            if (advance > percentage) {
              return {
                tooltip: `Advance payment for ${videosCountWithUnpaidAdvance} videos`,
              };
            } else if (
              advance < percentage ||
              (advance === percentage && advance > 0 && percentage > 0)
            ) {
              return {
                tooltip: `Percentage for ${unpaidSales.length} sales`,
              };
            } else {
              return {
                tooltip: `Main payment`,
              };
            }
          };

          const calcAmountToBePaid = () => {
            let amount = 0;

            if (advance > percentage) {
              amount += advance;
            } else if (
              advance < percentage ||
              (advance === percentage && advance > 0 && percentage > 0)
            ) {
              amount += percentage;
            }

            if (!!user?.note) {
              amount += user.note;
            }

            return amount;
          };

          const balance = Math.round(earnedYourselfTotal - user.gettingPaid);

          //console.log(
          //  `прошедшие ревью - ${videosCountReviewed}`,
          //  `отправленные на ревью - ${videosCountSentToReview}`,
          //  `отношение прошедших к отправленным - ${
          //    (videosCountReviewed / videosCountSentToReview) * 100
          //  }`,
          //  user.name,
          //  8888999
          //);

          return {
            ...user._doc,
            balance,
            gettingPaid: Math.round(user.gettingPaid),
            sentVideosCount: {
              total: linksCount,
              last30Days: linksCountLast30Days,
              last7Days: linksCountLast7Days,
            },
            acquiredVideosCount: {
              noMainRole: {
                total: acquiredVideosCountNoMainRole,
                last30Days: acquiredVideosCountLast30DaysNoMainRole,
                last7Days: acquiredVideosCountLast7DaysNoMainRole,
              },
              mainRole: {
                total: acquiredVideosCountMainRole,
                last30Days: acquiredVideosCountLast30DaysMainRole,
                last7Days: acquiredVideosCountLast7DaysMainRole,
              },
            },

            exclusivityRate: {
              total: !!acquiredVideosCountMainRole
                ? Math.round(
                    (acquiredExclusivityVideosCount /
                      acquiredVideosCountMainRole) *
                      100
                  )
                : 0,
              last30Days: !!acquiredVideosCountLast30DaysMainRole
                ? Math.round(
                    (acquiredExclusivityVideosCountLast30Days /
                      acquiredVideosCountLast30DaysMainRole) *
                      100
                  )
                : 0,
            },
            approvedRateAfterReview: {
              total: !videosCountSentToReview
                ? 0
                : Math.round(
                    (videosCountReviewed / videosCountSentToReview) * 100
                  ) > 100
                ? 100
                : Math.round(
                    (videosCountReviewed / videosCountSentToReview) * 100
                  ),
              last30Days: !videosCountSentToReviewLast30Days
                ? 0
                : Math.round(
                    (videosCountReviewedLast30Days /
                      videosCountSentToReviewLast30Days) *
                      100
                  ) > 100
                ? 100
                : Math.round(
                    (videosCountReviewedLast30Days /
                      videosCountSentToReviewLast30Days) *
                      100
                  ),
            },
            earnedYourself: {
              total: Math.round(earnedYourselfTotal),
              last30Days: Math.round(earnedYourselfLast30Days),
            },
            average,
            percentageOfProfitableVideos:
              +percentageOfProfitableVideos.toFixed(2),
            earnedCompanies:
              balance < 0
                ? Math.round(earnedCompanies + balance)
                : Math.round(earnedCompanies),
            earnedTotal: Math.round(earnedTotal),
            amountOfAdvancesToAuthors: Math.round(amountOfAdvancesToAuthors),
            amountToBePaid: {
              ...(advance > percentage && { advance }),
              ...((advance < percentage ||
                (advance === percentage && advance > 0 && percentage > 0)) && {
                percentage,
              }),
              note: !!user?.note ? user.note : 0,

              total: calcAmountToBePaid(),
            },
            paymentSubject: definePaymentSubject(),
          };
        })
      );

      const totalSumOfStatFields = employeeStat.reduce(
        (acc = {}, user = {}) => {
          //суммарный баланс работников
          acc.balance = Math.round(acc.balance + user.balance);

          acc.average = acc.average + user.average;

          acc.percentageOfProfitableVideos =
            acc.percentageOfProfitableVideos +
            user.percentageOfProfitableVideos;

          acc.gettingPaid = Math.round(acc.gettingPaid + user.gettingPaid);

          acc.amountOfAdvancesToAuthors = Math.round(
            acc.amountOfAdvancesToAuthors + user.amountOfAdvancesToAuthors
          );

          //суммарный личный заработок работников
          acc.earnedYourself = {
            //за 30 дней
            last30Days: Math.round(
              acc.earnedYourself.last30Days + user.earnedYourself.last30Days
            ),
            //всего
            total: Math.round(
              acc.earnedYourself.total + user.earnedYourself.total
            ),
          };

          //соотношение отправленных на ревью к прошедшим ревью
          acc.approvedRateAfterReview = {
            //за 30 дней
            last30Days:
              acc.approvedRateAfterReview.last30Days +
              user.approvedRateAfterReview.last30Days,
            //всего
            total:
              acc.approvedRateAfterReview.total +
              user.approvedRateAfterReview.total,
          };

          acc.exclusivityRate = {
            //за 30 дней
            last30Days: Math.round(
              acc.exclusivityRate.last30Days + user.exclusivityRate.last30Days
            ),
            //всего
            total: Math.round(
              acc.exclusivityRate.total + user.exclusivityRate.total
            ),
          };

          //суммарный общий заработок работников
          acc.earnedTotal = Math.round(acc.earnedTotal + user.earnedTotal);

          //суммарный заработок компании
          acc.earnedCompanies = Math.round(
            acc.earnedCompanies + user.earnedCompanies
          );

          //суммарное количество отправленных работниками в трелло видео
          acc.sentVideosCount = {
            //общий
            total: acc.sentVideosCount.total + user.sentVideosCount.total,
            //за 30 дней
            last30Days:
              acc.sentVideosCount.last30Days + user.sentVideosCount.last30Days,
            // за 7 дней
            last7Days:
              acc.sentVideosCount.last7Days + user.sentVideosCount.last7Days,
          };

          //суммарное количество опубликованных на сайте видео, где присутствуют работники
          acc.acquiredVideosCount = {
            //общий
            total:
              acc.acquiredVideosCount.total +
              user.acquiredVideosCount.noMainRole.total +
              user.acquiredVideosCount.mainRole.total,
            //за 30 дней
            last30Days:
              acc.acquiredVideosCount.last30Days +
              user.acquiredVideosCount.noMainRole.last30Days +
              user.acquiredVideosCount.mainRole.last30Days,
            // за 7 дней
            last7Days:
              acc.acquiredVideosCount.last7Days +
              user.acquiredVideosCount.noMainRole.last7Days +
              user.acquiredVideosCount.mainRole.last7Days,
          };

          return acc;
        },
        {
          balance: 0,
          gettingPaid: 0,
          amountOfAdvancesToAuthors: 0,
          approvedRateAfterReview: {
            last30Days: 0,
            total: 0,
          },
          average: 0,
          percentageOfProfitableVideos: 0,
          exclusivityRate: {
            last30Days: 0,
            total: 0,
          },
          earnedYourself: {
            last30Days: 0,
            total: 0,
          },
          earnedTotal: 0,
          earnedCompanies: 0,
          sentVideosCount: {
            total: 0,
            last30Days: 0,
            last7Days: 0,
          },
          acquiredVideosCount: {
            total: 0,
            last30Days: 0,
            last7Days: 0,
          },
        }
      );

      return res.status(200).json({
        message: "Users with updated statistics received",
        status: "success",
        apiData: {
          users: employeeStat.sort((prev, next) => {
            return (
              next.acquiredVideosCount.mainRole.last30Days -
              prev.acquiredVideosCount.mainRole.last30Days
            );
          }),
          sumValues: {
            ...totalSumOfStatFields,
            average: +(
              totalSumOfStatFields.average / employeeStat.length
            ).toFixed(2),
            approvedRateAfterReview: {
              last30Days: +(
                totalSumOfStatFields.approvedRateAfterReview.last30Days /
                employeeStat.length
              ).toFixed(2),
              total: +(
                totalSumOfStatFields.approvedRateAfterReview.total /
                employeeStat.length
              ).toFixed(2),
            },
            exclusivityRate: {
              last30Days: +(
                totalSumOfStatFields.exclusivityRate.last30Days /
                employeeStat.length
              ).toFixed(2),
              total: +(
                totalSumOfStatFields.exclusivityRate.total / employeeStat.length
              ).toFixed(2),
            },
            percentageOfProfitableVideos: +(
              totalSumOfStatFields.percentageOfProfitableVideos /
              employeeStat.length
            ).toFixed(2),
          },
        },
      });
    } catch (err) {
      console.log(
        errorsHandler({ err, trace: "user.collectStatForEmployees.enlarged" })
      );
      return res.status(400).json({
        message: "Server side error",
        status: "error",
      });
    }
  }
);

router.get(
  "/collectStatForEmployees/shorten",
  authMiddleware,
  async (req, res) => {
    const { roles } = req.query;

    try {
      const users = await getAllUsers({
        me: true,
        userId: null,
        roles,
      });

      const employeeStat = await Promise.all(
        users.map(async (user) => {
          const salesTotal = await getSalesByUserId({
            userId: user._id,
            dateLimit: null,
          });

          const earnedTotal = salesTotal.reduce(
            (a, sale) => a + +(sale.amount / sale.researchers.length),
            0
          );

          const acquiredVideosCountLast30Days = await getCountVideosBy({
            forLastDays: 30,
            isApproved: true,
            user: {
              value: user._id,
              purchased: true,
              searchBy: "researcher",
            },
          });

          const acquiredVideosCountLast7Days = await getCountVideosBy({
            forLastDays: 7,
            isApproved: true,
            user: {
              value: user._id,
              purchased: true,
              searchBy: "researcher",
            },
          });

          const acquiredVideosCount = await getCountVideosBy({
            isApproved: true,
            user: {
              value: user._id,
              purchased: true,
              searchBy: "researcher",
            },
          });

          const average = acquiredVideosCount
            ? Math.round(earnedTotal / acquiredVideosCount)
            : 0;

          const acquiredVideosMainRole = await getAllVideos({
            isApproved: true,
            researcher: {
              searchBy: "researcher",
              value: user._id,
              isAcquirer: true,
            },
          });

          const profitableVideos = acquiredVideosMainRole.filter((video) => {
            if (!!video.vbForm?.refFormId?.percentage) {
              return (
                video.balance -
                  (video.balance * video.vbForm.refFormId.percentage) / 100 >
                10
              );
            } else {
              return video.balance > 10;
            }
          });

          const percentageOfProfitableVideos = !acquiredVideosCount
            ? 0
            : +((profitableVideos.length / acquiredVideosCount) * 100).toFixed(
                2
              );

          return {
            ...user._doc,
            acquiredVideosCount: {
              total: acquiredVideosCount,
              last30Days: acquiredVideosCountLast30Days,
              last7Days: acquiredVideosCountLast7Days,
            },
            average,
            percentageOfProfitableVideos,
          };
        })
      );

      const totalSumOfStatFields = employeeStat.reduce(
        (acc = {}, user = {}) => {
          acc.average = acc.average + user.average;

          //суммарное количество опубликованных на сайте видео, где присутствуют работники
          acc.acquiredVideosCount = {
            //общий
            total:
              acc.acquiredVideosCount.total + user.acquiredVideosCount.total,
            //за 30 дней
            last30Days:
              acc.acquiredVideosCount.last30Days +
              user.acquiredVideosCount.last30Days,
            // за 7 дней
            last7Days:
              acc.acquiredVideosCount.last7Days +
              user.acquiredVideosCount.last7Days,
          };

          return acc;
        },
        {
          average: 0,
          acquiredVideosCount: {
            total: 0,
            last30Days: 0,
            last7Days: 0,
          },
        }
      );

      return res.status(200).json({
        message: "Team statistics received",
        status: "success",
        apiData: {
          users: employeeStat.sort((prev, next) => {
            return next?.average - prev?.average;
          }),
          sumValues: {
            ...totalSumOfStatFields,
            average: +(
              totalSumOfStatFields.average / employeeStat.length
            ).toFixed(2),
          },
        },
      });
    } catch (err) {
      console.log(
        errorsHandler({ err, trace: "user.collectStatForEmployees.shorten" })
      );
      return res.status(400).json({
        message: "Server side error",
        status: "error",
      });
    }
  }
);

router.get("/collectStatForEmployee", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await getUserById(userId);

    if (!user) {
      return res.status(200).json({
        message: "The user with this id was not found",
        status: "warning",
      });
    }

    const sales = await getSalesByUserId({
      userId: user._id,
    });

    const salesDateLimit = await getSalesByUserId({
      userId: user._id,
      dateLimit: 30,
    });

    const earnedYourselfLast30Days = salesDateLimit.reduce((acc, sale) => {
      return acc + +sale.amountToResearcher;
    }, 0);

    const earnedForYourself = sales.reduce(
      (acc, sale) => acc + +sale.amountToResearcher,
      0
    );

    const earnedTotal = sales.reduce(
      (a, sale) => a + +(sale.amount / sale.researchers.length),
      0
    );

    const linksCountLast30Days = await getCountLinksBy({
      userId: user._id,
      dateLimit: 30,
    });

    const linksCount = await getCountLinksBy({ userId: user._id });

    const acquiredVideosCountLast30DaysMainRole = await getCountVideosBy({
      forLastDays: 30,
      isApproved: true,
      user: {
        value: user._id,
        purchased: true,
        searchBy: "researcher",
      },
    });

    const acquiredVideosCountLast30DaysNoMainRole = await getCountVideosBy({
      forLastDays: 30,
      isApproved: true,
      user: {
        value: user._id,
        purchased: false,
        searchBy: "researcher",
      },
    });

    const acquiredVideosCountMainRole = await getCountVideosBy({
      isApproved: true,
      user: {
        value: user._id,
        purchased: true,
        searchBy: "researcher",
      },
    });

    const acquiredVideosCountNoMainRole = await getCountVideosBy({
      isApproved: true,
      user: {
        value: user._id,
        purchased: false,
        searchBy: "researcher",
      },
    });

    const acquiredExclusivityVideosCountLast30Days = await getCountVideosBy({
      forLastDays: 30,
      isApproved: true,
      exclusivity: true,
      user: {
        value: user._id,
        searchBy: "researcher",
        purchased: true,
      },
    });

    const acquiredExclusivityVideosCount = await getCountVideosBy({
      isApproved: true,
      exclusivity: true,
      user: {
        value: user._id,
        searchBy: "researcher",
        purchased: true,
      },
    });

    const videosCountReviewed = await getCountApprovedTrelloCardBy({
      searchBy: "researcherId",
      value: user._id,
    });

    const videosCountSentToReview = await getCountLinks({
      researcherId: user._id,
      listInTrello: "Review",
    });

    const videosCountReviewedLast30Days = await getCountApprovedTrelloCardBy({
      searchBy: "researcherId",
      value: user._id,
      forLastDays: 30,
    });

    const videosCountSentToReviewLast30Days = await getCountLinks({
      researcherId: user._id,
      listInTrello: "Review",
      forLastDays: 30,
    });

    const average = acquiredVideosCountMainRole
      ? Math.round(earnedTotal / acquiredVideosCountMainRole)
      : 0;

    const acquiredVideosMainRole = await getAllVideos({
      isApproved: true,
      researcher: {
        searchBy: "researcher",
        value: user._id,
        isAcquirer: true,
      },
    });

    const profitableVideos = acquiredVideosMainRole.filter((video) => {
      if (!!video.vbForm?.refFormId?.percentage) {
        return (
          video.balance -
            (video.balance * video.vbForm.refFormId.percentage) / 100 >
          10
        );
      } else {
        return video.balance > 10;
      }
    });

    const percentageOfProfitableVideos = !acquiredVideosCountMainRole
      ? 0
      : +(
          (profitableVideos.length / acquiredVideosCountMainRole) *
          100
        ).toFixed(2);

    let advance = 0;
    let percentage = 0;

    let videosCountWithUnpaidAdvance = null;

    if (!!user?.advancePayment) {
      videosCountWithUnpaidAdvance = await getCountVideosBy({
        isApproved: true,
        user: {
          value: user._id,
          purchased: true,
          searchBy: "researcher",
          advanceHasBeenPaid: false,
        },
      });

      advance = videosCountWithUnpaidAdvance * user.advancePayment;
    }

    const unpaidSales = await getSalesByUserId({
      userId: user._id,
      paidFor: false,
    });

    if (unpaidSales.length) {
      percentage = unpaidSales.reduce(
        (acc, sale) => acc + sale.amountToResearcher,
        0
      );
    }

    const definePaymentSubject = () => {
      if (advance > percentage) {
        return [
          `advance payment for ${videosCountWithUnpaidAdvance} videos`,
          ...(!!user?.note ? [`$${user?.note} in notepad`] : []),
        ];
      } else if (
        advance < percentage ||
        (advance === percentage && advance > 0 && percentage > 0)
      ) {
        return [
          `percentage for ${unpaidSales.length} sales`,
          ...(!!user?.note ? [`$${user?.note} in notepad`] : []),
        ];
      } else {
        return [...(!!user?.note ? [`$${user?.note} in notepad`] : [])];
      }
    };

    const calcAmountToBePaid = () => {
      let amount = 0;

      if (advance > percentage) {
        amount += advance;
      } else if (
        advance < percentage ||
        (advance === percentage && advance > 0 && percentage > 0)
      ) {
        amount += percentage;
      }

      if (!!user?.note) {
        amount += user.note;
      }

      return Math.round(amount);
    };

    const apiData = {
      balance: Math.round(earnedForYourself - user.gettingPaid),
      earnedForYourself: {
        allTime: Math.round(earnedForYourself),
        last30Days: Math.round(earnedYourselfLast30Days),
      },
      sentVideosCount: {
        allTime: linksCount,
        last30Days: linksCountLast30Days,
      },
      acquiredVideosCount: {
        noMainRole: {
          allTime: acquiredVideosCountNoMainRole,
          last30Days: acquiredVideosCountLast30DaysNoMainRole,
        },
        mainRole: {
          allTime: acquiredVideosCountMainRole,
          last30Days: acquiredVideosCountLast30DaysMainRole,
        },
      },
      exclusivityRate: {
        allTime: !!acquiredVideosCountMainRole
          ? Math.round(
              (acquiredExclusivityVideosCount / acquiredVideosCountMainRole) *
                100
            )
          : 0,
        last30Days: !!acquiredVideosCountLast30DaysMainRole
          ? Math.round(
              (acquiredExclusivityVideosCountLast30Days /
                acquiredVideosCountLast30DaysMainRole) *
                100
            )
          : 0,
      },
      approvedRateAfterReview: {
        allTime: !videosCountSentToReview
          ? 0
          : Math.round((videosCountReviewed / videosCountSentToReview) * 100) >
            100
          ? 100
          : Math.round((videosCountReviewed / videosCountSentToReview) * 100),
        last30Days: !videosCountSentToReviewLast30Days
          ? 0
          : Math.round(
              (videosCountReviewedLast30Days /
                videosCountSentToReviewLast30Days) *
                100
            ) > 100
          ? 100
          : Math.round(
              (videosCountReviewedLast30Days /
                videosCountSentToReviewLast30Days) *
                100
            ),
      },
      average,
      percentageOfProfitableVideos,
      percentage: user.percentage ? user.percentage : 0,
      advancePayment: user.advancePayment ? user.advancePayment : 0,
      payable: {
        sum: calcAmountToBePaid(),
        forWhat: definePaymentSubject(),
      },
      name: user.name,
      salesCount: sales.length,
    };

    return res.status(200).json({
      message: "User statistics updated",
      status: "success",
      apiData,
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "user.collectStatForEmployee" }));
    return res.status(400).json({
      message: "Server side error",
      status: "error",
    });
  }
});

router.delete("/deleteUser/:userId", authMiddleware, async (req, res) => {
  const { userId } = req.params;
  try {
    await deleteUser(userId);

    return res.status(200).json({
      message: "The user has been successfully deleted",
      status: "success",
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "user.deleteUser" }));
    return res.status(400).json({
      message: "Server side error",
      status: "error",
    });
  }
});

router.post("/topUpEmployeeBalance", authMiddleware, async (req, res) => {
  try {
    const { userId, amountToBePaid, extraPayment, notePayment } = req.body;

    if (
      !userId ||
      (!amountToBePaid.percentage &&
        !amountToBePaid.advance &&
        !extraPayment &&
        !notePayment)
    ) {
      return res.status(200).json({
        message: "Missing parameter for adding funds to the user's balance",
        status: "warning",
      });
    }

    const user = await getUserById(userId);

    if (!user) {
      return res.status(200).json({
        message: "The user with this id was not found",
        status: "warning",
      });
    }

    let balance = 0;
    let gettingPaid = 0;
    let finalSum = 0;

    if (!!amountToBePaid.advance) {
      const videosCountWithUnpaidAdvance = await getCountVideosBy({
        isApproved: true,
        user: {
          value: user._id,
          purchased: true,
          searchBy: "researcher",
          advanceHasBeenPaid: false,
        },
      });

      if (
        (typeof user?.advancePayment === "number" &&
          videosCountWithUnpaidAdvance * user.advancePayment !==
            amountToBePaid.advance) ||
        (typeof user?.advancePayment !== "number" &&
          videosCountWithUnpaidAdvance * 10 !== amountToBePaid.advance)
      ) {
        return res.status(200).json({
          message: `The totals for the payment do not converge`,
          status: "warning",
        });
      }

      await markVideoEmployeeAsHavingReceivedAnAdvance({
        researcherId: user._id,
      });

      balance = -amountToBePaid.advance;
      gettingPaid = amountToBePaid.advance;
      finalSum = amountToBePaid.advance;
    }

    if (!!amountToBePaid.percentage) {
      let percentage = 0;

      const unpaidSales = await getSalesByUserId({
        userId: user._id,
        dateLimit: null,
        paidFor: false,
      });

      if (unpaidSales.length) {
        percentage = unpaidSales.reduce(
          (acc, sale) => acc + sale.amountToResearcher,
          0
        );
      }

      if (percentage !== amountToBePaid.percentage) {
        return res.status(200).json({
          message: `The totals for the payment do not converge`,
          status: "warning",
        });
      }

      await markEmployeeOnSalesHavingReceivePercentage({
        researcherId: user._id,
      });

      balance = amountToBePaid.percentage;
      gettingPaid = amountToBePaid.percentage;
      finalSum = amountToBePaid.percentage;
    }

    if (!!extraPayment) {
      balance -= extraPayment;
      gettingPaid += extraPayment;
      finalSum += extraPayment;
    }

    if (!!notePayment) {
      finalSum += notePayment;
    }

    objDBForSet = {
      lastPaymentDate: moment().toDate(),
    };

    objDBForIncrement = {
      balance,
      gettingPaid,
    };

    objDBForUnset = {
      ...(!!notePayment && { note: 1 }),
    };

    await updateUser({
      userId,
      objDBForUnset,
      objDBForSet,
      objDBForIncrement,
    });

    await createNewPayment({
      user: userId,
      purpose: [
        ...(!!amountToBePaid?.advance ? ["advance"] : []),
        ...(!!amountToBePaid?.percentage ? ["percent"] : []),
        ...(!!notePayment ? ["note"] : []),
        ...(!!extraPayment ? ["extra"] : []),
      ],
      amount: {
        ...(!!amountToBePaid?.advance && {
          advance: amountToBePaid.advance,
        }),
        ...(!!amountToBePaid?.percentage && {
          percentage: amountToBePaid.percentage,
        }),
        ...(!!notePayment && {
          note: notePayment,
        }),
        ...(!!extraPayment && {
          extra: extraPayment,
        }),
      },
    });

    const bodyForEmail = {
      emailFrom: '"«VIRALBEAR» LLC" <info@viralbear.media>',
      emailTo: user.email,
      subject: "Payment of the amount",
      html: `
      Hello ${user.name}.<br/>
      ViralBear just paid your monthly income: ${finalSum}$!<br/>
      Have a good day!
      `,
    };

    sendEmail(bodyForEmail);

    return res.status(200).json({
      message: `The employee was paid $${finalSum}`,
      status: "success",
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "user.topUpEmployeeBalance" }));
    return res.status(400).json({
      message: "Server side error",
      status: "error",
    });
  }
});

router.post("/findByValueList", async (req, res) => {
  try {
    const { emailList } = req.body;

    const users = await findUsersByValueList({
      param: "email",
      valueList: emailList,
    });

    return res.status(200).json({
      message: 'The workers"s balance has been successfully replenished',
      status: "success",
      apiData: users,
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "user.findByValueList" }));
    return res.status(400).json({
      message: "Server side error",
      status: "error",
    });
  }
});

router.get("/authors/collectStatOnVideo", authMiddleware, async (req, res) => {
  try {
    const { group } = req.query;

    const videosWithVbCode = await getAllVideos({
      vbFormExists: true,
      isApproved: true,
    });

    if (videosWithVbCode.length) {
      let authorsVideoStatistics = await Promise.all(
        videosWithVbCode.map(async (video) => {
          const vbForm = await findOne({
            searchBy: "_id",
            param: video.vbForm,
          });

          const salesOfThisVideo = await getAllSales({
            videoId: video.videoData.videoId,
          });

          if (vbForm) {
            if (vbForm?.sender) {
              if (vbForm?.refFormId) {
                let percentAmount = 0;
                let advanceAmount = 0;
                let toBePaid = 0;
                let totalBalance = 0;

                if (
                  vbForm.refFormId?.advancePayment &&
                  typeof vbForm.advancePaymentReceived === "boolean" &&
                  !vbForm.advancePaymentReceived
                ) {
                  advanceAmount = vbForm.refFormId.advancePayment;
                  toBePaid = vbForm.refFormId.advancePayment;
                }

                if (
                  vbForm.refFormId?.advancePayment &&
                  typeof vbForm.advancePaymentReceived === "boolean" &&
                  vbForm.advancePaymentReceived
                ) {
                  totalBalance = vbForm.refFormId.advancePayment * -1;
                }

                if (vbForm.refFormId?.percentage) {
                  salesOfThisVideo.map((sale) => {
                    if (sale.vbFormInfo.paidFor === false) {
                      percentAmount +=
                        (sale.amount * vbForm.refFormId.percentage) / 100;
                      toBePaid +=
                        (sale.amount * vbForm.refFormId.percentage) / 100;
                    } else {
                      totalBalance +=
                        (sale.amount * vbForm.refFormId.percentage) / 100;
                    }
                  });
                }

                return {
                  status: "All right",
                  authorEmail: vbForm.sender.email,
                  percentage: vbForm.refFormId.percentage
                    ? vbForm.refFormId.percentage
                    : 0,
                  advance: {
                    value:
                      typeof vbForm.advancePaymentReceived === "boolean" &&
                      vbForm.refFormId.advancePayment
                        ? vbForm.refFormId.advancePayment
                        : 0,
                    paid:
                      typeof vbForm.advancePaymentReceived !== "boolean" &&
                      !vbForm.refFormId?.advancePayment
                        ? null
                        : vbForm.advancePaymentReceived === true
                        ? true
                        : false,
                  },
                  videoId: video.videoData.videoId,
                  videoTitle: video.videoData.title,
                  paymentInfo: !vbForm.sender
                    ? null
                    : !vbForm.sender?.paymentInfo?.variant
                    ? false
                    : true,
                  amount: {
                    percent: +percentAmount.toFixed(2),
                    advance: +advanceAmount.toFixed(2),
                    toBePaid: +toBePaid.toFixed(2),
                    totalBalance: +totalBalance.toFixed(2),
                  },
                  vbFormUid: vbForm.formId,
                  researchers: video.trelloData?.researchers?.length
                    ? video.trelloData?.researchers
                        .map((obj) => {
                          return obj.researcher.name;
                        })
                        .join(", ")
                    : null,
                  salesCount: salesOfThisVideo.length,
                };
              } else {
                return {
                  status: "VB form without referral link",
                  authorEmail: null,
                  percentage: null,
                  advance: {
                    value: null,
                    paid: null,
                  },
                  videoId: video.videoData.videoId,
                  videoTitle: video.videoData.title,
                  paymentInfo: null,
                  amount: {
                    percent: null,
                    advance: null,
                    toBePaid: null,
                    totalBalance: null,
                  },
                  vbFormUid: vbForm.formId,
                  researchers: video.trelloData?.researchers?.length
                    ? video.trelloData?.researchers
                        .map((obj) => {
                          return obj.researcher.name;
                        })
                        .join(", ")
                    : null,
                  salesCount: salesOfThisVideo.length,
                };
              }
            } else {
              return {
                status: "VB form without sender",
                authorEmail: null,
                percentage: null,
                advance: {
                  value: null,
                  paid: null,
                },
                videoId: video.videoData.videoId,
                videoTitle: video.videoData.title,
                paymentInfo: null,
                amount: {
                  percent: null,
                  advance: null,
                  toBePaid: null,
                  totalBalance: null,
                },
                vbFormUid: vbForm.formId,
                researchers: video.trelloData?.researchers?.length
                  ? video.trelloData?.researchers
                      .map((obj) => {
                        return obj.researcher.name;
                      })
                      .join(", ")
                  : null,
                salesCount: salesOfThisVideo.length,
              };
            }
          } else {
            return {
              status: "VB form not found",
              authorEmail: null,
              percentage: null,
              advance: {
                value: null,
                paid: null,
              },
              videoId: video.videoData.videoId,
              videoTitle: video.videoData.title,
              paymentInfo: null,
              amount: {
                percent: null,
                advance: null,
                toBePaid: null,
                totalBalance: null,
              },
              vbFormUid: null,
              researchers: video.trelloData?.researchers?.length
                ? video.trelloData?.researchers
                    .map((obj) => {
                      return obj.researcher.name;
                    })
                    .join(", ")
                : null,
              salesCount: salesOfThisVideo.length,
            };
          }
        })
      );

      authorsVideoStatistics = authorsVideoStatistics.reduce(
        (res, videoData) => {
          if (!!videoData.amount.percent && videoData.amount.percent < 75) {
            res["other"].push(videoData);
          }
          if (
            (videoData.paymentInfo === false && !!videoData.amount.advance) ||
            (videoData.paymentInfo === false && videoData.amount.percent >= 75)
          ) {
            res["noPayment"].push(videoData);
          }
          if (
            (!!videoData.paymentInfo && !!videoData.amount.advance) ||
            (!!videoData.paymentInfo && videoData.amount.percent >= 75)
          ) {
            res["ready"].push(videoData);
          }
          return res;
        },
        { ready: [], noPayment: [], other: [] }
      );

      const defineApiData = () => {
        if (group === "ready") {
          return authorsVideoStatistics.ready;
        }
        if (group === "noPayment") {
          return authorsVideoStatistics.noPayment;
        }
        if (group === "other") {
          return authorsVideoStatistics.other;
        }
      };

      return res.status(200).json({
        status: "success",
        message: "Statistics on authors have been successfully collected",
        apiData: defineApiData(),
      });
    } else {
      return res.status(200).json({
        status: "success",
        message: "Statistics on authors have been successfully collected",
        apiData: [],
      });
    }
  } catch (err) {
    console.log(
      errorsHandler({ err, trace: "user.authors.collectStatOnVideo" })
    );

    return res.status(400).json({
      message: "Server side error",
      status: "error",
    });
  }
});

router.get("/authors/getPaymentDetails", authMiddleware, async (req, res) => {
  try {
    const { searchBy, value } = req.query;

    const author = await getUserBy({ searchBy, value });

    if (!author) {
      return res.status(200).json({
        status: "warning",
        message: "Author not found",
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Statistics on authors have been successfully collected",
      apiData: author?.paymentInfo ? author.paymentInfo : {},
    });
  } catch (err) {
    console.log(
      errorsHandler({ err, trace: "user.authors.getPaymentDetails" })
    );

    return res.status(400).json({
      message: "Server side error",
      status: "error",
    });
  }
});

router.post("/authors/topUpBalance", authMiddleware, async (req, res) => {
  try {
    const { videoId, amountToTopUp } = req.body;
    const { paymentFor } = req.query;

    if (!paymentFor) {
      return res.status(200).json({
        message: 'missing parameter "paymentFor"',
        status: "warning",
      });
    }

    if (!videoId) {
      return res.status(200).json({
        message: "Missing parameter to top up the author's balance",
        status: "warning",
      });
    }

    const video = await findVideoBy({
      searchBy: "videoData.videoId",
      value: videoId,
    });

    if (!video) {
      return res.status(200).json({
        message: `Video with id "${videoId}" not found`,
        status: "warning",
      });
    }
    if (!video.vbForm) {
      return res.status(200).json({
        message: `The video has no VB form`,
        status: "warning",
      });
    }

    if (!video?.vbForm?.sender?.email) {
      return res.status(200).json({
        message: `Author not found`,
        status: "warning",
      });
    }

    if (!video?.vbForm?.refFormId) {
      return res.status(200).json({
        message: `Referral form not found`,
        status: "warning",
      });
    }

    const bodyForEmail = {
      emailFrom: '"«VIRALBEAR» LLC" <info@viralbear.media>',
      emailTo: video?.vbForm?.sender?.email,
      subject: "Payment of the amount",
      html: `
      Hello ${video.vbForm.sender.name}.<br/>
      ViralBear just paid you: ${amountToTopUp}$!<br/>
      Have a good day!
      `,
    };

    let advanceAmount = 0;
    let percentAmount = 0;

    if (paymentFor === "advance") {
      if (
        video.vbForm.refFormId.advancePayment &&
        video.vbForm.advancePaymentReceived === true
      ) {
        return res.status(200).json({
          message: `An advance has already been paid for this vb form`,
          status: "warning",
        });
      }

      if (
        !video.vbForm.refFormId?.advancePayment ||
        typeof video.vbForm.advancePaymentReceived !== "boolean"
      ) {
        return res.status(200).json({
          message: `There is no advance payment for this vb form`,
          status: "warning",
        });
      }

      advanceAmount = video.vbForm.refFormId.advancePayment;

      if (Math.ceil(advanceAmount) !== Math.ceil(amountToTopUp)) {
        return res.status(200).json({
          message: `The totals for the payment do not converge`,
          status: "warning",
        });
      }

      await updateVbFormBy({
        updateBy: "_id",
        value: video.vbForm._id,
        dataForUpdate: { advancePaymentReceived: true },
      });

      await updateVideoBy({
        searchBy: "_id",
        searchValue: video._id,
        dataToInc: { balance: -amountToTopUp },
      });

      const objDBForSet = {
        lastPaymentDate: moment().toDate(),
      };

      const objDBForIncrement = {
        balance: amountToTopUp,
      };

      await updateUser({
        userId: video.vbForm.sender._id,
        objDBForSet,
        objDBForIncrement,
      });

      sendEmail(bodyForEmail);

      return res.status(200).json({
        message: `Advance payment of $${advanceAmount} was credited to the author's balance`,
        status: "success",
      });
    }

    if (paymentFor === "percent") {
      const salesWithThisVideoId = await getAllSales({
        videoId,
        paidFor: { "vbFormInfo.paidFor": false },
      });

      if (!salesWithThisVideoId.length) {
        return res.status(200).json({
          message: `The video sales list is empty`,
          status: "warning",
        });
      }

      if (!video.vbForm.refFormId.percentage) {
        return res.status(200).json({
          message: `There is no percentage provided for this vb form`,
          status: "warning",
        });
      }

      percentAmount = salesWithThisVideoId.reduce(
        (acc, sale) =>
          acc + (sale.amount * video.vbForm.refFormId.percentage) / 100,
        0
      );

      if (Math.ceil(percentAmount) !== Math.ceil(amountToTopUp)) {
        return res.status(200).json({
          message: `The totals for the payment do not converge`,
          status: "warning",
        });
      }

      const dataForUpdateSales = {
        $set: { "vbFormInfo.paidFor": true },
      };

      await updateSalesBy({
        updateBy: "videoId",
        value: videoId,
        dataForUpdate: dataForUpdateSales,
      });

      const objDBForSet = {
        lastPaymentDate: moment().toDate(),
      };

      const objDBForIncrement = {
        balance: amountToTopUp,
      };

      await updateUser({
        userId: video.vbForm.sender._id,
        objDBForSet,
        objDBForIncrement,
      });

      sendEmail(bodyForEmail);

      return res.status(200).json({
        message: `Percentage of $${percentAmount} was credited to the author's balance`,
        status: "success",
      });
    }

    if (paymentFor === "mixed") {
      const salesWithThisVideoId = await getAllSales({
        videoId,
        paidFor: { "vbFormInfo.paidFor": false },
      });

      if (!salesWithThisVideoId.length) {
        return res.status(200).json({
          message: `The video sales list is empty`,
          status: "warning",
        });
      }

      if (!video.vbForm.refFormId.percentage) {
        return res.status(200).json({
          message: `There is no percentage provided for this vb form`,
          status: "warning",
        });
      }

      if (
        video.vbForm.refFormId.advancePayment &&
        video.vbForm.advancePaymentReceived === true
      ) {
        return res.status(200).json({
          message: `An advance has already been paid for this vb form`,
          status: "warning",
        });
      }

      if (
        !video.vbForm.refFormId.advancePayment ||
        typeof video.vbForm.advancePaymentReceived !== "boolean"
      ) {
        return res.status(200).json({
          message: `There is no advance payment for this vb form`,
          status: "warning",
        });
      }

      advanceAmount = video.vbForm.refFormId.advancePayment;

      percentAmount = salesWithThisVideoId.reduce(
        (acc, sale) =>
          acc + (sale.amount * video.vbForm.refFormId.percentage) / 100,
        0
      );

      if (
        Math.ceil(advanceAmount + percentAmount) !== Math.ceil(amountToTopUp)
      ) {
        return res.status(200).json({
          message: `The totals for the payment do not converge`,
          status: "warning",
        });
      }

      await updateVbFormBy({
        updateBy: "_id",
        value: video.vbForm._id,
        dataForUpdate: { advancePaymentReceived: true },
      });

      await updateVideoBy({
        searchBy: "_id",
        searchValue: video._id,
        dataToInc: { balance: -advanceAmount },
      });

      const objDBForSet = {
        lastPaymentDate: moment().toDate(),
      };

      const objDBForIncrement = {
        balance: amountToTopUp,
      };

      await updateUser({
        userId: video.vbForm.sender._id,

        objDBForSet,
        objDBForIncrement,
      });

      const dataForUpdateSales = {
        $set: { "vbFormInfo.paidFor": true },
      };

      await updateSalesBy({
        updateBy: "videoId",
        value: videoId,
        dataForUpdate: dataForUpdateSales,
      });

      sendEmail(bodyForEmail);

      return res.status(200).json({
        message: `An advance of $${advanceAmount} and a percentage of $${percentAmount} was credited to the author's balance`,
        status: "success",
      });
    }

    await createNewPayment({
      user: video?.vbForm?.sender?._id,
      purpose: [
        ...(paymentFor === "advance" ? ["advance"] : []),
        ...(paymentFor === "percent" ? ["percent"] : []),
        ...(paymentFor === "mixed" ? ["advance", "percent"] : []),
      ],
      amount: {
        ...(paymentFor === "advance" && {
          advance: advanceAmount,
        }),
        ...(paymentFor === "percent" && {
          percentage: percentAmount,
        }),
        ...(paymentFor === "mixed" && {
          advance: advanceAmount,
          percentage: percentAmount,
        }),
      },
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "user.authors.topUpBalance" }));
    return res.status(400).json({
      message: "Server side error",
      status: "error",
    });
  }
});

router.post("/authors/register", async (req, res) => {
  try {
    const { authorRegHash, password: reqPassword } = req.body;

    if (!authorRegHash) {
      return res.status(200).json({
        message:
          "There is no referral hash. Contact your administrator or try again",
        status: "warning",
      });
    }

    const objToSearchVbForm = {
      searchBy: "_id",
      param: authorRegHash,
    };

    const vbForm = await findOne(objToSearchVbForm);

    if (!vbForm) {
      return res.status(200).json({
        message:
          "The form was not found. Contact your administrator or try again",
        status: "warning",
      });
    }

    const candidate = await getUserById(vbForm.sender);

    if (!candidate) {
      return res.status(200).json({
        message: "A user with this email not found",
        status: "warning",
      });
    }

    const salt = await genSalt(10);

    const objDBForSet = {
      password: await hashBcrypt(reqPassword, salt),
      activatedTheAccount: true,
    };

    await updateUser({
      userId: vbForm.sender,
      objDBForSet,
    });

    const { accessToken, refreshToken } = generateTokens({
      userId: candidate._id,
      userRole: candidate.role,
    });

    return res.status(200).json({
      apiData: {
        accessToken,
        refreshToken,
        role: candidate.role,
        userId: candidate._id,
        name: candidate.name,
      },
      status: "success",
      message: "Congratulations on registering on the service!",
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "user.authors.register" }));
    return res.status(400).json({
      message: "Server side error",
      status: "error",
    });
  }
});

router.get(
  "/researchers/collectStatOnAcquiredVideos",
  authMiddleware,
  async (req, res) => {
    const userId = req.user.id;

    try {
      const { forLastDays } = req.query;

      let acquiredVideosStat = [];

      const videosWithVbCode = await getAllVideos({
        vbFormExists: true,
        isApproved: true,
        researcher: {
          searchBy: "researcher",
          value: mongoose.Types.ObjectId(userId),
        },
        ...(forLastDays && { forLastDays }),
      });

      if (videosWithVbCode.length) {
        acquiredVideosStat = await Promise.all(
          videosWithVbCode.map(async (video) => {
            const vbForm = await findOne({
              searchBy: "_id",
              param: video.vbForm,
            });

            if (vbForm) {
              if (vbForm?.sender) {
                if (vbForm?.refFormId) {
                  return {
                    status: "All right",
                    authorData: {
                      id: vbForm.sender._id,
                      email: vbForm.sender.email,
                    },
                    percentage: vbForm.refFormId.percentage
                      ? vbForm.refFormId.percentage
                      : 0,
                    advance: {
                      value:
                        typeof vbForm.advancePaymentReceived === "boolean" &&
                        vbForm.refFormId.advancePayment
                          ? vbForm.refFormId.advancePayment
                          : 0,
                      paid:
                        typeof vbForm.advancePaymentReceived !== "boolean" &&
                        !vbForm.refFormId.advancePayment
                          ? null
                          : vbForm.advancePaymentReceived === true
                          ? true
                          : false,
                    },
                    videoId: video.videoData.videoId,
                    videoTitle: video.videoData.title,
                    paymentInfo:
                      vbForm.sender?.paymentInfo?.variant === undefined
                        ? false
                        : true,
                    vbFormUid: vbForm.formId,
                  };
                } else {
                  return {
                    status: "VB form without referral link",
                    authorData: {
                      id: vbForm.sender._id,
                      email: vbForm.sender.email,
                    },
                    percentage: null,
                    advance: {
                      value: null,
                      paid: null,
                    },
                    videoId: video.videoData.videoId,
                    videoTitle: video.videoData.title,
                    paymentInfo:
                      vbForm.sender?.paymentInfo?.variant === undefined
                        ? false
                        : true,
                    vbFormUid: vbForm.formId,
                  };
                }
              } else {
                return {
                  status: "VB form without sender",
                  authorData: {
                    id: null,
                    email: null,
                  },
                  percentage: null,
                  advance: {
                    value: null,
                    paid: null,
                  },
                  videoId: video.videoData.videoId,
                  videoTitle: video.videoData.title,
                  paymentInfo: null,
                  vbFormUid: vbForm.formId,
                };
              }
            } else {
              return {
                status: "VB form not found",
                authorData: {
                  id: null,
                  email: null,
                },
                percentage: null,
                advance: {
                  value: null,
                  paid: null,
                },
                videoId: video.videoData.videoId,
                videoTitle: video.videoData.title,
                paymentInfo: null,
                vbFormUid: null,
              };
            }
          })
        );
      }

      return res.status(200).json({
        status: "success",
        message: "Employee statistics on purchased videos received",
        apiData: acquiredVideosStat,
      });
    } catch (err) {
      console.log(
        errorsHandler({
          err,
          trace: "user.researchers.collectStatOnAcquiredVideos",
        })
      );

      return res.status(400).json({
        message: "Server side error",
        status: "error",
      });
    }
  }
);

module.exports = router;
