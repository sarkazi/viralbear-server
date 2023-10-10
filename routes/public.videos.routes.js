const express = require('express');
const router = express.Router();

const Video = require('../entities/Video');
const moment = require('moment');
const { findTimestampsBySearch } = require('../utils/findTimestampsBySearch');
const {
  findStartEndPointOfDuration,
} = require('../utils/findStartEndPointOfDuration');
const { errorsHandler } = require('../handlers/error.handler');

const {
  getAllVideos,
  findNextVideoInFeed,
  findPrevVideoInFeed,
  findVideoBy,
} = require('../controllers/video.controller');

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
    wasRemovedFromPublication,
  } = req.query;

  let durationPoints = null;

  if (duration) {
    durationPoints = findStartEndPointOfDuration(duration);
  }
  try {
    let videos = await getAllVideos({
      durationPoints,
      category,
      tag,
      location,
      ...(isApproved &&
        typeof JSON.parse(isApproved) === 'boolean' && {
          isApproved: JSON.parse(isApproved),
        }),
      ...(wasRemovedFromPublication &&
        typeof JSON.parse(wasRemovedFromPublication) === 'boolean' && {
          wasRemovedFromPublication: JSON.parse(wasRemovedFromPublication),
        }),
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
    console.log(errorsHandler({ err, trace: 'public.video.findAll' }));;

    return res.status(500).json({
      status: 'error',
      message: 'Server side error',
    });
  }
});

router.get('/findOne/:id', async (req, res) => {
  try {
    const { id } = req.params;

    video = await findVideoBy({ searchBy: 'videoData.videoId', value: +id });

    if (!video) {
      return res.status(200).json({
        message: `Video with id "${id}" was not found`,
        status: 'warning',
      });
    }

    if (!video.isApproved) {
      return res.status(200).json({
        message: 'This video is not available in the feed',
        status: 'warning',
      });
    }

    return res.status(200).json({
      apiData: video,
      status: 'success',
      message: 'Video info successfully received',
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: 'public.video.findOne' }));;
  }
});

router.get('/findOne/next/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const video = await findNextVideoInFeed({ currentVideoId: +id });

    if (!video.length) {
      return res.status(200).json({
        status: 'warning',
        message: 'This is the last video',
      });
    }

    return res.status(200).json({
      apiData: video[0],
      status: 'success',
      message: 'Video info successfully received',
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: 'public.video.findOne.next' }));;
  }
});

router.get('/findOne/prev/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const video = await findPrevVideoInFeed({ currentVideoId: +id });

    if (!video.length) {
      return res.status(200).json({
        status: 'warning',
        message: 'This is first video',
      });
    }

    return res.status(200).json({
      apiData: video[0],
      status: 'success',
      message: 'Video info successfully received',
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: 'public.video.findOne.prev' }));;
  }
});

module.exports = router;
