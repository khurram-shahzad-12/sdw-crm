const LEDGER_SERVICE = require('./service');

const getSalesLedger = async (req, res, next) => {
    try {
        const { startDate, endDate, customer_id } = req.query;
        if (!startDate || !endDate) {throw new Error('Start date and end date are required')}
        res.status(200).json(await LEDGER_SERVICE.getSalesLedger(startDate, endDate, customer_id));
    } catch (e) { next(e); }
};
const getPurchaseLedger = async (req, res, next) => {
    try {
        const { startDate, endDate, supplier_id } = req.query;
         if (!startDate || !endDate) {throw new Error('Start date and end date are required')}
        res.status(200).json(await LEDGER_SERVICE.getPurchaseLedger(startDate, endDate, supplier_id));
    } catch (error) { next(error); }
};

module.exports = {
    getSalesLedger,
    getPurchaseLedger
};