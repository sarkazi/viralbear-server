const storageInstance = require("../storage.instance");
const socketInstance = require("../socket.instance");
const path = require("path");
const { v4: createUniqueHash } = require("uuid");

const uploadFileToStorage = async ({
  socketInfo,
  folder,
  name,
  buffer,
  type,
  extension,
  resolve,
}) => {
  await storageInstance
    .upload(
      {
        Bucket: process.env.YANDEX_CLOUD_BUCKET_NAME,
        Key: `${folder}/${name}${extension}`,
        Body: buffer,
        ContentType: type,
      },
      (err, data) => {
        if (err) {
          console.log(err);
          resolve({
            message: "Error during file upload to storage",
            status: "error",
          });
        }

        if (data) {
          resolve({
            message: "The file has been successfully uploaded to the storage",
            status: "success",
            response: data,
          });
        }
      }
    )
    .on("httpUploadProgress", (progress) => {
      if (!!socketInfo) {
        const loaded = Math.round((progress.loaded * 100) / progress.total);

        socketInstance
          .io()
          .sockets.in(socketInfo.userId)
          .emit(socketInfo.socketEmitName, {
            event: socketInfo.eventName,
            file: {
              ...(!!socketInfo?.fileName && { name: socketInfo.fileName }),
              loaded,
            },
          });
      }
    });
};

const removeFileFromStorage = (path, resolve, reject) => {
  storageInstance.deleteObject(
    {
      Bucket: process.env.YANDEX_CLOUD_BUCKET_NAME,
      Key: path,
    },
    (err, data) => {
      if (err) {
        console.log(err);
        resolve({
          message: "Error deleting a file from storage",
          status: "error",
        });
      }
      if (data) {
        resolve({
          message: "File successfully deleted from storage",
          status: "success",
          response: data,
        });
      }
    }
  );
};

module.exports = {
  uploadFileToStorage,
  removeFileFromStorage,
};
