const StringersVideosSchema = require("../entities/StringerVideos");

const GetAllStringersVideos = async () => {
  return StringersVideosSchema.find().populate({
    path: "user_id",
    select: { email: 1, name: 1, nickname: 1, avatarUrl: 1, role: 1 },
  });
};
const getStringersVideoById = async ({ videoId }) => {
  return StringersVideosSchema.findOne({ _id: videoId }).populate({
    path: "user_id",
    select: { email: 1, name: 1, nickname: 1, avatarUrl: 1, role: 1 },
  });
};
const deleteStringersVideoById = async ({ videoId }) => {
  return StringersVideosSchema.deleteOne({ _id: videoId });
};

module.exports = {
  GetAllStringersVideos,
  getStringersVideoById,
  deleteStringersVideoById,
};
