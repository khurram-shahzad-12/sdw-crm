const SERVICE_CUSTOMER_RECOMMENDATION = require('./service');

const getCustomerRecommendation = async (req, res, next) => {
    try {
        res.status(200).json(await SERVICE_CUSTOMER_RECOMMENDATION.getCustomerRecommendation(req.params.id));
    } catch (e) {next(e);}
};

module.exports = {
    getCustomerRecommendation,
   
};
