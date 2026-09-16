const createError = require('http-errors');
const moment = require('moment');
const CreditNote = require('./model');
const Invoice = require('../invoice/model');
const database = require('./../../../db/database');
const SERVICE_INVENTORY = require('./../inventory/service');
const SERVICE_CUSTOMER = require('./../customer/service');
const SERVICE_COUNTER = require('../counter/service');
const env = require('./../../../config.env');

const fetchCreditNotes = (query = {}, fields = null, sort = { created_at: -1 }) => {
    let queryBuilder = CreditNote.find(query);
    if (fields && Array.isArray(fields)) { queryBuilder = queryBuilder.select(fields);}
    if (sort) { queryBuilder = queryBuilder.sort(sort); }
    return queryBuilder;
};
const fetchOneCreditNote = (query = {}, projection = [], sort = {}, limit = 0) => {
    return database.findOne(CreditNote, query, projection, sort, limit);
};
const checkCreditNote = (query = {}) => { return database.exists(CreditNote, query); };

const createCreditNote = async (properties) => {
        const creditNoteNumber = await SERVICE_COUNTER.getNextCreditNoteNumber();
        properties.credit_note_number = creditNoteNumber;
        const doc = new CreditNote(properties);
        const error = await doc.validate();
        if (error) { throw new createError(500, 'Validation error'); }
        if (!await SERVICE_CUSTOMER.isCustomerActive(doc.customer_id) ||
            await SERVICE_CUSTOMER.isCustomerOnHold(doc.customer_id)) {
            throw new createError(500, 'Customer is not active or on hold');
        }
        const originalInvoice = await Invoice.findById(doc.original_invoice_id);
        if (!originalInvoice) { throw new createError(404, 'Original invoice not found'); }
        const invoiceTotal = Number(originalInvoice.total_incl_vat) || 0;
        const creditAmount = Number(doc.total_credit_amount) || 0;
        const currentTotalPaid = originalInvoice.payments.reduce((sum, payment) => { return sum + (payment.amount || 0); }, 0);
        const currentCreditApplied = originalInvoice.credit_notes.reduce((sum, note) => {
            return sum + (note.amount_credited || 0);
        }, 0);
        const newTotalPaid = currentTotalPaid + creditAmount;
        const newTotalCredit = currentCreditApplied + creditAmount;
        const newBalanceDue = Math.max(0, invoiceTotal - newTotalPaid);
        if (properties.credit_items && properties.credit_items.length > 0) {
            for (const item of properties.credit_items) {
                if (item.returned_to_stock) {
                    await SERVICE_INVENTORY.updateInventoryItemQuantity(
                        item._id,
                        item.quantity
                    );
                }
            }
        }
        const savedCreditNote = await doc.save();
        if (!savedCreditNote) { throw new createError(500, 'Failed to save credit note');  }
        originalInvoice.credit_notes.push({
            credit_note_id: savedCreditNote._id,
            credit_note_number: savedCreditNote.credit_note_number,
            amount_credited: creditAmount,
            credited_at: new Date()
        });
        const returnedItemsTotal = properties.credit_items.reduce((sum, item) => {
            if (item.returned_to_stock) { return sum + (item.amount_incl_vat) }
            return sum;
        }, 0);
        if (returnedItemsTotal > 0) {
            originalInvoice.payments.push({
                amount: creditAmount,
                date: new Date(),
                type: 'CREDIT_NOTE',
                recorded_by: properties.created_by || 'System',
                comments: `Credit note #${savedCreditNote.credit_note_number} created from invoice #${originalInvoice.sale_number} (RETURN)`
            });
        }
        originalInvoice.total_paid = +newTotalPaid.toFixed(2);
        originalInvoice.total_credit_applied = +newTotalCredit.toFixed(2);
        originalInvoice.balance_due = +newBalanceDue.toFixed(2);
        originalInvoice.paid = newBalanceDue <= 0;
        if (newBalanceDue <= 0) {
            if (newTotalCredit >= invoiceTotal && invoiceTotal > 0) {
                originalInvoice.status = 'RETURNED';
            } else {
                originalInvoice.status = newTotalPaid > invoiceTotal ? 'OVER_PAID' : 'PAID';
            }
        } else {
            originalInvoice.status = newTotalPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING';
        }
        await originalInvoice.save();
        return {
            success: true,
            credit_note: savedCreditNote,
            invoice: originalInvoice,
            credit_note_number: savedCreditNote.credit_note_number,
            total_credit_applied: originalInvoice.total_credit_applied,
            total_paid: originalInvoice.total_paid,
            balance_due: originalInvoice.balance_due,
            paid: originalInvoice.paid,
            status: originalInvoice.status,
            message: `Credit note #${savedCreditNote.credit_note_number} created successfully`
        };
};

const applyCreditToInvoices = async (creditNoteId, invoiceId, amount, appliedBy) => {
        const creditNote = await CreditNote.findById(creditNoteId);
        if (!creditNote) { throw new createError(404, 'Credit note not found'); }
        if (creditNote.remaining_credit <= 0) { throw new createError(400, 'No remaining credit to apply'); }
        const originalInvoice = await Invoice.findById(creditNote.original_invoice_id);
        if (!originalInvoice) { throw new createError(404, 'Original invoice not found'); }
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) { throw new createError(404, 'Invoice not found'); }
        const totalPaid = invoice.payments.reduce((sum, payment) => {
            return sum + (payment.amount || 0);
        }, 0);
        const invoiceTotal = invoice.total_incl_vat || 0;
        const currentBalanceDue = Math.max(0, invoiceTotal - totalPaid);
        if (currentBalanceDue <= 0) { throw new createError(400, 'Invoice is already paid'); }
        if (!amount || amount <= 0) { throw new createError(400, 'Amount must be greater than 0'); }
        if (amount > creditNote.remaining_credit) { throw new createError(400, `Amount exceeds remaining credit of £${creditNote.remaining_credit.toFixed(2)}`); }
        if (amount > currentBalanceDue) { throw new createError(400, `Amount exceeds invoice balance of £${currentBalanceDue.toFixed(2)}`); }
        creditNote.applied_to_invoices.push({
            invoice_id: invoiceId,
            invoice_number: invoice.sale_number,
            amount_applied: amount,
            applied_date: new Date(),
            applied_by: appliedBy || 'System',
            status: 'APPLIED'
        });
        creditNote.remaining_credit = creditNote.remaining_credit - amount;
        creditNote.status = creditNote.remaining_credit <= 0 ? 'APPLIED' : 'PARTIALLY_APPLIED';
        creditNote.updated_at = new Date();
        const existingCreditNote = invoice.credit_notes.find(
            cn => cn.credit_note_id && cn.credit_note_id.toString() === creditNote._id.toString()
        );
        if (!existingCreditNote) {
            invoice.credit_notes.push({
                credit_note_id: creditNote._id,
                credit_note_number: creditNote.credit_note_number,
                amount_credited: amount,
                credited_at: new Date()
            });
        }
        invoice.payments.push({
            amount: amount,
            date: new Date(),
            type: 'APPLIED CREDIT',
            recorded_by: appliedBy || 'System',
            comments: `Credit note #${creditNote.credit_note_number} applied to invoice #${invoice.sale_number} (APPLIED) | Original Invoice: #${originalInvoice.sale_number}`
        });
        const totalAdjustments = creditNote.credit_adjustments && creditNote.credit_adjustments.length > 0
            ? creditNote.credit_adjustments.reduce((sum, adj) => sum + (adj.amount || 0), 0)
            : 0;
        const regularPayments = [];
        const creditPayments = [];
        originalInvoice.payments.forEach(payment => {
            if (payment.type === 'APPLIED CREDIT' || payment.type === 'CREDIT_NOTE') {
                creditPayments.push(payment);
            } else {
                regularPayments.push(payment)
            }
        });
        let remainingToDeduct = amount;
        const updatedRegularPayments = [];
        const removedPaymentIds = [];
        for (const payment of regularPayments) {
            if (remainingToDeduct <= 0) {
                updatedRegularPayments.push(payment);
                continue;
            }
            if (payment.amount <= remainingToDeduct) { 
                remainingToDeduct -= payment.amount;
                removedPaymentIds.push(payment._id);
            } else {             
                payment.amount -= remainingToDeduct;                   
                updatedRegularPayments.push(payment);
                remainingToDeduct = 0; 
            }
        }
        const newTotalPaid = invoice.payments.reduce((sum, payment) => {
            return sum + (payment.amount || 0);
        }, 0);
        const newBalanceDue = Math.max(0, invoiceTotal - newTotalPaid);
        invoice.total_paid = +newTotalPaid.toFixed(2);
        invoice.balance_due = +newBalanceDue.toFixed(2);
        invoice.paid = newBalanceDue <= 0;
        originalInvoice.payments = [...creditPayments, ...updatedRegularPayments];
        if (newBalanceDue <= 0) {
            const totalCreditApplied = invoice.credit_notes.reduce((sum, note) => {
                return sum + (note.amount_credited || 0);
            }, 0);
            if (totalCreditApplied >= invoiceTotal && invoiceTotal > 0) {
                invoice.status = 'RETURNED';
            } else {
                invoice.status = newTotalPaid > invoiceTotal ? 'OVER_PAID' : 'PAID';
            }
        } else {
            invoice.status = newTotalPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING';
        }
        const totalCreditApplied = invoice.credit_notes.reduce((sum, note) => {
            return sum + (note.amount_credited || 0);
        }, 0);
        invoice.total_credit_applied = +totalCreditApplied.toFixed(2);
        await invoice.save();
        await creditNote.save();
        await originalInvoice.save();
        return {
            success: true,
            credit_note_id: creditNoteId,
            credit_note_number: creditNote.credit_note_number,
            invoice_id: invoiceId,
            invoice_number: invoice.sale_number,
            amount_applied: amount,
            remaining_credit: creditNote.remaining_credit,
            invoice_balance: invoice.balance_due,
            total_paid: invoice.total_paid,
            total_credit_applied: invoice.total_credit_applied,
            invoice_paid: invoice.paid,
            invoice_status: invoice.status
        };
};

const updateCreditNote = async (id, properties) => {
    const doc = new CreditNote(properties);
    const error = await doc.validate(Object.keys(properties));
    if (error) { throw new createError(500, 'Validation error'); }
    const existingCreditNote = await fetchOneCreditNote({ _id: id });
    if (!existingCreditNote) { throw new createError(404, 'Credit note not found'); }
    if (existingCreditNote.status === 'APPLIED' || existingCreditNote.status === 'PARTIALLY_APPLIED') {
        throw new createError(400, 'Cannot update applied or partially applied credit note');
    }
    const originalInvoice = await Invoice.findById(existingCreditNote.original_invoice_id);
    if (!originalInvoice) { throw new createError(404, "Original Invoice not found"); }
    if (properties.credit_items) {
        for (const item of existingCreditNote.credit_items) {
            if (item.returned_to_stock) {
                await SERVICE_INVENTORY.updateInventoryItemQuantity(
                    item._id,
                    -item.quantity
                );
            }
        }
        for (const item of properties.credit_items) {
            if (item.returned_to_stock) {
                await SERVICE_INVENTORY.updateInventoryItemQuantity(
                    item._id,
                    item.quantity 
                );
            }
        }
    }
    const newCreditAmount = Number(properties.total_credit_amount) || 0;
    const updatedCreditNote = await database.findByIdAndUpdate(CreditNote, id, properties);
    if (!updatedCreditNote) { throw new createError(500, "Failed to update credit note"); }
    originalInvoice.credit_notes = originalInvoice.credit_notes.filter(note => note.credit_note_id.toString() !== id.toString());
    originalInvoice.payments = originalInvoice.payments.filter(payment => !(payment.type === 'CREDIT_NOTE' && payment.comments && payment.comments.includes(`Credit note #${existingCreditNote.credit_note_number}`)));
    originalInvoice.credit_notes.push({
        credit_note_id: updatedCreditNote._id,
        credit_note_number: updatedCreditNote.credit_note_number,
        amount_credited: newCreditAmount,
        credited_at: new Date()
    });
    if (newCreditAmount > 0) {
        originalInvoice.payments.push({
            amount: newCreditAmount,
            date: new Date(),
            type: 'CREDIT_NOTE',
            recorded_by: properties.updated_by || 'System',
            comments: `Credit note #${updatedCreditNote.credit_note_number} updated from invoice #${originalInvoice.sale_number} (RETURN)`
        });
    }
    const invoiceTotal = Number(originalInvoice.total_incl_vat) || 0;
    const currentTotalPaid = originalInvoice.payments.reduce((sum, payment) => {
        return sum + (payment.amount || 0);
    }, 0);
    const currentCreditApplied = originalInvoice.credit_notes.reduce((sum, note) => {
        return sum + (note.amount_credited || 0);
    }, 0);
    const newTotalPaid = currentTotalPaid;
    const newTotalCredit = currentCreditApplied;
    const newBalanceDue = Math.max(0, invoiceTotal - newTotalPaid);
    originalInvoice.total_paid = +newTotalPaid.toFixed(2);
    originalInvoice.total_credit_applied = +newTotalCredit.toFixed(2);
    originalInvoice.balance_due = +newBalanceDue.toFixed(2);
    originalInvoice.paid = newBalanceDue <= 0;

    if (newBalanceDue <= 0) {
        if (newTotalCredit >= invoiceTotal && invoiceTotal > 0) {
            originalInvoice.status = 'RETURNED';
        } else {
            originalInvoice.status = newTotalPaid > invoiceTotal ? 'OVER_PAID' : 'PAID';
        }
    } else {
        originalInvoice.status = newTotalPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING';
    }
    await originalInvoice.save();
    return {
        success: true,
        credit_note: updatedCreditNote,
        invoice: originalInvoice,
        credit_note_number: updatedCreditNote.credit_note_number,
        total_credit_applied: originalInvoice.total_credit_applied,
        total_paid: originalInvoice.total_paid,
        balance_due: originalInvoice.balance_due,
        paid: originalInvoice.paid,
        status: originalInvoice.status,
        message: `Credit note #${updatedCreditNote.credit_note_number} updated successfully`
    }
};

const handleAppliedCreditDeletion = async (invoiceId, deletedPayment) => {
    const creditNoteMatch = deletedPayment.comments?.match(/Credit note #([A-Z0-9-]+)/);
    if (!creditNoteMatch) { return null; }
    const creditNoteNumber = creditNoteMatch[1];
    const originalInvoiceMatch = deletedPayment.comments?.match(/Original Invoice: #([A-Z0-9-]+)/);
    if (!originalInvoiceMatch) { throw new Error('Original invoice number not found in payment comments'); }
    const originalInvoiceNumber = originalInvoiceMatch[1];
    const creditNote = await CreditNote.findOne({credit_note_number: creditNoteNumber });
    if (!creditNote) { return null; }
    const originalInvoice = await Invoice.findOne({ sale_number: originalInvoiceNumber });
    if (!originalInvoice) { throw new Error(`Original invoice #${originalInvoiceNumber} not found`) }
    const appliedInvoice = await Invoice.findById(invoiceId);
    if(!appliedInvoice) {throw new Error(`Invoice ${invoiceId} not found`)}
    const amountToReturn = deletedPayment.amount || 0;
    appliedInvoice.credit_notes = appliedInvoice.credit_notes.filter(cn => cn.credit_note_id && cn.credit_note_id.toString()!==creditNote._id.toString());
    appliedInvoice.payments = appliedInvoice.payments.filter(payment => payment._id && payment._id.toString()!==deletedPayment._id.toString());
    const appliedInvoiceTotal = Number(appliedInvoice.total_incl_vat) || 0;
    const appliedTotalPaid = appliedInvoice.payments.reduce((sum, payment) => {return sum + (payment.amount || 0);}, 0);
    const appliedTotalCreditApplied = appliedInvoice.credit_notes.reduce((sum, note) => {return sum + (note.amount_credited || 0);}, 0);
    const appliedNewBalanceDue = Math.max(0, appliedInvoiceTotal - appliedTotalPaid);
    appliedInvoice.total_paid = +appliedTotalPaid.toFixed(2);
    appliedInvoice.total_credit_applied = +appliedTotalCreditApplied.toFixed(2);
    appliedInvoice.balance_due = +appliedNewBalanceDue.toFixed(2);
    appliedInvoice.paid = appliedNewBalanceDue <= 0;
    if (appliedNewBalanceDue <= 0) {
        if (appliedTotalCreditApplied >= appliedInvoiceTotal && appliedInvoiceTotal > 0) {
            appliedInvoice.status = 'RETURNED';
        } else {
            appliedInvoice.status = appliedTotalPaid > appliedInvoiceTotal ? 'OVER_PAID' : 'PAID';
        }
    } else {
        appliedInvoice.status = appliedTotalPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING';
    }
    await appliedInvoice.save();
    creditNote.applied_to_invoices = creditNote.applied_to_invoices.filter(
        app => app.invoice_id.toString() !== invoiceId.toString()
    );
    creditNote.remaining_credit = (creditNote.remaining_credit || 0) + amountToReturn;
    if (creditNote.remaining_credit >= (creditNote.total_credit_amount || 0)) {
        creditNote.status = 'PENDING';
    } else if (creditNote.remaining_credit > 0) {
        creditNote.status = 'PARTIALLY_APPLIED';
    } else {
        creditNote.status = 'APPLIED';
    }
    creditNote.updated_at = new Date();
    await creditNote.save();
    await originalInvoice.save();
    return {
        creditNoteNumber,
        amountReturned: amountToReturn,
        remainingCredit: creditNote.remaining_credit,
        status: creditNote.status
    };
};

const handleCreditNoteDeletion = async (invoiceId, deletedPayment) => {
    const creditNoteMatch = deletedPayment.comments?.match(/Credit note #([A-Z0-9-]+)/);
    if (!creditNoteMatch) { return null;}
    const creditNoteNumber = creditNoteMatch[1];
    const creditNote = await CreditNote.findOne({ credit_note_number: creditNoteNumber });
    if (!creditNote) { return null; }
    const appliedInvoices = creditNote.applied_to_invoices || [];
    const updatedInvoices = [];
    for (const applied of appliedInvoices) {
        const invoice = await Invoice.findById(applied.invoice_id);
        if (invoice) {
            invoice.credit_notes = invoice.credit_notes.filter(
                cn => cn.credit_note_id && cn.credit_note_id.toString() !== creditNote._id.toString()
            );
            invoice.payments = invoice.payments.filter(payment => {
                const match = payment.comments?.match(/Credit note #([A-Z0-9-]+)/);
                if (match && match[1] === creditNoteNumber) {
                    return false;
                }
                return true;
            });
            const invoiceTotal = Number(invoice.total_incl_vat) || 0;
            const totalPaid = invoice.payments.reduce((sum, payment) => {
                return sum + (payment.amount || 0);
            }, 0);
            const totalCreditApplied = invoice.credit_notes.reduce((sum, note) => {
                return sum + (note.amount_credited || 0);
            }, 0);
            const newBalanceDue = Math.max(0, invoiceTotal - totalPaid);
            invoice.total_paid = +totalPaid.toFixed(2);
            invoice.total_credit_applied = +totalCreditApplied.toFixed(2);
            invoice.balance_due = +newBalanceDue.toFixed(2);
            invoice.paid = newBalanceDue <= 0;
            if (newBalanceDue <= 0) {
                if (totalCreditApplied >= invoiceTotal && invoiceTotal > 0) {
                    invoice.status = 'RETURNED';
                } else {
                    invoice.status = totalPaid > invoiceTotal ? 'OVER_PAID' : 'PAID';
                }
            } else {
                invoice.status = totalPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING';
            }
            await invoice.save();
            updatedInvoices.push({
                invoice_id: invoice._id,
                invoice_number: invoice.sale_number,
                amount_removed: applied.amount_applied,
                new_balance: invoice.balance_due,
                new_status: invoice.status
            });
        }
    }
    const originalInvoice = await Invoice.findById(creditNote.original_invoice_id);
    let totalCreditAmount = 0;
    if (originalInvoice) {
        originalInvoice.credit_notes = originalInvoice.credit_notes.filter(note=>note.credit_note_id.toString()!==creditNote._id.toString());
        originalInvoice.payments = originalInvoice.payments.filter(payment => {
            return !(payment.type === 'CREDIT_NOTE' && payment.comments && payment.comments.includes(`Credit note #${creditNoteNumber}`))
        });
        const invoiceTotal = Number(originalInvoice.total_incl_vat) || 0;
        const totalPaid = originalInvoice.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
        const totalCreditApplied = originalInvoice.credit_notes.reduce((sum, note) => sum + (note.amount_credited || 0), 0);
        const newBalanceDue = Math.max(0, invoiceTotal - totalPaid);
        originalInvoice.total_paid = +totalPaid.toFixed(2);
        originalInvoice.total_credit_applied = +totalCreditApplied.toFixed(2);
        originalInvoice.balance_due = +newBalanceDue.toFixed(2);
        originalInvoice.paid = newBalanceDue <= 0;

        if (newBalanceDue <= 0) {
            originalInvoice.status = (totalCreditApplied >= invoiceTotal && invoiceTotal > 0)
                ? 'RETURNED'
                : (totalPaid > invoiceTotal ? 'OVER_PAID' : 'PAID');
        } else {
            originalInvoice.status = totalPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING';
        }
        await originalInvoice.save();
    }
    for (const item of creditNote.credit_items) {
        if (item.returned_to_stock) {
            await SERVICE_INVENTORY.updateInventoryItemQuantity(
                item._id,
                -item.quantity
            );
        }
    }
    await CreditNote.findByIdAndDelete(creditNote._id);
    return {
        creditNoteNumber,
        creditNoteId: creditNote._id,
        deleted: true,
        updatedInvoices: updatedInvoices,
        totalInvoicesUpdated: updatedInvoices.length,
        totalAmountRemoved: updatedInvoices.reduce((sum, inv) => sum + inv.amount_removed, 0),
        message: `Credit note #${creditNoteNumber} has been deleted and removed from ${updatedInvoices.length} invoice(s)`
    };
};

const cleanupCreditNotesArray = (invoice, payments) => {
    const validCreditNoteNumbers = new Set();
    payments.forEach(payment => {
        if (payment.type === 'APPLIED CREDIT' || payment.type === 'CREDIT_NOTE') {
            const match = payment.comments?.match(/Credit note #([A-Z0-9-]+)/);
            if (match) {
                validCreditNoteNumbers.add(match[1]);
            }
        }
    });
    if (invoice.credit_notes) {
        invoice.credit_notes = invoice.credit_notes.filter(cn => {
            return validCreditNoteNumbers.has(cn.credit_note_number);
        });
    }
    return invoice;
};

module.exports = {
    fetchCreditNotes,
    fetchOneCreditNote,
    checkCreditNote,
    createCreditNote,
    applyCreditToInvoices,
    updateCreditNote,
    cleanupCreditNotesArray,
    handleAppliedCreditDeletion,
    handleCreditNoteDeletion,
};