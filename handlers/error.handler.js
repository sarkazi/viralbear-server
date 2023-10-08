const errorsHandler = (err) => {
  if (err?.response?.data?.error === 'API_TOKEN_LIMIT_EXCEEDED') {
    return 'TRELLO_API_TOKEN_LIMIT_EXCEEDED';
  } else {
    return err;
  }
};

module.exports = { errorsHandler };
