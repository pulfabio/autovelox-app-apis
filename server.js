'use strict';
// Load dependencies
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var config = require('./config'); // get our config file (for secret and db)

// Get our API routes
const api = require('./server/routes/api');

const app = express();

app.set('superSecret', config.secret); // secret variable

app.use(cors());

// Parsers for POST data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

//Middleware to serve static files of Angular2 app
//app.use(express.static(path.join(__dirname, 'dist')));

// use morgan to log requests to the console
app.use(morgan('dev'));

// Set our api routes
app.use('/api', api);

// Catch all other routes and return the index file
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'dist/index.html'));
// });

/**
 * Get port from environment and store in Express.
 */
const port = process.env.PORT || '3001';
app.set('port', port);

/**
 * Create HTTP server.
 */
const server = http.createServer(app);

server.listen(port);
console.log('Serving autovelox on localhost:3001');