const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth.middleware');
const { errorsHandler } = require('../handlers/error.handler');

const {
  getAllTransactions,
  getCountAllTransactions,
} = require('../controllers/payment.controller');

router.get('/getAll', authMiddleware, async (req, res) => {
  const { fieldsInTheResponse, page, limit, dateRange } = req.query;

  try {
    const countTransactions = await getCountAllTransactions({
      ...(dateRange && { dateRange }),
    });

    const transactions = await getAllTransactions({
      ...(page && limit && { skip: (page - 1) * limit, limit }),
      ...(fieldsInTheResponse && {
        fieldsInTheResponse,
      }),
      ...(dateRange && { dateRange }),
    });

    const apiData = {
      ...(limit &&
        page && {
          pagination: {
            count: countTransactions,
            pageCount: Math.ceil(countTransactions / limit),
          },
        }),
      transactions,
    };

    res.status(200).json({
      message: 'The list of transactions has been received',
      status: 'success',
      apiData,
    });
  } catch (err) {
    console.log(errorsHandler({ err, trace: 'transaction.getAll' }));
    return res.status(400).json({
      message: 'Server side error',
      status: 'error',
    });
  }
});

module.exports = router;
