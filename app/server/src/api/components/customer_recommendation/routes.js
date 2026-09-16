const express = require('express');
const controller = require('./controller');
const {readCustomersCheck} = require('../../../middleware/auth0');
const {authenticate} = require('../../../middleware/auth');
const router = express.Router();

router.get('/:id',authenticate, readCustomersCheck, controller.getCustomerRecommendation);

module.exports = router;
