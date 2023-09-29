const axios = require('axios');

const calcOfCurrencyRatio = async ({ fromCur, toCur }) => {
  return await new Promise(async (resolve, reject) => {
    const ratiosToThirdCurrency = await Promise.all(
      [fromCur, toCur].map(async (cur) => {
        const { data } = await axios.get(
          `https://api.tinkoff.ru/v1/currency_rates?from=${cur}&to=RUB`
        );

        if (!!data?.errorMessage) {
          reject(`${data.plainMessage} (TCS currency rates)`);
        }

        return {
          amount: data.payload.rates[0].buy,
          cur,
          status: cur === fromCur ? 'from' : 'to',
        };
      })
    );

    resolve(
      ratiosToThirdCurrency.find((obj) => {
        return obj.status === 'from';
      }).amount /
        ratiosToThirdCurrency.find((obj) => {
          return obj.status === 'to';
        }).amount
    );
  });
};

module.exports = {
  calcOfCurrencyRatio,
};
