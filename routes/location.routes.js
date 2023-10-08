const express = require('express');
const router = express.Router();
const { getAllCountries } = require('../controllers/location.controller');
const { errorsHandler } = require('../handlers/error.handler');
router.get('/getAllCountries', async (req, res) => {
  try {
    const countries = await getAllCountries();

    const countryNames = countries.map((obj) => {
      return obj.name;
    });

    return res.status(200).json({
      apiData: countryNames,
      status: 'success',
      message: 'List of countries received',
    });
  } catch (err) {
    console.log(errorsHandler(err));;
    console.log(err?.response?.data);
    return res.status(500).json({
      status: 'error',
      code: 'Server side error',
    });
  }
});

module.exports = router;
