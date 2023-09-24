const Payment = require('../entities/Payment');

const moment = require('moment');

const createNewPayment = async (body) => {
  const newSales = await Payment.create(body);
  return newSales;
};

const getAllTransactions = async ({
  skip,
  limit,
  fieldsInTheResponse,
  dateRange,
}) => {
  return await Payment.find(
    {
      ...(dateRange && {
        createdAt: {
          $gte: dateRange[0],
          $lte: moment(dateRange[1]).add(1, 'd'),
        },
      }),
    },
    {
      ...(fieldsInTheResponse &&
        fieldsInTheResponse.reduce((a, v) => ({ ...a, [v]: 1 }), {})),
    }
  )
    .populate({
      path: 'user',
      model: 'User',
      select: {
        name: 1,
        role: 1,
        email: 1,
      },
    })
    .limit(limit ? limit : null)
    .skip(skip ? skip : null)
    .sort({ createdAt: -1 });
};

const getCountAllTransactions = async ({ dateRange }) => {
  return await Payment.find({
    ...(dateRange && {
      createdAt: {
        $gte: dateRange[0],
        $lte: moment(dateRange[1]).add(1, 'd'),
      },
    }),
  }).count();
};

module.exports = {
  createNewPayment,
  getAllTransactions,
  getCountAllTransactions,
};
