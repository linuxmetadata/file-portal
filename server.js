require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* STATIC FILES */
app.use(express.static("public"));

/* ROUTES */
app.use("/auth", require("./routes/auth"));   // ✅ FIXED
app.use("/data", require("./routes/data"));   // ✅ CLEAN

/* START */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port " + PORT));