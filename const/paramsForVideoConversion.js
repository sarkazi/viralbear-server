const paramsForVideoConversion = {
  size: {
    sm: '1280x720',
    lg: '1920x1080',
  },
  aspectRatio: '16:9',
  videoBitrate: '15000',
  allowedFps: [23.976, 25, 29.97, 50, 59.94],
  format: 'mp4',
  videoCodec: 'libx264',
  audioCodec: 'libmp3lame',
  autopad: 'black',
};

module.exports = { paramsForVideoConversion };
