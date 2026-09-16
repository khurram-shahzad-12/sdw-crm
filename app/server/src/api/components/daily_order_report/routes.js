const express = require('express');
const controller = require('./controller');
const {readDailyOrderReport, readOrderHistory} = require("../../../middleware/auth0");
const {authenticate} = require('../../../middleware/auth');
const router = express.Router();

router.get('/' ,authenticate, readDailyOrderReport ,controller.getDateOrderReport);
router.get('/customer-history/:customerId',authenticate, readOrderHistory, controller.getCustomerOrderHistory);

module.exports = router;