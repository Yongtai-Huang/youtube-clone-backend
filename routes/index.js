'use strict';

const router = require('express').Router();
const auth = require("./auth");
const admin = require("./admin");
const video = require("./video");
const user = require("./user");

router.use("/api/auth", auth);
router.use("/api/admin", admin);
router.use("/api/videos", video);
router.use("/api/users", user);


router.use(function(err, req, res, next){
  if (err.name === 'ValidationError') {
    return res.status(422).json({
      errors: Object.keys(err.errors).reduce(function(errors, key){
        errors[key] = err.errors[key].message;

        return errors;
      }, {})
    });
  }

  return next(err);
});

module.exports = router;