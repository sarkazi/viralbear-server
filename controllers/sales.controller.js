const Sales = require('../entities/Sales');

const createNewSale = async (body) => {
  const newSales = await Sales.create(body);
  return newSales;
};

const findSaleBySaleId = async (saleId) => {
  return await Sales.findOne({ saleId });
};

module.exports = { createNewSale, findSaleBySaleId };
