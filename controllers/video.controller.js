const Video = require('../entities/Video');
const async = require('async');

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

const filePath2 = path.join(
  __dirname,
  '..',
  '/localstorage',
  'localstorage.txt'
);

const refreshMrssFiles = async () => {
  const feedsData = [
    { path: `${__dirname}/../mrssFiles/mrss.xml`, name: 'Main' },
    { path: `${__dirname}/../mrssFiles/mrss2.xml`, name: 'Social Media' },
    {
      path: `${__dirname}/../mrssFiles/mrssConvertedVideos.xml`,
      name: 'Reuters',
    },
    {
      path: `${__dirname}/../mrssFiles/mrssAccidents.xml`,
      name: 'Accidents',
    },
    { path: `${__dirname}/../mrssFiles/mrssCool.xml`, name: 'Cool' },
    {
      path: `${__dirname}/../mrssFiles/mrssFailsAndFunnies.xml`,
      name: 'Fails and Funnies',
    },
    {
      path: `${__dirname}/../mrssFiles/mrssHeartwarming.xml`,
      name: 'Heartwarming',
    },
    { path: `${__dirname}/../mrssFiles/mrssNews.xml`, name: 'News' },
    {
      path: `${__dirname}/../mrssFiles/mrssRescue.xml`,
      name: 'Rescue',
    },
    {
      path: `${__dirname}/../mrssFiles/mrssRoadAccidents.xml`,
      name: 'Road accidents',
    },
    {
      path: `${__dirname}/../mrssFiles/mrssAp.xml`,
      name: 'AP video hub',
    },
    {
      path: `${__dirname}/../mrssFiles/mrssApArchive.xml`,
      name: 'AP video hub archive',
    },
    {
      path: `${__dirname}/../mrssFiles/mrssSport.xml`,
      name: 'Sport',
    },
    {
      path: `${__dirname}/../mrssFiles/mrssWeather.xml`,
      name: 'Weather',
    },
    {
      path: `${__dirname}/../mrssFiles/mrssAnimals.xml`,
      name: 'Animals',
    },
  ];

  await Promise.all(
    feedsData.map(async (obj) => {
      const videos = await Video.find({
        isApproved: true,
        ...(obj.name === 'Social Media' && { brandSafe: true }),
        ...(obj.name === 'Reuters' && {
          'videoData.hasAudioTrack': true,
          reuters: true,
        }),
        ...(obj.name === 'AP video hub' && {
          'videoData.hasAudioTrack': true,
          'videoData.duration': {
            $gte: 10,
            $lt: 300,
          },
          apVideoHub: true,
        }),
        ...(obj.name === 'AP video hub archive' && {
          'videoData.hasAudioTrack': true,
          'videoData.duration': {
            $gte: 10,
            $lt: 300,
          },
          apVideoHubArchive: true,
          apVideoHub: false,
        }),
        ...(obj.name !== 'Reuters' &&
          obj.name !== 'Main' &&
          obj.name !== 'AP video hub' &&
          obj.name !== 'AP video hub archive' &&
          obj.name !== 'Social Media' && {
            'videoData.category': { $in: [obj.name] },
          }),
      })
        .limit(200)
        .sort({ $natural: -1 });

      if (obj.name === 'AP video hub' || obj.name === 'AP video hub archive') {
        fs.writeFile(
          obj.path,
          `<?xml version="1.0" encoding="UTF-8"?>
          <rss xmlns:atom="http://www.w3.org/2005/Atom"
          xmlns:media="http://search.yahoo.com/mrss/"
          xmlns:openSearch="http://a9.com/-/spec/opensearchrss/1.0/"
          xmlns:dfpvideo="http://api.google.com/dfpvideo"
          xmlns:tms="http://data.tmsapi.com/v1.1"
          xmlns:dc="http://purl.org/dc/elements/1.1/"
          version="2.0">
            <channel>
              <title>ViralBear videos</title>
              <dfpvideo:version>2</dfpvideo:version>
                ${videos
                  .map((video) => {
                    return `
                      <item>
                        <title>${video.videoData.title.replace(
                          /&/g,
                          '&amp;'
                        )}</title>
                        <description>${video.videoData.description.replace(
                          /&/g,
                          '&amp;'
                        )}${video.videoData?.creditTo ? ' ' : ''}${
                      !video.videoData?.creditTo
                        ? ''
                        : `Credit to: ${video.videoData.creditTo}`
                    }</description>
                        <media:keywords>${video.videoData.tags.slice(
                          0,
                          10
                        )}</media:keywords>
                        <pubDate>${new Date(
                          video.pubDate
                            ? video.pubDate
                            : video?.updatedAt
                            ? video.updatedAt
                            : ''
                        ).toGMTString()}</pubDate>
                        <guid isPermaLink="false">${
                          video.videoData.videoId
                        }</guid>
                        <viralbearID>${video.videoData.videoId}</viralbearID>
                        <slugline>${video.videoData.title.replace(
                          /&/g,
                          '&amp;'
                        )}</slugline>
                        <media:content url="${
                          video.bucket.cloudConversionVideoLink
                        }" lang="en">
                          <media:title>${video.videoData.title.replace(
                            /&/g,
                            '&amp;'
                          )}</media:title>
                          <media:description>${video.videoData.description.replace(
                            /&/g,
                            '&amp;'
                          )}${video.videoData?.creditTo ? ' ' : ''}${
                      !video.videoData?.creditTo
                        ? ''
                        : `Credit to: ${video.videoData.creditTo}`
                    }</media:description>
                        </media:content>
                       
                       

                      </item>
                      `;
                  })
                  .join('')}
                       </channel>
                    </rss>
                  `,
          (err) => {
            if (!err) {
              console.log(err);
            }
          }
        );
      } else {
        fs.writeFile(
          obj.path,
          `<?xml version="1.0" encoding="UTF-8"?>
            <rss xmlns:atom="http://www.w3.org/2005/Atom"
            xmlns:media="http://search.yahoo.com/mrss/"
            xmlns:openSearch="http://a9.com/-/spec/opensearchrss/1.0/"
            xmlns:dfpvideo="http://api.google.com/dfpvideo"
            xmlns:tms="http://data.tmsapi.com/v1.1"
            version="2.0">
              <channel>
                <title>ViralBear videos</title>
                <dfpvideo:version>2</dfpvideo:version>
                  ${videos
                    .map((video) => {
                      return `
                        <item>
                          <media:title>${video.videoData.title.replace(
                            /&/g,
                            '&amp;'
                          )}</media:title>
                          <media:description>${video.videoData.description.replace(
                            /&/g,
                            '&amp;'
                          )}${video.videoData?.creditTo ? ' ' : ''}${
                        !video.videoData?.creditTo
                          ? ''
                          : `Credit to: ${video.videoData.creditTo}`
                      }</media:description>
                          <media:keywords>${
                            video.videoData.tags
                          }</media:keywords>
                          <media:city>${video.videoData.city}</media:city>
                          <media:country>${
                            video.videoData.country
                          }</media:country>
                          <media:regionCode>${
                            video.videoData.countryCode
                          }</media:regionCode>
                          <media:categoryCode>${
                            video.videoData.categoryReuters
                          }</media:categoryCode>
                          <media:category>${
                            video.videoData.category
                          }</media:category>
                          <media:exclusivity>${
                            video.exclusivity ? 'exclusive' : 'non-exсlusive'
                          }</media:exclusivity>
                          <media:filmingDate>${moment(
                            video.videoData.date
                          ).format(`ddd, D MMM YYYY`)}</media:filmingDate>
                          <guid>${
                            obj.name === 'Reuters' &&
                            +video.videoData.videoId >= 2615 &&
                            +video.videoData.videoId <= 2773
                              ? `${video.videoData.videoId}0000`
                              : video.videoData.videoId
                          }</guid>
                          <pubDate>${new Date(
                            video.pubDate
                              ? video.pubDate
                              : video?.updatedAt
                              ? video.updatedAt
                              : ''
                          ).toGMTString()}</pubDate>
                          <media:thumbnail url="${
                            video.bucket.cloudScreenLink
                          }" />
                          <media:content url="${
                            obj.name === 'Reuters'
                              ? video.bucket.cloudConversionVideoLink
                              : video.bucket.cloudVideoLink
                          }" />
                          ${
                            !!video?.lastChange
                              ? `<dfpvideo:lastModifiedDate>${new Date(
                                  video.lastChange
                                ).toGMTString()}</dfpvideo:lastModifiedDate>`
                              : '<dfpvideo:lastModifiedDate/>'
                          }
                          </item>
                        `;
                    })
                    .join('')}
                         </channel>
                      </rss>
                    `,
          (err) => {
            if (!err) {
              console.log(err);
            }
          }
        );
      }
    })
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

const updateVideoById = async ({ videoId, dataToDelete, dataToUpdate }) => {
  await Video.updateOne(
    {
      'videoData.videoId': videoId,
    },
    {
      ...(dataToDelete && { $unset: dataToDelete }),
      ...(dataToUpdate && { $set: dataToUpdate }),
    }
  );
};

const updateVideoBy = async ({
  searchBy,
  searchValue,
  dataToDelete,
  dataToUpdate,
  dataToInc,
}) => {
  await Video.updateOne(
    {
      [searchBy]: searchValue,
    },
    {
      ...(dataToDelete && { $unset: dataToDelete }),
      ...(dataToUpdate && { $set: dataToUpdate }),
      ...(dataToInc && { $inc: dataToInc }),
    }
  );
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
    ...(body.vbForm && {
      vbForm: body.vbForm,
    }),
    ...(body.commentToAdmin && {
      commentToAdmin: body.commentToAdmin,
    }),
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
    exclusivity: body.exclusivity,
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
            '/converted-videos'
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
  const videos = await Video.find({
    isApproved: false,
    needToBeFixed: { $exists: false },
  }).populate({
    path: 'vbForm',
    select: { refFormId: 1 },
    populate: {
      path: 'refFormId',
      select: { advancePayment: 1 },
    },
  });

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
      'videoData.category': { $in: [category] },
      'videoData.tags': { $in: [tag] },
      'videoData.videoId': { $ne: +videoId },
      isApproved: true,
    });

    res.status(200).json(videos);
  } catch (err) {
    console.log(err);
  }
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
  const videos = await Video.find({
    needToBeFixed: { $exists: true },
  }).populate({
    path: 'vbForm',
    select: { refFormId: 1 },
    populate: {
      path: 'refFormId',
      select: { advancePayment: 1 },
    },
  });

  return videos;
};

const findVideoById = async (id) => {
  const video = await Video.findOne({ 'videoData.videoId': id }).populate({
    path: 'vbForm',
    populate: {
      path: 'sender refFormId',
      select: { email: 1, advancePayment: 1, percentage: 1, exclusivity: 1 },
    },
  });

  return video;
};

const findById = async (id) => {
  return await Video.findOne({ 'videoData.videoId': +id });
};

const getAllVideos = async ({
  vbFormExists,
  isApproved,
  fieldsInTheResponse,
  advanceHasBeenPaid,
  forLastDays,
  researcher,
  wasRemovedFromPublication,
  durationPoints,
  category,
  tag,
  location,
  limit,
  skip,
  sort,
}) => {
  return Video.find(
    {
      ...(typeof vbFormExists === 'boolean' && {
        vbForm: { $exists: vbFormExists },
      }),
      ...(typeof isApproved === 'boolean' && { isApproved }),
      ...(typeof wasRemovedFromPublication === 'boolean' && {
        wasRemovedFromPublication,
      }),
      ...(forLastDays && {
        createdAt: {
          $gte: moment()
            .utc()
            .subtract(forLastDays, 'd')
            .startOf('d')
            .valueOf(),
        },
      }),
      ...(researcher && {
        'trelloData.researchers': {
          $elemMatch: {
            [researcher.searchBy]: researcher.value,
            ...(typeof researcher?.advanceHasBeenPaid === 'boolean' && {
              advanceHasBeenPaid,
            }),
            ...(typeof researcher?.isAcquirer === 'boolean' && {
              main: researcher.isAcquirer,
            }),
          },
        },
      }),
      ...(durationPoints && {
        'videoData.duration': {
          $gte: durationPoints?.start,
          $lt: durationPoints?.finish,
        },
      }),
      ...(category && { 'videoData.category': { $in: [category] } }),
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
    },
    {
      ...(fieldsInTheResponse &&
        fieldsInTheResponse.reduce((a, v) => ({ ...a, [v]: 1 }), {})),
    }
  )
    .populate({
      path: 'vbForm',
      select: {
        formId: 1,
        sender: 1,
        refFormId: 1,
        advancePaymentReceived: 1,
        createdAt: 1,
      },
      populate: {
        path: 'sender refFormId',
        select: { email: 1, advancePayment: 1, percentage: 1, exclusivity: 1 },
      },
    })
    .populate({
      path: 'trelloData.researchers.researcher',
      model: 'User',
      select: {
        name: 1,
        email: 1,
        avatarUrl: 1,
      },
    })

    .collation({ locale: 'en', strength: 2 })
    .sort(sort ? sort : null)
    .limit(limit ? limit : null)
    .skip(skip ? skip : null);
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

const getCountVideosBy = async ({
  forLastDays,
  exclusivity,
  isApproved,
  user,
}) => {
  const pipeline = [
    {
      $match: {
        ...(user && {
          'trelloData.researchers': {
            $elemMatch: {
              [user.searchBy]: user.value,
              ...(typeof user?.purchased === 'boolean' && {
                main: user.purchased,
              }),
              ...(typeof user?.advanceHasBeenPaid === 'boolean' && {
                advanceHasBeenPaid: user.advanceHasBeenPaid,
              }),
            },
          },
        }),
        ...(typeof isApproved === 'boolean' && { isApproved }),
        ...(typeof exclusivity === 'boolean' && { exclusivity }),
        ...(forLastDays && {
          pubDate: {
            $exists: true,
            $gte: new Date(
              moment().subtract(forLastDays, 'd').startOf('d').toISOString()
            ),
          },
        }),
      },
    },
    {
      $count: 'acquiredVideosCount',
    },
  ];

  let acquiredVideosCount = 0;

  const aggregationResult = await Video.aggregate(pipeline);

  for await (const doc of aggregationResult) {
    acquiredVideosCount = doc.acquiredVideosCount;
  }

  return acquiredVideosCount;
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

//const convertingVideoToHorizontal = async (video, userId) => {
//  const directoryForInputVideo = `./videos/${userId}`;
//  const directoryForOutputVideo = `./videos/${userId}`;

//  await Promise.all(
//    [directoryForInputVideo, directoryForOutputVideo].map((directory) => {
//      if (!fs.existsSync(directory)) {
//        fs.mkdirSync(directory);
//      }
//    })
//  );

//  fs.writeFileSync(
//    path.resolve(`${directoryForInputVideo}/input-for-conversion.mp4`),
//    video.buffer
//  );

//  const response = await new Promise(async (resolve, reject) => {
//    ffmpeg(`${directoryForInputVideo}/input-for-conversion.mp4`).ffprobe(
//      (err, info) => {
//        if (err) {
//          console.log(err);
//          reject({
//            message: 'Error when reading video parameters',
//            status: 'error',
//          });
//        }

//        const heightVideo = info.streams.find(
//          (stream) => stream.codec_type === 'video'
//        ).height;

//        if (!heightVideo) {
//          reject({
//            message: 'Error in determining the height of the incoming video',
//            status: 'error',
//          });
//        }

//        const hasAudioTrack = info.streams.find(
//          (stream) => stream.codec_type === 'audio'
//        )
//          ? true
//          : false;

//        ffmpeg(`${directoryForInputVideo}/input-for-conversion.mp4`)
//          .withVideoCodec('libx264')
//          .withAudioCodec('libmp3lame')
//          .size(`?x${heightVideo}`)
//          .aspect('16:9')
//          .autopad('black')
//          //.videoBitrate('4500', true)
//          //.fps(60)
//          .toFormat('mp4')
//          .on('start', () => {
//            console.log(
//              '------------------ start conversion ----------------------'
//            );
//          })
//          .on('progress', (progress) => {
//            //console.log(progress, `видео ${video.originalname}`);

//            const loaded = Math.round((progress.percent * 100) / 100);

//            console.log(userId, 8989);

//            socketInstance
//              .io()
//              .sockets.in(userId)
//              .emit('progressOfRequestInPublishing', {
//                event: 'Converting video to horizontal format',
//                file: {
//                  name: video.originalname,
//                  loaded,
//                },
//              });
//          })
//          .on('end', () => {
//            console.log(
//              '------------------------- end conversion ----------------------------------'
//            );
//            resolve({
//              message: 'the video has been successfully converted and saved',
//              status: 'success',
//              data: {
//                hasAudioTrack,
//              },
//            });
//          })
//          .on('error', (err) => {
//            console.log(err);
//            reject({
//              message: 'Error when converting video',
//              status: 'error',
//            });
//          })
//          .saveToFile(`${directoryForInputVideo}/output-for-conversion.mp4`);
//      }
//    );
//  });

//  return response;
//};

const convertingVideoToHorizontal = async ({ buffer, userId, filename }) => {
  const directoryForInputVideo = `./videos/${userId}`;
  const directoryForOutputVideo = `./videos/${userId}`;

  await Promise.all(
    [directoryForInputVideo, directoryForOutputVideo].map((directory) => {
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
      }
    })
  );

  if (!!buffer) {
    fs.writeFileSync(
      path.resolve(`${directoryForInputVideo}/input-for-conversion.mp4`),
      buffer
    );
  }

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
          .size(heightVideo <= 720 ? '1280x720' : '1920x1080')
          .aspect('16:9')
          .autopad('black')
          .videoBitrate('15000', false)
          .fps(25)
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
                  name: filename,
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

const updateVideosBy = async ({ updateBy, value, objForSet }) => {
  return Video.updateMany(
    { [updateBy]: value },
    { ...(!!objForSet && { $set: objForSet }) }
  );
};

const markVideoEmployeeAsHavingReceivedAnAdvance = async ({ researcherId }) => {
  return Video.updateMany(
    { 'trelloData.researchers': { $elemMatch: { researcher: researcherId } } },
    { $set: { 'trelloData.researchers.$[field].advanceHasBeenPaid': true } },
    { arrayFilters: [{ 'field.researcher': researcherId }] }
  );
};

const markResearcherAdvanceForOneVideoAsPaid = async ({
  videoId,
  researcherId,
}) => {
  return Video.updateOne(
    { 'videoData.videoId': videoId },
    { $set: { 'trelloData.researchers.$[field].advanceHasBeenPaid': true } },
    { arrayFilters: [{ 'field.researcher': researcherId }] }
  );
};

const findVideoBy = async ({
  searchBy,
  value,
  fieldsInTheResponse,
  lastAdded,
}) => {
  return Video.findOne(
    { [searchBy]: value, ...(lastAdded && { isApproved: false }) },
    {
      ...(fieldsInTheResponse &&
        fieldsInTheResponse.reduce((a, v) => ({ ...a, [v]: 1 }), {})),
    }
  )
    .populate({
      path: 'trelloData.researchers.researcher',
      model: 'User',
      select: {
        name: 1,
        avatarUrl: 1,
        email: 1,
      },
    })
    .populate({
      path: 'vbForm',
      populate: {
        path: 'sender refFormId',
        select: {
          email: 1,
          name: 1,
          advancePayment: 1,
          percentage: 1,
          exclusivity: 1,
        },
      },
    })
    .sort(lastAdded ? { createdAt: -1 } : null)
    .limit(lastAdded ? 1 : null);
};

module.exports = {
  findByIsBrandSafe,
  findByFixed,
  findById,
  generateExcelFile,
  findRelated,
  publishingVideoInSocialMedia,
  findNextVideoInFeed,
  findPrevVideoInFeed,
  findOneVideoInFeed,
  refreshMrssFiles,
  findReadyForPublication,
  findTheCountryCodeByName,
  uploadContentOnBucket,
  createNewVideo,
  findVideoById,
  convertingVideoToHorizontal,
  readingAndUploadingConvertedVideoToBucket,
  updateVideoById,
  deleteVideoById,
  findByNotApproved,
  getAllVideos,

  getCountVideosBy,
  updateVideosBy,
  markVideoEmployeeAsHavingReceivedAnAdvance,
  updateVideoBy,
  markResearcherAdvanceForOneVideoAsPaid,
  findVideoBy,
};
