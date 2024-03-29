var sio = require("socket.io");
var io = null;

exports.io = function () {
  return io;
};

exports.initialize = function (server) {
  return (io = sio(server, {
    cors: {
      origin: [
        process.env.CLIENT_URI,
        "http://localhost:3000",
        "http://localhost:3001",
      ],
    },
  }));
};
