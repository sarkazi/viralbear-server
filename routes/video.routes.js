const express = require('express');
const router = express.Router();
const multer = require('multer');

const fs = require('fs');
const path = require('path');
const request = require('request');

const { google } = require('googleapis');

const axios = require('axios');

const socketInstance = require('../socket.instance');
const googleApiOAuth2Instance = require('../googleApiOAuth2.instance');

const AWS = require('aws-sdk');
const moment = require('moment');

const readline = require('readline');

const { v4: createUniqueHash } = require('uuid');

const Video = require('../entities/Video');
const Sales = require('../entities/Sales');
const Users = require('../entities/User');

const authMiddleware = require('../middleware/auth.middleware');

const { generateVideoId } = require('../utils/generateVideoId');
const { findTimestampsBySearch } = require('../utils/findTimestampsBySearch');
const { convertInMongoIdFormat } = require('../utils/convertInMongoIdFormat');

const { getDurationFromBuffer } = require('fancy-video-duration');

const {
  findStartEndPointOfDuration,
} = require('../utils/findStartEndPointOfDuration');

const { findOne } = require('../controllers/uploadInfo.controller');

const {
  findOneRefFormByParam,
  markRefFormAsUsed,
} = require('../controllers/authorLink.controller');

var Mutex = require('async-mutex').Mutex;
const mutex = new Mutex();

const {
  refreshMrssFiles,
  findByIsBrandSafe,
  findLastVideo,
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
  findVideoByValue,
  markResearcherAdvanceForOneVideoAsPaid,
  updateVideosBy,
} = require('../controllers/video.controller');

const {
  findUsersByValueList,
  getUserBy,
  updateUser,
  getAllUsers,
} = require('../controllers/user.controller');

const { sendEmail } = require('../controllers/sendEmail.controller');

const {
  uploadFileToStorage,
  removeFileFromStorage,
} = require('../controllers/storage.controller');

const {
  deleteLabelFromTrelloCard,
  updateCustomFieldByTrelloCard,
} = require('../controllers/trello.controller');

const {
  findTheRecordOfTheCardMovedToDone,
} = require('../controllers/movedToDoneList.controller');

const {
  defineResearchersListForCreatingVideo,
} = require('../utils/defineResearchersListForCreatingVideo');

const { getAllSales } = require('../controllers/sales.controller');
const storageInstance = require('../storage.instance');

const storage = multer.memoryStorage();

router.post(
  '/addVideo',
  authMiddleware,

  multer({ storage: storage }).fields([
    {
      name: 'video',
      maxCount: 1,
    },
    {
      name: 'screen',
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
      } = req.body;

      const { video, screen } = req.files;

      if (
        path.extname(video[0].originalname) !== '.mp4' ||
        path.extname(screen[0].originalname) !== '.jpg'
      ) {
        return res
          .status(200)
          .json({ message: 'Invalid file/s extension', status: 'warning' });
      }

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
          message: 'Missing values for adding a new video',
          status: 'warning',
        });
      }

      if (!JSON.parse(researchers).find((name) => name === acquirerName)) {
        return res.status(200).json({
          message: 'The acquirer is not added to the list',
          status: 'warning',
        });
      }

      try {
        let vbForm = null;

        if (vbCode) {
          vbForm = await findOne({ searchBy: 'formId', param: `VB${vbCode}` });

          if (!vbForm) {
            return res.status(200).json({
              message: `The form with the vb code ${vbCode} was not found in the database`,
              status: 'warning',
            });
          }

          const videoWithVBForm = await findVideoByValue({
            searchBy: 'vbForm',
            value: vbForm._id,
          });

          if (videoWithVBForm) {
            return res.status(200).json({
              message:
                'a video with such a "VB code" is already in the database',
              status: 'warning',
            });
          }
        }

        const countryCode = await findTheCountryCodeByName(country);

        if (!countryCode) {
          return res.status(200).json({
            message: 'Could not determine the country code',
            status: 'warning',
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
                  reject({
                    status: 'error',
                    message: 'Error when reading a file from disk',
                  });
                } else {
                  await uploadFileToStorage(
                    video[0].originalname,
                    'converted-videos',
                    videoId,
                    buffer,
                    video[0].mimetype,
                    path.extname(video[0].originalname),
                    resolve,
                    reject,
                    'progressOfRequestInPublishing',
                    'Uploading the converted video to the bucket',
                    req.user.id
                  );
                }
              }
            );
          }
        );

        const bucketResponseByVideoUpload = await new Promise(
          async (resolve, reject) => {
            await uploadFileToStorage(
              video[0].originalname,
              'videos',

              videoId,
              video[0].buffer,
              video[0].mimetype,
              path.extname(video[0].originalname),
              resolve,
              reject,
              'progressOfRequestInPublishing',
              'Uploading video to the bucket',
              req.user.id
            );
          }
        );

        const bucketResponseByScreenUpload = await new Promise(
          async (resolve, reject) => {
            await uploadFileToStorage(
              screen[0].originalname,
              'screens',

              videoId,
              screen[0].buffer,
              screen[0].mimetype,
              path.extname(screen[0].originalname),
              resolve,
              reject,
              'progressOfRequestInPublishing',
              'Uploading screen to the bucket',
              req.user.id
            );
          }
        );

        socketInstance
          .io()
          .sockets.in(req.user.id)
          .emit('progressOfRequestInPublishing', {
            event: 'Just a little bit left',
            file: null,
          });

        const researchersList = await findUsersByValueList({
          param: 'name',
          valueList: JSON.parse(researchers),
        });

        let acquirer = null;

        if (acquirerName) {
          acquirer = await getUserBy({
            searchBy: 'name',
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

        socketInstance.io().emit('triggerForAnUpdateInPublishing', {
          event: 'ready for publication',
          priority: null,
        });

        return res.status(200).json({
          apiData: newVideo,
          status: 'success',
          message: 'Video successfully added',
        });
      } catch (err) {
        console.log(err);

        return res.status(500).json({
          message: err?.message ? err?.message : 'Server side error',
          status: 'error',
        });
      }
    });
  }
);

router.post('/convert', authMiddleware, async (req, res) => {
  await mutex.runExclusive(async () => {
    try {
      const { videoId } = req.query;
      const userId = req.user.id;

      if (!videoId) {
        return res
          .status(200)
          .json({ message: 'Missing videoId', status: 'warning' });
      }

      const video = await findVideoByValue({
        searchBy: 'videoData.videoId',
        value: +videoId,
      });

      if (!video) {
        return res.status(200).json({
          message: `Video with id ${+videoId} not found`,
          status: 'warning',
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
        responseType: 'stream',
      });

      await new Promise((resolve, reject) => {
        stream.pipe(writer);
        let error = null;
        writer.on('error', (err) => {
          error = err;
          writer.close();
          reject(err);

          return res.status(200).json({
            message: `Error when downloading a file`,
            status: 'warning',
          });
        });
        writer.on('close', () => {
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
                reject({
                  status: 'error',
                  message: 'Error when reading a file from disk',
                });
              } else {
                await uploadFileToStorage(
                  video.videoData.videoId,
                  'converted-videos',
                  video.videoData.videoId,
                  buffer,
                  'video/mp4',
                  '.mp4',
                  resolve,
                  reject,
                  'progressOfRequestInPublishing',
                  'Uploading the converted video to the bucket',
                  userId
                );
              }
            }
          );
        }
      );

      socketInstance
        .io()
        .sockets.in(userId)
        .emit('progressOfRequestInPublishing', {
          event: 'Just a little bit left',
          file: null,
        });

      await updateVideosBy({
        updateBy: '_id',
        value: video._id,
        objForSet: {
          'bucket.cloudConversionVideoLink':
            bucketResponseByConvertedVideoUpload.response.Location,
          'bucket.cloudConversionVideoPath':
            bucketResponseByConvertedVideoUpload.response.Key,
          'videoData.hasAudioTrack': responseAfterConversion.data.hasAudioTrack,
          apVideoHubArchive: true,
        },
      });

      const updatedVideo = await findVideoByValue({
        searchBy: 'videoData.videoId',
        value: +videoId,
      });

      await refreshMrssFiles();

      return res.status(200).json({
        message: 'The video has been successfully converted',
        status: 'success',
        apiData: updatedVideo,
      });
    } catch (err) {
      console.log(err);
      return res
        .status(500)
        .json({ message: 'Server side error', status: 'error' });
    }
  });
});

router.post('/generateExcelFile', authMiddleware, generateExcelFile);

router.get('/findOne', authMiddleware, findLastVideo);

router.get('/findOneBy', async (req, res) => {
  try {
    const { searchBy, searchValue } = req.query;

    if (!searchBy || !searchValue) {
      return res.status(200).json({
        status: 'warning',
        message: 'Missing parameters for video search',
      });
    }

    const apiData = await findVideoByValue({
      searchBy,
      value: searchBy === 'videoData.videoId' ? +searchValue : searchValue,
    });

    if (!apiData) {
      return res.status(200).json({
        status: 'warning',
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
          ).name,
        }),
      },
      status: 'success',
      message: 'Detailed video information received',
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      status: 'error',
      message: 'Server side error',
    });
  }
});

router.get('/findAll', authMiddleware, async (req, res) => {
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
  } = req.query;

  if ((limit && !page) || (!limit && page)) {
    return res
      .status(200)
      .json({ message: 'Missing parameter for pagination', status: 'warning' });
  }

  try {
    let videos = await getAllVideos({
      ...(category && { category }),
      ...(tag && { tag }),
      ...(location && { location }),
      ...(forLastDays && { forLastDays: +forLastDays }),
      ...(typeof JSON.parse(isApproved) === 'boolean' && {
        isApproved: JSON.parse(isApproved),
      }),
      ...(typeof JSON.parse(personal) === 'boolean' && {
        researcher: {
          searchBy: 'id',
          value: convertInMongoIdFormat({ string: req.user.id }),
        },
      }),
      ...(wasRemovedFromPublication &&
        typeof JSON.parse(wasRemovedFromPublication) === 'boolean' && {
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
          typeof JSON.parse(isApproved) === 'boolean' && {
            isApproved: JSON.parse(isApproved),
          }),
        ...(personal &&
          typeof JSON.parse(personal) === 'boolean' && {
            researcher: {
              searchBy: 'id',
              value: convertInMongoIdFormat({ string: req.user.id }),
            },
          }),
        ...(wasRemovedFromPublication &&
          typeof JSON.parse(wasRemovedFromPublication) === 'boolean' && {
            wasRemovedFromPublication: JSON.parse(wasRemovedFromPublication),
          }),
        limit,
        skip,
        sort: { 'videoData.videoId': -1 },
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
      status: 'success',
      message: 'The list of videos is received',
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      status: 'error',
      message: 'Server side error',
    });
  }
});

router.get('/findReadyForPublication', authMiddleware, async (req, res) => {
  try {
    const videosReadyForPublication = await findReadyForPublication();

    const apiData = videosReadyForPublication.map((video) => {
      return {
        _id: video._id,
        videoId: video.videoData.videoId,
        name:
          video.trelloData.trelloCardName.length >= 20
            ? video.trelloData.trelloCardName.substring(0, 20) + '...'
            : video.trelloData.trelloCardName,
        priority: video.trelloData.priority,
        hasAdvance: video?.vbForm?.refFormId?.advancePayment ? true : false,
        acquirer: {
          avatarUrl: video.trelloData.researchers.find(
            (researcher) => researcher.main && !!researcher.avatarUrl
          ).avatarUrl,
          name: video.trelloData.researchers.find(
            (researcher) => researcher.main && !!researcher.avatarUrl
          ).name,
        },
      };
    });

    return res.status(200).json({
      status: 'success',
      message: 'The list of videos ready for publication has been received',
      apiData,
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: 'Server-side error',
      status: 'error',
    });
  }
});

router.get('/findByIsBrandSafe', authMiddleware, async (req, res) => {
  try {
    const videosForSocialMedia = await findByIsBrandSafe();

    return res.status(200).json(videosForSocialMedia);
  } catch (err) {
    console.log(err);

    return res.status(400).json({
      message: 'server side error',
    });
  }
});

router.get('/findByFixed', authMiddleware, async (req, res) => {
  try {
    const videoPendingChanges = await findByFixed();

    const apiData = videoPendingChanges.map((video) => {
      return {
        _id: video._id,
        videoId: video.videoData.videoId,
        name:
          video.trelloData.trelloCardName.length >= 20
            ? video.trelloData.trelloCardName.substring(0, 20) + '...'
            : video.trelloData.trelloCardName,
        priority: video.trelloData.priority,
        hasAdvance: video?.vbForm?.refFormId?.advancePayment ? true : false,
        acquirer: {
          avatarUrl: video.trelloData.researchers.find(
            (researcher) => researcher.main && !!researcher.avatarUrl
          ).avatarUrl,
          name: video.trelloData.researchers.find(
            (researcher) => researcher.main && !!researcher.avatarUrl
          ).name,
        },
      };
    });

    console.log(apiData);

    return res.status(200).json({
      status: 'success',
      message: 'The list of videos awaiting editing has been received',
      apiData,
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      status: 'error',
      message: 'server side error',
    });
  }
});

router.get('/findByAuthor', authMiddleware, async (req, res) => {
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
        'videoData.title',
        'videoData.videoId',
        'bucket.cloudScreenLink',
      ],
    });

    let videos = await Promise.all(
      videosWithVbCode.map(async (video) => {
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
              'D MMMM YYYY, HH:mm:ss Z'
            ),
            videoByThisAuthor: true,
            revenue: +revenue.toFixed(2),
            percentage: video?.vbForm?.refFormId?.percentage
              ? video.vbForm.refFormId.percentage
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
          res['videosByThisAuthor'].push(videoData);
        } else {
          res['videosIsNotByThisAuthor'].push(videoData);
        }
        return res;
      },
      { videosByThisAuthor: [], videosIsNotByThisAuthor: [] }
    );

    return res.status(200).json({
      message: `Videos with statistics received`,
      status: 'success',
      apiData: videos.videosByThisAuthor,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: `Server side error`,
      status: 'error',
    });
  }
});

router.get('/findRelated', findRelated);

router.get('/findOneById/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;

    const video = await findVideoByValue({
      searchBy: 'videoData.videoId',
      value: +videoId,
    });

    if (!video) {
      return res.status(200).json({
        message: `Video with id "${videoId}" was not found`,
        status: 'warning',
      });
    }

    return res.status(200).json({
      message: `Video with id "${videoId}" was found`,
      status: 'success',
      apiData: video,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: `Server side error`,
      status: 'error',
    });
  }
});

router.get('/findOneInTheFeed/:id', findOneVideoInFeed);

router.get('/findNext/:id', findNextVideoInFeed);

router.get('/findPrev/:id', findPrevVideoInFeed);

router.patch(
  '/update/:id',
  authMiddleware,

  multer({ storage: storage }).fields([
    {
      name: 'video',
      maxCount: 1,
    },
    {
      name: 'screen',
      maxCount: 1,
    },
  ]),

  async (req, res) => {
    const { id: videoId } = req.params;

    if (!videoId) {
      return res
        .status(200)
        .json({ message: 'missing "video id" parameter', status: 'warning' });
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
        message: 'Missing values for adding a new video',
        status: 'warning',
      });
    }

    if (!JSON.parse(researchers).find((name) => name === acquirerName)) {
      return res.status(200).json({
        message: 'The acquirer is not added to the list',
        status: 'warning',
      });
    }

    const { video: reqVideo, screen: reqScreen } = req.files;

    try {
      const video = await findVideoById(+videoId);

      if (!video) {
        return res.status(200).json({
          message: `video with id "${videoId}" not found`,
          status: 'warning',
        });
      }

      if (!vbCode && !!video.vbForm) {
        await updateVideoById({
          videoId: +videoId,
          dataToDelete: {
            needToBeFixed: 1,
            vbForm: 1,
            ...(!creditTo && { 'videoData.creditTo': 1 }),
          },
          dataToUpdate: {
            exclusivity: false,
          },
        });
      }

      if (vbCode) {
        const vbForm = await findOne({
          searchBy: 'formId',
          param: `VB${vbCode}`,
        });

        if (!vbForm) {
          return res.status(200).json({
            message: `The form with the vb code ${vbCode} was not found in the database`,
            status: 'warning',
          });
        }

        const videoWithVBForm = await findVideoByValue({
          searchBy: 'vbForm',
          value: vbForm._id,
        });

        if (
          videoWithVBForm &&
          videoWithVBForm._id.toString() !== video._id.toString()
        ) {
          return res.status(200).json({
            message: 'a video with such a "VB code" is already in the database',
            status: 'warning',
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
        if (path.extname(reqVideo[0].originalname) !== '.mp4') {
          return res.status(200).json({
            message: `Incorrect video extension`,
            status: 'warning',
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
                  reject({
                    status: 'error',
                    message: 'Error when reading a file from disk',
                  });
                } else {
                  await uploadFileToStorage(
                    reqVideo[0].originalname,
                    'converted-videos',
                    videoId,
                    buffer,
                    reqVideo[0].mimetype,
                    path.extname(reqVideo[0].originalname),
                    resolve,
                    reject,
                    'progressOfRequestInPublishing',
                    'Uploading the converted video to the bucket',
                    req.user.id
                  );
                }
              }
            );
          }
        );

        const bucketResponseByVideoUpload = await new Promise(
          async (resolve, reject) => {
            await uploadFileToStorage(
              reqVideo[0].originalname,
              'videos',
              videoId,
              reqVideo[0].buffer,
              reqVideo[0].mimetype,
              path.extname(reqVideo[0].originalname),
              resolve,
              reject,
              'progressOfRequestInPublishing',
              'Uploading video to the bucket',
              req.user.id
            );
          }
        );

        const duration = Math.floor(getDurationFromBuffer(reqVideo[0].buffer));

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            'bucket.cloudVideoLink':
              bucketResponseByVideoUpload.response.Location,
            'bucket.cloudVideoPath': bucketResponseByVideoUpload.response.Key,
            'bucket.cloudConversionVideoLink':
              bucketResponseByConvertedVideoUpload.response.Location,
            'bucket.cloudConversionVideoPath':
              bucketResponseByConvertedVideoUpload.response.Key,
            'videoData.duration': duration,
            'videoData.hasAudioTrack':
              responseAfterConversion.data.hasAudioTrack,
          },
        });
      }

      if (reqScreen) {
        if (path.extname(reqScreen[0].originalname) !== '.jpg') {
          return res.status(400).json({
            message: `Incorrect screen extension`,
            status: 'warning',
          });
        }

        const bucketResponseByScreenUpload = await new Promise(
          async (resolve, reject) => {
            await uploadFileToStorage(
              reqScreen[0].originalname,
              'screens',
              videoId,
              reqScreen[0].buffer,
              reqScreen[0].mimetype,
              path.extname(reqScreen[0].originalname),
              resolve,
              reject,
              'progressOfRequestInPublishing',
              'Uploading screen to the bucket',
              req.user.id
            );
          }
        );

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            'bucket.cloudScreenLink':
              bucketResponseByScreenUpload.response.Location,
            'bucket.cloudScreenPath': bucketResponseByScreenUpload.response.Key,
          },
        });
      }

      socketInstance
        .io()
        .sockets.in(req.user.id)
        .emit('progressOfRequestInPublishing', {
          event: 'Just a little bit left',
          file: null,
        });

      if (!country && video.country && !video.countryCode) {
        const countryCode = await findTheCountryCodeByName(
          video.videoData.country
        );

        if (!countryCode) {
          return res.status(400).json({
            message: 'Error when searching for the country code',
            status: 'error',
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            'videoData.countryCode': countryCode,
          },
        });
      }

      if (country) {
        const countryCode = await findTheCountryCodeByName(country);

        if (!countryCode) {
          return res.status(200).json({
            message: 'Error when searching for the country code',
            status: 'warning',
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            'videoData.country': country,
            'videoData.countryCode': countryCode,
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
        param: 'name',
        valueList: JSON.parse(researchers),
      });

      let acquirer = null;

      if (acquirerName) {
        acquirer = await getUserBy({
          searchBy: 'name',
          value: acquirerName,
        });
      }

      const researcherWithPaidAdvance = video.trelloData.researchers.find(
        (researcher) => researcher.advanceHasBeenPaid
      );

      if (
        !!researcherWithPaidAdvance &&
        researcherWithPaidAdvance.id.toString() !== acquirer._id.toString()
      ) {
        return res.status(200).json({
          message: 'You cannot change the acquirer for this video.',
          status: 'warning',
        });
      }

      const researchersListForCreatingVideo =
        defineResearchersListForCreatingVideo({
          mainResearcher: acquirer ? acquirer : null,
          allResearchersList: researchersList,
          researcherWithPaidAdvance,
          ...(!!researcherWithPaidAdvance && { researcherWithPaidAdvance }),
        });

      await updateVideoById({
        videoId: +videoId,
        dataToUpdate: {
          'videoData.originalVideoLink': originalLink,
          'videoData.title': title,
          'videoData.description': desc,
          ...(creditTo && { 'videoData.creditTo': creditTo }),
          'videoData.tags': JSON.parse(tags).map((el) => {
            return el.trim();
          }),
          'videoData.category': JSON.parse(category),
          'videoData.categoryReuters': categoryReuters,
          'videoData.city': city,
          ...(commentToAdmin && { commentToAdmin }),
          'videoData.date': JSON.parse(date),
          'trelloData.researchers': researchersListForCreatingVideo,
          ...(video.isApproved && { lastChange: new Date().toGMTString() }),
          reuters: JSON.parse(reuters),
          apVideoHub: JSON.parse(apVideoHub),
          socialMedia: JSON.parse(socialMedia),
        },
      });

      const updatedVideo = await findVideoByValue({
        searchBy: 'videoData.videoId',
        value: +videoId,
      });

      if (!!acquirerPaidAdvance) {
        if (!acquirerName) {
          return res.status(200).json({
            message: 'No acquirer found to record a note',
            status: 'warning',
          });
        }

        if (
          !updatedVideo.trelloData.researchers.find(
            (researcher) => researcher.id.toString() === acquirer._id.toString()
          )
        ) {
          return res.status(200).json({
            message:
              'This acquirer is not in the list of researchers for this video. Save the acquirer, and then add the amount',
            status: 'warning',
          });
        }

        const acquirerInTheVideoList = updatedVideo.trelloData.researchers.find(
          (researcher) => researcher.id.toString() === acquirer._id.toString()
        );

        await markResearcherAdvanceForOneVideoAsPaid({
          videoId: +videoId,
          researcherId: acquirer._id,
        });

        await updateUser({
          userId: acquirer._id,
          objDBForIncrement: {
            ...(!!acquirerInTheVideoList &&
              !acquirerInTheVideoList.advanceHasBeenPaid && {
                balance: -acquirer?.advancePayment,
              }),
            note: +acquirerPaidAdvance,
          },
        });
      }

      if (video.isApproved && video.brandSafe !== JSON.parse(brandSafe)) {
        console.log('change');

        //меняем кастомное поле "brand safe" в карточке trello
        await updateCustomFieldByTrelloCard(
          video.trelloData.trelloCardId,
          process.env.TRELLO_CUSTOM_FIELD_BRAND_SAFE,
          {
            idValue: JSON.parse(brandSafe)
              ? '6363888c65a44802954d88e5'
              : '6363888c65a44802954d88e4',
          }
        );
      }

      if (updatedVideo.isApproved === true) {
        await refreshMrssFiles();
      }

      const { _id, __v, updatedAt, ...data } = updatedVideo._doc;

      return res.status(200).json({
        message: `Video with id "${videoId}" has been successfully updated`,
        status: 'success',
        apiData: {
          ...data,
          ...(data.trelloData.researchers.find(
            (researcher) => researcher.main
          ) && {
            acquirerName: data.trelloData.researchers.find(
              (researcher) => researcher.main
            ).name,
          }),
        },
      });
    } catch (err) {
      console.log(err);
      return res.status(500).json({
        message: err?.message ? err?.message : 'Server side error',
        status: 'error',
      });
    }
  }
);

router.patch('/updateByValue', authMiddleware, async (req, res) => {
  try {
    const { searchBy, searchValue, refreshFeeds } = req.query;
    const { isApproved, wasRemovedFromPublication } = req.body;

    await updateVideoBy({
      searchBy,
      searchValue,
      dataToUpdate: {
        ...(typeof isApproved === 'boolean' && { isApproved }),
        ...(typeof wasRemovedFromPublication === 'boolean' && {
          wasRemovedFromPublication,
        }),
      },
    });

    if (refreshFeeds && JSON.parse(refreshFeeds)) {
      await refreshMrssFiles();
    }

    return res.status(200).json({
      message: `Video has been successfully updated`,
      status: 'success',
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: err?.message ? err?.message : 'Server side error',
      status: 'error',
    });
  }
});

router.patch(
  '/fixedVideo/:id',
  authMiddleware,

  multer({ storage: storage }).fields([
    {
      name: 'video',
      maxCount: 1,
    },
    {
      name: 'screen',
      maxCount: 1,
    },
  ]),

  async (req, res) => {
    const { id: videoId } = req.params;

    if (!videoId) {
      return res
        .status(200)
        .json({ message: 'missing "video id" parameter', status: 'warning' });
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
        message: 'Missing values for adding a new video',
        status: 'warning',
      });
    }

    if (!JSON.parse(researchers).find((name) => name === acquirerName)) {
      return res.status(200).json({
        message: 'The acquirer is not added to the list',
        status: 'warning',
      });
    }

    const { video: reqVideo, screen: reqScreen } = req.files;

    try {
      const video = await findVideoById(+videoId);

      if (!video) {
        return res.status(200).json({
          message: `video with id "${videoId}" not found`,
          status: 'warning',
        });
      }

      if (!vbCode && !!video.vbForm) {
        await updateVideoById({
          videoId: +videoId,
          dataToDelete: {
            needToBeFixed: 1,
            vbForm: 1,
            ...(!creditTo && { 'videoData.creditTo': 1 }),
          },
          dataToUpdate: {
            exclusivity: false,
          },
        });
      }

      if (vbCode) {
        const vbForm = await findOne({
          searchBy: 'formId',
          param: `VB${vbCode}`,
        });

        if (!vbForm) {
          return res.status(200).json({
            message: `The form with the vb code ${vbCode} was not found in the database`,
            status: 'warning',
          });
        }

        const videoWithVBForm = await findVideoByValue({
          searchBy: 'vbForm',
          value: vbForm._id,
        });

        if (
          videoWithVBForm &&
          videoWithVBForm._id.toString() !== video._id.toString()
        ) {
          return res.status(200).json({
            message: 'a video with such a "VB code" is already in the database',
            status: 'warning',
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
        if (path.extname(reqVideo[0].originalname) !== '.mp4') {
          return res.status(200).json({
            message: `Incorrect video extension`,
            status: 'warning',
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
                  reject({
                    status: 'error',
                    message: 'Error when reading a file from disk',
                  });
                } else {
                  await uploadFileToStorage(
                    reqVideo[0].originalname,
                    'converted-videos',
                    videoId,
                    buffer,
                    reqVideo[0].mimetype,
                    path.extname(reqVideo[0].originalname),
                    resolve,
                    reject,
                    'progressOfRequestInPublishing',
                    'Uploading the converted video to the bucket',
                    req.user.id
                  );
                }
              }
            );
          }
        );

        const bucketResponseByVideoUpload = await new Promise(
          async (resolve, reject) => {
            await uploadFileToStorage(
              reqVideo[0].originalname,
              'videos',
              videoId,
              reqVideo[0].buffer,
              reqVideo[0].mimetype,
              path.extname(reqVideo[0].originalname),
              resolve,
              reject,
              'progressOfRequestInPublishing',
              'Uploading video to the bucket',
              req.user.id
            );
          }
        );

        const duration = Math.floor(getDurationFromBuffer(reqVideo[0].buffer));

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            'bucket.cloudVideoLink':
              bucketResponseByVideoUpload.response.Location,
            'bucket.cloudVideoPath': bucketResponseByVideoUpload.response.Key,
            'bucket.cloudConversionVideoLink':
              bucketResponseByConvertedVideoUpload.response.Location,
            'bucket.cloudConversionVideoPath':
              bucketResponseByConvertedVideoUpload.response.Key,
            'videoData.duration': duration,
            'videoData.hasAudioTrack':
              responseAfterConversion.data.hasAudioTrack,
          },
        });
      }

      if (reqScreen) {
        if (path.extname(reqScreen[0].originalname) !== '.jpg') {
          return res.status(400).json({
            message: `Incorrect screen extension`,
            status: 'warning',
          });
        }

        const bucketResponseByScreenUpload = await new Promise(
          async (resolve, reject) => {
            await uploadFileToStorage(
              reqScreen[0].originalname,
              'screens',
              videoId,
              reqScreen[0].buffer,
              reqScreen[0].mimetype,
              path.extname(reqScreen[0].originalname),
              resolve,
              reject,
              'progressOfRequestInPublishing',
              'Uploading screen to the bucket',
              req.user.id
            );
          }
        );

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            'bucket.cloudScreenLink':
              bucketResponseByScreenUpload.response.Location,
            'bucket.cloudScreenPath': bucketResponseByScreenUpload.response.Key,
          },
        });
      }

      socketInstance
        .io()
        .sockets.in(req.user.id)
        .emit('progressOfRequestInPublishing', {
          event: 'Just a little bit left',
          file: null,
        });

      if (!country && video.country && !video.countryCode) {
        const countryCode = await findTheCountryCodeByName(
          video.videoData.country
        );

        if (!countryCode) {
          return res.status(400).json({
            message: 'Error when searching for the country code',
            status: 'error',
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            'videoData.countryCode': countryCode,
          },
        });
      }

      if (country) {
        const countryCode = await findTheCountryCodeByName(country);

        if (!countryCode) {
          return res.status(400).json({
            message: 'Error when searching for the country code',
            status: 'error',
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            'videoData.country': country,
            'videoData.countryCode': countryCode,
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
        param: 'name',
        valueList: JSON.parse(researchers),
      });

      let acquirer = null;

      if (acquirerName) {
        acquirer = await getUserBy({
          searchBy: 'name',
          value: acquirerName,
        });
      }

      const researcherWithPaidAdvance = video.trelloData.researchers.find(
        (researcher) => researcher.advanceHasBeenPaid
      );

      if (
        !!researcherWithPaidAdvance &&
        researcherWithPaidAdvance.id.toString() !== acquirer._id.toString()
      ) {
        return res.status(200).json({
          message: 'You cannot change the acquirer for this video.',
          status: 'warning',
        });
      }

      const researchersListForCreatingVideo =
        defineResearchersListForCreatingVideo({
          mainResearcher: acquirer ? acquirer : null,
          allResearchersList: researchersList,
          researcherWithPaidAdvance,
          ...(!!researcherWithPaidAdvance && { researcherWithPaidAdvance }),
        });

      await updateVideoById({
        videoId: +videoId,
        dataToUpdate: {
          'videoData.originalVideoLink': originalLink,
          'videoData.title': title,
          'videoData.description': desc,
          ...(creditTo && { 'videoData.creditTo': creditTo }),
          'videoData.tags': JSON.parse(tags).map((el) => {
            return el.trim();
          }),
          'videoData.category': JSON.parse(category),
          'videoData.categoryReuters': categoryReuters,
          'videoData.city': city,
          ...(commentToAdmin && { commentToAdmin }),
          'videoData.date': JSON.parse(date),
          'trelloData.researchers': researchersListForCreatingVideo,
          ...(video.isApproved && { lastChange: new Date().toGMTString() }),
          reuters: JSON.parse(reuters),
          apVideoHub: JSON.parse(apVideoHub),
          socialMedia: JSON.parse(socialMedia),
        },
      });

      await Video.updateOne(
        { 'videoData.videoId': +videoId },
        { $unset: { needToBeFixed: 1 } }
      );

      const updatedVideo = await findVideoByValue({
        searchBy: 'videoData.videoId',
        value: +videoId,
      });

      if (!!acquirerPaidAdvance) {
        if (!acquirerName) {
          return res.status(200).json({
            message: 'No acquirer found to record a note',
            status: 'warning',
          });
        }

        if (
          !updatedVideo.trelloData.researchers.find(
            (researcher) => researcher.id.toString() === acquirer._id.toString()
          )
        ) {
          return res.status(200).json({
            message:
              'This acquirer is not in the list of researchers for this video. Save the acquirer, and then add the amount',
            status: 'warning',
          });
        }

        const acquirerInTheVideoList = updatedVideo.trelloData.researchers.find(
          (researcher) => researcher.id.toString() === acquirer._id.toString()
        );

        await markResearcherAdvanceForOneVideoAsPaid({
          videoId: +videoId,
          researcherId: acquirer._id,
        });

        await updateUser({
          userId: acquirer._id,
          objDBForIncrement: {
            ...(!!acquirerInTheVideoList &&
              !acquirerInTheVideoList.advanceHasBeenPaid && {
                balance: -acquirer?.advancePayment,
              }),
            note: +acquirerPaidAdvance,
          },
        });
      }

      if (video.isApproved && video.brandSafe !== JSON.parse(brandSafe)) {
        //меняем кастомное поле "brand safe" в карточке trello
        await updateCustomFieldByTrelloCard(
          video.trelloData.trelloCardId,
          process.env.TRELLO_CUSTOM_FIELD_BRAND_SAFE,
          {
            idValue: JSON.parse(brandSafe)
              ? '6363888c65a44802954d88e5'
              : '6363888c65a44802954d88e4',
          }
        );
      }

      if (updatedVideo.isApproved === true) {
        await refreshMrssFiles();
      }

      const { _id, __v, updatedAt, ...data } = updatedVideo._doc;

      return res.status(200).json({
        message: `Video with id "${videoId}" has been successfully updated`,
        status: 'success',
        apiData: {
          ...data,
          ...(data.trelloData.researchers.find(
            (researcher) => researcher.main
          ) && {
            acquirerName: data.trelloData.researchers.find(
              (researcher) => researcher.main
            ).name,
          }),
        },
      });
    } catch (err) {
      console.log(err);
      res.status(400).json({ message: 'Server side error', status: 'error' });
    }
  }
);

router.patch('/addCommentForFixed', authMiddleware, async (req, res) => {
  try {
    const { comment, videoId } = req.body;

    const video = await findVideoByValue({
      searchBy: 'videoData.videoId',
      value: videoId,
    });

    if (!video) {
      return res.status(200).json({
        message: `Video with id "${videoId}" was not found`,
        status: 'warning',
      });
    }

    await video.updateOne({
      needToBeFixed: {
        comment,
      },
    });

    const updatedVideo = await Video.findOne({ 'videoData.videoId': videoId });

    return res.status(200).json({
      status: 'success',
      message: 'Edits added to the video',
      apiData: updatedVideo,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      status: 'success',
      message: 'Server-side error',
    });
  }
});

router.patch(
  '/publishing/:id',
  authMiddleware,
  multer({ storage: storage }).fields([
    {
      name: 'video',
      maxCount: 1,
    },
    {
      name: 'screen',
      maxCount: 1,
    },
  ]),
  async (req, res) => {
    const { id: videoId } = req.params;

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
        message: 'Missing values for adding a new video',
        status: 'warning',
      });
    }

    if (!JSON.parse(researchers).find((name) => name === acquirerName)) {
      return res.status(200).json({
        message: 'The acquirer is not added to the list',
        status: 'warning',
      });
    }

    const { video: reqVideo, screen: reqScreen } = req.files;

    try {
      const video = await findVideoById(+videoId);

      if (!video) {
        return res.status(404).json({
          message: `Video with id "${videoId}" was not found`,
          status: 'warning',
        });
      }

      if (video.isApproved === true) {
        return res.status(200).json({
          message: `The video with id "${videoId}" has already been published`,
          status: 'warning',
        });
      }

      if (video.needToBeFixed) {
        return res.status(200).json({
          message: `Before publishing, you need to make edits!`,
          status: 'warning',
        });
      }

      if (!vbCode && !!video.vbForm) {
        await updateVideoById({
          videoId: +videoId,
          dataToDelete: {
            needToBeFixed: 1,
            vbForm: 1,
            ...(!creditTo && { 'videoData.creditTo': 1 }),
          },
          dataToUpdate: {
            exclusivity: false,
          },
        });
      }

      if (vbCode) {
        const vbForm = await findOne({
          searchBy: 'formId',
          param: `VB${vbCode}`,
        });

        if (!vbForm) {
          return res.status(200).json({
            message: `The form with the vb code ${vbCode} was not found in the database`,
            status: 'warning',
          });
        }

        const videoWithVBForm = await findVideoByValue({
          searchBy: 'vbForm',
          value: vbForm._id,
        });

        if (
          videoWithVBForm &&
          videoWithVBForm._id.toString() !== video._id.toString()
        ) {
          return res.status(200).json({
            message: 'a video with such a "VB code" is already in the database',
            status: 'warning',
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
        if (path.extname(reqVideo[0].originalname) !== '.mp4') {
          return res.status(400).json({
            message: `Incorrect video extension`,
            status: 'warning',
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
                  reject({
                    status: 'error',
                    message: 'Error when reading a file from disk',
                  });
                } else {
                  await uploadFileToStorage(
                    reqVideo[0].originalname,
                    'converted-videos',
                    videoId,
                    buffer,
                    reqVideo[0].mimetype,
                    path.extname(reqVideo[0].originalname),
                    resolve,
                    reject,
                    'progressOfRequestInPublishing',
                    'Uploading the converted video to the bucket',
                    req.user.id
                  );
                }
              }
            );
          }
        );

        const bucketResponseByVideoUpload = await new Promise(
          async (resolve, reject) => {
            await uploadFileToStorage(
              reqVideo[0].originalname,
              'videos',
              videoId,
              reqVideo[0].buffer,
              reqVideo[0].mimetype,
              path.extname(reqVideo[0].originalname),
              resolve,
              reject,
              'progressOfRequestInPublishing',
              'Uploading video to the bucket',
              req.user.id
            );
          }
        );

        const duration = Math.floor(getDurationFromBuffer(reqVideo[0].buffer));

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            'bucket.cloudVideoLink':
              bucketResponseByVideoUpload.response.Location,
            'bucket.cloudVideoPath': bucketResponseByVideoUpload.response.Key,
            'bucket.cloudConversionVideoLink':
              bucketResponseByConvertedVideoUpload.response.Location,
            'bucket.cloudConversionVideoPath':
              bucketResponseByConvertedVideoUpload.response.Key,
            'videoData.duration': duration,
            'videoData.hasAudioTrack':
              responseAfterConversion.data.hasAudioTrack,
          },
        });
      }

      if (reqScreen) {
        if (path.extname(reqScreen[0].originalname) !== '.jpg') {
          return res.status(400).json({
            message: `Incorrect screen extension`,
            status: 'warning',
          });
        }

        const bucketResponseByScreenUpload = await new Promise(
          async (resolve, reject) => {
            await uploadFileToStorage(
              reqScreen[0].originalname,
              'screens',
              videoId,
              reqScreen[0].buffer,
              reqScreen[0].mimetype,
              path.extname(reqScreen[0].originalname),
              resolve,
              reject,
              'progressOfRequestInPublishing',
              'Uploading screen to the bucket',
              req.user.id
            );
          }
        );

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            'bucket.cloudScreenLink':
              bucketResponseByScreenUpload.response.Location,
            'bucket.cloudScreenPath': bucketResponseByScreenUpload.response.Key,
          },
        });
      }

      socketInstance
        .io()
        .sockets.in(req.user.id)
        .emit('progressOfRequestInPublishing', {
          event: 'Just a little bit left',
          file: null,
        });

      if (!country && video.country && !video.countryCode) {
        const countryCode = await findTheCountryCodeByName(
          video.videoData.country
        );

        if (!countryCode) {
          return res.status(400).json({
            message: 'Error when searching for the country code',
            status: 'error',
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            'videoData.countryCode': countryCode,
          },
        });
      }

      if (country) {
        const countryCode = await findTheCountryCodeByName(country);

        if (!countryCode) {
          return res.status(400).json({
            message: 'Error when searching for the country code',
            status: 'error',
          });
        }

        await updateVideoById({
          videoId: +videoId,
          dataToUpdate: {
            'videoData.country': country,
            'videoData.countryCode': countryCode,
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
        param: 'name',
        valueList: JSON.parse(researchers),
      });

      let acquirer = null;

      if (acquirerName) {
        acquirer = await getUserBy({
          searchBy: 'name',
          value: acquirerName,
        });
      }

      const researcherWithPaidAdvance = video.trelloData.researchers.find(
        (researcher) => researcher.advanceHasBeenPaid
      );

      if (
        !!researcherWithPaidAdvance &&
        researcherWithPaidAdvance.id.toString() !== acquirer._id.toString()
      ) {
        return res.status(200).json({
          message: 'You cannot change the acquirer for this video.',
          status: 'warning',
        });
      }

      const researchersListForCreatingVideo =
        defineResearchersListForCreatingVideo({
          mainResearcher: acquirer ? acquirer : null,
          allResearchersList: researchersList,
          researcherWithPaidAdvance,
          ...(!!researcherWithPaidAdvance && { researcherWithPaidAdvance }),
        });

      await updateVideoById({
        videoId: +videoId,
        dataToUpdate: {
          'videoData.originalVideoLink': originalLink,
          'videoData.title': title,
          'videoData.description': desc,
          ...(creditTo && { 'videoData.creditTo': creditTo }),
          'videoData.tags': JSON.parse(tags).map((el) => {
            return el.trim();
          }),
          'videoData.category': JSON.parse(category),
          'videoData.categoryReuters': categoryReuters,
          'videoData.city': city,
          'videoData.date': JSON.parse(date),
          'trelloData.researchers': researchersListForCreatingVideo,
          apVideoHub: JSON.parse(apVideoHub),
          reuters: JSON.parse(reuters),
          socialMedia: JSON.parse(socialMedia),
          isApproved: true,
          pubDate: moment().valueOf(),
        },
      });

      const updatedVideo = await findVideoByValue({
        searchBy: 'videoData.videoId',
        value: +videoId,
      });

      if (!!acquirerPaidAdvance) {
        if (!acquirerName) {
          return res.status(200).json({
            message: 'No acquirer found to record a note',
            status: 'warning',
          });
        }

        if (
          !updatedVideo.trelloData.researchers.find(
            (researcher) => researcher.id.toString() === acquirer._id.toString()
          )
        ) {
          return res.status(200).json({
            message:
              'This acquirer is not in the list of researchers for this video. Save the acquirer, and then add the amount',
            status: 'warning',
          });
        }

        const acquirerInTheVideoList = updatedVideo.trelloData.researchers.find(
          (researcher) => researcher.id.toString() === acquirer._id.toString()
        );

        await markResearcherAdvanceForOneVideoAsPaid({
          videoId: +videoId,
          researcherId: acquirer._id,
        });

        await updateUser({
          userId: acquirer._id,
          objDBForIncrement: {
            ...(!!acquirerInTheVideoList &&
              !acquirerInTheVideoList.advanceHasBeenPaid && {
                balance: -acquirer?.advancePayment,
              }),
            note: +acquirerPaidAdvance,
          },
        });
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

      //меняем кастомное поле "brand safe" в карточке trello
      await updateCustomFieldByTrelloCard(
        updatedVideo.trelloData.trelloCardId,
        process.env.TRELLO_CUSTOM_FIELD_BRAND_SAFE,
        {
          idValue: updatedVideo.brandSafe
            ? '6363888c65a44802954d88e5'
            : '6363888c65a44802954d88e4',
        }
      );

      //убираем наклейку "not published" в карточке trello
      await deleteLabelFromTrelloCard(
        updatedVideo.trelloData.trelloCardId,
        process.env.TRELLO_LABEL_NOT_PUBLISHED
      );

      return res.status(200).json({
        status: 'success',
        message: 'The video was successfully published',
      });
    } catch (err) {
      console.log(err);
      return res
        .status(500)
        .json({ message: 'Server side error', status: 'error' });
    }
  }
);

router.patch(
  '/publishingInSocialMedia/:id',
  authMiddleware,
  publishingVideoInSocialMedia
);

router.delete('/:id', authMiddleware, async (req, res) => {
  const { id: videoId } = req.params;

  try {
    const video = await findVideoById(+videoId);

    if (!video) {
      return res.status(404).json({
        message: `Video with id "${videoId}" was not found`,
        status: 'warning',
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
            message: 'There is no path to delete',
            status: 'warning',
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
      message: 'video successfully deleted',
      status: 'success',
      apiData: { trelloCardId: video.trelloData.trelloCardId },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: err?.message ? err?.message : 'Server side error',
      status: 'error',
    });
  }
});

router.get('/getSalesAnalytics/:videoId', authMiddleware, async (req, res) => {
  const { videoId } = req.params;

  try {
    const video = await findVideoByValue({
      searchBy: 'videoData.videoId',
      value: +videoId,
    });

    if (!video) {
      return res.status(200).json({
        status: 'warning',
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
          _id: '$videoId',
          amount: { $sum: '$amount' },
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
          'vbFormInfo.paidFor': true,
        },
      },
      {
        $group: {
          _id: '$videoId',
          amount: { $sum: '$vbFormInfo.amount' },
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
          'vbFormInfo.paidFor': false,
        },
      },
      {
        $group: {
          _id: '$videoId',
          amount: { $sum: '$vbFormInfo.amount' },
        },
      },
    ];

    const amountOfUnpaidSales = await Sales.aggregate(
      pipelineForFindingUnpaidSales
    );

    const apiData = {
      sales,
      analytics: {
        totalReceived: !totalOfAllSales.length ? 0 : totalOfAllSales[0].amount,
        shareOfSales,
        totalPayment: !amountOfPaidSales.length
          ? 0
          : amountOfPaidSales[0].amount,
        currentAccountBalance: !amountOfUnpaidSales.length
          ? 0
          : amountOfUnpaidSales[0].amount,
      },
    };

    return res.status(200).json({
      apiData,
      status: 'success',
      message: 'Video analytics on sales received',
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

//----------------------------------------------------------------

router.post(
  '/test',

  multer({ storage: storage }).fields([
    {
      name: 'video',
      maxCount: 1,
    },
    {
      name: 'screen',
      maxCount: 1,
    },
  ]),
  async (req, res) => {
    try {
      const scopes = ['https://www.googleapis.com/auth/youtube'];

      const url = googleApiOAuth2Instance.generateAuthUrl({
        access_type: 'online',
        scope: scopes,
      });

      //const { tokens } = await googleApiOAuth2Instance.getToken(
      //  '4/0Adeu5BUUANgI1X-fZA70Ly8zIOV3ljUyGVCBHDxA79lDYVuVFTOaTFIG7C59RcLDRSAcRQ'
      //);

      //console.log(tokens, 88);

      //oauth2Client.setCredentials({
      //  refresh_token:
      //    '1//0c_2NaRnTZYkaCgYIARAAGAwSNwF-L9IroHCFGx1mE4LME_TCeEKQ-9X_bRCk9A27QKLeVC7Qbeq7LZemQZxQ_vCBKqS6AvrkWeY',
      //  access_token:
      //    'ya29.a0AfB_byDZvsa7FL1r-JZGwr-wz-yvR8RzurAZtW1GvTl3pRGn3uDykam6iOOv1wkeYpH9gqAfNLquJmVndP2SG_ft1v7CvkQnLJOMeDLJzwfOlzcjE_qWnKa9Ov90RM4twgs9dJHEV3_Df69LdYCY03_QmrKffI_NAAaCgYKAcMSARMSFQGOcNnCaQWLODwoYNyP_zZ4ExS2Fw0169',
      //});

      //oauth2Client.getAccessToken((err, data) => {
      //  if (err) {
      //    console.log(err);
      //  }
      //  console.log(data, 88);
      //});

      //googleApiOAuth2Instance.on('tokens', (tokens) => {
      //  console.log(tokens, 33);
      //});

      //googleApiOAuth2Instance.refreshAccessToken((err, data) => {
      //  if (err) {
      //    console.log(err);
      //  }
      //  console.log(data);
      //});

      //console.log(data, 88);

      //google.youtube({ version: 'v3' }).videos.insert(
      //  {
      //    access_token:
      //      'ya29.a0AfB_byCOs0A40uZ3nozZj45lyy3AwDUtsN9cz2p5N0zGfcw0hg0Gk2ftt4oZ97mtyorNaF_a2Bs91DVqUA2Tnc6ybHJFBYUbF3zEgrEsHRpmHqXA2nJGGLy2zROOR78H__B_0beAZlAjjkON9FajVLFdMmmSwPR_AgaCgYKAY4SARMSFQGOcNnCRIJw-8-yR6YwzzAR7Lc1bA0169',

      //    part: 'snippet,contentDetails,status',

      //    resource: {
      //      snippet: {
      //        title: 'test',
      //        description: 'testov',
      //      },

      //      status: {
      //        privacyStatus: 'private',
      //      },
      //    },

      //    media: {
      //      body: fs.createReadStream('./sample-5s.mp4'),
      //    },
      //  },
      //  (error, data) => {
      //    if (error) {
      //      console.log(error);
      //    }
      //    console.log('https://www.youtube.com/watch?v=' + data.data.id);
      //  }
      //);

      //google.youtube('v3').channels.list(
      //  {
      //    //part: 'snippet,contentDetails,status',
      //    //chart: 'mostPopular',
      //    access_token:
      //      'ya29.a0AfB_byCmp5XQVkjGabYrA1lnHGZSQtCU5KouN_Op6F1EedjGsmrU1ogK-hKrB7FFn5LxbSqtlJBod0errNoyzfcKGejHKq7RD8MR0sTw3wBGORSprewPRQOM6dUjsMeiZNeVdfir4Oy8mAtRAbcrAgtO_zoIDfk3jQaCgYKARMSARMSFQGOcNnCr5M6KTw4VtZXSRtkb6Q6TA0169',
      //  },
      //  (error, data) => {
      //    if (error) {
      //      console.log(error);
      //    }
      //    console.log(data.data.items);
      //  }
      //);

      //EAAD88S70UJUBO9GPuYMl3pT2LCUDelGGgwBWfJtm3Oob6OPDpBHEaersNpfGp0FJOAYVdRiMUjFFWnZAjiQi383f6YjbsEciZCp1I2lyyDcXW2H2prM9lwT1SN2ohmqult9Eq2IArjSBylJmcovzrN1hZBeQ33Nk1nlNuUMZBnnLlZA8ydlHqD6O39mX5zt21

      return res.status(200).json({ text: 'success', apiData: url });
    } catch (err) {
      console.log(err);

      return res.status(400).json({ text: 'error' });
    }
  }
);

module.exports = router;
