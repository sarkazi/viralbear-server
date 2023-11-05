const { google } = require("googleapis");

const googleApiOAuth2Instance = new google.auth.OAuth2(
  process.env.GOOGLE_API_CLIENT_ID,
  process.env.GOOGLE_API_CLIENT_SECRET,
  process.env.GOOGLE_API_REDIRECT_URIS
);

module.exports = googleApiOAuth2Instance;
