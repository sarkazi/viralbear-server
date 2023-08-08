const Sales = require('../entities/Sales');
const moment = require('moment');

const createNewSale = async (body) => {
  const newSales = await Sales.create(body);
  return newSales;
};

const getAllSales = async ({
  count,
  company,
  date,
  videoId,
  userId,
  relatedToTheVbForm,
  paidFor,
}) => {
  return await Sales.find({
    ...(userId && { researchers: { $elemMatch: { id: userId } } }),
    ...(company && { company }),
    ...(videoId && { videoId }),
    ...(paidFor && paidFor),
    ...(date && {
      createdAt: {
        $gte: date[0],
        $lt: date[1],
      },
    }),
    ...(relatedToTheVbForm && {
      vbFormInfo: { $exists: true },
    }),
  })
    .limit(count ? count : null)
    .sort({ $natural: -1 })
    .populate({
      path: 'vbFormInfo.uid',
      select: { formId: 1, sender: 1, refFormId: 1, advancePaymentReceived: 1 },
      populate: {
        path: 'sender refFormId',
        select: { email: 1, advancePayment: 1, percentage: 1, exclusivity: 1 },
      },
    });
};

const deleteSaleById = async (saleId) => {
  return await Sales.deleteOne({ _id: saleId });
};

const findSaleById = async (saleId) => {
  return Sales.findById(saleId);
};

const getSalesByUserId = async ({ userId, dateLimit, paidFor }) => {
  return Sales.find({
    researchers: {
      $elemMatch: {
        id: userId,
        ...(typeof paidFor === 'boolean' && { paidFor }),
      },
    },
    ...(dateLimit && {
      createdAt: {
        $gte: moment().utc().subtract(dateLimit, 'd').startOf('d').valueOf(),
      },
    }),
  }).sort({ createdAt: -1 });
};

const updateSalesBy = async ({ updateBy, value, dataForUpdate }) => {
  return Sales.updateMany(
    {
      [updateBy]: value,
    },
    dataForUpdate
  );
};

const updateSaleBy = async ({ updateBy, value, dataForUpdate }) => {
  return Sales.updateOne(
    {
      [updateBy]: value,
    },
    dataForUpdate
  );
};

const markEmployeeOnSalesHavingReceivePercentage = async ({ researcherId }) => {
  return Sales.updateMany(
    { researchers: { $elemMatch: { id: researcherId } } },
    { $set: { 'researchers.$[field].paidFor': true } },
    { arrayFilters: [{ 'field.id': researcherId }] }
  );
};

module.exports = {
  createNewSale,
  deleteSaleById,
  getAllSales,
  findSaleById,
  getSalesByUserId,
  updateSalesBy,
  updateSaleBy,
  markEmployeeOnSalesHavingReceivePercentage,
};
