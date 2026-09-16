const SERVICE_CREDIT_NOTE_PDF = require('./service.pdf');
const createCreditNotePDF = async (req, res, next) => {
    try {
        const { creditNotes } = req.body;
        const creditNoteIds = creditNotes && Array.isArray(creditNotes) ? creditNotes : [];
        if (creditNoteIds.length === 0) { throw new Error('No credit note IDs provided'); } 
        const pdfBuffer = await SERVICE_CREDIT_NOTE_PDF.generateCreditNotePDF(creditNoteIds);
        res.contentType('application/pdf');
        res.send(pdfBuffer);
    } catch (e) { next(e); }
};

const createCreditNoteReprint = async (req, res, next) => {
    try {
        const { ids } = req.query;
        const creditNoteIds = ids ? ids.split(',') : [];
        if (creditNoteIds.length === 0) { throw new Error('No credit note IDs provided'); }
        const pdfBuffer = await SERVICE_CREDIT_NOTE_PDF.generateCreditNotePDF(creditNoteIds);
        res.contentType('application/pdf');
        res.send(pdfBuffer);
    } catch (e) { next(e); }
};

module.exports = {
    createCreditNotePDF,
    createCreditNoteReprint
};