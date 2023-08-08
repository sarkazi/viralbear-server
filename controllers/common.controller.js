const axios = require('axios');

const convertCurrency = async ({ from, to, amount }) => {
  const { data } = await axios.get(
    `https://api.exchangerate.host/convert?from=${from}&to=${to}&amount=${amount}`
  );

  return data.result;
};

module.exports = {
  convertCurrency,
};
