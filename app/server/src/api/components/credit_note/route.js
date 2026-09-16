const express = require('express');
const controller = require('./controller');
const controllerPDF = require('./controller.pdf');
const {authenticate} = require('../../../middleware/auth');
const { createCreditNotescheck,editCreditNotesCheck,creditNoteApplyCheck,readCreditNoteCheck } = require('../../../middleware/auth0');
const router = express.Router();

router.all('/creditnote.pdf',authenticate, createCreditNotescheck, controllerPDF.createCreditNotePDF);
router.all('/creditNoteReprint.pdf',authenticate, createCreditNotescheck, controllerPDF.createCreditNoteReprint);

router.get('/:id?',authenticate, readCreditNoteCheck, controller.getCreditNotes);
router.post('/',authenticate, createCreditNotescheck, controller.createCreditNote);
router.post('/apply-credit',authenticate, creditNoteApplyCheck, controller.applyCreditToInvoices);
router.put('/:id',authenticate, editCreditNotesCheck, controller.updateCreditNote);
router.delete('/:id',authenticate, editCreditNotesCheck, controller.deleteCreditNote);

module.exports = router;