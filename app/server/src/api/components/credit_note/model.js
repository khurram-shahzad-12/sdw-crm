const mongoose = require('mongoose');
const SERVICE_CUSTOMER = require('./../customer/service');
const SERVICE_INVENTORY = require('./../inventory/service');
const SERVICE_VAT = require('./../vat/service');
const MODEL_NAME = 'CreditNote';
const COLLECTION_NAME = 'creditNotes';
const Invoice = require('../invoice/model')

const verifyCustomer = async (value) => {
    const customerID = value.toString();
    const lookup = await SERVICE_CUSTOMER.checkCustomer({ _id: customerID });
    return (lookup !== null);
};

const verifyInventory = async (value) => {
    const itemID = value.toString();
    const lookup = await SERVICE_INVENTORY.checkInventory({ _id: itemID });
    return (lookup !== null);
};

const verifyVAT = async (value) => {
    const taxID = value.toString();
    const lookup = await SERVICE_VAT.checkVAT({ _id: taxID });
    return (lookup !== null);
};

const SCHEMA_CREDIT_ITEM = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true, validate: { validator: verifyInventory } },
    name: { type: String, required: true },
    barcode: { type: Number },
    quantity: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true },
    cost_price: { type: Number, required: true },
    vat: { type: mongoose.Schema.Types.ObjectId, ref: 'VAT', required: true, validate: { validator: verifyVAT } },
    tax: { type: Number, required: true, min: 0 },
    amount_excl_vat: { type: Number, required: true },
    vat_amount: { type: Number, required: true },
    amount_incl_vat: { type: Number, required: true },
    weight_grams: { type: Number, default: 0, min: 0 },
    original_invoice_item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice.items' },
    returned_to_stock: { type: Boolean, default: false },
    returned_to_stock_date: Date
}, {
    versionKey: false,
});

const SCHEMA_CREDIT_ADJUSTMENT = new mongoose.Schema({
    description: { type: String, required: true },
    amount: { type: Number, required: true, default: 0 },
    type: { type: String, enum: ['DISCOUNT', 'SURCHARGE', 'OTHER'], default: 'OTHER' }
}, {
    versionKey: false,
});

const SCHEMA_APPLIED_TO_INVOICE = new mongoose.Schema({
    invoice_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
    invoice_number: { type: String, required: true },
    amount_applied: { type: Number, required: true },
    applied_date: { type: Date, default: Date.now },
    applied_by: { type: String },
    status: {
        type: String,
        enum: ['PENDING', 'APPLIED', 'REVERSED'],
        default: 'APPLIED'
    }
}, {
    versionKey: false,
});

const SCHEMA_CREDIT_NOTE = new mongoose.Schema({
    credit_note_number: { type: String, required: true, unique: true, index: true },
    original_invoice_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    original_invoice_number: { type: String, required: true },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true, validate: { validator: verifyCustomer } },
    customer_name: { type: String, required: true },
    customer_sales_rep: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerSalesRep' },
    credit_items: {
        type: [SCHEMA_CREDIT_ITEM], default: [],
        validate: {
            validator: (value) => Array.isArray(value) && value.length > 0,
            message: 'At least one credit item is required'
        }
    },
    credit_adjustments: { type: [SCHEMA_CREDIT_ADJUSTMENT], default: [] },
    reason_description: { type: String, default: '' },
    subtotal: { type: Number, default: 0, min: 0 },
    vat_total: { type: Number, default: 0, min: 0 },
    total_credit_amount: { type: Number, required: true, min: 0 },
    profit_impact: { type: Number, default: 0 },
    status: { type: String, enum: ['PENDING', 'APPLIED', 'CANCELLED', 'PARTIALLY_APPLIED'], default: 'PENDING', index: true },
    remaining_credit: { type: Number, default: 0 },
    applied_to_invoices: { type: [SCHEMA_APPLIED_TO_INVOICE], default: [] },
    created_by: { type: String, required: true },
    created_at: { type: Date, default: Date.now, index: true },
    updated_at: { type: Date, default: Date.now },
    notes: { type: String, default: '' },
}, {
    collection: COLLECTION_NAME,
    versionKey: false
});


SCHEMA_CREDIT_NOTE.methods.applyCreditToInvoice = async function (invoiceId, amount, appliedBy) {
    if (this.remaining_credit < amount) {
        throw new Error('Insufficient remaining credit');
    }
    const Invoice = mongoose.model('Invoice');
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
        throw new Error('Invoice not found');
    }

    this.applied_to_invoices.push({
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number || invoice.sale_number,
        amount_applied: amount,
        applied_date: new Date(),
        applied_by: appliedBy
    });

    this.remaining_credit -= amount;
    this.status = this.remaining_credit <= 0 ? 'APPLIED' : 'PARTIALLY_APPLIED';
    await this.save();

    const balanceDue = invoice.balance_due || invoice.total_incl_vat;
    invoice.balance_due = balanceDue - amount;
    invoice.credit_applied = (invoice.credit_applied || 0) + amount;
    invoice.status = invoice.balance_due <= 0 ? 'PAID' : 'PARTIALLY_PAID';
    await invoice.save();
    return {
        credit_note: this,
        invoice: invoice,
        amount_applied: amount,
        remaining_credit: this.remaining_credit
    };
};

SCHEMA_CREDIT_NOTE.statics.getAvailableCreditsForCustomer = async function (customerId) {
    const creditNotes = await this.find({
        customer_id: customerId,
        status: { $in: ['PENDING', 'PARTIALLY_APPLIED'] },
        remaining_credit: { $gt: 0 }
    }).sort({ created_at: 1 });
    return creditNotes;
};

const CreditNote = mongoose.model(MODEL_NAME, SCHEMA_CREDIT_NOTE);
module.exports = CreditNote;