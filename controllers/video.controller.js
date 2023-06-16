const Video = require('../entities/Video');

const storageInstance = require('../storage.instance');
const moment = require('moment');

const Stream = require('stream');

const path = require('path');
const fs = require('fs');

const socketInstance = require('../socket.instance');

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const ffprobe = require('ffprobe');
const ffprobeStatic = require('ffprobe-static');

const axios = require('axios');
const trelloInstance = require('../api/trello.instance');

const { exportsVideoToExcel } = require('../utils/exportsVideoToExcel');

const {
  findStartEndPointOfDuration,
} = require('../utils/findStartEndPointOfDuration');

const { findTimestampsBySearch } = require('../utils/findTimestampsBySearch');
const { timeStamp } = require('console');

const filePath2 = path.join(
  __dirname,
  '..',
  '/localstorage',
  'localstorage.txt'
);

const refreshMrssFiles = async () => {
  const mrssFilePath = path.join(__dirname, '..', 'mrssFiles', 'mrss.xml');
  const mrss2FilePath = path.join(__dirname, '..', 'mrssFiles', 'mrss2.xml');
  const mrssConvertedVideosFilePath = path.join(
    __dirname,
    '..',
    'mrssFiles',
    'mrssConvertedVideos.xml'
  );

  const videosForMrssFile = await Video.find({
    isApproved: true,
  })
    .limit(50)
    .sort({ $natural: -1 });

  const videosForMrssConvertedVFiles = await Video.find({
    isApproved: true,
    'videoData.hasAudioTrack': true,
    reuters: true,
    mRSSConvertedVideos: { $exists: true },
  })
    .limit(50)
    .sort({ $natural: -1 });

  const videosForMrss2File = await Video.find({
    isApproved: true,
    mRSS: { $exists: true },
    mRSS2: { $exists: true },
    brandSafe: true,
  })
    .limit(50)
    .sort({ $natural: -1 });

  fs.writeFile(
    mrssFilePath,
    `<?xml version="1.0" encoding="UTF-8"?><rss xmlns:atom="http://www.w3.org/2005/Atom"
        xmlns:media="http://search.yahoo.com/mrss/"
        xmlns:openSearch="http://a9.com/-/spec/opensearchrss/1.0/"
        xmlns:dfpvideo="http://api.google.com/dfpvideo"
        xmlns:tms="http://data.tmsapi.com/v1.1"
        version="2.0">
         <channel>
           <title>ViralBear videos</title>
           <dfpvideo:version>2</dfpvideo:version>${videosForMrssFile
             .map((video) => video.mRSS)
             .join('')}</channel>
           </rss>`,
    () => {}
  );

  fs.writeFile(
    mrss2FilePath,
    `<?xml version="1.0" encoding="UTF-8"?><rss xmlns:atom="http://www.w3.org/2005/Atom"
        xmlns:media="http://search.yahoo.com/mrss/"
        xmlns:openSearch="http://a9.com/-/spec/opensearchrss/1.0/"
        xmlns:dfpvideo="http://api.google.com/dfpvideo"
        xmlns:tms="http://data.tmsapi.com/v1.1"
        version="2.0">
         <channel>
           <title>ViralBear videos</title>
           <dfpvideo:version>2</dfpvideo:version>${videosForMrss2File
             .map((video) => video.mRSS2)
             .join('')}</channel>
           </rss>`,
    () => {}
  );

  fs.writeFile(
    mrssConvertedVideosFilePath,
    `<?xml version="1.0" encoding="UTF-8"?><rss xmlns:atom="http://www.w3.org/2005/Atom"
        xmlns:media="http://search.yahoo.com/mrss/"
        xmlns:openSearch="http://a9.com/-/spec/opensearchrss/1.0/"
        xmlns:dfpvideo="http://api.google.com/dfpvideo"
        xmlns:tms="http://data.tmsapi.com/v1.1"
        version="2.0">
         <channel>
           <title>ViralBear videos</title>
           <dfpvideo:version>2</dfpvideo:version>${videosForMrssConvertedVFiles
             .map((video) => video?.mRSSConvertedVideos)
             .join('')}</channel>
           </rss>`,
    () => {}
  );
};

const findTheCountryCodeByName = async (countryName) => {
  const { data: response } = await axios.get(
    `https://geohelper.info/api/v1/countries?locale[lang]=en`,
    {
      params: {
        apiKey: process.env.GEOHELPER_API_KEY,
      },
    }
  );

  const countryCode = response.result.find(
    (country) => country.name === countryName
  );

  return countryCode.iso;
};

const generateExcelFile = async (req, res) => {
  const { range } = req.body;

  let listVideo = [];
  for (u of range) {
    const video = await Video.findOne({ 'videoData.videoId': +u });
    if (video) {
      listVideo.push(u);
    }
  }

  if (listVideo.length === 0) {
    res.set('Content-Type', 'application/json');
    res
      .status(200)
      .json({ message: 'Videos with the id of this range were not found' });
    return;
  }

  let dataFromFoundVideo = [];

  for (i of listVideo) {
    const video = await Video.findOne({ 'videoData.videoId': +i });

    let objectExcel = {
      id: video.videoData.videoId,
      title: video.videoData.title,
      videoLink: video.bucket.cloudVideoLink,
      story: video.videoData.description,
      date: video.videoData.date,
      city: video.videoData.city,
      country: video.videoData.country,
      keywords: video.videoData.tags.toString(),
    };
    dataFromFoundVideo.push(objectExcel);
  }

  const columnList = [
    'ID',
    'TITLE',
    'VideoLink',
    'STORY',
    'DATE',
    'CITY',
    'COUNTRY',
    'KEYWORDS',
  ];

  const workSheetName = 'Videos';
  const filePathExcel = path.join(__dirname, '..', 'excel', 'data.xlsx');

  exportsVideoToExcel(
    dataFromFoundVideo,
    columnList,
    workSheetName,
    filePathExcel
  );

  setTimeout(() => {
    fs.writeFile(filePath2, ``, (err) => {
      if (err) {
        throw err;
      }
    });
  }, 2000);

  res.set(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.status(200).download(path.resolve(__dirname, '..', 'excel', 'data.xlsx'));
};

const updateVideoById = async (id, dataValues, { creditTo }) => {
  const updatedVideo = await Video.updateOne(
    {
      'videoData.videoId': id,
    },
    {
      $set: dataValues,
      ...(!creditTo && { $unset: { 'videoData.creditTo': 1 } }),
    }
  );
};

const findLastVideo = async (req, res) => {
  try {
    const lastAddedVideo = await Video.findOne({ isApproved: false })
      .sort({ createdAt: -1 })
      .limit(1);
    if (!lastAddedVideo) {
      return res.status(200).json({ message: 'No data found!' });
    }
    res.status(200).json(lastAddedVideo);
  } catch (err) {
    console.log(err);
    throw Error('Database error!');
  }
};

const findNextVideoInFeed = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findOne({
      isApproved: true,
      'videoData.videoId': { $gt: +id },
    });

    if (!video) {
      return res.status(200).json({ message: `Video with id ${id} not found` });
    }

    const nextVideo = await Video.findOne({
      isApproved: true,
      'videoData.videoId': { $gt: +video.videoData.videoId },
    });

    const { updatedAt, __v, _id, ...data } = video._doc;

    res.status(200).json({
      data: data,
      isLastVideo: nextVideo ? false : true,
    });
  } catch (err) {
    console.log(err);
    throw Error('Server side error...');
  }
};

const uploadContentOnBucket = async (buffer, name, bucketPath) => {
  var bucketRequest = await storageInstance.Upload(
    [
      {
        buffer,
        name,
      },
    ],
    bucketPath
  );

  return bucketRequest;
};

const findPrevVideoInFeed = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.find(
      {
        isApproved: true,
        'videoData.videoId': { $lt: +id },
      },
      { updatedAt: 0, _id: 0, __v: 0 }
    )
      .limit(1)
      .sort({ 'videoData.videoId': -1 });

    if (!video) {
      return res.status(200).json({ message: `Video with id ${id} not found` });
    }

    const prevVideo = await Video.find({
      isApproved: true,
      'videoData.videoId': { $lt: +video[0]?.videoData?.videoId },
    })
      .limit(1)
      .sort({ 'videoData.videoId': -1 });

    res.status(200).json({
      data: video[0],
      isFirstVideo: prevVideo[0] ? false : true,
    });
  } catch (err) {
    console.log(err);
    throw Error('Server side error...');
  }
};

const createNewVideo = async (body) => {
  const newVideo = await Video.create({
    videoData: {
      videoId: body.videoId,
      originalVideoLink: body.originalLink,
      title: body.title,
      description: body.desc,
      ...(body.creditTo && {
        creditTo: body.creditTo,
      }),
      tags: body.tags,
      category: body.category,
      categoryReuters: body.categoryReuters,
      city: body.city,
      country: body.country,
      countryCode: body.countryCode,
      date: body.date,
      duration: body.duration,
      hasAudioTrack: body.hasAudioTrack,
    },
    trelloData: {
      trelloCardUrl: body.trelloCardUrl,
      trelloCardId: body.trelloCardId,
      trelloCardName: body.trelloCardName,
      researchers: body.researchers,
      priority: body.priority,
    },
    uploadData: {
      ...(body.vbCode && {
        vbCode: body.vbCode,
      }),
      ...(body.agreementLink && {
        agreementLink: body.agreementLink,
      }),
      ...(body.authorEmail && {
        authorEmail: body.authorEmail,
      }),
      ...(body.advancePayment && {
        advancePayment: body.advancePayment,
      }),
      ...(body.percentage && {
        percentage: body.percentage,
      }),
      ...(body.whereFilmed && {
        whereFilmed: body.whereFilmed,
      }),
      ...(body.whyDecide && {
        whyDecide: body.whyDecide,
      }),
      ...(body.whatHappen && {
        whatHappen: body.whatHappen,
      }),
      ...(body.whenFilmed && {
        whenFilmed: body.whenFilmed,
      }),
      ...(body.whoAppears && {
        whoAppears: body.whoAppears,
      }),
    },
    bucket: {
      cloudVideoLink: body.bucketResponseByVideoUpload.Location,
      cloudScreenLink: body.bucketResponseByScreenUpload.Location,
      cloudVideoPath: body.bucketResponseByVideoUpload.Key,
      cloudScreenPath: body.bucketResponseByScreenUpload.Key,
      cloudConversionVideoLink:
        body.bucketResponseByConversionVideoUpload.Location,
      cloudConversionVideoPath: body.bucketResponseByConversionVideoUpload.Key,
    },
    brandSafe: false,
  });

  return newVideo;
};

const readingAndUploadingConvertedVideoToBucket = async (name, userId) => {
  const response = await new Promise((resolve, reject) => {
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
          const bucketResByConvertedVideoUpload = await uploadContentOnBucket(
            buffer,
            name,
            '/reuters-videos'
          );

          resolve({
            status: 'success',
            message:
              'The converted video was successfully uploaded to the bucket',
            response: bucketResByConvertedVideoUpload,
          });
        }
      }
    );
  });

  return response;
};

const findByNotApproved = async () => {
  const videos = await Video.find(
    {
      isApproved: false,
      needToBeFixed: { $exists: false },
    },
    { _id: false, __v: false, updatedAt: false }
  );

  return videos;
};

const findByIsBrandSafe = async () => {
  const videos = await Video.find(
    {
      brandSafe: true,
      isApproved: true,
      publishedInSocialMedia: false,
    },
    { _id: false, __v: false, updatedAt: false }
  );

  return videos;
};

const findRelated = async (req, res) => {
  const { category, tag, videoId } = req.query;

  try {
    const videos = await Video.find({
      'videoData.category': category,
      'videoData.tags': { $in: [tag] },
      'videoData.videoId': { $ne: +videoId },
      isApproved: true,
    });

    res.status(200).json(videos);
  } catch (err) {
    console.log(err);
  }
};

const findVideoByVBCode = async (vbCode) => {
  const videoWithVBCode = await Video.findOne({
    'uploadData.vbCode': `VB${vbCode}`,
  });

  return videoWithVBCode;
};

const findOneVideoInFeed = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findOne({ 'videoData.videoId': +id });

    if (!video) {
      return res
        .status(200)
        .json({ message: `Video with id "${id}" was not found` });
    }

    if (video.isApproved === false) {
      return res
        .status(200)
        .json({ message: 'This video is not available in the feed' });
    }

    const nextVideo = await Video.findOne({
      isApproved: true,
      'videoData.videoId': { $gt: +video.videoData.videoId },
    });

    const prevVideo = await Video.find({
      isApproved: true,
      'videoData.videoId': { $lt: +video?.videoData?.videoId },
    })
      .limit(1)
      .sort({ 'videoData.videoId': -1 });

    const { _id, __v, updatedAt, ...data } = video._doc;

    res.status(200).json({
      data: data,
      isLastVideo: nextVideo ? false : true,
      isFirstVideo: prevVideo[0] ? false : true,
    });
  } catch (err) {
    console.log(err);
  }
};

const findByFixed = async () => {
  const videos = await Video.find(
    {
      needToBeFixed: { $exists: true },
    },
    { _id: false, __v: false, updatedAt: false }
  );

  return videos;
};

const findVideoById = async (id) => {
  const video = await Video.findOne({ 'videoData.videoId': id });

  return video;
};

const findVideoByTitle = async (title) => {
  const video = await Video.findOne({ 'videoData.title': title });

  return video;
};

const findAllVideo = async (req, res) => {
  const ITEMS_PER_PAGE = 10;

  const { category, tag, duration, location, postedDate, occured, page } =
    req.query;

  if (duration) {
    var durationPoints = findStartEndPointOfDuration(duration);
  }

  try {
    const skip = (page - 1) * ITEMS_PER_PAGE;

    let items = await Video.find({
      ...(durationPoints && {
        'videoData.duration': {
          $gte: durationPoints?.start,
          $lt: durationPoints?.finish,
        },
      }),
      ...(category && { 'videoData.category': category }),
      ...(tag && { 'videoData.tags': { $in: [tag] } }),
      ...(location && {
        $or: [
          {
            'videoData.city': location,
          },
          {
            'videoData.country': location,
          },
        ],
      }),
      isApproved: true,
    }).collation({ locale: 'en', strength: 2 });

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

        items = items.filter((video) => {
          const date = moment(video.createdAt).utc().startOf('d').toDate();

          return (
            date.getTime() >= dateFrom.getTime() &&
            date.getTime() <= dateTo.getTime()
          );
        });
      } else {
        const { dateFrom, dateTo } = findTimestampsBySearch(postedDate);

        items = items.filter((video) => {
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

        items = items.filter((video) => {
          const date = moment(video.videoData.date).utc().startOf('d').toDate();

          return (
            date.getTime() >= dateFrom.getTime() &&
            date.getTime() <= dateTo.getTime()
          );
        });
      } else {
        const { dateFrom, dateTo } = findTimestampsBySearch(occured);

        items = items.filter((video) => {
          const date = moment(video.videoData.date).utc().startOf('d').toDate();
          return (
            date.getTime() >= dateFrom.getTime() &&
            date.getTime() <= dateTo.getTime()
          );
        });
      }
    }

    const count = items.length;

    pageCount = Math.ceil(count / ITEMS_PER_PAGE);

    const itemsId = await Promise.all(
      items.map(async (el) => {
        return await el.videoData.videoId;
      })
    );

    const videos = await Video.find(
      {
        'videoData.videoId': { $in: itemsId },
        isApproved: true,
      },
      { __v: 0, updatedAt: 0, _id: 0 }
    )
      .sort({ 'videoData.videoId': -1 })
      .collation({ locale: 'en_US', numericOrdering: true })
      .limit(ITEMS_PER_PAGE)
      .skip(skip);

    res.json({
      pagination: {
        count,
        pageCount,
      },
      videos,
    });
  } catch (err) {
    console.error(err);
  }
};

const findById = async (id) => {
  return await Video.findOne({ 'videoData.videoId': +id });
};

const addCommentForFixed = async (req, res) => {
  try {
    const { comment, videoId } = req.body;

    const video = await Video.findOne({ 'videoData.videoId': videoId });

    if (!video) {
      res
        .status(200)
        .json({ message: `Video with id "${videoId}" was not found` });
      return;
    }

    await video.updateOne({
      needToBeFixed: {
        comment,
      },
    });

    const updatedVideo = await Video.findOne({ 'videoData.videoId': videoId });

    const { _id, __v, updatedAt, ...data } = updatedVideo._doc;

    const videoPendingChanges = await findByFixed();

    socketInstance.io().emit('toggleCommentForFixedVideo', {
      videos: videoPendingChanges,
      event: 'add edits',
    });

    res.status(200).json(data);
  } catch (err) {
    console.log(err);
    throw Error('Server-side error...');
  }
};

const publishingVideoInSocialMedia = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findOne({ 'videoData.videoId': +id });

    if (!video) {
      res.status(200).json({ message: `Video with id "${id}" was not found` });
      return;
    }

    if (video.isApproved === false || video.brandSafe === false) {
      res.status(200).json({
        message: `Video ${id} is not subject to publication in the social network`,
      });
      return;
    }

    if (video.publishedInSocialMedia === true) {
      res.status(200).json({
        message: `video ${id} has already been published on the social network`,
      });
      return;
    }

    await Video.updateOne(
      { 'videoData.videoId': +id },
      { publishedInSocialMedia: true }
    );

    const updatedVideo = await Video.findOne({
      'videoData.videoId': +id,
    });

    const { _id, __v, updatedAt, ...data } = updatedVideo._doc;

    //const videosForSocialMedia = await findByIsBrandSafe();

    //socketInstance.io().emit('findReadyForSocialMedia', videosForSocialMedia);

    res.status(200).json(data);
  } catch (err) {
    console.log(err);
    throw Error('Server side error...');
  }
};

const deleteVideoById = async (id) => {
  await Video.deleteOne({ 'videoData.videoId': id });
};

const getCountAcquiredVideoByUserEmail = async (userValue, dateLimit) => {
  return await Video.find({
    'trelloData.researchers': userValue,
    createdAt: {
      $gte: moment().utc().subtract(dateLimit, 'd').startOf('d').valueOf(),
    },
  })
    .countDocuments()
    .sort({ pubDate: -1 });
};

const findReadyForPublication = async () => {
  const videosByNotApproved = await findByNotApproved();

  //ищем видео с наклейкой done или в списке done

  const doneVideosFromTrello = await Promise.all(
    videosByNotApproved.map(async (video) => {
      const { data } = await trelloInstance.get(
        `/1/cards/${video?.trelloData?.trelloCardId}`,
        {
          params: {
            customFieldItems: true,
            members: true,
          },
        }
      );

      if (
        //если карточка находится в листе "done" в trello
        data?.idList === '61a1c05f03075c0ea01b62af' ||
        //или если у карточки есть наклейка "done"
        data?.labels?.find((label) => label.id === '61a1d74565c249483548bf9a')
      ) {
        return data.id;
      }
    })
  );

  const videosReadyForPublication = videosByNotApproved.filter(
    (databaseVideo) => {
      return doneVideosFromTrello.some((trelloVideoId) => {
        return trelloVideoId === databaseVideo?.trelloData?.trelloCardId;
      });
    }
  );

  return videosReadyForPublication;
};

const creatingAndSavingFeeds = async (video) => {
  const {
    videoData: {
      title,
      description,
      creditTo,
      videoId,
      tags,
      city,
      country,
      category,
      date,
      originalVideoLink,
      categoryReuters,
      countryCode,
    },
    uploadData: { vbCode },
    bucket: { cloudVideoLink, cloudScreenLink, cloudConversionVideoLink },
    brandSafe,
    createdAt,
    pubDate,
  } = video;

  if (
    !title ||
    !description ||
    !videoId ||
    !tags ||
    !city ||
    !country ||
    !category ||
    !date ||
    !originalVideoLink ||
    !cloudVideoLink ||
    !cloudScreenLink ||
    !categoryReuters ||
    !countryCode
  ) {
    return { message: 'Missing values for saving feeds', status: 'warning' };
  }

  let credit;
  let creditMrss;
  if (!creditTo || creditTo == '') {
    credit = description;
    creditMrss = '';
  } else {
    credit = `${description}

  Credit to: ${creditTo}`;
    creditMrss = `Credit to: ${creditTo}`;
  }

  const dateOfPublication = new Date(createdAt).toGMTString();

  const filmingDate = moment(date).format(`ddd, D MMM YYYY`);

  if (brandSafe === true) {
    await video.updateOne({
      $set: {
        mRSS2: `<item>
             <media:title>${title.replace(/&/g, '&amp;')}</media:title>
             <media:description>${description.replace(/&/g, '&amp;')}${
          creditMrss ? ' ' : ''
        }${creditMrss}</media:description>
             <media:keywords>${tags}</media:keywords>
             <media:city>${city}</media:city>
             <media:country>${country}</media:country>
             <media:category>${category}</media:category>
             <media:filmingDate>${filmingDate}</media:filmingDate>
             <guid>${videoId}</guid>
             <pubDate>${dateOfPublication}</pubDate>
             <media:thumbnail url="${cloudScreenLink}"/>
             <media:content url="${cloudVideoLink}" />
             <dfpvideo:lastModifiedDate/>
             </item>`,
        mRSS: `<item>
             <media:title>${title.replace(/&/g, '&amp;')}</media:title>
             <media:description>${description.replace(/&/g, '&amp;')}${
          creditMrss ? ' ' : ''
        }${creditMrss}</media:description>
             <media:keywords>${tags}</media:keywords>
             <media:city>${city}</media:city>
             <media:country>${country}</media:country>
             <media:regionCode>${countryCode}</media:regionCode>
            <media:categoryCode>${categoryReuters}</media:categoryCode>      
             <media:category>${category}</media:category>
             <media:exclusivity>${
               vbCode ? 'exclusive' : 'non-exсlusive'
             }</media:exclusivity>
             <media:filmingDate>${filmingDate}</media:filmingDate>
             <guid>${videoId}</guid>
             <pubDate>${dateOfPublication}</pubDate>
             <media:thumbnail url="${cloudScreenLink}" />
             <media:content url="${cloudVideoLink}" />
             <dfpvideo:lastModifiedDate/>
             </item>`,
        ...(cloudConversionVideoLink && {
          mRSSConvertedVideos: `<item>
            <media:title>${title.replace(/&/g, '&amp;')}</media:title>
            <media:description>${description.replace(/&/g, '&amp;')}${
            creditMrss ? ' ' : ''
          }${creditMrss}</media:description>
            <media:keywords>${tags}</media:keywords>
            <media:city>${city}</media:city>
            <media:country>${country}</media:country>
            <media:regionCode>${countryCode}</media:regionCode>
           <media:categoryCode>${categoryReuters}</media:categoryCode>      
            <media:category>${category}</media:category>
            <media:exclusivity>${
              vbCode ? 'exclusive' : 'non-exсlusive'
            }</media:exclusivity>
            <media:filmingDate>${filmingDate}</media:filmingDate>
            <guid>${videoId}</guid>
            <pubDate>${dateOfPublication}</pubDate>
            <media:thumbnail url="${cloudScreenLink}" />
            <media:content url="${cloudConversionVideoLink}" />
            <dfpvideo:lastModifiedDate/>
            </item>`,
        }),
      },
    });
  } else {
    await video.updateOne({
      $set: {
        mRSS: `<item>
             <media:title>${title.replace(/&/g, '&amp;')}</media:title>
             <media:description>${description.replace(/&/g, '&amp;')}${
          creditMrss ? ' ' : ''
        }${creditMrss}</media:description>
             <media:keywords>${tags}</media:keywords>
             <media:city>${city}</media:city>
             <media:country>${country}</media:country>
             <media:regionCode>${countryCode}</media:regionCode>
             <media:categoryCode>${categoryReuters}</media:categoryCode>
             <media:category>${category}</media:category>
             <media:exclusivity>${
               vbCode ? 'exclusive' : 'non-exсlusive'
             }</media:exclusivity>
             <media:filmingDate>${filmingDate}</media:filmingDate>
             <guid>${videoId}</guid>
             <pubDate>${dateOfPublication}</pubDate>
             <media:thumbnail url="${cloudScreenLink}" />
             <media:content url="${cloudVideoLink}" />
             <dfpvideo:lastModifiedDate/>
             </item>`,
        ...(cloudConversionVideoLink && {
          mRSSConvertedVideos: `<item>
              <media:title>${title.replace(/&/g, '&amp;')}</media:title>
              <media:description>${description.replace(/&/g, '&amp;')}${
            creditMrss ? ' ' : ''
          }${creditMrss}</media:description>
              <media:keywords>${tags}</media:keywords>
              <media:city>${city}</media:city>
              <media:country>${country}</media:country>
              <media:regionCode>${countryCode}</media:regionCode>
              <media:categoryCode>${categoryReuters}</media:categoryCode>
              <media:category>${category}</media:category>
              <media:exclusivity>${
                vbCode ? 'exclusive' : 'non-exсlusive'
              }</media:exclusivity>
              <media:filmingDate>${filmingDate}</media:filmingDate>
              <guid>${videoId}</guid>
              <pubDate>${dateOfPublication}</pubDate>
              <media:thumbnail url="${cloudScreenLink}" />
              <media:content url="${cloudConversionVideoLink}" />
              <dfpvideo:lastModifiedDate/>
              </item>`,
        }),
      },
    });
  }

  return { message: 'Feeds saved successfully', status: 'success' };
};

const convertingVideoToHorizontal = async (video, userId) => {
  const directoryForInputVideo = `./videos/${userId}`;
  const directoryForOutputVideo = `./videos/${userId}`;

  await Promise.all(
    [directoryForInputVideo, directoryForOutputVideo].map((directory) => {
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
      }
    })
  );

  fs.writeFileSync(
    path.resolve(`${directoryForInputVideo}/input-for-conversion.mp4`),
    video.buffer
  );

  const response = await new Promise(async (resolve, reject) => {
    ffmpeg(`${directoryForInputVideo}/input-for-conversion.mp4`).ffprobe(
      (err, info) => {
        if (err) {
          console.log(err);
          reject({
            message: 'Error when reading video parameters',
            status: 'error',
          });
        }

        const heightVideo = info.streams.find(
          (stream) => stream.codec_type === 'video'
        ).height;

        if (!heightVideo) {
          reject({
            message: 'Error in determining the height of the incoming video',
            status: 'error',
          });
        }

        const hasAudioTrack = info.streams.find(
          (stream) => stream.codec_type === 'audio'
        )
          ? true
          : false;

        ffmpeg(`${directoryForInputVideo}/input-for-conversion.mp4`)
          .withVideoCodec('libx264')
          .withAudioCodec('libmp3lame')
          .size(`?x${heightVideo}`)
          .aspect('16:9')
          .autopad('black')
          //.videoBitrate('4500', true)
          //.fps(60)
          .toFormat('mp4')
          .on('start', () => {
            console.log(
              '------------------ start conversion ----------------------'
            );
          })
          .on('progress', (progress) => {
            //console.log(progress, `видео ${video.originalname}`);

            const loaded = Math.round((progress.percent * 100) / 100);

            socketInstance
              .io()
              .sockets.in(userId)
              .emit('progressOfRequestInPublishing', {
                event: 'Converting video to horizontal format',
                file: {
                  name: video.originalname,
                  loaded,
                },
              });
          })
          .on('end', () => {
            console.log(
              '------------------------- end conversion ----------------------------------'
            );
            resolve({
              message: 'the video has been successfully converted and saved',
              status: 'success',
              data: {
                hasAudioTrack,
              },
            });
          })
          .on('error', (err) => {
            console.log(err);
            reject({
              message: 'Error when converting video',
              status: 'error',
            });
          })
          .saveToFile(`${directoryForInputVideo}/output-for-conversion.mp4`);
      }
    );
  });

  return response;
};

module.exports = {
  findLastVideo,
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
  refreshMrssFiles,
  findReadyForPublication,
  findVideoByVBCode,
  findTheCountryCodeByName,
  uploadContentOnBucket,
  createNewVideo,
  findVideoById,
  creatingAndSavingFeeds,
  convertingVideoToHorizontal,
  readingAndUploadingConvertedVideoToBucket,
  updateVideoById,
  deleteVideoById,
  findByNotApproved,
  findVideoByTitle,
  getCountAcquiredVideoByUserEmail,
};
