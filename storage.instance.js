const AWS = require('aws-sdk');

const storageInstance = new AWS.S3({
  endpoint: process.env.YANDEX_CLOUD_ENDPOINT,
  credentials: {
    accessKeyId: process.env.YANDEX_CLOUD_KEY_ID,
    secretAccessKey: process.env.YANDEX_CLOUD_ACCESS_KEY,
  },
  region: process.env.YANDEX_CLOUD_REGION,
  httpOptions: {
    timeout: 20000,
    connectTimeout: 20000,
  },
});

module.exports = storageInstance;
