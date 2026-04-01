const { google } = require("googleapis");

// ================= OAUTH CLIENT =================
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// ================= SET TOKEN =================
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

// ================= EXPORT =================
module.exports = oauth2Client;