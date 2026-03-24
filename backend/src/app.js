const express = require("express");
const cors = require("cors");
const errorMiddleware = require("./middleware/error.middleware");
const routes = require("./routes/index");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", routes);

app.use(errorMiddleware);

module.exports = app;
