const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv').config();
const cookieParser = require('cookie-parser');
const socketInstance = require('./socket.instance');
const axios = require('axios');
const storageInstance = require('./storage.instance');
const aws = require('aws-sdk');

mongoose.set('strictQuery', false);

const { findVideoBy } = require('./controllers/video.controller');
const { getAllUsers } = require('./controllers/user.controller');
const {
  markEmployeeOnSalesHavingReceivePercentage,
} = require('./controllers/sales.controller');

app.use(cors());

app.use(express.static('mrssFiles'));
app.use(express.json({ limit: '50mb', extended: true }));
app.use(express.urlencoded({ limit: '50mb' }));
app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, 'ejs'));
app.use(express.static(path.join(__dirname, 'build')));

const videoRouter = require('./routes/video.routes');
const uploadInfoRouter = require('./routes/uploadInfo.routes');
const sendMailRouter = require('./routes/sendEmail.routes');
const userRouter = require('./routes/user.routes');
const LinksRouter = require('./routes/links.routes');
const trelloRouter = require('./routes/trello.routes');
const authRouter = require('./routes/auth.routes');
const viewedMentionsRouter = require('./routes/viewedMention.routes');
const authorLinkRouter = require('./routes/authorLink.routes');
const salesRouter = require('./routes/sales.routes');
const locationRouter = require('./routes/location.routes');
const webhookRouter = require('./routes/webhook.routes');
const publicUsersRouter = require('./routes/public.users.routes');
const publicVideosRouter = require('./routes/public.videos.routes');
const commonRouter = require('./routes/common.routes');
const transactionsRouter = require('./routes/transactions.routes');

const socketServer = require('http').createServer(app);

socketInstance.initialize(socketServer);

socketInstance.io().sockets.on('connection', (socket) => {
  socket.on('createRoom', (data) => {
    socket.join(data.userId);
    //console.log(socketInstance.io().sockets.adapter.rooms, 'rooms');
  });
});

socketServer.listen(9999, () => {
  console.log(`listening`);
});

app.use(cookieParser());

app.use('/', commonRouter);
app.use('/video', videoRouter);
app.use('/uploadInfo', uploadInfoRouter);
app.use('/sendEmail', sendMailRouter);
app.use('/users', userRouter);
app.use('/links', LinksRouter);
app.use('/trello', trelloRouter);
app.use('/auth', authRouter);
app.use('/viewedMentions', viewedMentionsRouter);
app.use('/authorLink', authorLinkRouter);
app.use('/sales', salesRouter);
app.use('/location', locationRouter);
app.use('/transactions', transactionsRouter);
app.use('/webhook', webhookRouter);
app.use('/public/users', publicUsersRouter);
app.use('/public/videos', publicVideosRouter);

app.post('/fbTest', async (req, res) => {
  try {
    const streamifier = require('streamifier');

    const { videoDbId } = req.body;

    const video = await findVideoBy({
      searchBy: 'videoData.videoId',
      value: videoDbId,
    });

    console.log(video, 88);

    const params = {
      Bucket: 'viralbear',
      Key: video.bucket.cloudVideoPath,
    };

    const resBucket = await new Promise((resolve, reject) => {
      new aws.S3({
        endpoint: 'https://storage.yandexcloud.net',
        credentials: {
          accessKeyId: 'YCAJE9VavEEX6lxxxmn5Zf9gf',
          secretAccessKey: 'YCNN8SqgPoEf14LAsSfeVL8hJqC-G6YDL2cwSHrQ',
        },
        region: 'ru-central1',
        httpOptions: {
          timeout: 20000,
          connectTimeout: 20000,
        },
      }).getObject(params, (err, data) => {
        if (err) {
          reject(err);
        }

        resolve({ length: data.ContentLength, buffer: data.Body });
      });
    });

    const stream = streamifier.createReadStream(resBucket.buffer);

    console.log(stream, 812);

    return res.status(200).json({ text: 'success' });
  } catch (err) {
    console.log(err);

    return res.status(400).json({ text: 'error' });
  }
});

app.post('/test', async (req, res) => {
  try {
    const researchers = await getAllUsers({ roles: ['researcher'] });

    await Promise.all(
      researchers.map(async (researcher) => {
        await markEmployeeOnSalesHavingReceivePercentage({
          researcherId: researcher._id,
        });
      })
    );

    return res.status(200).json({
      message: 'success',
    });
  } catch (err) {
    console.log(err);

    return res.status(400).json({
      message: 'error',
    });
  }
});

let PORT = process.env.PORT || 8888;

(async () => {
  try {
    await mongoose.connect(
      `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}`,
      {}
    );
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (e) {
    console.log(e);
  }
})();
