const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();

// view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// static files
app.use(express.static("public"));

// home route
app.get("/", (req, res) => {
  res.render("index");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});