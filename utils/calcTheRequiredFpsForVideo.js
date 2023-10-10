const {
  paramsForVideoConversion,
} = require('../const/paramsForVideoConversion');

const calcTheRequiredFpsForVideo = ({ videoFps }) => {
  return paramsForVideoConversion.allowedFps.reduce((prev, next) =>
    Math.abs(next - videoFps) < Math.abs(prev - videoFps) ? next : prev
  );
};

module.exports = calcTheRequiredFpsForVideo;
