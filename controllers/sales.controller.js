const Sales = require('../entities/Sales');

const createNewSale = async (body) => {
  console.log(body, 78798);

  const newSales = await Sales.create(body);
  return newSales;
};

const findSaleBySaleId = async (saleId) => {
  return await Sales.findOne({ saleId });
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

module.exports = {
  createNewSale,
  findSaleBySaleId,
  getAllSales,
};
