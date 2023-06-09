const axios = require('axios');

const getAllCountries = async () => {
  const { data } = await axios.get(
    'https://geohelper.info/api/v1/countries?locale[lang]=en',
    {
      params: {
        apiKey: process.env.GEOHELPER_API_KEY,
      },
    }
  );

  return data.result;
};

module.exports = { getAllCountries };
