const CC = require('currency-converter-lt');

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
              amount: await new CC()
                .from('GBP')
                .to('USD')
                .amount(obj['Your Earnings'])
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
              amount: await new CC()
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