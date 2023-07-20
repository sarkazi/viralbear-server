const express = require('express');
const router = express.Router();
const multer = require('multer');

const fs = require('fs');
const path = require('path');

const moment = require('moment');

const { v4: createUniqueHash } = require('uuid');

const Video = require('../entities/Video');

const authMiddleware = require('../middleware/auth.middleware');

const { generateVideoId } = require('../utils/generateVideoId');
const { findTimestampsBySearch } = require('../utils/findTimestampsBySearch');

const { getDurationFromBuffer } = require('fancy-video-duration');

const {
  findStartEndPointOfDuration,
} = require('../utils/findStartEndPointOfDuration');

const { findOne } = require('../controllers/uploadInfo.controller');

const {
  findOneRefFormByParam,
} = require('../controllers/authorLink.controller');

var Mutex = require('async-mutex').Mutex;
const mutex = new Mutex();

const {
  refreshMrssFiles,
  findByIsBrandSafe,
  creatingAndSavingFeeds,
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
  findVideoByVBCode,
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
  findAllVideos,
  findVideoByValue,
} = require('../controllers/video.controller');

const {
  findUsersByValueList,
  getUserBy,
} = require('../controllers/user.controller');

const { sendEmail } = require('../controllers/sendEmail.controller');

const {
  uploadFileToStorage,
  removeFileFromStorage,
} = require('../controllers/storage.controller');

const {
  getTrelloCardsFromDoneListByApprovedAndNot,
} = require('../controllers/trello.controller');

const {
  findTheRecordOfTheCardMovedToDone,
} = require('../controllers/movedToDoneList.controller');

const socketInstance = require('../socket.instance');

const {
  defineResearchersListForCreatingVideo,
} = require('../utils/defineResearchersListForCreatingVideo');
const { getAllSales } = require('../controllers/sales.controller');

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
        authorEmail,
        percentage,
        advancePayment,
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
        whereFilmed,
        whyDecide,
        whatHappen,
        whenFilmed,
        whoAppears,
        agreementLink,
        exclusivity,
        videoId: reqVideoId,
      } = req.body;

      const { video, screen } = req.files;

      if (
        path.extname(video[0].originalname) !== '.mp4' ||
        path.extname(screen[0].originalname) !== '.jpg'
      ) {
        return res
          .status(400)
          .json({ message: 'Invalid file/s extension', status: 'warning' });
      }

      let videoId;

      if (
        !originalLink ||
        !researchers.length ||
        !title ||
        !desc ||
        !tags ||
        !category ||
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
        return res.status(404).json({
          message: 'Missing values for adding a new video',
          status: 'warning',
        });
      }

      try {
        if (vbCode) {
          const form = await findOne(vbCode);

          if (!form) {
            return res.status(200).json({
              message: `The form with the vb code ${vbCode} was not found in the database`,
              status: 'warning',
            });
          }
        }

        const videoWithVBCode = await findVideoByVBCode(vbCode);

        if (videoWithVBCode) {
          return res.status(200).json({
            message: 'a video with such a "vbcode" is already in the database',
            status: 'warning',
          });
        }

        const countryCode = await findTheCountryCodeByName(country);

        if (!countryCode) {
          return res.status(400).json({
            message: 'Could not determine the country code',
            status: 'error',
          });
        }

        const responseAfterConversion = await convertingVideoToHorizontal(
          video[0],
          req.user.id
        );

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
                    'reuters-videos',

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

        const recordInTheDatabaseAboutTheMovedCard =
          await findTheRecordOfTheCardMovedToDone(trelloCardId);

        let researchersListForCreatingVideo;

        if (recordInTheDatabaseAboutTheMovedCard) {
          const userWhoDraggedTheCard = await getUserBy({
            param: '_id',
            value: recordInTheDatabaseAboutTheMovedCard.researcherId,
          });

          researchersListForCreatingVideo =
            await defineResearchersListForCreatingVideo({
              mainResearcher: userWhoDraggedTheCard,
              allResearchersList: researchersList,
            });
        } else {
          researchersListForCreatingVideo =
            await defineResearchersListForCreatingVideo({
              mainResearcher: null,
              allResearchersList: researchersList,
            });
        }

        const bodyForNewVideo = {
          videoId,
          originalLink,
          title,
          desc,
          ...(creditTo && {
            creditTo,
          }),
          tags: JSON.parse(tags).map((el) => {
            return el.trim();
          }),
          category,
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
          ...(agreementLink && {
            agreementLink,
          }),
          ...(vbCode && {
            vbCode: `VB${vbCode}`,
          }),
          ...(authorEmail && {
            authorEmail,
          }),
          ...(advancePayment && {
            advancePayment,
          }),
          ...(percentage && {
            percentage,
          }),
          ...(whereFilmed && {
            whereFilmed,
          }),
          ...(whyDecide && {
            whyDecide,
          }),
          ...(whatHappen && {
            whatHappen,
          }),
          ...(whenFilmed && {
            whenFilmed,
          }),
          ...(whoAppears && {
            whoAppears,
          }),
          bucketResponseByVideoUpload: bucketResponseByVideoUpload.response,
          bucketResponseByScreenUpload: bucketResponseByScreenUpload.response,
          bucketResponseByConversionVideoUpload:
            bucketResponseByConvertedVideoUpload.response,
        };

        const newVideo = await createNewVideo(bodyForNewVideo);

        if (!newVideo) {
          return res.status(400).json({
            message: 'Error while adding a new video',
            status: 'error',
          });
        }

        const videosReadyForPublication = await findReadyForPublication();

        const { doneTasks, approvedTasks } =
          await getTrelloCardsFromDoneListByApprovedAndNot();

        socketInstance.io().emit('findReadyForPublication', {
          data: {
            videosReadyForPublication,
            doneTasks,
            approvedTasks,
          },
          event: 'ready for publication',
        });

        socketInstance.io().emit('changeDoneAndApprovedCards', {
          doneTasks,
          approvedTasks,
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

router.post('/generateExcelFile', authMiddleware, generateExcelFile);

router.get('/findOne', authMiddleware, findLastVideo);

router.get('/findAll', async (req, res) => {
  const {
    category,
    tag,
    duration,
    location,
    postedDate,
    occured,
    page,
    isApproved,
    limit,
  } = req.query;

  let durationPoints = null;

  if (duration) {
    durationPoints = findStartEndPointOfDuration(duration);
  }
  try {
    let videos = await findAllVideos({
      durationPoints,
      category,
      tag,
      location,
      isApproved,
    });

    let count = 0;
    let pageCount = 0;

    if (postedDate) {
      if (typeof postedDate !== 'string') {
        const dateFrom = moment(postedDate[0])
          .utc()
          .add(1, 'd')
          .startOf('d')
          .toDate();
        const dateTo = moment(postedDate[1])
          .utc()
          .add(1, 'd')
          .startOf('d')
          .toDate();
        videos = videos.filter((video) => {
          const date = moment(video.createdAt).utc().startOf('d').toDate();
          return (
            date.getTime() >= dateFrom.getTime() &&
            date.getTime() <= dateTo.getTime()
          );
        });
      } else {
        const { dateFrom, dateTo } = findTimestampsBySearch(postedDate);
        videos = videos.filter((video) => {
          const date = moment(video.createdAt).utc().startOf('d').toDate();
          return (
            date.getTime() >= dateFrom.getTime() &&
            date.getTime() <= dateTo.getTime()
          );
        });
      }
    }
    if (occured) {
      if (typeof occured !== 'string') {
        const dateFrom = moment(occured[0])
          .utc()
          .add(1, 'd')
          .startOf('d')
          .toDate();
        const dateTo = moment(occured[1])
          .utc()
          .add(1, 'd')
          .startOf('d')
          .toDate();
        videos = videos.filter((video) => {
          const date = moment(video.videoData.date).utc().startOf('d').toDate();
          return (
            date.getTime() >= dateFrom.getTime() &&
            date.getTime() <= dateTo.getTime()
          );
        });
      } else {
        const { dateFrom, dateTo } = findTimestampsBySearch(occured);
        videos = videos.filter((video) => {
          const date = moment(video.videoData.date).utc().startOf('d').toDate();
          return (
            date.getTime() >= dateFrom.getTime() &&
            date.getTime() <= dateTo.getTime()
          );
        });
      }
    }

    if (limit && page) {
      count = videos.length;
      pageCount = Math.ceil(count / limit);
      const videosId = await Promise.all(
        videos.map(async (el) => {
          return await el.videoData.videoId;
        })
      );

      const skip = (page - 1) * limit;

      videos = await Video.find(
        {
          'videoData.videoId': { $in: videosId },
          isApproved: true,
        },
        { __v: 0, updatedAt: 0, _id: 0 }
      )
        .sort({ 'videoData.videoId': -1 })
        .collation({ locale: 'en_US', numericOrdering: true })
        .limit(limit)
        .skip(skip);
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

    return res.status(200).json(videosReadyForPublication);
  } catch (err) {
    console.log(err);

    return res.status(400).json({
      message: 'server side error',
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

    res.status(200).json(videoPendingChanges);
  } catch (err) {
    console.log(err);

    res.status(400).json({
      message: 'server side error',
    });
  }
});

router.get('/findByAuthor', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const videosWithVbCode = await getAllVideos({
      vbCode: true,
      isApproved: true,
      fieldsInTheResponse: [
        'videoData.title',
        'videoData.videoId',
        'uploadData.vbCode',
        'bucket.cloudScreenLink',
      ],
    });


    let videos = await Promise.all(
      videosWithVbCode.map(async (video) => {
        const vbForm = await findOne({
          searchBy: 'formId',
          param: video.uploadData.vbCode,
        });

        if (vbForm?.sender && vbForm.sender.toString() === userId.toString()) {
          const sales = await getAllSales({ videoId: video.videoData.videoId });

          let refForm = null;
          let revenue = 0;

          if (vbForm?.refFormId) {
            refForm = await findOneRefFormByParam({
              searchBy: '_id',
              value: vbForm.refFormId,
            });
          }

          if (sales.length && refForm && refForm?.percentage) {
            revenue = sales.reduce(
              (acc, sale) => acc + (sale.amount * refForm.percentage) / 100,
              0
            );
          }

          console.log(refForm, revenue);

          return {
            title: video.videoData.title,
            videoId: video.videoData.videoId,
            screenPath: video.bucket.cloudScreenLink,
            agreementDate: moment(vbForm.createdAt).format(),
            videoByThisAuthor: true,
            revenue: +revenue.toFixed(2),
            percentage:
              refForm && refForm?.percentage ? refForm?.percentage : 0,
          };
        } else {
          return { ...video._doc, videoByThisAuthor: false };
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

router.get('/findOne/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const video = await findById(id);

    if (!video) {
      return res.status(200).json({
        message: `Video with id "${id}" was not found`,
        status: 'warning',
      });
    }

    return res.status(200).json({
      message: `Video with id "${id}" was found`,
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

router.get('/findOneBy', async (req, res) => {
  try {
    const { searchBy, searchValue, pullUpVbFormData } = req.query;

    if (!searchBy || !searchValue) {
      return res.status(200).json({
        status: 'warning',
        message: 'Missing parameters for video search',
      });
    }

    let videoData = null;

    const video = await findVideoByValue({
      searchBy,
      value: JSON.parse(searchValue),
    });

    videoData = {
      ...video,
    };

    if (!video) {
      return res.status(200).json({
        status: 'warning',
        message: 'No such video was found',
      });
    }

    if (pullUpVbFormData && JSON.parse(pullUpVbFormData) === true) {
      videoData = {
        title: video.videoData.title,
        videoId: video.videoData.videoId,
        image: video.bucket.cloudScreenLink,
        authorEmail: '-',
        percentage: '-',
        advance: {
          value: '-',
          paid: '-',
        },
        paymentInfo: '-',
        salesCount: '-',
        published: video.isApproved === true ? 'yes' : 'no',
      };

      const salesOfThisVideo = await getAllSales({
        videoId: video.videoData.videoId,
      });

      videoData = {
        ...videoData,
        salesCount: salesOfThisVideo.length,
      };

      if (video.uploadData.vbCode) {
        const vbForm = await findOne({
          searchBy: 'formId',
          param: video.uploadData.vbCode,
        });

        if (vbForm.sender) {
          const authorRelatedWithVbForm = await getUserBy({
            param: '_id',
            value: vbForm.sender,
          });

          if (authorRelatedWithVbForm) {
            videoData = {
              ...videoData,
              authorEmail: authorRelatedWithVbForm.email,
              percentage: authorRelatedWithVbForm.percentage
                ? authorRelatedWithVbForm.percentage
                : 0,
              advance: {
                value:
                  typeof vbForm.advancePaymentReceived === 'boolean' &&
                  authorRelatedWithVbForm.advancePayment
                    ? authorRelatedWithVbForm.advancePayment
                    : 0,
                paid:
                  typeof vbForm.advancePaymentReceived !== 'boolean' &&
                  !authorRelatedWithVbForm.advancePayment
                    ? '-'
                    : vbForm.advancePaymentReceived === true
                    ? 'yes'
                    : 'no',
              },
              paymentInfo:
                authorRelatedWithVbForm.paymentInfo.variant === undefined
                  ? 'no'
                  : 'yes',
              salesCount: salesOfThisVideo.length,
            };
          }
        }
      }
    }

    return res.status(200).json({
      message: `Video data received`,
      status: 'success',
      apiData: videoData,
    });
  } catch (err) {
    console.log(err);
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
        .status(404)
        .json({ message: 'missing "video id" parameter', status: 'warning' });
    }

    const {
      originalLink,
      vbCode,
      authorEmail,
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
    } = req.body;

    const { video: reqVideo, screen: reqScreen } = req.files;

    try {
      const video = await findVideoById(+videoId);

      if (!video) {
        return res.status(404).json({
          message: `video with id "${videoId}" not found`,
          status: 'warning',
        });
      }

      if (authorEmail && !video?.uploadData?.vbCode && !vbCode) {
        return res.status(400).json({
          message: `the "author's email" field cannot be without "vb code"`,
          status: 'warning',
        });
      }

      if (!vbCode && video?.uploadData?.vbCode) {
        await updateVideoById(
          +videoId,
          {
            uploadData: {},
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      if (vbCode) {
        const form = await findOne(vbCode);

        if (!form) {
          return res.status(404).json({
            message: `The form with the vb code ${vbCode} was not found in the database`,
            status: 'warning',
          });
        }

        await updateVideoById(
          +videoId,
          {
            uploadData: {
              vbCode: `VB${vbCode}`,
              authorEmail: authorEmail ? authorEmail : form.email,
              agreementLink: form.agreementLink,
              ...(form.percentage && {
                percentage: form.percentage,
              }),
              ...(form.advancePayment && {
                advancePayment: form.advancePayment,
              }),
              ...(form.whereFilmed && {
                whereFilmed: form.whereFilmed,
              }),
              ...(form.whyDecide && {
                whyDecide: form.whyDecide,
              }),
              ...(form.whatHappen && {
                whatHappen: form.whatHappen,
              }),
              ...(form.whenFilmed && {
                whenFilmed: form.whenFilmed,
              }),
              ...(form.whoAppears && {
                whoAppears: form.whoAppears,
              }),
            },
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      if (authorEmail && !vbCode && video?.uploadData?.vbCode) {
        await updateVideoById(
          +videoId,
          {
            'uploadData.authorEmail': authorEmail,
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      if (reqVideo) {
        if (path.extname(reqVideo[0].originalname) !== '.mp4') {
          return res.status(400).json({
            message: `Incorrect video extension`,
            status: 'warning',
          });
        }

        const responseAfterConversion = await convertingVideoToHorizontal(
          reqVideo[0],
          req.user.id
        );

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
                    'reuters-videos',
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

        await updateVideoById(
          +videoId,
          {
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
          { creditTo: creditTo ? creditTo : null }
        );
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

        await updateVideoById(
          +videoId,
          {
            'bucket.cloudScreenLink':
              bucketResponseByScreenUpload.response.Location,
            'bucket.cloudScreenPath': bucketResponseByScreenUpload.response.Key,
          },
          { creditTo: creditTo ? creditTo : null }
        );
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

        await updateVideoById(
          videoId,
          {
            'videoData.countryCode': countryCode,
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      if (country) {
        const countryCode = await findTheCountryCodeByName(country);

        if (!countryCode) {
          return res.status(400).json({
            message: 'Error when searching for the country code',
            status: 'error',
          });
        }

        await updateVideoById(
          +videoId,
          {
            'videoData.country': country,
            'videoData.countryCode': countryCode,
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      if (JSON.parse(brandSafe) === false) {
        await updateVideoById(
          +videoId,
          {
            brandSafe: JSON.parse(brandSafe),
            publishedInSocialMedia: false,
          },
          { creditTo: creditTo ? creditTo : null }
        );
      } else {
        await updateVideoById(
          +videoId,
          {
            brandSafe: JSON.parse(brandSafe),
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      const trelloCardId = video.trelloData.trelloCardId;

      const researchersList = await findUsersByValueList({
        param: 'name',
        valueList: JSON.parse(researchers),
      });

      const recordInTheDatabaseAboutTheMovedCard =
        await findTheRecordOfTheCardMovedToDone(trelloCardId);

      let researchersListForCreatingVideo;

      if (recordInTheDatabaseAboutTheMovedCard) {
        const userWhoDraggedTheCard = await getUserBy({
          param: '_id',
          value: recordInTheDatabaseAboutTheMovedCard.researcherId,
        });

        researchersListForCreatingVideo =
          await defineResearchersListForCreatingVideo({
            mainResearcher: userWhoDraggedTheCard,
            allResearchersList: researchersList,
          });
      } else {
        researchersListForCreatingVideo =
          await defineResearchersListForCreatingVideo({
            mainResearcher: null,
            allResearchersList: researchersList,
          });
      }

      await updateVideoById(
        +videoId,
        {
          ...(originalLink && { 'videoData.originalVideoLink': originalLink }),
          ...(authorEmail && { 'uploadData.authorEmail': authorEmail }),
          ...(title && { 'videoData.title': title }),
          ...(desc && { 'videoData.description': desc }),
          ...(creditTo && { 'videoData.creditTo': creditTo }),
          ...(tags && {
            'videoData.tags': JSON.parse(tags).map((el) => {
              return el.trim();
            }),
          }),

          ...(category && { 'videoData.category': category }),
          ...(categoryReuters && {
            'videoData.categoryReuters': categoryReuters,
          }),
          ...(socialMedia && {
            socialMedia,
          }),
          ...(city && { 'videoData.city': city }),
          ...(reuters && { reuters }),
          ...(date && { 'videoData.date': JSON.parse(date) }),
          ...(researchers && {
            'trelloData.researchers': researchersListForCreatingVideo,
          }),
        },
        { creditTo: creditTo ? creditTo : null }
      );

      const updatedVideo = await findVideoById(+videoId);

      if (updatedVideo.isApproved === true) {
        const { status } = await creatingAndSavingFeeds(updatedVideo);

        if (status === 'warning') {
          return res.status(404).json({
            message: 'Missing values for saving feeds',
            status: 'warning',
          });
        }

        await refreshMrssFiles();
      }

      const { _id, __v, updatedAt, ...data } = updatedVideo._doc;

      //const videosForSocialMedia = await findByIsBrandSafe();

      //socketInstance.io().emit('findReadyForSocialMedia', videosForSocialMedia);

      return res.status(200).json({
        message: `Video with id "${videoId}" has been successfully updated`,
        status: 'success',
        apiData: data,
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
        .status(404)
        .json({ message: 'missing "video id" parameter', status: 'warning' });
    }

    const {
      originalLink,
      vbCode,
      authorEmail,
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
    } = req.body;

    const { video: reqVideo, screen: reqScreen } = req.files;

    try {
      const video = await findVideoById(+videoId);

      if (!video) {
        return res.status(404).json({
          message: `video with id "${videoId}" not found`,
          status: 'warning',
        });
      }

      if (authorEmail && !video?.uploadData?.vbCode && !vbCode) {
        return res.status(400).json({
          message: `the "author's email" field cannot be without "vb code"`,
          status: 'warning',
        });
      }

      if (!vbCode && video?.uploadData?.vbCode) {
        await updateVideoById(
          +videoId,
          {
            uploadData: {},
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      if (vbCode) {
        const form = await findOne(vbCode);

        if (!form) {
          return res.status(404).json({
            message: `The form with the vb code ${vbCode} was not found in the database`,
            status: 'warning',
          });
        }

        await updateVideoById(
          +videoId,
          {
            uploadData: {
              vbCode: `VB${vbCode}`,
              authorEmail: authorEmail ? authorEmail : form.email,
              agreementLink: form.agreementLink,
              ...(form.percentage && {
                percentage: form.percentage,
              }),
              ...(form.advancePayment && {
                advancePayment: form.advancePayment,
              }),
              ...(form.whereFilmed && {
                whereFilmed: form.whereFilmed,
              }),
              ...(form.whyDecide && {
                whyDecide: form.whyDecide,
              }),
              ...(form.whatHappen && {
                whatHappen: form.whatHappen,
              }),
              ...(form.whenFilmed && {
                whenFilmed: form.whenFilmed,
              }),
              ...(form.whoAppears && {
                whoAppears: form.whoAppears,
              }),
            },
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      if (authorEmail && !vbCode && video?.uploadData?.vbCode) {
        await updateVideoById(
          +videoId,
          {
            'uploadData.authorEmail': authorEmail,
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      if (reqVideo) {
        if (path.extname(reqVideo[0].originalname) !== '.mp4') {
          return res.status(400).json({
            message: `Incorrect video extension`,
            status: 'warning',
          });
        }

        const responseAfterConversion = await convertingVideoToHorizontal(
          reqVideo[0],
          req.user.id
        );

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
                    'reuters-videos',
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

        await updateVideoById(
          +videoId,
          {
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
          { creditTo: creditTo ? creditTo : null }
        );
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

        await updateVideoById(
          +videoId,
          {
            'bucket.cloudScreenLink':
              bucketResponseByScreenUpload.response.Location,
            'bucket.cloudScreenPath': bucketResponseByScreenUpload.response.Key,
          },
          { creditTo: creditTo ? creditTo : null }
        );
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

        await updateVideoById(
          videoId,
          {
            'videoData.countryCode': countryCode,
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      if (country) {
        const countryCode = await findTheCountryCodeByName(country);

        if (!countryCode) {
          return res.status(400).json({
            message: 'Error when searching for the country code',
            status: 'error',
          });
        }

        await updateVideoById(
          +videoId,
          {
            'videoData.country': country,
            'videoData.countryCode': countryCode,
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      if (JSON.parse(brandSafe) === false) {
        await updateVideoById(
          +videoId,
          {
            brandSafe: JSON.parse(brandSafe),
            publishedInSocialMedia: false,
          },
          { creditTo: creditTo ? creditTo : null }
        );
      } else {
        await updateVideoById(
          +videoId,
          {
            brandSafe: JSON.parse(brandSafe),
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      const trelloCardId = video.trelloData.trelloCardId;

      const researchersList = await findUsersByValueList({
        param: 'name',
        valueList: JSON.parse(researchers),
      });

      const recordInTheDatabaseAboutTheMovedCard =
        await findTheRecordOfTheCardMovedToDone(trelloCardId);

      let researchersListForCreatingVideo;

      if (recordInTheDatabaseAboutTheMovedCard) {
        const userWhoDraggedTheCard = await getUserBy({
          param: '_id',
          value: recordInTheDatabaseAboutTheMovedCard.researcherId,
        });

        researchersListForCreatingVideo =
          await defineResearchersListForCreatingVideo({
            mainResearcher: userWhoDraggedTheCard,
            allResearchersList: researchersList,
          });
      } else {
        researchersListForCreatingVideo =
          await defineResearchersListForCreatingVideo({
            mainResearcher: null,
            allResearchersList: researchersList,
          });
      }

      await updateVideoById(
        +videoId,
        {
          ...(originalLink && { 'videoData.originalVideoLink': originalLink }),
          ...(vbCode && { 'uploadData.vbCode': `VB${vbCode}` }),
          ...(authorEmail && { 'uploadData.authorEmail': authorEmail }),
          ...(title && { 'videoData.title': title }),
          ...(desc && { 'videoData.description': desc }),
          ...(creditTo && { 'videoData.creditTo': creditTo }),
          ...(tags && {
            'videoData.tags': JSON.parse(tags).map((el) => {
              return el.trim();
            }),
          }),

          ...(category && { 'videoData.category': category }),
          ...(categoryReuters && {
            'videoData.categoryReuters': categoryReuters,
          }),
          ...(socialMedia && {
            socialMedia,
          }),
          ...(city && { 'videoData.city': city }),
          ...(reuters && { reuters }),
          ...(date && { 'videoData.date': JSON.parse(date) }),
          ...(researchers && {
            'trelloData.researchers': researchersListForCreatingVideo,
          }),
        },
        { creditTo: creditTo ? creditTo : null }
      );

      await Video.updateOne(
        { 'videoData.videoId': +videoId },
        { $unset: { needToBeFixed: 1 } }
      );

      const updatedVideo = await findVideoById(+videoId);

      if (updatedVideo.isApproved === true) {
        const { status } = await creatingAndSavingFeeds(updatedVideo);

        if (status === 'warning') {
          return res.status(404).json({
            message: 'Missing values for saving feeds',
            status: 'warning',
          });
        }

        await refreshMrssFiles();
      }

      const { _id, __v, updatedAt, ...data } = updatedVideo._doc;

      const videoPendingChanges = await findByFixed();

      socketInstance.io().emit('toggleCommentForFixedVideo', {
        videos: videoPendingChanges,
        event: 'fix',
      });

      //const videosForSocialMedia = await findByIsBrandSafe();

      //socketInstance.io().emit('findReadyForSocialMedia', videosForSocialMedia);

      return res.status(200).json({
        message: `Video with id "${videoId}" has been successfully updated`,
        status: 'success',
        apiData: data,
      });
    } catch (err) {
      console.log(err);
      res.status(400).json({ message: 'Server side error', status: 'error' });
    }
  }
);

router.patch('/addCommentForFixed', authMiddleware, addCommentForFixed);

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
      authorEmail,
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
      socialMedia,
    } = req.body;

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

      if (authorEmail && !video?.uploadData?.vbCode && !vbCode) {
        return res.status(400).json({
          message: `the "author's email" field cannot be without "vb code"`,
          status: 'warning',
        });
      }

      if (!vbCode && video?.uploadData?.vbCode) {
        await updateVideoById(
          +videoId,
          {
            uploadData: {},
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      if (vbCode) {
        const form = await findOne(vbCode);

        if (!form) {
          return res.status(404).json({
            message: `The form with the vb code ${vbCode} was not found in the database`,
            status: 'warning',
          });
        }

        await updateVideoById(
          +videoId,
          {
            uploadData: {
              vbCode: `VB${vbCode}`,
              authorEmail: authorEmail ? authorEmail : form.email,
              agreementLink: form.agreementLink,
              ...(form.percentage && {
                percentage: form.percentage,
              }),
              ...(form.advancePayment && {
                advancePayment: form.advancePayment,
              }),
              ...(form.whereFilmed && {
                whereFilmed: form.whereFilmed,
              }),
              ...(form.whyDecide && {
                whyDecide: form.whyDecide,
              }),
              ...(form.whatHappen && {
                whatHappen: form.whatHappen,
              }),
              ...(form.whenFilmed && {
                whenFilmed: form.whenFilmed,
              }),
              ...(form.whoAppears && {
                whoAppears: form.whoAppears,
              }),
            },
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      if (authorEmail && !vbCode && video?.uploadData?.vbCode) {
        await updateVideoById(
          +videoId,
          {
            'uploadData.authorEmail': authorEmail,
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      if (reqVideo) {
        if (path.extname(reqVideo[0].originalname) !== '.mp4') {
          return res.status(400).json({
            message: `Incorrect video extension`,
            status: 'warning',
          });
        }

        const responseAfterConversion = await convertingVideoToHorizontal(
          reqVideo[0],
          req.user.id
        );

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
                    'reuters-videos',
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

        await updateVideoById(
          +videoId,
          {
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
          { creditTo: creditTo ? creditTo : null }
        );
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

        await updateVideoById(
          +videoId,
          {
            'bucket.cloudScreenLink':
              bucketResponseByScreenUpload.response.Location,
            'bucket.cloudScreenPath': bucketResponseByScreenUpload.response.Key,
          },
          { creditTo: creditTo ? creditTo : null }
        );
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

        await updateVideoById(
          videoId,
          {
            'videoData.countryCode': countryCode,
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      if (country) {
        const countryCode = await findTheCountryCodeByName(country);

        if (!countryCode) {
          return res.status(400).json({
            message: 'Error when searching for the country code',
            status: 'error',
          });
        }

        await updateVideoById(
          +videoId,
          {
            'videoData.country': country,
            'videoData.countryCode': countryCode,
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      if (
        video.publishedInSocialMedia === true &&
        JSON.parse(brandSafe) === false
      ) {
        await updateVideoById(
          +videoId,
          {
            brandSafe: JSON.parse(brandSafe),
            publishedInSocialMedia: false,
          },
          {
            creditTo: creditTo ? creditTo : null,
          }
        );
      } else {
        await updateVideoById(
          +videoId,
          {
            brandSafe: JSON.parse(brandSafe),
          },
          { creditTo: creditTo ? creditTo : null }
        );
      }

      const trelloCardId = video.trelloData.trelloCardId;

      const researchersList = await findUsersByValueList({
        param: 'name',
        valueList: JSON.parse(researchers),
      });

      const recordInTheDatabaseAboutTheMovedCard =
        await findTheRecordOfTheCardMovedToDone(trelloCardId);

      let researchersListForCreatingVideo;

      if (recordInTheDatabaseAboutTheMovedCard) {
        const userWhoDraggedTheCard = await getUserBy({
          param: '_id',
          value: recordInTheDatabaseAboutTheMovedCard.researcherId,
        });

        researchersListForCreatingVideo =
          await defineResearchersListForCreatingVideo({
            mainResearcher: userWhoDraggedTheCard,
            allResearchersList: researchersList,
          });
      } else {
        researchersListForCreatingVideo =
          await defineResearchersListForCreatingVideo({
            mainResearcher: null,
            allResearchersList: researchersList,
          });
      }

      await updateVideoById(
        +videoId,
        {
          ...(originalLink && { 'videoData.originalVideoLink': originalLink }),
          ...(vbCode && { 'uploadData.vbCode': `VB${vbCode}` }),
          ...(authorEmail && { 'uploadData.authorEmail': authorEmail }),
          ...(title && { 'videoData.title': title }),
          ...(desc && { 'videoData.description': desc }),
          ...(creditTo && { 'videoData.creditTo': creditTo }),
          ...(tags && {
            'videoData.tags': JSON.parse(tags).map((el) => {
              return el.trim();
            }),
          }),

          ...(category && { 'videoData.category': category }),
          ...(categoryReuters && {
            'videoData.categoryReuters': categoryReuters,
          }),
          ...(socialMedia && {
            socialMedia,
          }),
          ...(city && { 'videoData.city': city }),
          ...(reuters && { reuters }),
          ...(date && { 'videoData.date': JSON.parse(date) }),
          ...(researchers && {
            'trelloData.researchers': researchersListForCreatingVideo,
          }),
          isApproved: true,
          pubDate: moment().valueOf(),
        },
        { creditTo: creditTo ? creditTo : null }
      );

      const updatedVideo = await findVideoById(+videoId);

      const { status } = await creatingAndSavingFeeds(updatedVideo);

      if (status === 'warning') {
        return res.status(404).json({
          message: 'Missing values for saving feeds',
          status: 'warning',
        });
      }

      await refreshMrssFiles();

      const videosReadyForPublication = await findReadyForPublication();

      socketInstance.io().emit('findReadyForPublication', {
        data: {
          videosReadyForPublication,
        },
        event: 'published',
      });

      //const videosForSocialMedia = await findByIsBrandSafe();

      //socketInstance.io().emit('findReadyForSocialMedia', videosForSocialMedia);

      return res.status(200).json({
        apiData: {
          trelloCardId: video.trelloData.trelloCardId,
          videoId: video.videoData.videoId,
          brandSafe: video.brandSafe,
        },
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

    //const videosForSocialMedia = await findByIsBrandSafe();

    //socketInstance.io().emit('findReadyForSocialMedia', videosForSocialMedia);

    const videoPendingChanges = await findByFixed();

    socketInstance.io().emit('toggleCommentForFixedVideo', {
      videos: videoPendingChanges,
      event: 'delete video',
    });

    const videosReadyForPublication = await findReadyForPublication();

    socketInstance.io().emit('findReadyForPublication', {
      data: {
        videosReadyForPublication,
      },
      event: 'delete video',
    });

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

//----------------------------------------------------------------

router.post(
  '/test',
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
    const video = req.files.video[0];
    const userId = req.user.id;

    console.log(mutex.isLocked(), 67577);

    mutex
      .runExclusive(async () => {
        try {
          const response = await new Promise(async (resolve, reject) => {
            const response = await convertingVideoToHorizontal(video, userId);

            if (response.status === 'error') {
              reject({ status: 'error', message: response.message });
            } else {
              resolve({
                status: 'success',
                apiData: response.data,
                message: response.message,
              });
            }
          });

          const bucketResponseByConvertedVideoUpload = await new Promise(
            (resolve, reject) => {
              fs.readFile(
                path.resolve(
                  `./videos/${req.user.id}/output-for-conversion.mp4`
                ),
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
                      video.originalname,
                      'testo',
                      createUniqueHash(),
                      buffer,
                      video.mimetype,
                      path.extname(video.originalname),
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

          const bucketResponseByVideoUpload = await new Promise(
            async (resolve, reject) => {
              await uploadFileToStorage(
                video.originalname,
                'testo',
                createUniqueHash(),
                video.buffer,
                video.mimetype,
                path.extname(video.originalname),
                resolve,
                reject,
                'progressOfRequestInPublishing',
                'Uploading video to the bucket',
                userId
              );
            }
          );

          console.log(bucketResponseByVideoUpload);

          return res.status(200).json({
            status: 'success',
            message: response.message,
            apiData: bucketResponseByVideoUpload,
          });
        } catch (err) {
          console.log(err);
          return res.status(500).json({
            status: 'error',
            message: err?.response?.message,
          });
        }
      })
      .then((result) => {
        console.log(result);
      });
  }
);

module.exports = router;
