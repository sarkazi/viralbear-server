const Links = require('../entities/Links');
const fetch = require('node-fetch');

const moment = require('moment');

const urlParser = require('js-video-url-parser');

const getCountLinks = async ({ researcherId, listInTrello, forLastDays }) => {
  return await Links.find({
    ...(researcherId && { researcher: researcherId }),
    ...(listInTrello && { listInTrello }),
    ...(forLastDays && {
      createdAt: {
        $gte: moment().utc().subtract(forLastDays, 'd').startOf('d').valueOf(),
      },
    }),
  }).countDocuments();
};

const findBaseUrl = async (link) => {
  const videoLink = await fetch(link, { redirect: 'follow' }).then((res) => {
    return res.url;
  });

  return videoLink;
};

const pullIdFromUrl = async (videoLink) => {
  if (videoLink.includes('tiktok.com')) {
    const link = urlParser.parse(videoLink)?.id;

    if (link) {
      return link;
    } else {
      videoLink;
    }
  }
  if (videoLink.includes('facebook')) {
    const link = urlParser.parse(videoLink)?.id;

    if (!link) {
      const regex =
        /^http(?:s?):\/\/(?:www\.|web\.|m\.)?facebook\.com\/([A-z0-9\.]+)\/videos(?:\/[0-9A-z].+)?\/(\d+)(?:.+)?$/gm.exec(
          videoLink
        );

      if (regex) {
        return regex;
      } else {
        return videoLink;
      }
    } else {
      return link;
    }
  }
  if (videoLink.includes('vk.com')) {
    const regex =
      /((\bvideo|\bclip)(\-*)(\d+)_(\d+))|(club|id|public|group|board|albums|sel=[c]*)(\-*)(\d+)|(\bvideos\b|\bim\b(?!\?))/.exec(
        videoLink
      );

    if (regex) {
      return regex[0];
    } else {
      return videoLink;
    }
  }
  if (videoLink.includes('youtu')) {
    const link = urlParser.parse(videoLink)?.id;

    if (!link) {
      let regex =
        /(youtu.*be.*)\/(watch\?v=|embed\/|v|shorts|)(.*?((?=[&#?])|$))/gm.exec(
          videoLink
        );

      if (regex) {
        return regex[3];
      } else {
        return videoLink;
      }
    } else {
      return link;
    }
  }
  if (videoLink.includes('instagram.com')) {
    let regex =
      /(?:https?:\/\/)?(?:www.)?instagram.com\/?([a-zA-Z0-9\.\_\-]+)?\/([p]+)?([reel]+)?([tv]+)?([stories]+)?\/([a-zA-Z0-9\-\_\.]+)\/?([0-9]+)?/.exec(
        videoLink
      );

    if (regex) {
      return regex[6];
    } else {
      return videoLink;
    }
  }
  if (videoLink.includes('twitter.com')) {
    const regex =
      /^https?:\/\/twitter\.com\/(?:#!\/)?(\w+)\/status(es)?\/(\d+)/.exec(
        videoLink
      );

    if (regex) {
      return regex[3];
    } else {
      return videoLink;
    }
  }
  if (
    videoLink.includes('vimeo') ||
    videoLink.includes('dailymotion') ||
    videoLink.includes('canalplus') ||
    videoLink.includes('youku.com') ||
    videoLink.includes('coub.com') ||
    videoLink.includes('wistia.com') ||
    videoLink.includes('soundcloud') ||
    videoLink.includes('teachertube') ||
    videoLink.includes('ted.com') ||
    videoLink.includes('loom.com') ||
    videoLink.includes('allocine.fr')
  ) {
    const regex = urlParser.parse(videoLink)?.id;

    if (regex) {
      return regex;
    } else {
      return videoLink;
    }
  }
  return videoLink;
};

const findLinkByVideoId = async (videoId) => {
  const linkInfo = await Links.findOne({ unixid: videoId });
  return linkInfo;
};

const createNewLink = async ({ bodyForCreateLink }) => {
  const linkInfo = await Links.create(bodyForCreateLink);

  return linkInfo;
};

const conversionIncorrectLinks = (link) => {
  if (
    !link.includes('www.') &&
    !link.includes('https://') &&
    !link.includes('http://')
  ) {
    return `https://${link}`;
  } else if (
    link.includes('www.') &&
    !link.includes('https://') &&
    !link.includes('http://')
  ) {
    return `https://${link.replace('www.', '')}`;
  } else if (!link.includes('www.') && link.includes('http://')) {
    return link.replace('http://', 'https://');
  } else if (link.includes('www.') && link.includes('http://')) {
    return link.replace('http://', 'https://');
  } else {
    return link;
  }
};

const getCountLinksByUserEmail = async (userValue, dateLimit) => {
  return Links.find({
    email: userValue,
    ...(dateLimit && {
      createdAt: {
        $gte: moment().utc().subtract(dateLimit, 'd').startOf('d').valueOf(),
      },
    }),
  })
    .countDocuments()
    .sort({ createdAt: -1 });
};

const findLinkBy = async ({ searchBy, value }) => {
  return Links.findOne({ [searchBy]: value }).populate({
    path: 'researcher',
    select: { email: 1, name: 1, nickname: 1 },
  });
};

module.exports = {
  findBaseUrl,
  pullIdFromUrl,
  findLinkByVideoId,
  createNewLink,
  conversionIncorrectLinks,
  getCountLinksByUserEmail,
  findLinkBy,
  getCountLinks,
};
