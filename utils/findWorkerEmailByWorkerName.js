const User = require('../entities/User');

const findWorkerEmailByWorkerName = async (decodeResearchers) => {
  const workers = await User.find({ role: 'worker' });

  const workersEmailsList = decodeResearchers
    .map((el) => {
      const nameRespond = workers.find((worker) => worker.name === el);
      return nameRespond.email;
    })
    .filter((el) => el);

  return workersEmailsList;
};

module.exports = { findWorkerEmailByWorkerName };
