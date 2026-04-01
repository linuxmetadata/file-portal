const { google } = require("googleapis");
const fs = require("fs");

const credentials = JSON.parse(fs.readFileSync("credentials.json"));

const { client_id, client_secret } = credentials.web;

const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  "http://localhost"
);

// Load token
const token = JSON.parse(fs.readFileSync("token.json"));
oAuth2Client.setCredentials(token);

module.exports = oAuth2Client;