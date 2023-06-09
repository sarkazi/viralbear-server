const express = require('express');
const router = express.Router();

const { findById } = require('../controllers/video.controller');

const moment = require('moment');

const authMiddleware = require('../middleware/auth.middleware');

router.post('/manualGenerationPreSale', authMiddleware, async (req, res) => {
  try {
    const { company, videoId, amount, usage } = req.body;

    if (!company || !videoId || !amount || !usage) {
      return res.status(200).json({
        status: 'warning',
        message: 'Missing parameter',
      });
    }

    const videoDb = await findById(videoId);

    if (!videoDb) {
      return res.status(200).json({
        status: 'warning',
        message: `Video with id "${videoId}" not found`,
      });
    }

    const apiData = {
      suitable: [
        {
          researchers: videoDb.trelloData.researchers,
          videoId,
          usage,
          amount,
          videoTitle: videoDb.videoData.title,
          company,
          amountToResearcher: (amount * 0.4).toFixed(2),
          date: moment().toString(),
          author: null,
          advance: null,
          percentage: null,
        },
      ],
      type: 'manual',
    };

    return res.status(200).json({
      apiData,
      status: 'success',
      message: 'The data has been processed successfully',
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      status: 'error',
      message: err?.message ? err.message : 'Server side error',
    });
  }
});

module.exports = router;
