const identifyingSuitableVideosFromPairedReport = (company, arr) => {
  switch (company) {
    case 'newsflare':
      return arr[0].reduce(
        (res, item) => {
          res[
            !item['Partner Video Id']
              ? 'emptyVideoId'
              : item['Partner Video Id'] < 1460
              ? 'idLess1460'
              : 'suitable'
          ].push(item);
          return res;
        },
        { suitable: [], idLess1460: [], emptyVideoId: [] }
      );
  }
};
