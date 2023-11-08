const express = require("express");
const router = express.Router();

const { errorsHandler } = require("../handlers/error.handler");

const authMiddleware = require("../middleware/auth.middleware");

const socketInstance = require("../socket.instance");
const {
  GetAllStringersVideos,
  getStringersVideoById,
  deleteStringersVideoById,
} = require("../controllers/stringersVideos.controller");

router.get("/get", authMiddleware, async (req, res) => {
  try {
    const stringersVideos = await GetAllStringersVideos();

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

router.delete("/:videoId", authMiddleware, async (req, res) => {
  try {
    const { videoId } = req.params;

    const stringersVideo = await getStringersVideoById({ videoId });

    if (!stringersVideo) {
      return res.status(200).json({
        status: "warning",
        message: "An entry with this id was not found",
      });
    }

    await deleteStringersVideoById({ videoId });

    socketInstance.io().emit("stringersVideoPanelChanges");

    return res.status(200).json({
      status: "success",
      message: "An entry was successfully deleted",
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
