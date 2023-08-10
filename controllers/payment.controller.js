const Payment = require('../entities/Payment');

const createNewPayment = async (body) => {
  const newSales = await Payment.create(body);
  return newSales;
};

module.exports = {
  createNewPayment,
};
