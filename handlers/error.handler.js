const errorsHandler = ({ err, trace }) => {
  if (
    err?.response?.data?.error !== 'API_TOKEN_LIMIT_EXCEEDED' &&
    err?.response?.statusText !== 'Too Many Requests'
  ) {
    return {
      err: err?.response?.data === 'invalid id' ? 'trello invalid id' : err,
      trace,
    };
  }
};

module.exports = { errorsHandler };
