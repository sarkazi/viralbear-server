const CC = require('currency-converter-lt');
const axios = require('axios');

let currencyConverter = new CC();

const test = async (curFrom, amount) => {
  const { data } = await axios.get(
    `https://api.apilayer.com/currency_data/convert?from=${curFrom}&to=USD&amount=${amount}&apikey=94RslgQImpbDjRPyZ5vXGxzrQx1nQ4sD`
  );
  return data.result;
};

const determinationCompanyDataBasedOnPairedReport = async (arr) => {
  return await new Promise(async (resolve, reject) => {
    if (arr[0].hasOwnProperty('Partner Video Id')) {
      resolve({
        company: 'newsflare',
        searchBy: 'videoId',
        data: await Promise.all(
          arr.map(async (obj) => {
            return {
              videoId: obj['Partner Video Id'],
              usage: obj['Sale Type'],
              amount: await test('JPY', obj['Your Earnings']),
              title: null,
            };
          })
        ).then((arr) => {
          return arr.reduce(
            (res, item) => {
              res[!item.videoId ? 'emptyField' : 'suitable'].push(item);
              return res;
            },
            { suitable: [], emptyField: [] }
          );
        }),
      });
    } else if (arr[0].hasOwnProperty('Content Provider Revenue')) {
      resolve({
        company: 'videoElephant',
        searchBy: 'title',
        data: arr
          .map((obj) => {
            return {
              videoId: null,
              usage: null,
              amount: obj['Content Provider Revenue'],
              title: obj['Title'],
            };
          })
          .reduce(
            (res, item) => {
              res[!item.title ? 'emptyField' : 'suitable'].push(item);
              return res;
            },
            { suitable: [], emptyField: [] }
          ),
      });
    } else if (arr[0].hasOwnProperty('Supplier Ref')) {
      resolve({
        company: 'aflo',
        searchBy: 'videoId',

        data: await Promise.all(
          arr.map(async (obj) => {
            return {
              videoId: obj['Supplier Ref'],
              usage: null,
              amount: await currencyConverter
                .from('JPY')
                .to('USD')
                .amount(obj['Total'])
                .convert(),
              title: null,
            };
          })
        ).then((arr) => {
          return arr.reduce(
            (res, item) => {
              res[!item.videoId ? 'emptyField' : 'suitable'].push(item);
              return res;
            },
            { suitable: [], emptyField: [] }
          );
        }),
      });
    } else if (arr[0].hasOwnProperty('Amount')) {
      resolve({
        company: 'tmb',
        searchBy: 'title',
        data: arr
          .map((obj) => {
            return {
              videoId: null,
              usage: obj['Client'],
              amount: obj['Amount'],
              title: obj['Title'],
            };
          })
          .reduce(
            (res, item) => {
              res[!item.title ? 'emptyField' : 'suitable'].push(item);
              return res;
            },
            { suitable: [], emptyField: [] }
          ),
      });
    }
  });
};

module.exports = determinationCompanyDataBasedOnPairedReport;
