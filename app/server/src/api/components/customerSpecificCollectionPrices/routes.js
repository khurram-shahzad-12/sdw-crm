const express = require('express');
const controller = require('./controller');
const {readCustomersCheck, writeCustomersCheck} = require('../../../middleware/auth0');
const {authenticate} = require('../../../middleware/auth');
const router = express.Router();

router.get('/:id',authenticate,  readCustomersCheck, controller.getCustomerCollectionPrices);
router.put('/',authenticate, writeCustomersCheck, controller.upsertCustomerCollectionSpecificPrices);
router.delete("/:customerId/:productId",authenticate, writeCustomersCheck, controller.removeCustomerCollectionSpecificPrices);

module.exports = router;
