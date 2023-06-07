const axios = require('axios');

const trelloApiKey = process.env.TRELLO_API_KEY;
const trelloApiToken = process.env.TRELLO_API_TOKEN;

const trelloInstance = axios.create({
  baseURL: 'https://api.trello.com',
  params: {
    key: trelloApiKey,
    token: trelloApiToken,
  },
});

module.exports = trelloInstance;
