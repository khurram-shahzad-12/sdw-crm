const createError = require('http-errors');
const SERVICE_INVENTORY = require('./../inventory/service');
const validate = require('../../../utils/validate');
const env = require('./../../../config.env');
const collectionSpiceficPriceModel = require('./model');

const getCustomerCollectionPrices = (query = {}) => {
        return collectionSpiceficPriceModel.findOne(query);
};

const upsertCustomerCollectionSpecificPrices = async (properties, userPermissions) => {
        if (properties.hasOwnProperty('items')) await processItems(properties, !userPermissions.includes(env.WRITE_OVERRIDE_MIN_SALE_PRICE_CLAIM));
        let existingDoc = await collectionSpiceficPriceModel.findOne({customer: properties.customer})
        if(!existingDoc) { return await collectionSpiceficPriceModel.create(properties); }
        properties.items.forEach(newItem => {
            const existingItem = existingDoc.items.find(
                item => item.product_id.toString() === newItem.product_id.toString()
            );
            if(existingItem) {existingItem.collection_rate = newItem.collection_rate}
            else{existingDoc.items.push(newItem);}
        });
        await existingDoc.save();
        return existingDoc;
};

const processItems = async (customerItemsObj, checkValues = true) => {
    const itemsList = customerItemsObj.items;
    await Promise.all([
        SERVICE_INVENTORY.fetchInventory({ _id: { $in: itemsList.map(item => validate.id(item.product_id)) } }),
    ]).then(data => {
        [InventoryList] = data.map(list => list.reduce((a, v) => {
            const id = v._id;
            delete v._id;
            a[id] = v;
            return a;
        }, {}));
    });
    if (checkValues) {
        itemsList.forEach(item => {
            if (item.collection_rate < InventoryList[item.product_id].min_sale_price) {
                item.collection_rate; return
                throw new createError(500, `Price for ${InventoryList[item.product_id].name} cannot be below ${InventoryList[item.product_id].min_sale_price}`);
            }
        });
    }
};

const removeCustomerCollectionSpecificPrices = async ({customerId, productId}) => {
    return await collectionSpiceficPriceModel.updateOne({customer: customerId}, {$pull: {items: {product_id: productId}}})
};

const removeSpecificCollectionPriceFromAllCustomers = async (productId) => {
    return await collectionSpiceficPriceModel.updateMany(
        {},
        {
            $pull: {
                items: {
                    product_id: productId
                }
            }
        }
    );
};
module.exports = {
    getCustomerCollectionPrices,
    upsertCustomerCollectionSpecificPrices,
    removeCustomerCollectionSpecificPrices,
    removeSpecificCollectionPriceFromAllCustomers,
};