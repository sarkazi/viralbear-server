const express = require("express");
const router = express.Router();

const { errorsHandler } = require("../handlers/error.handler");

const StringerVideosEntity = require("../entities/StringerVideos");

const authMiddleware = require("../middleware/auth.middleware");

router.get("/get", authMiddleware, async (req, res) => {
  try {
    const stringersVideos = await StringerVideosEntity.find();

    return res.status(200).json({
      apiData: stringersVideos,
      status: "success",
      message: "The data has been processed successfully",
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: "sale.manualAddition" }));

    return res.status(400).json({
      status: "error",
      message: err?.message ? err.message : "Server side error",
    });
  }
});

module.exports = router;
