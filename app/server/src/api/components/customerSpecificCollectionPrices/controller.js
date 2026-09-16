const SERVICE_COLLECTION_SPECIFIC_PRICES = require('./service');
const validate = require('../../../utils/validate');
const extractProperties = require('./../../../utils/extractProperties');

const buildQuery = (req) => {
    if (req.params.id && validate.id(req.params.id)) return {customer: req.params.id};
    return {};
};

const getCustomerCollectionPrices = async (req, res, next) => {
    try {
        res.status(200).json(await SERVICE_COLLECTION_SPECIFIC_PRICES.getCustomerCollectionPrices(buildQuery(req)));
    } catch (e) {next(e);}
};
const upsertCustomerCollectionSpecificPrices = async (req, res, next) => {
    try {
        res.status(201).json(await SERVICE_COLLECTION_SPECIFIC_PRICES.upsertCustomerCollectionSpecificPrices(req.body, req.user?.permissions || []));
    } catch (e) {next(e);}
};
const removeCustomerCollectionSpecificPrices = async (req, res, next) => {
    const {customerId, productId} = req.params;
    try {
        res.status(200).json(await SERVICE_COLLECTION_SPECIFIC_PRICES.removeCustomerCollectionSpecificPrices({customerId, productId}));
    } catch (e) {next(e);}
};

module.exports = {
    getCustomerCollectionPrices,
    upsertCustomerCollectionSpecificPrices,
    removeCustomerCollectionSpecificPrices,
};
