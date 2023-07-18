const CC = require('currency-converter-lt');
const axios = require('axios');

const convertCurrency = async ({ from, to, amount }) => {
  const { data } = await axios.get(
    `https://api.exchangerate.host/convert?from=${from}&to=${to}&amount=${amount}`
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
              amount:
                obj['Your Earnings'] && obj['Your Earnings'] > 0
                  ? await convertCurrency({
                      from: 'GBP',
                      to: 'USD',
                      amount: obj['Your Earnings'],
                    })
                  : 0,
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
    } else if (arr[0].hasOwnProperty('Aflo Ref:')) {
      resolve({
        company: 'aflo',
        searchBy: 'videoId',

        data: await Promise.all(
          arr.map(async (obj) => {
            return {
              videoId:
                obj['Supplier Ref:'] && obj['Supplier Ref:'].includes('_tv')
                  ? +obj['Supplier Ref:'].replace('_tv', '')
                  : obj['Supplier Ref:'],
              usage: null,
              amount:
                obj.TOTAL && obj.TOTAL > 0
                  ? await convertCurrency({
                      from: 'JPY',
                      to: 'USD',
                      amount: obj.TOTAL,
                    })
                  : 0,
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
    } else if (arr[0].hasOwnProperty('Video_ref_ID')) {
      resolve({
        company: 'kameraone',
        searchBy: 'videoId',
        data: await Promise.all(
          arr.map(async (obj) => {
            return {
              videoId: obj['Video_ref_ID'],
              usage: null,
              amount:
                obj[' EUR/clip'] && obj[' EUR/clip'] > 0
                  ? await convertCurrency({
                      from: 'EUR',
                      to: 'USD',
                      amount: obj[' EUR/clip'],
                    })
                  : 0,
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
    } else if (arr[0].hasOwnProperty('ViralBear ID')) {
      resolve({
        company: 'stringershub',
        searchBy: 'videoId',
        data: await Promise.all(
          arr.map(async (obj) => {
            return {
              videoId: obj['ViralBear ID'],
              usage: null,
              amount: obj['Net sales'],
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
    }
  });
};

module.exports = determinationCompanyDataBasedOnPairedReport;
