const express = require("express");
const router = express.Router();
const multer = require("multer");

const fs = require("fs");
const path = require("path");
const request = require("request");

const Video = require("../entities/Video");

const { google } = require("googleapis");

const mongoose = require("mongoose");

const trelloInstance = require("../api/trello.instance");

const axios = require("axios");

const streamifier = require("streamifier");

const { errorsHandler } = require("../handlers/error.handler");

const socketInstance = require("../socket.instance");
const googleApiOAuth2Instance = require("../googleApiOAuth2.instance");

const moment = require("moment");

const Sales = require("../entities/Sales");

const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const fbUpload = require("facebook-api-video-upload");

const authMiddleware = require("../middleware/auth.middleware");

const { generateVideoId } = require("../utils/generateVideoId");
const { findTimestampsBySearch } = require("../utils/findTimestampsBySearch");
const { convertInMongoIdFormat } = require("../utils/convertInMongoIdFormat");
const {
  definingDescriptionForYoutube,
} = require("../utils/videos/definingDescriptionForYoutube");

const { getDurationFromBuffer } = require("fancy-video-duration");

const {
  findStartEndPointOfDuration,
} = require("../utils/findStartEndPointOfDuration");

const { findOne } = require("../controllers/uploadInfo.controller");

const {
  findOneRefFormByParam,
  markRefFormAsUsed,
} = require("../controllers/authorLink.controller");

var Mutex = require("async-mutex").Mutex;
const mutex = new Mutex();

const {
  refreshMrssFiles,
  findByIsBrandSafe,

  findByFixed,
  findById,
  addCommentForFixed,
  generateExcelFile,
  findRelated,
  findAllVideo,
  publishingVideoInSocialMedia,
  findNextVideoInFeed,
  findPrevVideoInFeed,
  findOneVideoInFeed,
  findReadyForPublication,
  updateVideoBy,
  findTheCountryCodeByName,
  uploadContentOnBucket,
  createNewVideo,
  findVideoById,
  convertingVideoToHorizontal,
  readingAndUploadingConvertedVideoToBucket,
  updateVideoById,
  deleteVideoById,
  writingFileToDisk,
  getAllVideos,
  findVideoBy,
  markResearcherAdvanceForOneVideoAsPaid,
  updateVideosBy,
} = require("../controllers/video.controller");

const {
  findUsersByValueList,
  getUserBy,
  updateUser,
  getAllUsers,
  updateUserBy,
} = require("../controllers/user.controller");

const { sendEmail } = require("../controllers/sendEmail.controller");

const {
  uploadFileToStorage,
  removeFileFromStorage,
} = require("../controllers/storage.controller");

const {
  deleteLabelFromTrelloCard,
  updateCustomFieldByTrelloCard,
} = require("../controllers/trello.controller");

const {
  findTheRecordOfTheCardMovedToDone,
} = require("../controllers/movedToDoneList.controller");

const { updateVbFormBy } = require("../controllers/uploadInfo.controller");

const {
  defineResearchersListForCreatingVideo,
} = require("../utils/defineResearchersListForCreatingVideo");

const { getAllSales } = require("../controllers/sales.controller");
const { createNewPayment } = require("../controllers/payment.controller");
const storageInstance = require("../storage.instance");
const { resolveCname } = require("dns");

const storage = multer.memoryStorage();

router.post(
  "/addVideo",
  authMiddleware,

  multer({ storage: storage }).fields([
    {
      name: "video",
      maxCount: 1,
    },
    {
      name: "screen",
      maxCount: 1,
    },
  ]),
  async (req, res) => {
    await mutex.runExclusive(async () => {
      const {
        originalLink,
        vbCode,
        researchers,
        title,
        desc,
        creditTo,
        tags,
        category,
        categoryReuters,
        city,
        country,
        date,
        trelloCardUrl,
        trelloCardId,
        trelloCardName,
        priority,
        exclusivity,
        videoId: reqVideoId,
        commentToAdmin,
        acquirerName,
        checkPaymentToTheAuthor,
      } = req.body;

      const { video, screen } = req.files;

      let videoId;

      if (
        !originalLink ||
        !JSON.parse(researchers).length ||
        !title ||
        !desc ||
        !JSON.parse(tags).length ||
        !JSON.parse(category).length ||
        !categoryReuters ||
        !city ||
        !country ||
        !date ||
        !trelloCardUrl ||
        !trelloCardId ||
        !trelloCardName ||
        !priority ||
        !video ||
        !screen
      ) {
        return res.status(200).json({
          message: "Missing values for adding a new video",
          status: "warning",
        });
      }

      if (
        path.extname(video[0].originalname) !== ".mp4" ||
        path.extname(screen[0].originalname) !== ".jpg"
      ) {
        return res
          .status(200)
          .json({ message: "Invalid file/s extension", status: "warning" });
      }

      if (!JSON.parse(researchers).find((name) => name === acquirerName)) {
        return res.status(200).json({
          message: "The acquirer is not added to the list",
          status: "warning",
        });
      }

      if (
        !!JSON.parse(checkPaymentToTheAuthor) &&
        !JSON.parse(acquirerPaidAdvance)
      ) {
        return res.status(200).json({
          message:
            "The video cannot be added without confirmation of the advance payment by the employee to the author",
          status: "warning",
        });
      }

      try {
        let vbForm = null;

        if (vbCode) {
          vbForm = await findOne({ searchBy: "formId", param: `VB${vbCode}` });

          if (!vbForm) {
            return res.status(200).json({
              message: `The form with the vb code ${vbCode} was not found in the database`,
              status: "warning",
            });
          }

          const videoWithVBForm = await findVideoBy({
            searchBy: "vbForm",
            value: vbForm._id,
          });

          if (videoWithVBForm) {
            return res.status(200).json({
              message:
                'a video with such a "VB code" is already in the database',
              status: "warning",
            });
          }
        }

        const countryCode = await findTheCountryCodeByName(country);

        if (!countryCode) {
          return res.status(200).json({
            message: "Could not determine the country code",
            status: "warning",
          });
        }

        const responseAfterConversion = await convertingVideoToHorizontal({
          buffer: video[0].buffer,
          userId: req.user.id,
          filename: video[0].originalname,
        });

        if (!reqVideoId) {
          videoId = await generateVideoId();
        } else {
          videoId = +reqVideoId;
        }

        const bucketResponseByConvertedVideoUpload = await new Promise(
          (resolve, reject) => {
            fs.readFile(
              path.resolve(`./videos/${req.user.id}/output-for-conversion.mp4`),
              {},
              async (err, buffer) => {
                if (err) {
                  console.log(err);
                  resolve({
                    status: "error",
                    message: "Error when reading a file from disk",
                  });
                } else {
                  await uploadFileToStorage({
                    folder: "converted-videos",
                    name: videoId,
                    buffer,
                    type: video[0].mimetype,
                    extension: path.extname(video[0].originalname),
                    resolve,
                    socketInfo: {
                      userId: req.user.id,
                      socketEmitName: "progressOfRequestInPublishing",
                      fileName: video[0].originalname,
                      eventName: "Uploading the converted video to the bucket",
                    },
                  });
                }
              }
            );
          }
        );

        if (bucketResponseByConvertedVideoUpload.status === "error") {
          return res.status(200).json({
            message: bucketResponseByConvertedVideoUpload.message,
            status: "warning",
          });
        }

        const bucketResponseByVideoUpload = await new Promise(
          async (resolve, reject) => {
            await uploadFileToStorage({
              folder: "videos",
              name: videoId,
              buffer: video[0].buffer,
              type: video[0].mimetype,
              extension: path.extname(video[0].originalname),
              resolve,
              socketInfo: {
                userId: req.user.id,
                socketEmitName: "progressOfRequestInPublishing",
                fileName: video[0].originalname,
                eventName: "Uploading video to the bucket",
              },
            });
          }
        );

        if (bucketResponseByVideoUpload.status === "error") {
          return res.status(200).json({
            message: bucketResponseByVideoUpload.message,
            status: "warning",
          });
        }

        const bucketResponseByScreenUpload = await new Promise(
          async (resolve, reject) => {
            await uploadFileToStorage({
              folder: "screens",
              name: videoId,
              buffer: screen[0].buffer,
              type: screen[0].mimetype,
              extension: path.extname(screen[0].originalname),
              resolve,
              socketInfo: {
                userId: req.user.id,
                socketEmitName: "progressOfRequestInPublishing",
                fileName: screen[0].originalname,
                eventName: "Uploading screen to the bucket",
              },
            });
          }
        );

        if (bucketResponseByScreenUpload.status === "error") {
          return res.status(200).json({
            message: bucketResponseByScreenUpload.message,
            status: "warning",
          });
        }

        socketInstance
          .io()
          .sockets.in(req.user.id)
          .emit("progressOfRequestInPublishing", {
            event: "Just a little bit left",
            file: null,
          });

        const researchersList = await findUsersByValueList({
          param: "name",
          valueList: JSON.parse(researchers),
        });

        let acquirer = null;

        if (acquirerName) {
          acquirer = await getUserBy({
            searchBy: "name",
            value: acquirerName,
          });
        }

        const researchersListForCreatingVideo =
          defineResearchersListForCreatingVideo({
            mainResearcher: acquirer ? acquirer : null,
            allResearchersList: researchersList,
          });

        const bodyForNewVideo = {
          videoId,
          originalLink,
          title,
          desc,
          ...(creditTo && {
            creditTo,
          }),
          ...(commentToAdmin && {
            commentToAdmin,
          }),
          tags: JSON.parse(tags).map((el) => {
            return el.trim();
          }),
          category: JSON.parse(category),
          categoryReuters,
          city,
          hasAudioTrack: responseAfterConversion.data.hasAudioTrack,
          country,
          countryCode,
          date,
          duration: Math.floor(getDurationFromBuffer(video[0].buffer)),
          trelloCardUrl,
          trelloCardId,
          trelloCardName,

          researchers: researchersListForCreatingVideo,
          priority: JSON.parse(priority),
          exclusivity: JSON.parse(exclusivity),
          ...(vbForm && {
            vbForm: vbForm._id,
          }),
          bucketResponseByVideoUpload: bucketResponseByVideoUpload.response,
          bucketResponseByScreenUpload: bucketResponseByScreenUpload.response,
          bucketResponseByConversionVideoUpload:
            bucketResponseByConvertedVideoUpload.response,
        };

        const newVideo = await createNewVideo(bodyForNewVideo);

        if (!!JSON.parse(checkPaymentToTheAuthor)) {
          if (!vbForm?.sender) {
            return res.status(200).json({
              message: "This video has no author",
              status: "warning",
            });
          }

          if (!!vbForm?.advancePaymentReceived) {
            return res.status(200).json({
              message: "The author has already been paid an advance",
              status: "warning",
            });
          }

          if (!acquirerName) {
            return res.status(200).json({
              message: "No acquirer found to record a note",
              status: "warning",
            });
          }

          await updateUser({
            userId: acquirer._id,
            objDBForIncrement: {
              note: +vbForm.refFormId.advancePayment,
            },
          });

          await updateVbFormBy({
            updateBy: "_id",
            value: vbForm._id,
            dataForUpdate: { advancePaymentReceived: true },
          });

          await updateVideoBy({
            searchBy: "_id",
            searchValue: newVideo._id,
            dataToInc: { balance: -vbForm.refFormId.advancePayment },
          });

          await createNewPayment({
            user: vbForm.sender._id,
            purpose: ["advance"],
            amount: {
              advance: +vbForm.refFormId.advancePayment,
            },
          });

          const bodyForEmail = {
            emailFrom: '"«VIRALBEAR» LLC" <info@viralbear.media>',
            emailTo: vbForm.sender.email,
            subject: "Payment of the amount",
            html: `
            Hello ${vbForm.sender.name}.<br/>
            ViralBear just paid you: ${vbForm.refFormId.advancePayment}$!<br/>
            Have a good day!
            `,
          };

          sendEmail(bodyForEmail);
        }

        const acquirerData = newVideo.trelloData.researchers.find(
          (obj) => obj.main
        );

        socketInstance.io().emit("editorPanelChanges", {
          event: "prePublish",
        });

        return res.status(200).json({
          apiData: newVideo,
          status: "success",
          message: "Video successfully added",
        });
      } catch (err) {
        console.log(errorsHandler({ err, trace: "video.addVideo" }));

        return res.status(400).json({
          message: err?.message ? err?.message : "Server side error",
          status: "error",
        });
      }
    });
  }
);

router.post("/convert", authMiddleware, async (req, res) => {
  await mutex.runExclusive(async () => {
    try {
      const { videoId } = req.query;
      const userId = req.user.id;

      if (!videoId) {
        return res
          .status(200)
          .json({ message: "Missing videoId", status: "warning" });
      }

      const video = await findVideoBy({
        searchBy: "videoData.videoId",
        value: +videoId,
      });

      if (!video) {
        return res.status(200).json({
          message: `Video with id ${+videoId} not found`,
          status: "warning",
        });
      }

      const directory = `./videos/${userId}`;

      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
      }

      const writer = fs.createWriteStream(
        `./videos/${userId}/input-for-conversion.mp4`
      );

      const { data: stream } = await axios.get(video.bucket.cloudVideoLink, {
        responseType: "stream",
      });

      await new Promise((resolve, reject) => {
        stream.pipe(writer);
        let error = null;
        writer.on("error", (err) => {
          error = err;
          writer.close();
          reject(err);

          return res.status(200).json({
            message: `Error when downloading a file`,
            status: "warning",
          });
        });
        writer.on("close", () => {
          if (!error) {
            resolve(true);
          }
        });
      });

      const responseAfterConversion = await convertingVideoToHorizontal({
        userId: req.user.id,
        filename: `${video.videoData.videoId}.mp4`,
      });

      const bucketResponseByConvertedVideoUpload = await new Promise(
        (resolve, reject) => {
          fs.readFile(
            path.resolve(`./videos/${userId}/output-for-conversion.mp4`),
            {},
            async (err, buffer) => {
              if (err) {
                console.log(err);
                resolve({
                  status: "error",
                  message: "Error when reading a file from disk",
                });
              } else {
                await uploadFileToStorage({
                  folder: "converted-videos",
                  name: video.videoData.videoId,
                  buffer,
                  type: "video/mp4",
                  extension: ".mp4",
                  resolve,
                  socketInfo: {
                    userId: userId,
                    socketEmitName: "progressOfRequestInPublishing",
                    fileName: video.videoData.videoId,
                    eventName: "Uploading the converted video to the bucket",
                  },
                });
              }
            }
          );
        }
      );

      if (bucketResponseByConvertedVideoUpload.status === "error") {
        return res.status(200).json({
          message: bucketResponseByConvertedVideoUpload.message,
          status: "warning",
        });
      }

      socketInstance
        .io()
        .sockets.in(userId)
        .emit("progressOfRequestInPublishing", {
          event: "Just a little bit left",
          file: null,
        });

      await updateVideosBy({
        updateBy: "_id",
        value: video._id,
        objForSet: {
          "bucket.cloudConversionVideoLink":
            bucketResponseByConvertedVideoUpload.response.Location,
          "bucket.cloudConversionVideoPath":
            bucketResponseByConvertedVideoUpload.response.Key,
          "videoData.hasAudioTrack": responseAfterConversion.data.hasAudioTrack,
          apVideoHubArchive: true,
        },
      });

      const updatedVideo = await findVideoBy({
        searchBy: "videoData.videoId",
        value: +videoId,
      });

      await refreshMrssFiles();

      return res.status(200).json({
        message: "The video has been successfully converted",
        status: "success",
        apiData: updatedVideo,
      });
    } catch (err) {
      console.log(errorsHandler({ err, trace: "video.convert" }));
      return res
        .status(400)
        .json({ message: "Server side error", status: "error" });
    }
  });
});

router.post("/generateExcelFile", authMiddleware, generateExcelFile);

router.get("/findOneBy", async (req, res) => {
  try {
    const { searchBy, searchValue, lastAdded } = req.query;

    const apiData = await findVideoBy({
      ...(searchBy && { searchBy }),
      ...(searchValue && {
        value: searchBy === "videoData.videoId" ? +searchValue : searchValue,
      }),
      ...(lastAdded &&
        JSON.parse(lastAdded) === true && { lastAdded: JSON.parse(lastAdded) }),
    });

    if (!apiData) {
      return res.status(200).json({
        status: "warning",
        message: `No such video was found`,
      });
    }

    return res.status(200).json({
      apiData: {
        ...apiData._doc,
        ...(apiData.trelloData.researchers.find(
          (researcher) => researcher.main
        ) && {
          acquirerName: apiData.trelloData.researchers.find(
            (researcher) => researcher.main
          ).researcher.name,
        }),
      },
      status: "success",
      message: "Detailed video information received",
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "video.findOneBy" }));

    return res.status(400).json({
      status: "error",
      message: "Server side error",
    });
  }
});

router.get("/findCountByGroups", async (req, res) => {
  try {
    const brandSafeVideosCount30Days = await Video.aggregate([
      {
        $match: {
          isApproved: true,
          brandSafe: true,
          pubDate: {
            $exists: true,
            $gte: new Date(
              moment().subtract(30, "d").startOf("d").toISOString()
            ),
          },
        },
      },
      {
        $count: "brandSafeVideosCount",
      },
    ]);

    const socialMediaVideosCount30Days = await Video.aggregate([
      {
        $match: {
          isApproved: true,
          socialMedia: true,
          pubDate: {
            $exists: true,
            $gte: new Date(
              moment().subtract(30, "d").startOf("d").toISOString()
            ),
          },
        },
      },

      {
        $count: "socialMediaVideosCount",
      },
    ]);

    const reutersVideosCount30Days = await Video.aggregate([
      {
        $match: {
          isApproved: true,
          reuters: true,
          pubDate: {
            $exists: true,
            $gte: new Date(
              moment().subtract(30, "d").startOf("d").toISOString()
            ),
          },
        },
      },
      {
        $count: "reutersVideosCount",
      },
    ]);

    const apVideoHubVideosCount30Days = await Video.aggregate([
      {
        $match: {
          isApproved: true,
          apVideoHub: true,
          pubDate: {
            $exists: true,
            $gte: new Date(
              moment().subtract(30, "d").startOf("d").toISOString()
            ),
          },
          "videoData.hasAudioTrack": true,
          "videoData.duration": {
            $gte: 10,
            $lt: 300,
          },
        },
      },
      {
        $count: "apVideoHubVideosCount30Days",
      },
    ]);

    const apVideoHubVideosCount24Hours = await Video.aggregate([
      {
        $match: {
          isApproved: true,
          apVideoHub: true,
          pubDate: {
            $exists: true,
            $gte: new Date(
              moment().subtract(24, "h").startOf("d").toISOString()
            ),
          },
        },
      },
      {
        $count: "apVideoHubVideosCount24Hours",
      },
    ]);

    const apiData = {
      brandSafeVideosCount: !!brandSafeVideosCount30Days[0]
        ?.brandSafeVideosCount
        ? brandSafeVideosCount30Days[0].brandSafeVideosCount
        : 0,
      socialMediaVideosCount: !!socialMediaVideosCount30Days[0]
        ?.socialMediaVideosCount
        ? socialMediaVideosCount30Days[0].socialMediaVideosCount
        : 0,
      reutersVideosCount: !!reutersVideosCount30Days[0]?.reutersVideosCount
        ? reutersVideosCount30Days[0].reutersVideosCount
        : 0,
      apVideoHubVideosCount30Days: !!apVideoHubVideosCount30Days[0]
        ?.apVideoHubVideosCount30Days
        ? apVideoHubVideosCount30Days[0].apVideoHubVideosCount30Days
        : 0,
      apVideoHubVideosCount24Hours: !!apVideoHubVideosCount24Hours[0]
        ?.apVideoHubVideosCount24Hours
        ? apVideoHubVideosCount24Hours[0].apVideoHubVideosCount24Hours
        : 0,
    };

    return res.status(200).json({
      status: "success",
      message: "Count videos successfully received",
      apiData,
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "video.findCountByGroups" }));

    return res.status(400).json({
      status: "error",
      message: "Server side error",
    });
  }
});

router.get("/findAll", authMiddleware, async (req, res) => {
  const {
    category,
    tag,
    location,
    page,
    isApproved,
    limit,
    wasRemovedFromPublication,
    personal,
    forLastDays,
    onlyWhereAcquirer,
  } = req.query;

  if ((limit && !page) || (!limit && page)) {
    return res
      .status(200)
      .json({ message: "Missing parameter for pagination", status: "warning" });
  }

  try {
    let videos = await getAllVideos({
      ...(category && { category }),
      ...(tag && { tag }),
      ...(location && { location }),
      ...(forLastDays && { forLastDays: +forLastDays }),
      ...(isApproved &&
        typeof JSON.parse(isApproved) === "boolean" && {
          isApproved: JSON.parse(isApproved),
        }),
      ...(personal &&
        !!JSON.parse(personal) && {
          researcher: {
            searchBy: "researcher",
            value: convertInMongoIdFormat({ string: req.user.id }),
            ...(onlyWhereAcquirer &&
              typeof JSON.parse(onlyWhereAcquirer) === "boolean" && {
                isAcquirer: JSON.parse(onlyWhereAcquirer),
              }),
          },
        }),
      ...(wasRemovedFromPublication &&
        typeof JSON.parse(wasRemovedFromPublication) === "boolean" && {
          wasRemovedFromPublication: JSON.parse(wasRemovedFromPublication),
        }),
    });

    let count = 0;
    let pageCount = 0;

    if (limit && page) {
      count = videos.length;
      pageCount = Math.ceil(count / limit);
      const skip = (page - 1) * limit;

      videos = await getAllVideos({
        category,
        tag,
        location,
        ...(isApproved &&
          typeof JSON.parse(isApproved) === "boolean" && {
            isApproved: JSON.parse(isApproved),
          }),
        ...(personal &&
          typeof JSON.parse(personal) === "boolean" && {
            researcher: {
              searchBy: "researcher",
              value: convertInMongoIdFormat({ string: req.user.id }),
            },
          }),
        ...(wasRemovedFromPublication &&
          typeof JSON.parse(wasRemovedFromPublication) === "boolean" && {
            wasRemovedFromPublication: JSON.parse(wasRemovedFromPublication),
          }),
        limit,
        skip,
        sort: { "videoData.videoId": -1 },
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
      videos,
    };

    return res.status(200).json({
      apiData,
      status: "success",
      message: "The list of videos is received",
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "video.findAll" }));

    return res.status(400).json({
      status: "error",
      message: "Server side error",
    });
  }
});

router.get("/findReadyForPublication", authMiddleware, async (req, res) => {
  try {
    const videosReadyForPublication = await findReadyForPublication();

    const apiData = videosReadyForPublication.map((video) => {
      const acquirerData = video.trelloData.researchers.find((obj) => obj.main);

      return {
        _id: video._id,
        videoId: video.videoData.videoId,
        name:
          video.trelloData.trelloCardName.length >= 20
            ? video.trelloData.trelloCardName.substring(0, 20) + "..."
            : video.trelloData.trelloCardName,
        priority: video.trelloData.priority,
        hasAdvance: video?.vbForm?.refFormId?.advancePayment ? true : false,
        acquirer: {
          avatarUrl: acquirerData.researcher.avatarUrl,
          name: acquirerData.researcher.name,
        },
      };
    });

    return res.status(200).json({
      status: "success",
      message: "The list of videos ready for publication has been received",
      apiData,
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "video.findReadyForPublication" }));

    return res.status(400).json({
      message: "Server-side error",
      status: "error",
    });
  }
});

router.get("/findByIsBrandSafe", authMiddleware, async (req, res) => {
  try {
    const videosForSocialMedia = await findByIsBrandSafe();

    return res.status(200).json(videosForSocialMedia);
  } catch (err) {
    console.log(errorsHandler({ err, trace: "video.findByIsBrandSafe" }));

    return res.status(400).json({
      message: "server side error",
    });
  }
});

router.get("/findByFixed", authMiddleware, async (req, res) => {
  try {
    const videoPendingChanges = await findByFixed();

    const apiData = videoPendingChanges.map((video) => {
      const acquirerData = video.trelloData.researchers.find((obj) => obj.main);

      return {
        _id: video._id,
        videoId: video.videoData.videoId,
        name:
          video.trelloData.trelloCardName.length >= 20
            ? video.trelloData.trelloCardName.substring(0, 20) + "..."
            : video.trelloData.trelloCardName,
        priority: video.trelloData.priority,
        hasAdvance: video?.vbForm?.refFormId?.advancePayment ? true : false,
        acquirer: {
          avatarUrl: acquirerData.researcher.avatarUrl,
          name: acquirerData.researcher.name,
        },
      };
    });

    return res.status(200).json({
      status: "success",
      message: "The list of videos awaiting editing has been received",
      apiData,
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "video.findByFixed" }));

    res.status(400).json({
      status: "error",
      message: "server side error",
    });
  }
});

router.get("/findByAuthor", authMiddleware, async (req, res) => {
  try {
    const { authorId } = req.query;

    let userId = null;

    if (authorId) {
      userId = authorId;
    } else {
      userId = req.user.id;
    }

    const videosWithVbCode = await getAllVideos({
      vbFormExists: true,
      isApproved: true,
      fieldsInTheResponse: [
        "videoData.title",
        "videoData.videoId",
        "bucket.cloudScreenLink",
      ],
    });

    let videos = await Promise.all(
      videosWithVbCode.map(async (video) => {
        console.log(video?.vbForm?.sender?._id, userId);

        if (video?.vbForm?.sender?._id.toString() === userId.toString()) {
          const sales = await getAllSales({ videoId: video.videoData.videoId });

          let revenue = 0;

          if (sales.length && !!video?.vbForm?.refFormId?.percentage) {
            revenue = sales.reduce(
              (acc, sale) =>
                acc + (sale.amount * video.vbForm.refFormId.percentage) / 100,
              0
            );
          }

          return {
            title: video.videoData.title,
            videoId: video.videoData.videoId,
            screenPath: video.bucket.cloudScreenLink,
            agreementDate: moment(video?.vbForm?.createdAt).format(
              "D MMMM YYYY, HH:mm:ss Z"
            ),
            videoByThisAuthor: true,
            revenue: +revenue.toFixed(2),
            percentage: video?.vbForm?.refFormId?.percentage
              ? video.vbForm.refFormId.percentage
              : 0,
            advancePayment: video?.vbForm?.refFormId?.advancePayment
              ? video.vbForm.refFormId.advancePayment
              : 0,
          };
        } else {
          return { videoByThisAuthor: false };
        }
      })
    );

    videos = videos.reduce(
      (res, videoData) => {
        if (videoData.videoByThisAuthor) {
          res["videosByThisAuthor"].push(videoData);
        } else {
          res["videosIsNotByThisAuthor"].push(videoData);
        }
        return res;
      },
      { videosByThisAuthor: [], videosIsNotByThisAuthor: [] }
    );

    return res.status(200).json({
      message: `Videos with statistics received`,
      status: "success",
      apiData: videos.videosByThisAuthor,
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "video.findByAuthor" }));
    return res.status(400).json({
      message: `Server side error`,
      status: "error",
    });
  }
});

router.get("/findRelated", findRelated);

router.get("/findOneById/:videoId", async (req, res) => {
  try {
    const { videoId } = req.params;

    const video = await findVideoBy({
      searchBy: "videoData.videoId",
      value: +videoId,
    });

    if (!video) {
      return res.status(200).json({
        message: `Video with id "${videoId}" was not found`,
        status: "warning",
      });
    }

    return res.status(200).json({
      message: `Video with id "${videoId}" was found`,
      status: "success",
      apiData: video,
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "video.findOneById" }));
    return res.status(400).json({
      message: `Server side error`,
      status: "error",
    });
  }
});

router.get("/findNext/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const video = await findNextVideoInFeed({ currentVideoId: +id });

    console.log(video, 88);

    if (!video.length) {
      return res.status(200).json({
        status: "warning",
        message: "This is the last video",
      });
    }

    return res.status(200).json({
      apiData: video[0],
      status: "success",
      message: "Video successfully received",
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "video.findNext" }));

    return res.status(400).json({
      status: "error",
      message: "Server side error",
    });
  }
});

router.get("/findPrev/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const video = await findPrevVideoInFeed({ currentVideoId: +id });

    if (!video.length) {
      return res.status(200).json({
        status: "warning",
        message: "This is the very first video",
      });
    }

    return res.status(200).json({
      apiData: video[0],
      status: "success",
      message: "Video successfully received",
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "video.findPrev" }));

    return res.status(400).json({
      status: "error",
      message: "Server side error",
    });
  }
});

router.patch(
  "/update/:id",
  authMiddleware,

  multer({ storage: storage }).fields([
    {
      name: "video",
      maxCount: 1,
    },
    {
      name: "screen",
      maxCount: 1,
    },
  ]),

  async (req, res) => {
    const { id: videoId } = req.params;

    if (!videoId) {
      return res
        .status(200)
        .json({ message: 'missing "video id" parameter', status: "warning" });
    }

    const {
      originalLink,
      vbCode,
      researchers,
      title,
      desc,
      creditTo,
      tags,
      category,
      categoryReuters,
      city,
      country,
      date,
      brandSafe,
      socialMedia,
      reuters,
      apVideoHub,
      commentToAdmin,
      acquirerName,
      acquirerPaidAdvance,
      advanceToResearcher,
    } = req.body;

    if (
      !originalLink ||
      !JSON.parse(researchers).length ||
      !title ||
      !desc ||
      !JSON.parse(tags).length ||
      !JSON.parse(category).length ||
      !categoryReuters ||
      !city ||
      !country ||
      !date
    ) {
      return res.status(200).json({
        message: "Missing values for adding a new video",
        status: "warning",
      });
    }

    if (!JSON.parse(researchers).find((name) => name === acquirerName)) {
      return res.status(200).json({
        message: "The acquirer is not added to the list",
        status: "warning",
      });
    }

    const { video: reqVideo, screen: reqScreen } = req.files;

    try {
      const video = await findVideoBy({
        searchBy: "videoData.videoId",
        value: +videoId,
      });

      if (!video) {
        return res.status(200).json({
          message: `video with id "${videoId}" not found`,
          status: "warning",
        });
      }

      if (!vbCode && !!video.vbForm) {
        await updateVideoById({
          videoId: +videoId,
          dataToDelete: {
            needToBeFixed: 1,
            vbForm: 1,
            ...(!creditTo && { "videoData.creditTo": 1 }),
          },
          dataToUpdate: {
            exclusivity: false,
          },
        });
      }

      if (vbCode) {
        const vbForm = await findOne({
          searchBy: "formId",
          param: `VB${vbCode}`,
        });

        if (!vbForm) {
          return res.status(200).json({
            message: `The form with the vb code ${vbCode} was not found in the database`,
            status: "warning",
          });
        }

        const videoWithVBForm = await findVideoBy({
          searchBy: "vbForm",
          value: vbForm._id,
        });

        if (
          videoWithVBForm &&
          videoWithVBForm._id.toString() !== video._id.toString()
        ) {
          return res.status(200).json({
            message: 'a video with such a "VB code" is already in the database',
            status: "warning",
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            vbForm: vbForm._id,
            exclusivity: !vbForm?.refFormId
              ? true
              : vbForm.refFormId.exclusivity
              ? true
              : false,
          },
        });
      }

      if (reqVideo) {
        if (path.extname(reqVideo[0].originalname) !== ".mp4") {
          return res.status(200).json({
            message: `Incorrect video extension`,
            status: "warning",
          });
        }

        const responseAfterConversion = await convertingVideoToHorizontal({
          buffer: reqVideo[0].buffer,
          userId: req.user.id,
          filename: reqVideo[0].originalname,
        });

        const bucketResponseByConvertedVideoUpload = await new Promise(
          (resolve, reject) => {
            fs.readFile(
              path.resolve(`./videos/${req.user.id}/output-for-conversion.mp4`),
              {},
              async (err, buffer) => {
                if (err) {
                  console.log(err);
                  resolve({
                    status: "error",
                    message: "Error when reading a file from disk",
                  });
                } else {
                  await uploadFileToStorage({
                    folder: "converted-videos",
                    name: videoId,
                    buffer,
                    type: reqVideo[0].mimetype,
                    extension: path.extname(reqVideo[0].originalname),
                    resolve,
                    socketInfo: {
                      userId: req.user.id,
                      socketEmitName: "progressOfRequestInPublishing",
                      fileName: reqVideo[0].originalname,
                      eventName: "Uploading the converted video to the bucket",
                    },
                  });
                }
              }
            );
          }
        );

        if (bucketResponseByConvertedVideoUpload.status === "error") {
          return res.status(200).json({
            message: bucketResponseByConvertedVideoUpload.message,
            status: "warning",
          });
        }

        const bucketResponseByVideoUpload = await new Promise(
          async (resolve, reject) => {
            await uploadFileToStorage({
              folder: "videos",
              name: videoId,
              buffer: reqVideo[0].buffer,
              type: reqVideo[0].mimetype,
              extension: path.extname(reqVideo[0].originalname),
              resolve,
              socketInfo: {
                userId: req.user.id,
                socketEmitName: "progressOfRequestInPublishing",
                fileName: reqVideo[0].originalname,
                eventName: "Uploading video to the bucket",
              },
            });
          }
        );

        if (bucketResponseByVideoUpload.status === "error") {
          return res.status(200).json({
            message: bucketResponseByVideoUpload.message,
            status: "warning",
          });
        }

        const duration = Math.floor(getDurationFromBuffer(reqVideo[0].buffer));

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            "bucket.cloudVideoLink":
              bucketResponseByVideoUpload.response.Location,
            "bucket.cloudVideoPath": bucketResponseByVideoUpload.response.Key,
            "bucket.cloudConversionVideoLink":
              bucketResponseByConvertedVideoUpload.response.Location,
            "bucket.cloudConversionVideoPath":
              bucketResponseByConvertedVideoUpload.response.Key,
            "videoData.duration": duration,
            "videoData.hasAudioTrack":
              responseAfterConversion.data.hasAudioTrack,
          },
        });
      }

      if (reqScreen) {
        if (path.extname(reqScreen[0].originalname) !== ".jpg") {
          return res.status(400).json({
            message: `Incorrect screen extension`,
            status: "warning",
          });
        }

        const bucketResponseByScreenUpload = await new Promise(
          async (resolve, reject) => {
            await uploadFileToStorage({
              folder: "screens",
              name: videoId,
              buffer: reqScreen[0].buffer,
              type: reqScreen[0].mimetype,
              extension: path.extname(reqScreen[0].originalname),
              resolve,
              socketInfo: {
                userId: req.user.id,
                socketEmitName: "progressOfRequestInPublishing",
                fileName: reqScreen[0].originalname,
                eventName: "Uploading screen to the bucket",
              },
            });
          }
        );

        if (bucketResponseByScreenUpload.status === "error") {
          return res.status(200).json({
            message: bucketResponseByScreenUpload.message,
            status: "warning",
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            "bucket.cloudScreenLink":
              bucketResponseByScreenUpload.response.Location,
            "bucket.cloudScreenPath": bucketResponseByScreenUpload.response.Key,
          },
        });
      }

      socketInstance
        .io()
        .sockets.in(req.user.id)
        .emit("progressOfRequestInPublishing", {
          event: "Just a little bit left",
          file: null,
        });

      if (!country && video.country && !video.countryCode) {
        const countryCode = await findTheCountryCodeByName(
          video.videoData.country
        );

        if (!countryCode) {
          return res.status(400).json({
            message: "Error when searching for the country code",
            status: "error",
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            "videoData.countryCode": countryCode,
          },
        });
      }

      if (country) {
        const countryCode = await findTheCountryCodeByName(country);

        if (!countryCode) {
          return res.status(200).json({
            message: "Error when searching for the country code",
            status: "warning",
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            "videoData.country": country,
            "videoData.countryCode": countryCode,
          },
        });
      }

      if (JSON.parse(brandSafe) === false) {
        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            brandSafe: JSON.parse(brandSafe),
            publishedInSocialMedia: false,
          },
        });
      } else {
        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            brandSafe: JSON.parse(brandSafe),
          },
        });
      }

      const researchersList = await findUsersByValueList({
        param: "name",
        valueList: JSON.parse(researchers),
      });

      let acquirer = null;

      if (acquirerName) {
        acquirer = await getUserBy({
          searchBy: "name",
          value: acquirerName,
        });
      }

      const researcherWithPaidAdvance = video.trelloData.researchers.find(
        (researcher) => researcher.advanceHasBeenPaid
      );

      if (
        !!researcherWithPaidAdvance &&
        researcherWithPaidAdvance.researcher._id.toString() !==
          acquirer._id.toString()
      ) {
        return res.status(200).json({
          message: "You cannot change the acquirer for this video.",
          status: "warning",
        });
      }

      const researchersListForCreatingVideo =
        defineResearchersListForCreatingVideo({
          mainResearcher: acquirer ? acquirer : null,
          allResearchersList: researchersList,
          advanceToResearcher: +advanceToResearcher,
          ...(!!researcherWithPaidAdvance && { researcherWithPaidAdvance }),
        });

      await updateVideoById({
        videoId: +videoId,
        dataToUpdate: {
          "videoData.originalVideoLink": originalLink,
          "videoData.title": title,
          "videoData.description": desc,
          ...(creditTo && { "videoData.creditTo": creditTo }),
          "videoData.tags": JSON.parse(tags).map((el) => {
            return el.trim();
          }),
          "videoData.category": JSON.parse(category),
          "videoData.categoryReuters": categoryReuters,
          "videoData.city": city,
          ...(commentToAdmin && { commentToAdmin }),
          "videoData.date": JSON.parse(date),
          "trelloData.researchers": researchersListForCreatingVideo,
          ...(video.isApproved && { lastChange: new Date().toGMTString() }),
          reuters: JSON.parse(reuters),
          apVideoHub: JSON.parse(apVideoHub),
          socialMedia: JSON.parse(socialMedia),
        },
      });

      const updatedVideo = await findVideoBy({
        searchBy: "videoData.videoId",
        value: +videoId,
      });

      if (!!acquirerPaidAdvance) {
        if (!updatedVideo?.vbForm?.sender) {
          return res.status(200).json({
            message: "This video has no author",
            status: "warning",
          });
        }

        if (!!updatedVideo?.vbForm?.advancePaymentReceived) {
          return res.status(200).json({
            message: "The author has already been paid an advance",
            status: "warning",
          });
        }

        if (!acquirerName) {
          return res.status(200).json({
            message: "No acquirer found to record a note",
            status: "warning",
          });
        }

        if (
          +acquirerPaidAdvance !== updatedVideo.vbForm.refFormId.advancePayment
        ) {
          return res.status(200).json({
            message: "The amount does not match the advance for the author",
            status: "warning",
          });
        }

        const acquirerInTheVideoList = updatedVideo.trelloData.researchers.find(
          (obj) => obj.researcher._id.toString() === acquirer._id.toString()
        );

        if (!acquirerInTheVideoList) {
          return res.status(200).json({
            message:
              "This acquirer is not in the list of researchers for this video. Save the acquirer, and then add the amount",
            status: "warning",
          });
        }

        await updateUser({
          userId: acquirer._id,
          objDBForIncrement: {
            note: +acquirerPaidAdvance,
          },
        });

        await updateVbFormBy({
          updateBy: "_id",
          value: updatedVideo.vbForm._id,
          dataForUpdate: { advancePaymentReceived: true },
        });

        await updateVideoBy({
          searchBy: "_id",
          searchValue: updatedVideo._id,
          dataToInc: { balance: -acquirerPaidAdvance },
        });

        await createNewPayment({
          user: updatedVideo.vbForm.sender._id,
          purpose: ["advance"],
          amount: {
            advance: +acquirerPaidAdvance,
          },
        });

        const bodyForEmail = {
          emailFrom: '"«VIRALBEAR» LLC" <info@viralbear.media>',
          emailTo: updatedVideo.vbForm.sender.email,
          subject: "Payment of the amount",
          html: `
          Hello ${updatedVideo.vbForm.sender.name}.<br/>
          ViralBear just paid you: ${acquirerPaidAdvance}$!<br/>
          Have a good day!
          `,
        };

        sendEmail(bodyForEmail);
      }

      if (video.isApproved && video.brandSafe !== JSON.parse(brandSafe)) {
        console.log("change");

        //меняем кастомное поле "brand safe" в карточке trello
        await updateCustomFieldByTrelloCard(
          video.trelloData.trelloCardId,
          process.env.TRELLO_CUSTOM_FIELD_BRAND_SAFE,
          {
            idValue: JSON.parse(brandSafe)
              ? "6363888c65a44802954d88e5"
              : "6363888c65a44802954d88e4",
          }
        );
      }

      if (updatedVideo.isApproved === true) {
        await refreshMrssFiles();
      }

      const { _id, __v, updatedAt, ...data } = updatedVideo._doc;

      return res.status(200).json({
        message: `Video with id "${videoId}" has been successfully updated`,
        status: "success",
        apiData: {
          ...data,
          ...(data.trelloData.researchers.find(
            (researcher) => researcher.main
          ) && {
            acquirerName: data.trelloData.researchers.find(
              (researcher) => researcher.main
            ).researcher.name,
          }),
        },
      });
    } catch (err) {
      console.log(errorsHandler({ err, trace: "video.update" }));

      return res.status(400).json({
        message: err?.message ? err?.message : "Server side error",
        status: "error",
      });
    }
  }
);

router.patch("/updateByValue", authMiddleware, async (req, res) => {
  try {
    const { searchBy, searchValue, refreshFeeds } = req.query;
    const { isApproved, wasRemovedFromPublication } = req.body;

    await updateVideoBy({
      searchBy,
      searchValue,
      dataToUpdate: {
        ...(typeof isApproved === "boolean" && { isApproved }),
        ...(typeof wasRemovedFromPublication === "boolean" && {
          wasRemovedFromPublication,
        }),
      },
    });

    if (refreshFeeds && JSON.parse(refreshFeeds)) {
      await refreshMrssFiles();
    }

    return res.status(200).json({
      message: `Video has been successfully updated`,
      status: "success",
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "video.updateByValue" }));

    return res.status(400).json({
      message: err?.message ? err?.message : "Server side error",
      status: "error",
    });
  }
});

router.patch(
  "/fixedVideo/:id",
  authMiddleware,

  multer({ storage: storage }).fields([
    {
      name: "video",
      maxCount: 1,
    },
    {
      name: "screen",
      maxCount: 1,
    },
  ]),

  async (req, res) => {
    const { id: videoId } = req.params;

    if (!videoId) {
      return res
        .status(200)
        .json({ message: 'missing "video id" parameter', status: "warning" });
    }

    const {
      originalLink,
      vbCode,
      researchers,
      title,
      desc,
      creditTo,
      tags,
      category,
      categoryReuters,
      city,
      country,
      date,
      brandSafe,
      socialMedia,
      reuters,
      apVideoHub,
      commentToAdmin,
      acquirerName,
      advanceToResearcher,
    } = req.body;

    if (
      !originalLink ||
      !JSON.parse(researchers).length ||
      !title ||
      !desc ||
      !JSON.parse(tags).length ||
      !JSON.parse(category).length ||
      !categoryReuters ||
      !city ||
      !country ||
      !date
    ) {
      return res.status(200).json({
        message: "Missing values for adding a new video",
        status: "warning",
      });
    }

    if (!JSON.parse(researchers).find((name) => name === acquirerName)) {
      return res.status(200).json({
        message: "The acquirer is not added to the list",
        status: "warning",
      });
    }

    const { video: reqVideo, screen: reqScreen } = req.files;

    try {
      const video = await findVideoBy({
        searchBy: "videoData.videoId",
        value: +videoId,
      });

      if (!video) {
        return res.status(200).json({
          message: `video with id "${videoId}" not found`,
          status: "warning",
        });
      }

      if (!vbCode && !!video.vbForm) {
        await updateVideoById({
          videoId: +videoId,
          dataToDelete: {
            needToBeFixed: 1,
            vbForm: 1,
            ...(!creditTo && { "videoData.creditTo": 1 }),
          },
          dataToUpdate: {
            exclusivity: false,
          },
        });
      }

      if (vbCode) {
        const vbForm = await findOne({
          searchBy: "formId",
          param: `VB${vbCode}`,
        });

        if (!vbForm) {
          return res.status(200).json({
            message: `The form with the vb code ${vbCode} was not found in the database`,
            status: "warning",
          });
        }

        const videoWithVBForm = await findVideoBy({
          searchBy: "vbForm",
          value: vbForm._id,
        });

        if (
          videoWithVBForm &&
          videoWithVBForm._id.toString() !== video._id.toString()
        ) {
          return res.status(200).json({
            message: 'a video with such a "VB code" is already in the database',
            status: "warning",
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            vbForm: vbForm._id,
            exclusivity: !vbForm?.refFormId
              ? true
              : vbForm.refFormId.exclusivity
              ? true
              : false,
          },
        });
      }

      if (reqVideo) {
        if (path.extname(reqVideo[0].originalname) !== ".mp4") {
          return res.status(200).json({
            message: `Incorrect video extension`,
            status: "warning",
          });
        }

        const responseAfterConversion = await convertingVideoToHorizontal({
          buffer: reqVideo[0].buffer,
          userId: req.user.id,
          filename: reqVideo[0].originalname,
        });

        const bucketResponseByConvertedVideoUpload = await new Promise(
          (resolve, reject) => {
            fs.readFile(
              path.resolve(`./videos/${req.user.id}/output-for-conversion.mp4`),
              {},
              async (err, buffer) => {
                if (err) {
                  console.log(err);
                  resolve({
                    status: "error",
                    message: "Error when reading a file from disk",
                  });
                } else {
                  await uploadFileToStorage({
                    folder: "converted-videos",
                    name: videoId,
                    buffer,
                    type: reqVideo[0].mimetype,
                    extension: path.extname(reqVideo[0].originalname),
                    resolve,
                    socketInfo: {
                      userId: req.user.id,
                      socketEmitName: "progressOfRequestInPublishing",
                      fileName: reqVideo[0].originalname,
                      eventName: "Uploading the converted video to the bucket",
                    },
                  });
                }
              }
            );
          }
        );

        if (bucketResponseByConvertedVideoUpload.status === "error") {
          return res.status(200).json({
            message: bucketResponseByConvertedVideoUpload.message,
            status: "warning",
          });
        }

        const bucketResponseByVideoUpload = await new Promise(
          async (resolve, reject) => {
            await uploadFileToStorage({
              folder: "videos",
              name: videoId,
              buffer: reqVideo[0].buffer,
              type: reqVideo[0].mimetype,
              extension: path.extname(reqVideo[0].originalname),
              resolve,
              socketInfo: {
                userId: req.user.id,
                socketEmitName: "progressOfRequestInPublishing",
                fileName: reqVideo[0].originalname,
                eventName: "Uploading video to the bucket",
              },
            });
          }
        );

        if (bucketResponseByVideoUpload.status === "error") {
          return res.status(200).json({
            message: bucketResponseByVideoUpload.message,
            status: "warning",
          });
        }

        const duration = Math.floor(getDurationFromBuffer(reqVideo[0].buffer));

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            "bucket.cloudVideoLink":
              bucketResponseByVideoUpload.response.Location,
            "bucket.cloudVideoPath": bucketResponseByVideoUpload.response.Key,
            "bucket.cloudConversionVideoLink":
              bucketResponseByConvertedVideoUpload.response.Location,
            "bucket.cloudConversionVideoPath":
              bucketResponseByConvertedVideoUpload.response.Key,
            "videoData.duration": duration,
            "videoData.hasAudioTrack":
              responseAfterConversion.data.hasAudioTrack,
          },
        });
      }

      if (reqScreen) {
        if (path.extname(reqScreen[0].originalname) !== ".jpg") {
          return res.status(400).json({
            message: `Incorrect screen extension`,
            status: "warning",
          });
        }

        const bucketResponseByScreenUpload = await new Promise(
          async (resolve, reject) => {
            await uploadFileToStorage({
              folder: "screens",
              name: videoId,
              buffer: reqScreen[0].buffer,
              type: reqScreen[0].mimetype,
              extension: path.extname(reqScreen[0].originalname),
              resolve,
              socketInfo: {
                userId: req.user.id,
                socketEmitName: "progressOfRequestInPublishing",
                fileName: reqScreen[0].originalname,
                eventName: "Uploading screen to the bucket",
              },
            });
          }
        );

        if (bucketResponseByScreenUpload.status === "error") {
          return res.status(200).json({
            message: bucketResponseByScreenUpload.message,
            status: "warning",
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            "bucket.cloudScreenLink":
              bucketResponseByScreenUpload.response.Location,
            "bucket.cloudScreenPath": bucketResponseByScreenUpload.response.Key,
          },
        });
      }

      socketInstance
        .io()
        .sockets.in(req.user.id)
        .emit("progressOfRequestInPublishing", {
          event: "Just a little bit left",
          file: null,
        });

      if (!country && video.country && !video.countryCode) {
        const countryCode = await findTheCountryCodeByName(
          video.videoData.country
        );

        if (!countryCode) {
          return res.status(400).json({
            message: "Error when searching for the country code",
            status: "error",
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            "videoData.countryCode": countryCode,
          },
        });
      }

      if (country) {
        const countryCode = await findTheCountryCodeByName(country);

        if (!countryCode) {
          return res.status(400).json({
            message: "Error when searching for the country code",
            status: "error",
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            "videoData.country": country,
            "videoData.countryCode": countryCode,
          },
        });
      }

      if (JSON.parse(brandSafe) === false) {
        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            brandSafe: JSON.parse(brandSafe),
            publishedInSocialMedia: false,
          },
        });
      } else {
        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            brandSafe: JSON.parse(brandSafe),
          },
        });
      }

      const researchersList = await findUsersByValueList({
        param: "name",
        valueList: JSON.parse(researchers),
      });

      let acquirer = null;

      if (acquirerName) {
        acquirer = await getUserBy({
          searchBy: "name",
          value: acquirerName,
        });
      }

      const researcherWithPaidAdvance = video.trelloData.researchers.find(
        (researcher) => researcher.advanceHasBeenPaid
      );

      if (
        !!researcherWithPaidAdvance &&
        researcherWithPaidAdvance.researcher._id.toString() !==
          acquirer._id.toString()
      ) {
        return res.status(200).json({
          message: "You cannot change the acquirer for this video.",
          status: "warning",
        });
      }

      const researchersListForCreatingVideo =
        defineResearchersListForCreatingVideo({
          mainResearcher: acquirer ? acquirer : null,
          allResearchersList: researchersList,
          advanceToResearcher: +advanceToResearcher,
          ...(!!researcherWithPaidAdvance && { researcherWithPaidAdvance }),
        });

      await updateVideoById({
        videoId: +videoId,
        dataToUpdate: {
          "videoData.originalVideoLink": originalLink,
          "videoData.title": title,
          "videoData.description": desc,
          ...(creditTo && { "videoData.creditTo": creditTo }),
          "videoData.tags": JSON.parse(tags).map((el) => {
            return el.trim();
          }),
          "videoData.category": JSON.parse(category),
          "videoData.categoryReuters": categoryReuters,
          "videoData.city": city,
          ...(commentToAdmin && { commentToAdmin }),
          "videoData.date": JSON.parse(date),
          "trelloData.researchers": researchersListForCreatingVideo,
          ...(video.isApproved && { lastChange: new Date().toGMTString() }),
          reuters: JSON.parse(reuters),
          apVideoHub: JSON.parse(apVideoHub),
          socialMedia: JSON.parse(socialMedia),
        },
      });

      await Video.updateOne(
        { "videoData.videoId": +videoId },
        { $unset: { needToBeFixed: 1 } }
      );

      const updatedVideo = await findVideoBy({
        searchBy: "videoData.videoId",
        value: +videoId,
      });

      if (video.isApproved && video.brandSafe !== JSON.parse(brandSafe)) {
        //меняем кастомное поле "brand safe" в карточке trello
        await updateCustomFieldByTrelloCard(
          video.trelloData.trelloCardId,
          process.env.TRELLO_CUSTOM_FIELD_BRAND_SAFE,
          {
            idValue: JSON.parse(brandSafe)
              ? "6363888c65a44802954d88e5"
              : "6363888c65a44802954d88e4",
          }
        );
      }

      if (updatedVideo.isApproved === true) {
        await refreshMrssFiles();
      }

      const { _id, __v, updatedAt, ...data } = updatedVideo._doc;

      return res.status(200).json({
        message: `Video with id "${videoId}" has been successfully updated`,
        status: "success",
        apiData: {
          ...data,
          ...(data.trelloData.researchers.find(
            (researcher) => researcher.main
          ) && {
            acquirerName: data.trelloData.researchers.find(
              (researcher) => researcher.main
            ).researcher.name,
          }),
        },
      });
    } catch (err) {
      console.log(errorsHandler({ err, trace: "video.fixedVideo" }));
      return res
        .status(400)
        .json({ message: "Server side error", status: "error" });
    }
  }
);

router.patch("/addCommentForFixed", authMiddleware, async (req, res) => {
  try {
    const { comment, videoId } = req.body;

    const video = await findVideoBy({
      searchBy: "videoData.videoId",
      value: videoId,
    });

    if (!video) {
      return res.status(200).json({
        message: `Video with id "${videoId}" was not found`,
        status: "warning",
      });
    }

    await video.updateOne({
      needToBeFixed: {
        comment,
      },
    });

    const updatedVideo = await findVideoBy({
      searchBy: "videoData.videoId",
      value: videoId,
    });

    socketInstance.io().emit("editorPanelChanges", {
      event: "fixCard",
    });

    return res.status(200).json({
      status: "success",
      message: "Edits added to the video",
      apiData: updatedVideo,
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "video.addCommentForFixed" }));
    return res.status(400).json({
      status: "success",
      message: "Server-side error",
    });
  }
});

router.patch(
  "/publishing/:id",
  authMiddleware,
  multer({ storage: storage }).fields([
    {
      name: "video",
      maxCount: 1,
    },
    {
      name: "screen",
      maxCount: 1,
    },
  ]),
  async (req, res) => {
    const { id: videoId } = req.params;

    const { code } = req.query;

    const {
      originalLink,
      vbCode,
      researchers,
      title,
      desc,
      creditTo,
      tags,
      category,
      categoryReuters,
      city,
      country,
      date,
      brandSafe,
      reuters,
      apVideoHub,
      socialMedia,
      acquirerName,
      acquirerPaidAdvance,
      advanceToResearcher,
    } = req.body;

    if (
      !originalLink ||
      !JSON.parse(researchers).length ||
      !title ||
      !desc ||
      !JSON.parse(tags).length ||
      !JSON.parse(category).length ||
      !categoryReuters ||
      !city ||
      !country ||
      !date
    ) {
      return res.status(200).json({
        message: "Missing values for adding a new video",
        status: "warning",
      });
    }

    if (!JSON.parse(researchers).find((name) => name === acquirerName)) {
      return res.status(200).json({
        message: "The acquirer is not added to the list",
        status: "warning",
      });
    }

    const { video: reqVideo, screen: reqScreen } = req.files;

    const userId = req.user.id;

    try {
      const authUser = await getUserBy({
        searchBy: "_id",
        value: mongoose.Types.ObjectId(userId),
      });

      const video = await findVideoBy({
        searchBy: "videoData.videoId",
        value: +videoId,
      });

      if (!video) {
        return res.status(404).json({
          message: `Video with id "${videoId}" was not found`,
          status: "warning",
        });
      }

      if (video.isApproved === true) {
        return res.status(200).json({
          message: `The video with id "${videoId}" has already been published`,
          status: "warning",
        });
      }

      if (video.needToBeFixed) {
        return res.status(200).json({
          message: `Before publishing, you need to make edits!`,
          status: "warning",
        });
      }

      if (
        !!JSON.parse(socialMedia) &&
        process.env.MODE === "production" &&
        (!video?.uploadedToFb || !video?.uploadedToYoutube)
      ) {
        let stream = null;

        if (!!reqVideo) {
          stream = streamifier.createReadStream(reqVideo[0].buffer);
        } else {
          const resBucket = await new Promise((resolve, reject) => {
            storageInstance.getObject(
              {
                Bucket: process.env.YANDEX_CLOUD_BUCKET_NAME,
                Key: video.bucket.cloudVideoPath,
              },
              (err, data) => {
                if (err) {
                  console.log(err);
                  reject(err);
                }
                resolve({ length: data.ContentLength, buffer: data.Body });
              }
            );
          });
          stream = streamifier.createReadStream(resBucket.buffer);
        }

        if (!video?.uploadedToYoutube) {
          const SCOPES = ["https://www.googleapis.com/auth/youtube"];

          const responseAfterUploadOnYoutube = await new Promise(
            (resolve, reject) => {
              if (!authUser.rt) {
                if (!code) {
                  const authUrl = googleApiOAuth2Instance.generateAuthUrl({
                    access_type: "offline",
                    prompt: "consent",
                    scope: SCOPES,
                  });

                  return res.status(200).json({
                    status: "redirect",
                    apiData: authUrl,
                    method: "publishingInFeeds",
                  });
                } else {
                  socketInstance
                    .io()
                    .sockets.in(req.user.id)
                    .emit("progressOfRequestInPublishing", {
                      event: "Uploading video to youtube",
                      file: null,
                    });

                  googleApiOAuth2Instance.getToken(code, async (err, token) => {
                    if (err) {
                      socketInstance
                        .io()
                        .sockets.in(req.user.id)
                        .emit("progressOfRequestInPublishing", {
                          event: "Uploading video to youtube",
                          file: null,
                          error: {
                            data: err,
                            message: "Error when uploading videos to youtube",
                          },
                        });

                      resolve({
                        status: "error",
                        message: err,
                      });
                    }
                    if (!!token) {
                      googleApiOAuth2Instance.credentials = token;

                      await updateUserBy({
                        updateBy: "_id",
                        value: mongoose.Types.ObjectId(userId),
                        objDBForSet: {
                          rt: token.refresh_token,
                        },
                      });

                      google.youtube("v3").videos.insert(
                        {
                          access_token: token.access_token,
                          part: "snippet,status",
                          requestBody: {
                            snippet: {
                              title: video.videoData.title,
                              description: definingDescriptionForYoutube({
                                desc: video.videoData.description,
                                country: video.videoData.country,
                              }),
                              tags: video.videoData.tags,
                              //categoryId: 28,
                              defaultLanguage: "en",
                              defaultAudioLanguage: "en",
                            },
                            status: {
                              privacyStatus: "public",
                            },
                          },
                          media: {
                            body: stream,
                          },
                        },
                        (err, response) => {
                          if (err) {
                            socketInstance
                              .io()
                              .sockets.in(req.user.id)
                              .emit("progressOfRequestInPublishing", {
                                event: "Uploading video to youtube",
                                file: null,
                                error: {
                                  data: err,
                                  message:
                                    "Error when uploading videos to youtube",
                                },
                              });

                            resolve({
                              status: "error",
                              message: err,
                            });
                          }
                          if (response) {
                            resolve({
                              message: `Video uploaded to youtube successfully`,
                              status: "success",
                              apiData: response.data,
                            });
                          }
                        }
                      );
                    }
                  });
                }
              } else {
                socketInstance
                  .io()
                  .sockets.in(req.user.id)
                  .emit("progressOfRequestInPublishing", {
                    event: "Uploading video to youtube",
                    file: null,
                  });

                const refreshToken = authUser.rt;

                googleApiOAuth2Instance.credentials = {
                  refresh_token: refreshToken,
                };

                googleApiOAuth2Instance.refreshAccessToken((err, token) => {
                  if (err) {
                    socketInstance
                      .io()
                      .sockets.in(req.user.id)
                      .emit("progressOfRequestInPublishing", {
                        event: "Uploading video to youtube",
                        file: null,
                        error: {
                          data: err,
                          message: "Error when uploading videos to youtube",
                        },
                      });

                    resolve({
                      status: "error",
                      message: err,
                    });
                  }
                  if (!!token) {
                    google.youtube("v3").videos.insert(
                      {
                        access_token: token.access_token,
                        part: "snippet,status",
                        requestBody: {
                          snippet: {
                            title: video.videoData.title,
                            description: definingDescriptionForYoutube({
                              desc: video.videoData.description,
                              country: video.videoData.country,
                            }),
                            tags: video.videoData.tags,
                            //categoryId: 28,
                            defaultLanguage: "en",
                            defaultAudioLanguage: "en",
                          },
                          status: {
                            privacyStatus: "public",
                          },
                        },
                        media: {
                          body: stream,
                        },
                      },
                      (err, response) => {
                        if (err) {
                          socketInstance
                            .io()
                            .sockets.in(req.user.id)
                            .emit("progressOfRequestInPublishing", {
                              event: "Uploading video to youtube",
                              file: null,
                              error: {
                                data: err,
                                message:
                                  "Error when uploading videos to youtube",
                              },
                            });

                          resolve({
                            status: "error",
                            message: err,
                          });
                        }
                        if (response) {
                          resolve({
                            message: `Video uploaded to youtube successfully`,
                            status: "success",
                            apiData: response.data,
                          });
                        }
                      }
                    );
                  }
                });
              }
            }
          );

          if (responseAfterUploadOnYoutube.status === "success") {
            await updateVideoBy({
              searchBy: "videoData.videoId",
              searchValue: video.videoData.videoId,
              dataToUpdate: { uploadedToYoutube: true },
            });
          }
        }

        if (!video?.uploadedToFb) {
          socketInstance
            .io()
            .sockets.in(req.user.id)
            .emit("progressOfRequestInPublishing", {
              event: "Uploading video to facebook",
              file: null,
            });
          const { data: pagesResData } = await axios.get(
            `https://graph.facebook.com/${process.env.FACEBOOK_USER_ID}/accounts`,
            {
              params: {
                fields: "name,access_token",
                access_token: process.env.FACEBOOK_API_TOKEN,
              },
            }
          );
          const pageToken = pagesResData.data.find(
            (page) => page.id === process.env.FACEBOOK_PAGE_ID
          ).access_token;

          const responseAfterUploadOnFacebook = await new Promise(
            async (resolve, reject) => {
              fbUpload({
                token: pageToken,
                id: process.env.FACEBOOK_PAGE_ID,
                stream,
                title: video.videoData.title,
                description: video.videoData.description,
              })
                .then((res) => {
                  resolve({
                    status: "success",
                    message: "Video successfully uploaded on facebook",
                  });
                })
                .catch((err) => {
                  socketInstance
                    .io()
                    .sockets.in(req.user.id)
                    .emit("progressOfRequestInPublishing", {
                      event: "Uploading video to facebook",
                      file: null,
                      error: {
                        data: err,
                        message: "Error when uploading videos to facebook",
                      },
                    });
                  resolve({
                    status: "error",
                    resErr: err,
                  });
                });
            }
          );

          if (responseAfterUploadOnFacebook.status === "success") {
            await updateVideoBy({
              searchBy: "_id",
              searchValue: video._id,
              dataToUpdate: { uploadedToFb: true },
            });
          }
        }
      }

      if (!vbCode && !!video.vbForm) {
        await updateVideoById({
          videoId: +videoId,
          dataToDelete: {
            needToBeFixed: 1,
            vbForm: 1,
            ...(!creditTo && { "videoData.creditTo": 1 }),
          },
          dataToUpdate: {
            exclusivity: false,
          },
        });
      }

      if (vbCode) {
        const vbForm = await findOne({
          searchBy: "formId",
          param: `VB${vbCode}`,
        });

        if (!vbForm) {
          return res.status(200).json({
            message: `The form with the vb code ${vbCode} was not found in the database`,
            status: "warning",
          });
        }

        const videoWithVBForm = await findVideoBy({
          searchBy: "vbForm",
          value: vbForm._id,
        });

        if (
          videoWithVBForm &&
          videoWithVBForm._id.toString() !== video._id.toString()
        ) {
          return res.status(200).json({
            message: 'a video with such a "VB code" is already in the database',
            status: "warning",
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            vbForm: vbForm._id,
            exclusivity: !vbForm?.refFormId
              ? true
              : vbForm.refFormId.exclusivity
              ? true
              : false,
          },
        });
      }

      if (reqVideo) {
        if (path.extname(reqVideo[0].originalname) !== ".mp4") {
          return res.status(400).json({
            message: `Incorrect video extension`,
            status: "warning",
          });
        }

        const responseAfterConversion = await convertingVideoToHorizontal({
          buffer: reqVideo[0].buffer,
          userId: req.user.id,
          filename: reqVideo[0].originalname,
        });

        const bucketResponseByConvertedVideoUpload = await new Promise(
          (resolve, reject) => {
            fs.readFile(
              path.resolve(`./videos/${req.user.id}/output-for-conversion.mp4`),
              {},
              async (err, buffer) => {
                if (err) {
                  console.log(err);
                  resolve({
                    status: "error",
                    message: "Error when reading a file from disk",
                  });
                } else {
                  await uploadFileToStorage({
                    folder: "converted-videos",
                    name: videoId,
                    buffer,
                    type: reqVideo[0].mimetype,
                    extension: path.extname(reqVideo[0].originalname),
                    resolve,
                    socketInfo: {
                      userId: req.user.id,
                      socketEmitName: "progressOfRequestInPublishing",
                      fileName: reqVideo[0].originalname,
                      eventName: "Uploading the converted video to the bucket",
                    },
                  });
                }
              }
            );
          }
        );

        if (bucketResponseByConvertedVideoUpload.status === "error") {
          return res.status(200).json({
            message: bucketResponseByConvertedVideoUpload.message,
            status: "warning",
          });
        }

        const bucketResponseByVideoUpload = await new Promise(
          async (resolve, reject) => {
            await uploadFileToStorage({
              folder: "videos",
              name: videoId,
              buffer: reqVideo[0].buffer,
              type: reqVideo[0].mimetype,
              extension: path.extname(reqVideo[0].originalname),
              resolve,
              socketInfo: {
                userId: req.user.id,
                socketEmitName: "progressOfRequestInPublishing",
                fileName: reqVideo[0].originalname,
                eventName: "Uploading video to the bucket",
              },
            });
          }
        );

        if (bucketResponseByVideoUpload.status === "error") {
          return res.status(200).json({
            message: bucketResponseByVideoUpload.message,
            status: "warning",
          });
        }

        const duration = Math.floor(getDurationFromBuffer(reqVideo[0].buffer));

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            "bucket.cloudVideoLink":
              bucketResponseByVideoUpload.response.Location,
            "bucket.cloudVideoPath": bucketResponseByVideoUpload.response.Key,
            "bucket.cloudConversionVideoLink":
              bucketResponseByConvertedVideoUpload.response.Location,
            "bucket.cloudConversionVideoPath":
              bucketResponseByConvertedVideoUpload.response.Key,
            "videoData.duration": duration,
            "videoData.hasAudioTrack":
              responseAfterConversion.data.hasAudioTrack,
          },
        });
      }

      if (reqScreen) {
        if (path.extname(reqScreen[0].originalname) !== ".jpg") {
          return res.status(200).json({
            message: `Incorrect screen extension`,
            status: "warning",
          });
        }

        const bucketResponseByScreenUpload = await new Promise(
          async (resolve, reject) => {
            await uploadFileToStorage({
              folder: "screens",
              name: videoId,
              buffer: reqScreen[0].buffer,
              type: reqScreen[0].mimetype,
              extension: path.extname(reqScreen[0].originalname),
              resolve,
              socketInfo: {
                userId: req.user.id,
                socketEmitName: "progressOfRequestInPublishing",
                fileName: reqScreen[0].originalname,
                eventName: "Uploading screen to the bucket",
              },
            });
          }
        );

        if (bucketResponseByScreenUpload.status === "error") {
          return res.status(200).json({
            message: bucketResponseByScreenUpload.message,
            status: "warning",
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            "bucket.cloudScreenLink":
              bucketResponseByScreenUpload.response.Location,
            "bucket.cloudScreenPath": bucketResponseByScreenUpload.response.Key,
          },
        });
      }

      socketInstance
        .io()
        .sockets.in(req.user.id)
        .emit("progressOfRequestInPublishing", {
          event: "Just a little bit left",
          file: null,
        });

      if (!country && video.country && !video.countryCode) {
        const countryCode = await findTheCountryCodeByName(
          video.videoData.country
        );

        if (!countryCode) {
          return res.status(400).json({
            message: "Error when searching for the country code",
            status: "error",
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            "videoData.countryCode": countryCode,
          },
        });
      }

      if (country) {
        const countryCode = await findTheCountryCodeByName(country);

        if (!countryCode) {
          return res.status(400).json({
            message: "Error when searching for the country code",
            status: "error",
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            "videoData.country": country,
            "videoData.countryCode": countryCode,
          },
        });
      }

      if (
        video.publishedInSocialMedia === true &&
        JSON.parse(brandSafe) === false
      ) {
        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            brandSafe: JSON.parse(brandSafe),
            publishedInSocialMedia: false,
          },
        });
      } else {
        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            brandSafe: JSON.parse(brandSafe),
          },
        });
      }

      const researchersList = await findUsersByValueList({
        param: "name",
        valueList: JSON.parse(researchers),
      });

      let acquirer = null;

      if (acquirerName) {
        acquirer = await getUserBy({
          searchBy: "name",
          value: acquirerName,
        });
      }

      const researcherWithPaidAdvance = video.trelloData.researchers.find(
        (researcher) => researcher.advanceHasBeenPaid
      );

      if (
        !!researcherWithPaidAdvance &&
        researcherWithPaidAdvance.researcher._id.toString() !==
          acquirer._id.toString()
      ) {
        return res.status(200).json({
          message: "You cannot change the acquirer for this video.",
          status: "warning",
        });
      }

      const researchersListForCreatingVideo =
        defineResearchersListForCreatingVideo({
          mainResearcher: acquirer ? acquirer : null,
          allResearchersList: researchersList,
          advanceToResearcher: +advanceToResearcher,
          ...(!!researcherWithPaidAdvance && { researcherWithPaidAdvance }),
        });

      await updateVideoById({
        videoId: +videoId,
        dataToUpdate: {
          "videoData.originalVideoLink": originalLink,
          "videoData.title": title,
          "videoData.description": desc,
          ...(creditTo && { "videoData.creditTo": creditTo }),
          "videoData.tags": JSON.parse(tags).map((el) => {
            return el.trim();
          }),
          "videoData.category": JSON.parse(category),
          "videoData.categoryReuters": categoryReuters,
          "videoData.city": city,
          "videoData.date": JSON.parse(date),
          "trelloData.researchers": researchersListForCreatingVideo,
          apVideoHub: JSON.parse(apVideoHub),
          reuters: JSON.parse(reuters),
          socialMedia: JSON.parse(socialMedia),
          isApproved: true,
          pubDate: moment().valueOf(),
        },
      });

      const updatedVideo = await findVideoBy({
        searchBy: "videoData.videoId",
        value: +videoId,
      });

      if (!!acquirerPaidAdvance) {
        if (!updatedVideo?.vbForm?.sender) {
          return res.status(200).json({
            message: "This video has no author",
            status: "warning",
          });
        }

        if (!!updatedVideo?.vbForm?.advancePaymentReceived) {
          return res.status(200).json({
            message: "The author has already been paid an advance",
            status: "warning",
          });
        }

        if (!acquirerName) {
          return res.status(200).json({
            message: "No acquirer found to record a note",
            status: "warning",
          });
        }

        if (
          +acquirerPaidAdvance !== updatedVideo.vbForm.refFormId.advancePayment
        ) {
          return res.status(200).json({
            message: "The amount does not match the advance for the author",
            status: "warning",
          });
        }

        const acquirerInTheVideoList = updatedVideo.trelloData.researchers.find(
          (obj) => obj.researcher._id.toString() === acquirer._id.toString()
        );

        if (!acquirerInTheVideoList) {
          return res.status(200).json({
            message:
              "This acquirer is not in the list of researchers for this video. Save the acquirer, and then add the amount",
            status: "warning",
          });
        }

        await updateUser({
          userId: acquirer._id,
          objDBForIncrement: {
            note: +acquirerPaidAdvance,
          },
        });

        await updateVbFormBy({
          updateBy: "_id",
          value: updatedVideo.vbForm._id,
          dataForUpdate: { advancePaymentReceived: true },
        });

        await updateVideoBy({
          searchBy: "_id",
          searchValue: updatedVideo._id,
          dataToInc: { balance: -acquirerPaidAdvance },
        });

        await createNewPayment({
          user: updatedVideo.vbForm.sender._id,
          purpose: ["advance"],
          amount: {
            advance: +acquirerPaidAdvance,
          },
        });

        const bodyForEmail = {
          emailFrom: '"«VIRALBEAR» LLC" <info@viralbear.media>',
          emailTo: updatedVideo.vbForm.sender.email,
          subject: "Payment of the amount",
          html: `
          Hello ${updatedVideo.vbForm.sender.name}.<br/>
          ViralBear just paid you: ${acquirerPaidAdvance}$!<br/>
          Have a good day!
          `,
        };

        sendEmail(bodyForEmail);
      }

      await refreshMrssFiles();

      //добавляем кастомное поле "id video" в карточке trello
      await updateCustomFieldByTrelloCard(
        updatedVideo.trelloData.trelloCardId,
        process.env.TRELLO_CUSTOM_FIELD_ID_VIDEO,
        {
          value: {
            number: `${updatedVideo.videoData.videoId}`,
          },
        }
      );

      //убираем наклейку "not published" в карточке trello
      await deleteLabelFromTrelloCard(
        updatedVideo.trelloData.trelloCardId,
        process.env.TRELLO_LABEL_NOT_PUBLISHED
      );

      return res.status(200).json({
        status: "success",
        message: "The video was successfully published",
      });
    } catch (err) {
      console.log(errorsHandler({ err, trace: "video.publishing" }));

      return res
        .status(400)
        .json({ message: "Server side error", status: "error" });
    }
  }
);

router.post(
  "/publishingInSocialMedia/:videoId",
  authMiddleware,
  async (req, res) => {
    const { videoId } = req.params;
    const { code } = req.query;

    try {
      if (process.env.MODE === "production") {
        const video = await findVideoBy({
          searchBy: "videoData.videoId",
          value: +videoId,
        });

        if (!video) {
          return res.status(200).json({
            message: `video with id "${videoId}" not found`,
            status: "warning",
          });
        }

        if (!!video?.uploadedToFb && !!video?.uploadedToYoutube) {
          return res.status(200).json({
            message: `This video has already been posted on social networks`,
            status: "warning",
          });
        }

        const userId = req.user.id;

        const authUser = await getUserBy({
          searchBy: "_id",
          value: mongoose.Types.ObjectId(userId),
        });

        const resBucket = await new Promise((resolve, reject) => {
          storageInstance.getObject(
            {
              Bucket: process.env.YANDEX_CLOUD_BUCKET_NAME,
              Key: video.bucket.cloudVideoPath,
            },
            (err, data) => {
              if (err) {
                console.log(err);
                resolve({ status: "error" });
              }

              resolve({
                length: data.ContentLength,
                buffer: data.Body,
                status: "success",
              });
            }
          );
        });

        if (resBucket.status === "error") {
          return res.status(200).json({
            message: `Error when receiving a video from a bucket`,
            status: "warning",
          });
        }

        const stream = streamifier.createReadStream(resBucket.buffer);

        if (!video?.uploadedToYoutube) {
          const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];

          const responseAfterUploadOnYoutube = await new Promise(
            (resolve, reject) => {
              if (!authUser.rt) {
                if (!code) {
                  const authUrl = googleApiOAuth2Instance.generateAuthUrl({
                    access_type: "offline",
                    prompt: "consent",
                    scope: SCOPES,
                  });

                  return res.status(200).json({
                    status: "redirect",
                    apiData: authUrl,
                    method: "publishingInFeeds",
                  });
                } else {
                  socketInstance
                    .io()
                    .sockets.in(req.user.id)
                    .emit("progressOfRequestInPublishing", {
                      event: "Uploading video to youtube",
                      file: null,
                    });

                  googleApiOAuth2Instance.getToken(code, async (err, token) => {
                    if (err) {
                      socketInstance
                        .io()
                        .sockets.in(req.user.id)
                        .emit("progressOfRequestInPublishing", {
                          event: "Uploading video to youtube",
                          file: null,
                          error: {
                            data: err,
                            message: "Error when uploading videos to youtube",
                          },
                        });

                      resolve({
                        status: "error",
                        message: err,
                      });
                    }
                    if (!!token) {
                      googleApiOAuth2Instance.credentials = token;

                      await updateUserBy({
                        updateBy: "_id",
                        value: mongoose.Types.ObjectId(userId),
                        objDBForSet: {
                          rt: token.refresh_token,
                        },
                      });

                      google.youtube("v3").videos.insert(
                        {
                          access_token: token.access_token,
                          part: "snippet,status",
                          requestBody: {
                            snippet: {
                              title: video.videoData.title,
                              description: definingDescriptionForYoutube({
                                desc: video.videoData.description,
                                country: video.videoData.country,
                              }),
                              tags: video.videoData.tags,
                              //categoryId: 28,
                              defaultLanguage: "en",
                              defaultAudioLanguage: "en",
                            },
                            status: {
                              privacyStatus: "public",
                            },
                          },
                          media: {
                            body: stream,
                          },
                        },
                        (err, response) => {
                          if (err) {
                            socketInstance
                              .io()
                              .sockets.in(req.user.id)
                              .emit("progressOfRequestInPublishing", {
                                event: "Uploading video to youtube",
                                file: null,
                                error: {
                                  data: err,
                                  message:
                                    "Error when uploading videos to youtube",
                                },
                              });

                            resolve({
                              status: "error",
                              message: err,
                            });
                          }
                          if (response) {
                            resolve({
                              message: `Video uploaded to youtube successfully`,
                              status: "success",
                              apiData: response.data,
                            });
                          }
                        }
                      );
                    }
                  });
                }
              } else {
                socketInstance
                  .io()
                  .sockets.in(req.user.id)
                  .emit("progressOfRequestInPublishing", {
                    event: "Uploading video to youtube",
                    file: null,
                  });

                const refreshToken = authUser.rt;

                googleApiOAuth2Instance.credentials = {
                  refresh_token: refreshToken,
                };

                googleApiOAuth2Instance.refreshAccessToken((err, token) => {
                  if (err) {
                    socketInstance
                      .io()
                      .sockets.in(req.user.id)
                      .emit("progressOfRequestInPublishing", {
                        event: "Uploading video to youtube",
                        file: null,
                        error: {
                          data: err,
                          message: "Error when uploading videos to youtube",
                        },
                      });

                    resolve({
                      status: "error",
                      message: err,
                    });
                  }
                  if (!!token) {
                    google.youtube("v3").videos.insert(
                      {
                        access_token: token.access_token,
                        part: "snippet,status",
                        requestBody: {
                          snippet: {
                            title: video.videoData.title,
                            description: definingDescriptionForYoutube({
                              desc: video.videoData.description,
                              country: video.videoData.country,
                            }),
                            tags: video.videoData.tags,
                            //categoryId: 28,
                            defaultLanguage: "en",
                            defaultAudioLanguage: "en",
                          },
                          status: {
                            privacyStatus: "public",
                          },
                        },
                        media: {
                          body: stream,
                        },
                      },
                      (err, response) => {
                        if (err) {
                          socketInstance
                            .io()
                            .sockets.in(req.user.id)
                            .emit("progressOfRequestInPublishing", {
                              event: "Uploading video to youtube",
                              file: null,
                              error: {
                                data: err,
                                message:
                                  "Error when uploading videos to youtube",
                              },
                            });

                          resolve({
                            status: "error",
                            message: err,
                          });
                        }
                        if (response) {
                          resolve({
                            message: `Video uploaded to youtube successfully`,
                            status: "success",
                            apiData: response.data,
                          });
                        }
                      }
                    );
                  }
                });
              }
            }
          );

          if (responseAfterUploadOnYoutube.status === "success") {
            await updateVideoBy({
              searchBy: "videoData.videoId",
              searchValue: video.videoData.videoId,
              dataToUpdate: { uploadedToYoutube: true },
            });
          }
        }

        if (!video?.uploadedToFb) {
          socketInstance
            .io()
            .sockets.in(req.user.id)
            .emit("progressOfRequestInPublishing", {
              event: "Uploading video to facebook",
              file: null,
            });
          const { data: pagesResData } = await axios.get(
            `https://graph.facebook.com/${process.env.FACEBOOK_USER_ID}/accounts`,
            {
              params: {
                fields: "name,access_token",
                access_token: process.env.FACEBOOK_API_TOKEN,
              },
            }
          );
          const pageToken = pagesResData.data.find(
            (page) => page.id === process.env.FACEBOOK_PAGE_ID
          ).access_token;

          const responseAfterUploadOnFacebook = await new Promise(
            async (resolve, reject) => {
              fbUpload({
                token: pageToken,
                id: process.env.FACEBOOK_PAGE_ID,
                stream,
                title: video.videoData.title,
                description: video.videoData.description,
              })
                .then((res) => {
                  resolve({
                    status: "success",
                    message: "Video successfully uploaded on facebook",
                  });
                })
                .catch((err) => {
                  socketInstance
                    .io()
                    .sockets.in(req.user.id)
                    .emit("progressOfRequestInPublishing", {
                      event: "Uploading video to facebook",
                      file: null,
                      error: {
                        data: err,
                        message: "Error when uploading videos to facebook",
                      },
                    });
                  resolve({
                    status: "error",
                    resErr: err,
                  });
                });
            }
          );

          if (responseAfterUploadOnFacebook.status === "success") {
            await updateVideoBy({
              searchBy: "_id",
              searchValue: video._id,
              dataToUpdate: { uploadedToFb: true },
            });
          }

          //на будущее
          //https://graph.facebook.com/oauth/access_token?
          //client_id=APP_ID&
          //client_secret=APP_SECRET&
          //grant_type=fb_exchange_token&
          //fb_exchange_token=EXISTING_ACCESS_TOKEN
        }

        await updateVideoBy({
          searchBy: "_id",
          searchValue: video._id,
          dataToUpdate: { socialMedia: true },
        });
      }

      return res.status(200).json({
        status: "success",
        message: "The video was successfully uploaded to social networks",
      });
    } catch (err) {
      console.log(
        errorsHandler({ err, trace: "video.publishingInSocialMedia" })
      );

      return res.status(400).json({
        status: "error",
        message: err?.response?.data?.message
          ? err.response.data.message
          : "Server side error",
      });
    }
  }
);

router.delete("/:id", authMiddleware, async (req, res) => {
  const { id: videoId } = req.params;

  try {
    const video = await findVideoBy({
      searchBy: "videoData.videoId",
      value: +videoId,
    });

    if (!video) {
      return res.status(404).json({
        message: `Video with id "${videoId}" was not found`,
        status: "warning",
      });
    }

    const bucketPathArr = [
      video.bucket.cloudScreenPath,
      video.bucket.cloudVideoPath,
      video.bucket.cloudConversionVideoPath,
    ];

    await Promise.all(
      bucketPathArr.map(async (path) => {
        if (!path) {
          return {
            message: "There is no path to delete",
            status: "warning",
            response: {},
          };
        } else {
          return await new Promise((resolve, reject) => {
            removeFileFromStorage(path, resolve, reject);
          });
        }
      })
    );

    await deleteVideoById(+videoId);

    if (video.isApproved === true) {
      await refreshMrssFiles();
    }

    return res.status(200).json({
      message: "video successfully deleted",
      status: "success",
      apiData: { trelloCardId: video.trelloData.trelloCardId },
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "video.delete" }));
    return res.status(400).json({
      message: err?.message ? err?.message : "Server side error",
      status: "error",
    });
  }
});

router.get("/getSalesAnalytics/:videoId", authMiddleware, async (req, res) => {
  const { videoId } = req.params;

  try {
    const video = await findVideoBy({
      searchBy: "videoData.videoId",
      value: +videoId,
    });

    if (!video) {
      return res.status(200).json({
        status: "warning",
        message: "Couldn't get analytics on this video",
      });
    }

    const percentageOfAuthor = video?.vbForm?.refFormId?.percentage;

    let sales = await getAllSales({
      videoId,
    });

    const pipelineToSearchForAllSales = [
      {
        $match: {
          videoId: +video.videoData.videoId,
        },
      },
      {
        $group: {
          _id: "$videoId",
          amount: { $sum: "$amount" },
        },
      },
    ];

    const totalOfAllSales = await Sales.aggregate(pipelineToSearchForAllSales);

    let shareOfSales = 0;

    if (!!percentageOfAuthor && !!totalOfAllSales[0]?.amount) {
      shareOfSales = (totalOfAllSales[0].amount * percentageOfAuthor) / 100;
    }

    const pipelineForFindingPaidSales = [
      {
        $match: {
          videoId: +video.videoData.videoId,
          "vbFormInfo.paidFor": true,
        },
      },
      {
        $group: {
          _id: "$videoId",
          amount: { $sum: "$vbFormInfo.amount" },
        },
      },
    ];

    const amountOfPaidSales = await Sales.aggregate(
      pipelineForFindingPaidSales
    );

    const pipelineForFindingUnpaidSales = [
      {
        $match: {
          videoId: +video.videoData.videoId,
          "vbFormInfo.paidFor": false,
        },
      },
      {
        $group: {
          _id: "$videoId",
          amount: { $sum: "$vbFormInfo.amount" },
        },
      },
    ];

    const amountOfUnpaidSales = await Sales.aggregate(
      pipelineForFindingUnpaidSales
    );

    const calcTotalAmountOfPayments = () => {
      let totalPayment = 0;

      if (amountOfPaidSales.length) {
        totalPayment = amountOfPaidSales[0].amount;
      }

      if (
        video?.vbForm?.advancePaymentReceived === true &&
        !!video?.vbForm?.refFormId?.advancePayment
      ) {
        totalPayment += video.vbForm.refFormId.advancePayment;
      }

      return totalPayment;
    };

    const calcTotalAmountOfDebt = () => {
      let currentAccountBalance = 0;

      if (amountOfUnpaidSales.length) {
        currentAccountBalance = amountOfUnpaidSales[0].amount;
      }

      if (
        video?.vbForm?.advancePaymentReceived === false &&
        !!video?.vbForm?.refFormId?.advancePayment
      ) {
        currentAccountBalance += video.vbForm.refFormId.advancePayment;
      }

      return currentAccountBalance;
    };

    const apiData = {
      sales,
      analytics: {
        totalReceived: !totalOfAllSales.length ? 0 : totalOfAllSales[0].amount,
        shareOfSales,
        totalPayment: calcTotalAmountOfPayments(),
        currentAccountBalance: calcTotalAmountOfDebt(),
      },
    };

    return res.status(200).json({
      apiData,
      status: "success",
      message: "Video analytics on sales received",
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "video.getSalesAnalytics" }));
    return res.status(400).json({
      message: "Server side error",
      status: "error",
    });
  }
});

module.exports = router;
