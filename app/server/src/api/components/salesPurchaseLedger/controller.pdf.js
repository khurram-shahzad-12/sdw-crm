const SERVICE_LEDGER_PDF = require('./service.pdf');
const moment = require("moment");

const createSalesLedgerPDF = async (req, res, next) => {
    try {
        const { ids, startDate, endDate } = req.body;
        if (!ids || ids.length === 0) { throw new Error('No sales IDs provided'); } 
        const pdfBuffer = await SERVICE_LEDGER_PDF.generateSalesLedgerPDF( ids, startDate, endDate ); 
        res.contentType('application/pdf');
        res.send(pdfBuffer);
    } catch (e) { next(e); }
};

const createPurchaseLedgerPDF = async (req, res, next) => {
    try {
        const { ids, startDate, endDate } = req.body;
        if (!ids || ids.length === 0) { throw new Error('No Purchase IDs provided'); } 
        const pdfBuffer = await SERVICE_LEDGER_PDF.generatePurchaseLedgerPDF( ids, startDate, endDate );
        res.contentType('application/pdf');
        res.send(pdfBuffer);
    } catch (e) { next(e); }
};

module.exports = {
    createSalesLedgerPDF,
    createPurchaseLedgerPDF
};