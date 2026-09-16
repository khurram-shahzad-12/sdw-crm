const InvoiceModel = require('../invoice/model');
const CustomerModel = require('../customer/model');
const SupplierInvoicesModel = require('../supplier_invoices/model');
const moment = require('moment');
const mongoose = require('mongoose');

const getSalesLedger = async (startDate, endDate, customer_id = null) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        let query = { ot_date: { $gte: start, $lte: end } };
        if (customer_id) { query.customer = mongoose.Types.ObjectId(customer_id); }
        const invoices = await InvoiceModel.find(query).populate('customer', 'customer_name').sort({ ot_date: -1 }).lean();
        const formattedSales = invoices.map(invoice => {
            const items = (invoice.items || []).map(item => ({
                name: item.name || 'Unknown Item',
                quantity: item.quantity || 0,
                rate: item.rate || 0,
                total: (item.quantity || 0) * (item.rate || 0)
            }));
            const totalPaid = (invoice.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
            const totalAmount = invoice.total_incl_vat || 0;
            const outstanding = Math.max(0, totalAmount - totalPaid);
            const paymentMethodsWithAmounts = (invoice.payments || []).map(p => ({
                type: p.type || 'Not Specified',
                amount: p.amount || 0
            }));
            const uniquePaymentMethods = [...new Set((invoice.payments || []).map(p => p.type || 'Not Specified'))];
            return {
                _id: invoice._id,
                invoice_date: invoice.invoice_date,
                sale_number: invoice.sale_number,
                customer: {
                    _id: invoice.customer?._id || invoice.customer,
                    name: invoice.customer?.customer_name || 'Unknown Customer'
                },
                total_incl_vat: totalAmount,
                total_no_vat: invoice.total_no_vat || 0,
                vat_total: invoice.vat_total || 0,
                payments: invoice.payments || [],
                payment_methods_with_amounts: paymentMethodsWithAmounts,
                payment_methods: uniquePaymentMethods,
                total_paid: totalPaid,
                balance_due: outstanding,
                status: outstanding === 0 ? 'PAID' : (totalPaid > 0 ? 'PARTIAL' : 'UNPAID'),
                items: items,
                delivery_status: invoice.delivery_status || 'pending'
            };
        });
        const stats = {
            total_sales: formattedSales.length,
            total_value: formattedSales.reduce((sum, s) => sum + s.total_incl_vat, 0),
            total_paid: formattedSales.reduce((sum, s) => sum + s.total_paid, 0),
            total_outstanding: formattedSales.reduce((sum, s) => sum + s.balance_due, 0),
            paid_count: formattedSales.filter(s => s.status === 'PAID').length,
            partial_count: formattedSales.filter(s => s.status === 'PARTIAL').length,
            unpaid_count: formattedSales.filter(s => s.status === 'UNPAID').length
        };
        const customers = await CustomerModel.find({}, '_id customer_name').lean();
        return {
            success: true,
            data: {
                sales: formattedSales,
                stats: stats,
                customers: customers.map(c => ({ _id: c._id, name: c.customer_name }))
            }
        };
};

const getPurchaseLedger = async (startDate, endDate, supplier_id = null) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    let query = { invoice_date: { $gte: start, $lte: end } };
    if (supplier_id) { query.supplier = mongoose.Types.ObjectId(supplier_id); }
    const supplierInvoices = await SupplierInvoicesModel.find(query).populate('supplier', 'name').sort({ invoice_date: -1 }).lean();
    const formattedPurchases = supplierInvoices.map(invoice => {
        const totalPaid = (invoice.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        const grossAmount = invoice.total || 0;
        const outstanding = Math.max(0, grossAmount - totalPaid);
        const paymentMethodsWithAmounts = (invoice.payments || []).map(p => ({
            type: p.type || 'Not Specified',
            amount: p.amount || 0
        }));
        const uniquePaymentMethods = [...new Set((invoice.payments || []).map(p => p.type || 'Not Specified'))];
        return {
            _id: invoice._id,
            purchase_date: invoice.invoice_date,
            supplier: {
                _id: invoice.supplier?._id || invoice.supplier,
                name: invoice.supplier?.name || 'Unknown Supplier'
            },
            invoice_number: invoice.invoice_number,
            net_amount: invoice.standard_rate || 0,
            vat_amount: invoice.vat || 0,
            gross_amount: grossAmount,
            payments: invoice.payments || [],
            payment_methods_with_amounts: paymentMethodsWithAmounts,
            payment_methods: uniquePaymentMethods,
            total_paid: totalPaid,
            amount_outstanding: outstanding,
            payment_date: invoice.payments && invoice.payments.length > 0 ? invoice.payments[invoice.payments.length - 1].date : null,
            status: outstanding === 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Unpaid'),
            invoice_type: invoice.invoice_type || 'Invoiced',
            delivery_status: invoice.delivery_status || 'Not Delivered',
            expense_type: invoice.expense_type || 'Inventory'
        };
    });
    const stats = {
        total_purchases: formattedPurchases.length,
        total_spend: formattedPurchases.reduce((sum, p) => sum + p.gross_amount, 0),
        total_paid: formattedPurchases.reduce((sum, p) => sum + p.total_paid, 0),
        total_outstanding: formattedPurchases.reduce((sum, p) => sum + p.amount_outstanding, 0),
        paid_count: formattedPurchases.filter(p => p.status === 'Paid').length,
        partial_count: formattedPurchases.filter(p => p.status === 'Partial').length,
        unpaid_count: formattedPurchases.filter(p => p.status === 'Unpaid').length
    };
    const supplierMap = new Map();
    formattedPurchases.forEach(purchase => {
        if (purchase.supplier && purchase.supplier._id) {
            const supplierId = purchase.supplier._id.toString();
            if (!supplierMap.has(supplierId)) {
                supplierMap.set(supplierId, {
                    _id: purchase.supplier._id,
                    name: purchase.supplier.name || 'Unknown Supplier'
                });
            }
        }
    });
    const supplierDetails = Array.from(supplierMap.values());
    return {
        success: true,
        data: {
            purchases: formattedPurchases,
            stats: stats,
            suppliers: supplierDetails || []
        }
    };
};
module.exports = {
    getSalesLedger,
    getPurchaseLedger
};