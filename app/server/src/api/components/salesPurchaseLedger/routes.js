const express = require('express');
const controller = require('./controller');
const controllerPDF = require('./controller.pdf');
const {authenticate} = require('../../../middleware/auth')
const { readSalesLedger, readPurchaseLedger, writeSalesLedgerCheck, writePurchaseLedgerCheck } = require("../../../middleware/auth0");
const router = express.Router();

router.post('/sales-ledger.pdf',authenticate, writeSalesLedgerCheck, controllerPDF.createSalesLedgerPDF);
router.post('/purchase-ledger.pdf',authenticate, writePurchaseLedgerCheck, controllerPDF.createPurchaseLedgerPDF);
router.get('/sales-ledger',authenticate, readSalesLedger, controller.getSalesLedger);
router.get('/purchase-ledger',authenticate, readPurchaseLedger, controller.getPurchaseLedger);

module.exports = router;