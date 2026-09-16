const InvoiceModel = require('../invoice/model');
const CustomerModel = require('../customer/model');
const CustomerCancelledInvoicesDay = require('../customerCancelledInvoicesDay/model');
const CustomerTemporaryOrdersDay = require('../customerTemporaryOrdersDay/model');
const moment = require('moment');
const mongoose = require('mongoose');

const getDateOrderReport = async (ot_date, customer_id = null) => {
        let selectedDate;
        if (ot_date) { selectedDate = moment.utc(ot_date); } else { selectedDate = moment.utc(); }      
        const startOfDay = selectedDate.clone().startOf('day').toDate();
        const endOfDay = selectedDate.clone().endOf('day').toDate();
        const cancelledCustomers = await CustomerCancelledInvoicesDay.find({ ot_date: { $gte: startOfDay, $lte: endOfDay }}).populate('customer', 'customer_name').lean();
        const cancelledCustomerIds = cancelledCustomers.map(item => item.customer?._id?.toString() ).filter(id => id);
        let query = { ot_date: { $gte: startOfDay, $lte: endOfDay }};
        if (customer_id) { query.customer = mongoose.Types.ObjectId(customer_id); }
        const invoices = await InvoiceModel.find(query).populate('customer', 'customer_name').lean();
        const filteredInvoices = invoices.filter(invoice => {
            const customerId = invoice.customer?._id?.toString() || invoice.customer?.toString();
            return !cancelledCustomerIds.includes(customerId);
        });
        const allCustomers = await CustomerModel.find({}, '_id customer_name active order_taking_days').lean();
        const temporaryCustomers = await CustomerTemporaryOrdersDay.find({
            ot_date: { $gte: startOfDay, $lte: endOfDay }}).populate('customer', 'customer_name').lean();     
        const formattedOrders = filteredInvoices.map(invoice => {
            const items = (invoice.items || []).map(item => ({
                name: item.name || 'Unknown Item',
                quantity: item.quantity || 0,
                rate: item.rate || 0,
                total: (item.quantity || 0) * (item.rate || 0)
            }));
            const balance_due = items.reduce((sum, item) => sum + item.total, 0);
            return {
                _id: invoice._id,
                sale_number: invoice.sale_number|| invoice._id.toString().slice(-6),
                invoice_date: invoice.ot_date,
                customer: {
                    _id: invoice.customer?._id || invoice.customer,
                    name: invoice.customer?.customer_name || 'Unknown Customer'
                },
                status: invoice.status || 'PENDING',
                items: items,
                balance_due: balance_due || 0
            };
        });
        const dayOfWeek = selectedDate.day();
        const expectedCustomers = allCustomers
            .filter(c => c.active && c.order_taking_days && c.order_taking_days.includes(dayOfWeek))
            .map(c => ({
                _id: c._id,
                name: c.customer_name,
                isTemporary: false,
                isCancelled: false
            }));
        temporaryCustomers.forEach(temp => {
            if (temp.customer) {
                const customerId = temp.customer._id.toString();
                const existingIndex = expectedCustomers.findIndex(c => c._id.toString() === customerId);
                if (existingIndex === -1) {
                    expectedCustomers.push({
                        _id: temp.customer._id,
                        name: temp.customer.customer_name,
                        isTemporary: true,
                        isCancelled: cancelledCustomerIds.includes(customerId)
                    });
                } else {
                    expectedCustomers[existingIndex].isTemporary = true;
                }
            }
        });
        expectedCustomers.forEach(customer => {
            const customerId = customer._id.toString();
            if (cancelledCustomerIds.includes(customerId)) {
                customer.isCancelled = true;
                customer.cancellationReason = cancelledCustomers.find(
                    c => c.customer?._id?.toString() === customerId
                )?.reason || 'No reason provided';
            }
        });
        const customersWithOrders = new Set(formattedOrders.map(o => o.customer?._id?.toString()).filter(id => id));
        const cancelledCustomerIdSet = new Set(cancelledCustomerIds); 
        const pendingCustomers = expectedCustomers.filter(c => 
            !customersWithOrders.has(c._id.toString()) && !cancelledCustomerIdSet.has(c._id.toString())
        ); 
        const confirmedCustomers = expectedCustomers.filter(c => customersWithOrders.has(c._id.toString()) );
        const cancelledExpectedCustomers = expectedCustomers.filter(c => cancelledCustomerIdSet.has(c._id.toString()) );
        const stats = {
            expected: expectedCustomers.length,
            confirmed: confirmedCustomers.length,
            totalValue: formattedOrders.reduce((sum, o) => sum + (o.balance_due || 0), 0),
            pending: pendingCustomers.length,
            cancelled: cancelledExpectedCustomers.length
        };
        const customers = allCustomers.map(c => ({ _id: c._id, name: c.customer_name }));
        const cancelledCustomersList = cancelledCustomers.map(item => ({
            recordId: item._id,
            _id: item.customer?._id,
            name: item.customer?.customer_name || 'Unknown',
            reason: item.reason || 'No reason provided',
            remarks: item.remarks || '',
        }));
        return {
            success: true,
            data: {
                orders: formattedOrders,
                stats: stats,
                customers: customers,
                selectedDate: selectedDate.format('YYYY-MM-DD'),
                expectedCustomers: expectedCustomers,
                cancelledCustomers: cancelledCustomersList,
                isCancelledDay: cancelledCustomerIds.length > 0
            }
        };
};
const getCustomerOrderHistory = async (customer_id, currentInvoiceDate = null, limit = 10) => {
        let cancelledQuery = { customer: mongoose.Types.ObjectId(customer_id) };
        if (currentInvoiceDate) {
            const beforeDate = new Date(currentInvoiceDate);
            cancelledQuery.ot_date = { $lt: beforeDate };
        }
        const cancelledDays = await CustomerCancelledInvoicesDay.find(cancelledQuery).lean();
        const cancelledDates = new Set( cancelledDays.map(day => moment(day.ot_date).format('YYYY-MM-DD')) );
        let invoiceQuery = { customer: mongoose.Types.ObjectId(customer_id) };
        if (currentInvoiceDate) {
            const beforeDate = new Date(currentInvoiceDate);
            invoiceQuery.ot_date = { $lt: beforeDate };
        } 
        const invoices = await InvoiceModel.find(invoiceQuery).sort({ ot_date: -1 }).limit(parseInt(limit)).lean();
        const filteredInvoices = invoices.filter(invoice => {
            const invoiceDate = moment(invoice.ot_date).format('YYYY-MM-DD');
            return !cancelledDates.has(invoiceDate);
        });  
        const formattedHistory = filteredInvoices.map(invoice => {
            const items = (invoice.items || []).map(item => ({
                name: item.name || 'Unknown Item',
                quantity: item.quantity || 0,
                rate: item.rate || 0,
                total: (item.quantity || 0) * (item.rate || 0)
            }));  
            return {
                _id: invoice._id,
                sale_number: invoice.sale_number,
                invoice_date: invoice.ot_date,
                items: items,
                balance_due: items.reduce((sum, item) => sum + item.total, 0),
            };
        });
        return {
            success: true,
            data: formattedHistory
        };
};

module.exports = {
    getDateOrderReport,
    getCustomerOrderHistory,
};