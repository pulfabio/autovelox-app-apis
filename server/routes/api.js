const express = require('express');
const router = express.Router();
const fs = require('fs'); //file system module
const path = require('path');
const jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var bodyParser = require('body-parser');
var dbUrl = "mongodb://localhost:27017/autovelox-app";
var mongo = require("mongodb").MongoClient;
var config = require('../../config'); // get our config file (for secret and db)
var ObjectId = require('mongodb').ObjectID;

// Parsers for POST data
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: false }));

//REAL AUTHENTICATION ROUTE - WITH DB
// route to authenticate a user (POST http://localhost:3001/api/login)
router.post('/login', function(req, res) {
  //find the user
  mongo.connect(dbUrl, function(err, db) {
    if (err) throw err;
    var username = req.body.username;
    var password = req.body.password;
    db.collection("users").findOne({
      "username": username
    }, function(err, user) {
      if (err) throw err;
      if (!user) {
        //res.json({ success: false, message: 'Authentication failed. User not found.' });

        //If user is not found we create a new one instead of responding unsuccessfully

        createUser(username, password);
      } else if (user) {
        // check if password matches
        if (user.password !== req.body.password) {
          res.json({ success: false, message: 'Authentication failed. Wrong password.' });
        } else {
          // if user is found and password is right
          // create a token
          //sendToken();
          var token = jwt.sign(user, config.secret/*app.get('superSecret')*/, {
            expiresIn: "24h" // expires in 24 hours
          });
          // return the information including token as JSON
          res.json({
            success: true,
            message: 'Enjoy your token!',
            auth_token: token
          });
        }
      }
    })

    function createUser(username, password) {
      //With password encryption
      //var user = _.omit(userParam, 'password');
      // add hashed password to user object
      //user.hash = bcrypt.hashSync(userParam.password, 10);

      //Without password encryption
      if (!username || !password) {
        res.json({
          success: false,
          message: "Can't create user, missing data!"
        });
      }
      var user = {"username": username, "password": password};
      db.collection("users").insert(
        user,
        function (err, doc) {
          if (err) throw err;
          // if user is created correctly create a token
          var token = jwt.sign(user, config.secret/*app.get('superSecret')*/, {
            expiresIn: "24h" // expires in 24 hours
          });
          // return the information including token as JSON
          res.json({
            success: true,
            message: 'Enjoy your token!',
            auth_token: token
          });
        }
      );
    }
  })
});

// route middleware to verify a token - implemented AFTER the authentication route
//because we don't want to secure that, but before the get methods,
//which need to be secured

router.use(function(req, res, next) {
  // check header or url parameters or post parameters for token
  //var token = req.body.token || req.query.token || req.headers['x-access-token'];
  var authorization = req.get('Authorization');
  if (!authorization) { //If no authorization key in header
    return res.status(403).send({
      success: false,
      message: 'No authorization key/value pair provided in header.'
    });
  }
  var token = authorization.substring(7);
  // decode token
  if (token) {
    // verifies secret and checks exp
    jwt.verify(token, config.secret/*app.get('superSecret')*/, function(err, decoded) {
      if (err) {
        return res.json({ success: false, message: 'Failed to authenticate token.' });
      } else {
        // if everything is good, save to request for use in other routes
        req.decoded = decoded;
        next();
      }
    });
  } else {
    // if there is no token
    // return an error
    return res.status(403).send({
      success: false,
      message: 'No token provided.'
    });
  }
});

//Next routes are secured by the middleware above.

//Real get-pins route
router.get('/get-pins', (req, res) => {
  mongo.connect(dbUrl, function(err, db) {
    var latitude = parseFloat(req.query.latitude);
    var longitude = parseFloat(req.query.longitude);
    var distance = parseFloat(req.query.distance);

    if (!distance) {
      distance = 0.0400;
    }
    if (err) throw err;
    db.collection("pins").find(
      {
        $and: [
          {"latitude":{$lt:latitude + distance, $gt:latitude - distance}},
          //{"latitude":{$gt:latitude - distance}},
          {"longitude":{$lt:longitude + distance, $gt:longitude - distance}}
          //{"longitude":{$gt:longitude - distance}}
        ]

      }
    ).toArray(function(err, results) {
      if (err) throw err;

      //Calculate distance of each radar-pin from user
      results = results.map(function(pin) {
        pin.distance = calcDist(latitude, longitude, pin.latitude, pin.longitude);
        return pin;
      });

      res.send(results);
      db.close();
    })
  })

  //Calculates distance in meters between two points,
  //given the points latitudes and longitudes
  //using ‘haversine’ formula
  function calcDist(lat1, lon1, lat2, lon2) {

    //toRad converts angles from degrees to radians
    function toRad(x) {
      return x * Math.PI / 180;
    }

    var R = 6371e3; // meters
    var φ1 = toRad(lat1);
    var φ2 = toRad(lat2);
    var Δφ = toRad(lat2-lat1);
    var Δλ = toRad(lon2-lon1);

    var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    var d = R * c;
    return d;
  }
})

//Real get-user-pins route
router.get('/get-user-pins', (req, res) => {
  mongo.connect(dbUrl, function(err, db) {
    if (err) throw err;
    db.collection("pins").find(
      {"username": req.query.username}
    ).toArray(function(err, results) {
      if (err) throw err;
      res.send(results);
      db.close();
    })
  })
})

//Real add-pin route
router.post('/add-pin', (req, res) => {
  mongo.connect(dbUrl, function(err, db) {
    if (err) throw err;
    var pin = {
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      type: req.body.type,
      date: req.body.date,
      time: req.body.time,
      username: req.body.username,
      distance: req.body.distance,
      speed: req.body.speed
    };
    db.collection("pins").insert(
      pin,
      function (err, doc) {
        if (err) throw err;
        res.json({
          success: true,
          message: 'Pin added!',
          pin: pin
        });
      }
    );
  })
})

//Real get-comments-username route
router.get('/get-comments-username', (req, res) => {
  mongo.connect(dbUrl, function(err, db) {
    if (err) throw err;
    db.collection("comments").find(
      {"username": req.query.username}
    ).toArray(function(err, results) {
      if (err) throw err;
      res.send(results);
      db.close();
    })
  })
})

//Real get-comments-pin route
router.get('/get-comments-pin', (req, res) => {
  mongo.connect(dbUrl, function(err, db) {
    var pin_id = req.query.pin_id;
    if (err) throw err;
    db.collection("comments").find(
      {"pin_id": new ObjectId(pin_id) }
    ).toArray(function(err, results) {
      if (err) throw err;
      res.send(results);
      db.close();
    })
  })
})

//Real add-comment route
router.post('/add-comment', (req, res) => {
  mongo.connect(dbUrl, function(err, db) {
    if (err) throw err;
    var comment = {username: req.body.username, pin_id: req.body.pin_id, text: req.body.text};
    db.collection("comments").insert(
      comment,
      function (err, doc) {
        if (err) throw err;
        res.json({
          success: true,
          message: 'Comment added!',
          pin: comment
        });
      }
    );
  })
})

module.exports = router;

