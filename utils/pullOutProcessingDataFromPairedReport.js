const { convertCurrency } = require('../controllers/common.controller');

const pullOutProcessingDataFromPairedReport = async ({
  parseReport,
  companyName,
  revShare,
  totalSumFromKameraOne,
}) => {
  return await new Promise(async (resolve, reject) => {
    if (companyName === 'newsflare') {
      resolve({
        company: companyName,
        searchBy: 'videoId',
        data: await Promise.all(
          parseReport.map(async (obj) => {
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
            };
          })
        ),
      });
    } else if (companyName === 'videoelephant') {
      resolve({
        company: companyName,
        searchBy: 'title',
        data: parseReport.map((obj) => {
          return {
            usage: null,
            amount: obj['Content Provider Revenue'],
            title: obj['Title'],
          };
        }),
      });
    } else if (companyName === 'aflo') {
      resolve({
        company: companyName,
        searchBy: 'videoId',

        data: await Promise.all(
          parseReport.map(async (obj) => {
            return {
              videoId:
                obj['Supplier Ref:'] &&
                obj['Supplier Ref:'].toString().includes('_tv')
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
            };
          })
        ),
      });
    } else if (companyName === 'tmb') {
      resolve({
        company: companyName,
        searchBy: 'title',
        data: parseReport.map((obj) => {
          return {
            usage: obj['Client'],
            amount: obj['Amount'],
            title: obj['Title'],
          };
        }),
      });
    } else if (companyName === 'kameraone') {
      resolve({
        company: companyName,
        searchBy: 'videoId',
        data: await Promise.all(
          parseReport.map(async (obj) => {
            return {
              videoId: obj['Video_ref_ID'],
              usage: null,
              amount:
                obj[' EUR/clip'] && obj[' EUR/clip'] > 0
                  ? await convertCurrency({
                      from: 'EUR',
                      to: 'USD',
                      amount:
                        (revShare / totalSumFromKameraOne) * obj[' EUR/clip'],
                    })
                  : 0,
            };
          })
        ),
      });
    } else if (companyName === 'stringershub') {
      resolve({
        company: companyName,
        searchBy: 'videoId',
        data: await Promise.all(
          parseReport.map(async (obj, index) => {
            return {
              videoId: obj['ViralBear ID'],
              usage: null,
              amount:
                obj[Object.keys(obj).find((key) => key.includes('Net sales'))],
            };
          })
        ),
      });
    }
  });
};

module.exports = pullOutProcessingDataFromPairedReport;
