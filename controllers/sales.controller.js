const Sales = require('../entities/Sales');
const moment = require('moment');

const createNewSale = async (body) => {
  const newSales = await Sales.create(body);
  return newSales;
};

const getAllSales = async ({ count, company, date, videoId, researcher }) => {
  return await Sales.find({
    ...(researcher && { 'researchers.names': { $in: [researcher] } }),
    ...(company && { company }),
    ...(videoId && { videoId }),
    ...(date && {
      createdAt: {
        $gte: date[0],
        $lt: date[1],
      },
    }),
  })
    .limit(count ? count : null)
    .sort({ $natural: -1 });
};

const deleteSaleById = async (saleId) => {
  return await Sales.deleteOne({ _id: saleId });
};

const findSaleById = async (saleId) => {
  return Sales.findById(saleId);
};

const getSalesByUserId = async (userId, dateLimit) => {
  return Sales.find({
    researchers: userId,
    ...(dateLimit && {
      createdAt: {
        $gte: moment().utc().subtract(dateLimit, 'd').startOf('d').valueOf(),
      },
    }),
  }).sort({ createdAt: -1 });
};

module.exports = {
  createNewSale,
  deleteSaleById,
  getAllSales,
  findSaleById,
  getSalesByUserId,
};
