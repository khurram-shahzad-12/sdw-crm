const database = require('../../../db/database');
const Invoice = require('../invoice/model');
const axios = require("axios");


const getCustomerRecommendation = async (customerId) => {
    try {
        const invoices = await Invoice.find({ customer: customerId }).sort({ invoice_date: -1 }).limit(15).lean();
        const productMap = {};
        for (const invoice of invoices) {
            const invoiceProducts = new Set();
            for (const item of invoice.items) {
                const productId = item._id.toString();
                if (invoiceProducts.has(productId))
                    continue;
                invoiceProducts.add(productId);
                if (!productMap[productId]) {
                    productMap[productId] = {
                        _id: item._id,
                        timesOrdered: 0,
                        lastOrdered: invoice.invoice_date,
                    };
                }
                productMap[productId].timesOrdered++;
                if (new Date(invoice.invoice_date) > new Date(productMap[productId].lastOrdered)) { productMap[productId].lastOrdered = invoice.invoice_date }
            }
        }
        const recommendations = Object.values(productMap).map(item => {
            let priority = "low";
            if(item.timesOrdered >= 9) {priority = "high"}
            else if (item.timesOrdered >= 3) {priority = "medium";}
            return {...item, priority, }
        })
        return recommendations.sort((a, b) => b.timesOrdered - a.timesOrdered);
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    getCustomerRecommendation,
};

