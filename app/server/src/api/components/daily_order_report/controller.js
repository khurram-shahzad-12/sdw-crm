const DAILY_ORDER_REPORT = require('./service');

const getDateOrderReport = async (req, res, next) => {
    try {
        const { ot_date, customer_id } = req.query;
        res.status(200).json(await DAILY_ORDER_REPORT.getDateOrderReport(ot_date, customer_id));
    } catch (e) { next(e); }
};

const getCustomerOrderHistory = async (req, res, next) => {
    try {
        const { customerId } = req.params;
        const { limit, invoiceDate } = req.query;
        res.status(200).json(await DAILY_ORDER_REPORT.getCustomerOrderHistory( customerId, invoiceDate, limit || 10 ));
    } catch (e) { next(e); }
};

module.exports = {
    getDateOrderReport,
    getCustomerOrderHistory,
};