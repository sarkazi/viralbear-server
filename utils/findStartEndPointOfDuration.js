const findStartEndPointOfDuration = (duration) => {
  if (duration == 'Any') {
    return null;
  }
  if (duration === '0 to 30 Seconds') {
    return {
      start: 1,
      finish: 30,
    };
  }
  if (duration === '30 to 60 Seconds') {
    return {
      start: 30,
      finish: 60,
    };
  }

  if (duration === '1 to 3 Minutes') {
    return {
      start: 60,
      finish: 180,
    };
  }

  if (duration === '> 3 Minutes') {
    return {
      start: 180,
      finish: 1800000,
    };
  }
};

module.exports = { findStartEndPointOfDuration };
