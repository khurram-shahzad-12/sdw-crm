const moment = require('moment');
const SERVICE_CREDIT_NOTE = require('./service');
const SERVICE_CREDIT_NOTE_PDF = require('./service.pdf');
const validate = require('../../../utils/validate');
const env = require('../../../config.env');
const extractProperties = require('./../../../utils/extractProperties');

const allowedModifiableProperties = [
    'original_invoice_id', 'original_invoice_number', 'customer_id', 'customer_name', 'customer_sales_rep', 'credit_items', 'credit_adjustments',
    'reason_description', 'subtotal', 'vat_total', 'total_credit_amount', 'profit_impact', 'notes', 'email_sent', 'printed', 'created_by', 'remaining_credit',];

const buildQuery = (req) => {
    if (req.params.id && validate.id(req.params.id)) { return { _id: req.params.id }; }
    const QUERY = {};
    const { customer_id, status, start_date, end_date, credit_note_number } = req.query;
    if (customer_id && validate.id(customer_id)) { QUERY.customer_id = customer_id; }
    if (status) { QUERY.status = status; }
    if (credit_note_number) { QUERY.credit_note_number = credit_note_number; }
    if (start_date) {
        const date = moment(start_date).format('YYYY-MM-DD');
        if (date) QUERY.created_at = { $gte: new Date(date) };
    }
    if (end_date) {
        const date = moment(end_date).format('YYYY-MM-DD');
        if (date) {
            if (!QUERY.created_at) QUERY.created_at = {};
            QUERY.created_at.$lte = moment(date).endOf('day').toDate();
        }
    }
    return QUERY;
};
const getCreditNotes = async (req, res, next) => {
    try { res.status(200).json(await SERVICE_CREDIT_NOTE.fetchCreditNotes(buildQuery(req),null, { created_at: -1 })); } catch (e) { next(e); }
};

const createCreditNote = async (req, res, next) => {
    console.log(req.body)
    try {
        res.status(201).json(await SERVICE_CREDIT_NOTE.createCreditNote(extractProperties(req.body, allowedModifiableProperties) ));
    } catch (e) { next(e); }
};

const applyCreditToInvoices = async (req, res, next) => {
    try {
        const { invoiceId, creditNoteId, appliedBy, amount } = req.body;
        if (!validate.id(creditNoteId)) { throw new Error('Invalid credit note ID'); }
        if (!amount || amount <= 0) { throw new Error('Amount must be greater than 0'); }
        const result = await SERVICE_CREDIT_NOTE.applyCreditToInvoices(creditNoteId, invoiceId, amount, appliedBy || 'System');
        res.status(200).json(result);
    } catch (e) { next(e); }
};

const updateCreditNote = async (req, res, next) => {
    try {
        const id = validate.id(req.params.id);
        if (!id) { throw new Error('Invalid credit note ID');  }
        const updatedCreditNote = await SERVICE_CREDIT_NOTE.updateCreditNote( id, extractProperties(req.body, allowedModifiableProperties) );
        res.status(200).json(updatedCreditNote);
    } catch (e) { next(e); }
};

const deleteCreditNote = async (req, res, next) => {
    try {
        const id = validate.id(req.params.id);
        if (!id) { throw new Error('Invalid credit note ID'); }
        res.status(200).json(await SERVICE_CREDIT_NOTE.deleteCreditNote(id));
    } catch (e) { next(e); }
};

module.exports = {
    getCreditNotes,
    createCreditNote,
    applyCreditToInvoices,
    updateCreditNote,
    deleteCreditNote,
};