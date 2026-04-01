const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Routes
app.use("/auth", require("./routes/auth"));
app.use("/data", require("./routes/data"));
app.use("/upload", require("./routes/upload"));

app.listen(process.env.PORT, () => {
  console.log("Server running on port " + process.env.PORT);
});