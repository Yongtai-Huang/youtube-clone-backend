require("dotenv").config();
const path = require('path');
const express = require("express");
const cors = require("cors");
const routes = require('./routes');
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, '/public')));
app.use('/upload', express.static(path.join(__dirname, 'upload')));

// Routes
app.use(routes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, console.log(`Server started at http://localhost:${PORT}`));
