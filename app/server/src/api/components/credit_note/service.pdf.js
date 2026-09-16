const PDFDocument = require('pdfkit');
const moment = require('moment');
const SERVICE_CREDIT_NOTE = require('./service');
const SERVICE_CUSTOMER = require('./../customer/service');
const SERVICE_VAT = require('./../vat/service');
const currentConfig = require('../../../utils/appConfig');
const pdfkit_service = require('../../../utils/pdfkit_utility');
const { getInvoiceConfigForDate } = require("../../../config.env");

const momentFormat = 'DD/MM/YYYY';
const HEX_ROW_SHADE = '#e1e1e1';
const LABEL_MISSING_ITEM_NAME = '[ITEM NAME MISSING]';

const generateCreditNotePDF = async (creditNoteIds, reprint = false) => {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = pdfkit_service.createPDFDoc();
            pdfkit_service.registerFont(doc);
            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            const creditNotes = await SERVICE_CREDIT_NOTE.fetchCreditNotes(
                { _id: { $in: creditNoteIds } },
                [
                    'credit_note_number', 'original_invoice_number', 'customer_id', 'customer_name', 'reason', 'reason_description', 'credit_items', 'credit_adjustments',
                    'subtotal', 'vat_total', 'total_credit_amount', 'status', 'remaining_credit', 'notes', 'created_at', 'invoice_date', 'applied_to_invoices']
            );
            if (!creditNotes || creditNotes.length === 0) { throw new Error('No credit notes found for the provided IDs'); }
            const customerIds = [...new Set(creditNotes.map(cn => cn.customer_id))];
            const Customers = await SERVICE_CUSTOMER.fetchCustomers({ _id: { $in: customerIds } }, ['legal_entity', 'customer_name', 'mobile', 'phone', 'address', 'city', 'postcode']);
            const customerMap = {};
            if (Customers && Array.isArray(Customers)) {
                Customers.forEach(customer => {
                    const id = customer._id;
                    delete customer._id;
                    customerMap[id] = customer;
                });
            }
            const vatIds = new Set();
            for (const creditNote of creditNotes) {
                if (creditNote.credit_items && Array.isArray(creditNote.credit_items)) {
                    for (const item of creditNote.credit_items) {
                        if (item.vat) {
                            vatIds.add(item.vat.toString());
                        }
                    }
                }
            }
            let VAT = {};
            if (vatIds.size > 0) {
                const vatData = await SERVICE_VAT.fetchVAT({ _id: { $in: [...vatIds] } }, ['name', 'rate', 'order']);
                VAT = vatData.reduce((a, v) => {
                    a[v._id] = v;
                    return a;
                }, {});
            }
            let isFirstPage = true;
            for (const creditNote of creditNotes) {
                if (!isFirstPage) { doc.addPage(); }
                isFirstPage = false;
                const currentInvoiceConfigData = getInvoiceConfigForDate(creditNote.invoice_date || creditNote.created_at);
                const customer = customerMap[creditNote.customer_id] || {};
                const analysisVAT = {};
                let totalExclVat = 0;
                let totalVat = 0;
                if (creditNote.credit_items && Array.isArray(creditNote.credit_items)) {
                    for (const item of creditNote.credit_items) {
                        const taxRate = item.tax || 0;
                        const vatId = item.vat ? item.vat.toString() : null;
                        if (!analysisVAT[taxRate]) {
                            analysisVAT[taxRate] = {
                                vatId: vatId,
                                goods_value: 0,
                                vat_value: 0
                            };
                        }
                        const itemPrice = (item.rate || 0) * (item.quantity || 0);
                        analysisVAT[taxRate].goods_value += item.amount_excl_vat || 0;
                        analysisVAT[taxRate].vat_value += item.vat_amount || 0;
                        totalExclVat += item.amount_excl_vat || 0;
                        totalVat += item.vat_amount || 0;
                    }
                }
                const pageWidth = doc.page.width;
                const marginLeft = doc.page.margins.left;
                const marginRight = doc.page.margins.right;
                const leftColWidth = 100;
                const rightColWidth = 160;
                doc.font('Roboto-Bold').fontSize(18).text('CREDIT NOTE', { align: 'center', bold: true });
                doc.moveDown(0.5);
                const headerY = doc.y;
                try {
                    if (currentConfig.logo) {
                        doc.image(currentConfig.logo, marginLeft, headerY, { width: leftColWidth });
                    }
                } catch (error) {
                    console.log('Logo not found, continuing without it');
                }
                const rightX = pageWidth - marginRight - rightColWidth;
                doc.font('Roboto-normal')
                    .fontSize(10)
                    .text(currentInvoiceConfigData.addressLines.join('\n'), rightX, headerY, {
                        width: rightColWidth,
                        alignment: 'right'
                    });
                doc.moveDown(1);
                const customerLines = [];
                if (customer.legal_entity) customerLines.push(customer.legal_entity);
                if (customer.customer_name) {
                    customerLines.push(`T/A ${customer.customer_name}`);
                } else if (creditNote.customer_name) {
                    customerLines.push(creditNote.customer_name);
                }
                if (customer.mobile) customerLines.push(`Tel: ${customer.mobile}`);
                if (customer.address) customerLines.push(customer.address);
                if (customer.city) customerLines.push(customer.city);
                if (customer.postcode) customerLines.push(customer.postcode);
                const rightDetailsX = pageWidth - marginRight - rightColWidth;
                const creditNoteDetails = [
                    `Number: ${creditNote.credit_note_number || 'N/A'}`,
                    `Date: ${creditNote.created_at ? moment(creditNote.created_at).format(momentFormat) : 'N/A'}`,
                    `Original Invoice #: ${creditNote.original_invoice_number || 'N/A'}`,
                ];
                const maxLines = Math.max(customerLines.length, creditNoteDetails.length);
                let currentY = doc.y;
                for (let i = 0; i < maxLines; i++) {
                    if (i < customerLines.length) {
                        doc.font('Roboto-normal').fontSize(10);
                        doc.text(customerLines[i], marginLeft, currentY, { width: '40%' });
                    }
                    if (i < creditNoteDetails.length) {
                        doc.font('Roboto-normal').fontSize(10);
                        doc.text(creditNoteDetails[i], rightDetailsX, currentY, { width: rightColWidth, alignment: 'right' });
                    }
                    currentY += 12;
                }
                doc.y = currentY + 8;
                if (reprint) {
                    doc.font('Roboto-Bold').fontSize(12).fillColor('red').text('** REPRINT **', 0, doc.y, { width: pageWidth, alignment: 'center' }).fillColor('black');
                    doc.moveDown(1);
                }
                if (creditNote.reason) {
                    doc.font('Roboto-Bold').fontSize(10);
                    doc.text('Reason for Credit:', marginLeft, doc.y);
                    doc.font('Roboto-normal').fontSize(10);
                    doc.text(creditNote.reason, marginLeft + 100, doc.y - 12);

                    if (creditNote.reason_description) {
                        doc.moveDown(0.5);
                        doc.font('Roboto-Bold').fontSize(10);
                        doc.text('Details:', marginLeft, doc.y);
                        doc.font('Roboto-normal').fontSize(10);
                        doc.text(creditNote.reason_description, marginLeft + 100, doc.y - 12);
                    }
                    doc.moveDown(2);
                }
                const tableTop = doc.y;
                const tableWidth = pageWidth - marginLeft - marginRight;
                const colWidths = {
                    itemNo: tableWidth * 0.10,
                    itemName: tableWidth * 0.35,
                    unitPrice: tableWidth * 0.13,
                    quantity: tableWidth * 0.12,
                    vatCode: tableWidth * 0.13,
                    total: tableWidth * 0.17
                };
                doc.font('Roboto-Bold').fontSize(9);
                const headerHeight = 20;
                doc.rect(marginLeft, tableTop, tableWidth, headerHeight)
                    .fill('#e1e1e1');

                doc.fillColor('black');
                let headerX = marginLeft;
                doc.text('Item#', headerX + 5, tableTop + 3, { width: colWidths.itemNo - 5, bold: true });
                headerX += colWidths.itemNo;
                doc.text('Item Name', headerX + 5, tableTop + 3, { width: colWidths.itemName - 5, bold: true });
                headerX += colWidths.itemName;
                doc.text('Unit Price', headerX + 5, tableTop + 3, { width: colWidths.unitPrice - 5, alignment: 'right', bold: true });
                headerX += colWidths.unitPrice;
                doc.text('Quantity', headerX + 5, tableTop + 3, { width: colWidths.quantity - 5, alignment: 'center', bold: true });
                headerX += colWidths.quantity;
                doc.text('VAT Code', headerX + 5, tableTop + 3, { width: colWidths.vatCode - 5, alignment: 'center', bold: true });
                headerX += colWidths.vatCode;
                doc.text('Total', headerX + 5, tableTop + 3, { width: colWidths.total - 5, alignment: 'right', bold: true });
                let currentYPos = tableTop + headerHeight;
                let rowIndex = 0;
                let itemCounter = 1;
                if (creditNote.credit_items && Array.isArray(creditNote.credit_items)) {
                    for (const item of creditNote.credit_items) {
                        const rowY = currentYPos;
                        const rowHeight = 18;
                        if (rowIndex % 2 === 1) {
                            doc.rect(marginLeft, rowY, tableWidth, rowHeight).fill('#f5f5f5');
                            doc.fillColor('black');
                        }
                        const vatDisplay = item.vat && VAT[item.vat] ? VAT[item.vat].name : (item.tax || `${item.tax || 0}%`);
                        let itemX = marginLeft;
                        doc.text(item.barcode, itemX + 5, rowY + 3, { width: colWidths.itemNo - 5 });
                        itemX += colWidths.itemNo;
                        doc.text(item.name || LABEL_MISSING_ITEM_NAME, itemX + 5, rowY + 3, { width: colWidths.itemName - 5 });
                        itemX += colWidths.itemName;
                        doc.text(`£${(item.rate || 0).toFixed(2)}`, itemX + 5, rowY + 3, { width: colWidths.unitPrice - 5, alignment: 'right' });
                        itemX += colWidths.unitPrice;
                        doc.text(item.quantity ? item.quantity.toString() : '0', itemX + 5, rowY + 3, { width: colWidths.quantity - 5, alignment: 'center' });
                        itemX += colWidths.quantity;
                        doc.text(vatDisplay, itemX + 5, rowY + 3, { width: colWidths.vatCode - 5, alignment: 'center' });
                        itemX += colWidths.vatCode;
                        doc.text(`£${(item.amount_excl_vat || 0).toFixed(2)}`, itemX + 5, rowY + 3, { width: colWidths.total - 5, alignment: 'right' });
                        currentYPos += rowHeight;
                        rowIndex++;
                        itemCounter++;
                    }
                }
                doc.rect(marginLeft, currentYPos, tableWidth, 1).fill('black');
                doc.fillColor('black');
                doc.moveDown(2);
                const analysisWidth = tableWidth * 0.48;
                const totalsWidth = 200;
                const totalsX = pageWidth - marginRight - totalsWidth;
                const columnStartY = doc.y;
                let vatAnalysisBottomY = columnStartY;
                if (Object.keys(analysisVAT).length > 0) {
                    const vatKeys = Object.keys(analysisVAT).sort((x, y) => {
                        const vatX = analysisVAT[x].vatId ? VAT[analysisVAT[x].vatId] : null;
                        const vatY = analysisVAT[y].vatId ? VAT[analysisVAT[y].vatId] : null;
                        const orderX = vatX ? vatX.order : 999;
                        const orderY = vatY ? vatY.order : 999;
                        return orderX - orderY;
                    });
                    const vatHeaderY = columnStartY;
                    doc.rect(marginLeft, vatHeaderY, analysisWidth, 18).fill('#e1e1e1');
                    doc.fillColor('black');
                    doc.font('Roboto-Bold').fontSize(9);
                    doc.text('VAT Analysis', marginLeft + (analysisWidth / 2) - 40, vatHeaderY + 3, { width: 80, alignment: 'center' });
                    let vatY = vatHeaderY + 18;
                    doc.font('Roboto-Bold').fontSize(9);
                    doc.text('Code', marginLeft + 5, vatY, { width: 50 });
                    doc.text('Rate', marginLeft + 55, vatY, { width: 40 });
                    doc.text('Goods Value', marginLeft + 95, vatY, { width: 85, alignment: 'right' });
                    doc.text('VAT Value', marginLeft + 180, vatY, { width: 85, alignment: 'right' });
                    vatY += 16;
                    doc.font('Roboto-normal').fontSize(9);
                    let vatRowIndex = 0;
                    for (const rate of vatKeys) {
                        const data = analysisVAT[rate];
                        const rowY = vatY;

                        if (vatRowIndex % 2 === 1) {
                            doc.rect(marginLeft, rowY, analysisWidth, 16).fill('#f5f5f5');
                            doc.fillColor('black');
                        }
                        const vatCode = data.vatId && VAT[data.vatId] ? VAT[data.vatId].name : `VAT${rate}`;
                        doc.text(vatCode, marginLeft + 5, rowY + 2, { width: 50 });
                        doc.text(`${rate}%`, marginLeft + 55, rowY + 2, { width: 40 });
                        doc.text(`£${data.goods_value.toFixed(2)}`, marginLeft + 95, rowY + 2, { width: 85, alignment: 'right' });
                        doc.text(`£${data.vat_value.toFixed(2)}`, marginLeft + 180, rowY + 2, { width: 85, alignment: 'right' });
                        vatY += 16;
                        vatRowIndex++;
                    }
                    doc.rect(marginLeft, vatHeaderY, analysisWidth, vatY - vatHeaderY).stroke();
                    vatAnalysisBottomY = vatY;
                }
                let adjustmentsHeight = 0;
                let adjustmentsBottomY = columnStartY;

                if (creditNote.credit_adjustments && creditNote.credit_adjustments.length > 0) {
                    const adjY = columnStartY;
                    doc.rect(totalsX, adjY, totalsWidth, 18).fill('#e1e1e1');
                    doc.fillColor('black');
                    doc.font('Roboto-Bold').fontSize(9);
                    doc.text('Adjustments', totalsX + (totalsWidth / 2) - 35, adjY + 3, { width: 70, alignment: 'center' });
                    doc.font('Roboto-normal').fontSize(9);
                    let adjYPos = adjY + 18;
                    for (const adj of creditNote.credit_adjustments) {
                        doc.text(`${adj.description}:`, totalsX + 5, adjYPos, { width: 130 });
                        doc.text(`£${(adj.amount || 0).toFixed(2)}`, totalsX + 140, adjYPos, { width: 55, alignment: 'right' });
                        adjYPos += 16;
                    }
                    doc.rect(totalsX, adjY, totalsWidth, adjYPos - adjY).stroke();
                    adjustmentsHeight = adjYPos - adjY;
                    adjustmentsBottomY = adjYPos;
                }
                const totals = [
                    { label: 'Subtotal', value: creditNote.subtotal || totalExclVat || 0 },
                    { label: 'VAT Amount', value: creditNote.vat_total || totalVat || 0 },
                    { label: 'Total Credit', value: creditNote.total_credit_amount || 0, bold: true },
                ];
                const boxHeight = totals.length * 18 + 10;
                const totalsStartY = adjustmentsHeight > 0 ? adjustmentsBottomY + 5 : columnStartY;
                doc.rect(totalsX, totalsStartY, totalsWidth, boxHeight).stroke();
                doc.fillColor('black');
                let yOffset = totalsStartY + 5;
                for (const total of totals) {
                    doc.font(total.bold ? 'Roboto-Bold' : 'Roboto-normal').fontSize(total.bold ? 11 : 9);
                    doc.text(`${total.label}:`, totalsX + 5, yOffset);
                    doc.text(`£${total.value.toFixed(2)}`, totalsX + 150, yOffset, { alignment: 'right' });
                    yOffset += 18;
                }
                const totalsBottomY = totalsStartY + boxHeight;
                const maxBottomY = Math.max(vatAnalysisBottomY, totalsBottomY);
                doc.y = maxBottomY + 10;
                if (creditNote.applied_to_invoices && creditNote.applied_to_invoices.length > 0) {
                    doc.font('Roboto-Bold').fontSize(10);
                    doc.text('Applied to Invoices: ', marginLeft, doc.y);
                    doc.moveDown(0.5);
                    const appliedTableTop = doc.y;
                    const appliedTableWidth = tableWidth * 0.7;
                    const appliedMarginLeft = marginLeft;
                    const appliedColWidths = {
                        invoiceNo: appliedTableWidth * 0.30,
                        appliedDate: appliedTableWidth * 0.35,
                        amount: appliedTableWidth * 0.35
                    };
                    const appliedHeaderHeight = 18;
                    doc.rect(appliedMarginLeft, appliedTableTop, appliedTableWidth, appliedHeaderHeight).fill('#e1e1e1');
                    doc.fillColor('black');
                    doc.font('Roboto-Bold').fontSize(8);
                    let appliedX = appliedMarginLeft;
                    doc.text('Invoice #', appliedX + 5, appliedTableTop + 3, { width: appliedColWidths.invoiceNo - 5, bold: true });
                    appliedX += appliedColWidths.invoiceNo;
                    doc.text('Applied Date', appliedX + 5, appliedTableTop + 3, {
                        width: appliedColWidths.appliedDate - 5,
                        bold: true
                    });
                    appliedX += appliedColWidths.appliedDate;
                    doc.text('Amount', appliedX + 5, appliedTableTop + 3, {
                        width: appliedColWidths.amount - 5,
                        alignment: 'right',
                        bold: true
                    });
                    let appliedYPos = appliedTableTop + appliedHeaderHeight;
                    let appliedRowIndex = 0;
                    const sortedApplied = [...creditNote.applied_to_invoices].sort((a, b) => new Date(b.applied_date) - new Date(a.applied_date));
                    for (const applied of sortedApplied) {
                        const rowY = appliedYPos;
                        const rowHeight = 16;
                        if (appliedRowIndex % 2 === 1) {
                            doc.rect(appliedMarginLeft, rowY, appliedTableWidth, rowHeight).fill('#f5f5f5');
                            doc.fillColor('black');
                        }
                        doc.font('Roboto-normal').fontSize(8);
                        let itemX = appliedMarginLeft;
                        doc.text(applied.invoice_number || 'N/A', itemX + 5, rowY + 2, {
                            width: appliedColWidths.invoiceNo - 5
                        });
                        itemX += appliedColWidths.invoiceNo;
                        doc.text(applied.applied_date ? moment(applied.applied_date).format(momentFormat) : 'N/A',
                            itemX + 5, rowY + 2, { width: appliedColWidths.appliedDate - 5 });
                        itemX += appliedColWidths.appliedDate;
                        doc.text(`£${(applied.amount_applied || 0).toFixed(2)}`,
                            itemX + 5, rowY + 2, { width: appliedColWidths.amount - 5, alignment: 'right' });
                        appliedYPos += rowHeight;
                        appliedRowIndex++;
                    }
                    doc.rect(appliedMarginLeft, appliedYPos, appliedTableWidth, 1).fill('black');
                    doc.fillColor('black');
                    doc.moveDown(1);
                }
                if (creditNote.status) {
                    doc.font('Roboto-Bold').fontSize(10);
                    doc.text(`Status: ${creditNote.status}`, marginLeft, doc.y);
                    if (creditNote.remaining_credit !== undefined && creditNote.remaining_credit !== null) {
                        doc.text(`Remaining Credit: £${creditNote.remaining_credit.toFixed(2)}`, marginLeft + 150, doc.y - 12);
                    }
                    doc.moveDown(1);
                }
                if (creditNote.notes) {
                    doc.font('Roboto-Bold').fontSize(10);
                    doc.text('Notes:', marginLeft, doc.y);
                    doc.font('Roboto-normal').fontSize(9);
                    doc.text(creditNote.notes, marginLeft + 50, doc.y - 10);
                    doc.moveDown(2);
                }
                pdfkit_service.PDFFooter(doc);
            }
            doc.end();
        } catch (error) {
            console.error('Error generating credit note PDF:', error);
            reject(error);
        }
    });
};

module.exports = {
    generateCreditNotePDF
};