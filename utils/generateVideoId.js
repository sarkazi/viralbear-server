
const Video = require('../entities/Video')


const generateVideoId = async () => {
   try {
      const lastAddedVideo = await Video.findOne({})
         .sort({ "videoData.videoId": -1 })
         .limit(1)

      if (!lastAddedVideo) {
         return 1
      } else {
         const videoId = lastAddedVideo.videoData.videoId
         return Number(videoId) + 1
      }



   } catch (err) {
      console.log(err)
   }
}


module.exports = { generateVideoId }