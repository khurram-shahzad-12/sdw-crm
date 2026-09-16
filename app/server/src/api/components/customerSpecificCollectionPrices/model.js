const MONGOOSE = require('mongoose');
const SERVICE_CUSTOMER = require('./../customer/service');
const MODEL_NAME = 'CustomerSpecificCollectionPrices';
const COLLECTION_NAME = 'customerSpecificCollectionPrices';

const verifyCustomer = async (value) => {
    const customerID = value.toString();
    const lookup = await SERVICE_CUSTOMER.checkCustomer({ _id: customerID });
    return lookup !== null;
};
const verifyInventory = async (value) => {
    const SERVICE_INVENTORY = require("../inventory/service");
    const itemID = value.toString();
    const lookup = await SERVICE_INVENTORY.checkInventory({ _id: MONGOOSE.Types.ObjectId(itemID) });
    return lookup !== null;
};
const SCHEMA_CUSTOMER_SPECIFIC_COLLECTION_PRICES = new MONGOOSE.Schema({
    customer: { type: MONGOOSE.Schema.Types.ObjectId, required: true, ref: 'Customer', unique: true, index: true, validate: { validator: verifyCustomer }},
    items: [
        {
            product_id: { type: MONGOOSE.Schema.Types.ObjectId, ref: 'Inventory', required: true, validate: { validator: verifyInventory } },
            collection_rate: { type: Number, required: true }
        }
    ]
}, {
    collection: COLLECTION_NAME,
    versionKey: false,
});
const CustomerSpecificCollectionPrices = MONGOOSE.model( MODEL_NAME, SCHEMA_CUSTOMER_SPECIFIC_COLLECTION_PRICES );
module.exports = CustomerSpecificCollectionPrices;