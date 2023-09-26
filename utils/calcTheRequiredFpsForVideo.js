const allowedFps = require('../const/allowedFpsForConvertedVideo');

const calcTheRequiredFpsForVideo = ({ videoFps }) => {
  return allowedFps.reduce((prev, next) =>
    Math.abs(next - videoFps) < Math.abs(prev - videoFps) ? next : prev
  );
};

module.exports = calcTheRequiredFpsForVideo;
