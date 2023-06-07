const moment = require('moment');

const findTimestampsBySearch = (request) => {
  if (request === 'Today') {
    const dateFrom = moment().utc().startOf('d').toDate();
    const dateTo = moment().utc().endOf('d').toDate();

    return { dateFrom, dateTo };
  }
  if (request === 'Yesterday') {
    const dateFrom = moment().utc().subtract(1, 'd').startOf('d').toDate();
    const dateTo = moment().utc().subtract(1, 'd').endOf('d').toDate();

    return { dateFrom, dateTo };
  }
  if (request === 'Last 7 Days') {
    const date = moment().toDate();
    const dateFrom = moment(date).utc().subtract(7, 'd').toDate();
    const dateTo = date;

    return { dateFrom, dateTo };
  }
  if (request === 'Last 30 Days') {
    const date = moment().toDate();
    const dateFrom = moment(date).utc().subtract(30, 'd').toDate();
    const dateTo = date;

    return { dateFrom, dateTo };
  }
  if (request === 'This Month') {
    const date = moment().toDate();
    const dateFrom = moment(date).utc().startOf('month').toDate();
    const dateTo = date;

    return { dateFrom, dateTo };
  }
  if (request === 'Last Month') {
    const date = moment().toDate();

    const dateFrom = moment(date)
      .utc()
      .subtract(1, 'months')
      .startOf('month')
      .toDate();

    const dateTo = moment(date)
      .utc()
      .subtract(1, 'months')
      .endOf('month')
      .toDate();

    return { dateFrom, dateTo };
  }
};

module.exports = { findTimestampsBySearch };
