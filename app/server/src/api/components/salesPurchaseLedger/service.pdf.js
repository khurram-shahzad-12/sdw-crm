const PDFDocument = require('pdfkit');
const moment = require('moment');
const currentConfig = require('../../../utils/appConfig');
const pdfkit_service = require('../../../utils/pdfkit_utility');
const { getInvoiceConfigForDate } = require("../../../config.env");
const InvoiceModel = require('../invoice/model');
const SupplierInvoicesModel = require('../supplier_invoices/model');
const momentFormat = 'DD/MM/YYYY';

const PAYMENT_ROW_HEIGHT = 18;
const PAYMENT_HEADER_HEIGHT = 18;
const PAGE_OPTIONS = {
    size: 'A4',
    layout: 'landscape',
    margins: { top: 40, bottom: 10, left: 40, right: 40 },
    bufferPages: true
};

function drawPaymentsMiniTable(doc, payments, x, y, width) {
    const colFractions = [0.30, 0.40, 0.30];
    const colWidths = colFractions.map(f => width * f);
    const HEADER_FONT_SIZE = 9;
    const BODY_FONT_SIZE = 8;

    const horizontalPadding = 4;
    const headerHeight = PAYMENT_ROW_HEIGHT;
    const rowHeight = PAYMENT_HEADER_HEIGHT;
    if (!payments || payments.length === 0) {
        doc.save();
        doc.font('Roboto-normal').fontSize(BODY_FONT_SIZE).fillColor('#95a5a6');
        doc.text( 'No payments', x + horizontalPadding, y + 3, { width: width - horizontalPadding * 2, lineBreak: false });
        doc.restore();
        return rowHeight + 4;
    }
    const bodyHeight = payments.length * rowHeight;
    const tableHeight = headerHeight + bodyHeight + 2;
    doc.save();
    doc.lineWidth(0.8).strokeColor('#cfd6dc');
    doc.roundedRect( x, y, width, tableHeight, 2 ).stroke();
    doc.rect( x + 0.5, y + 0.5, width - 1, headerHeight ).fill('#34495e');
    doc.font('Roboto-Bold').fontSize(HEADER_FONT_SIZE).fillColor('white');
    const headerTextY = y + (headerHeight - HEADER_FONT_SIZE) / 2 - 1;
    const headers = [ 'Date', 'Type', 'Amount' ];
    let hx = x + horizontalPadding;
    headers.forEach((header, index) => {
        const isAmount = index === 2;
        doc.text( header, hx, headerTextY,
            {
                width: colWidths[index] - 8,
                align: isAmount ? 'right' : 'left',
                lineBreak: false
            }
        );
        hx += colWidths[index];
    });
    payments.forEach((payment, index) => {
        const rowY = y + headerHeight + (index * rowHeight) + 1;
        if (index % 2 === 0) { doc.rect( x + 1, rowY, width - 2, rowHeight - 1 ).fill('#f8fafb'); }
        if (index > 0) { doc.moveTo( x + 2, rowY ).lineTo( x + width - 2, rowY ).lineWidth(0.4).strokeColor('#e5e9ec').stroke(); }
        doc.font('Roboto-normal').fontSize(BODY_FONT_SIZE).fillColor('#2c3e50');
        const textY = rowY + (rowHeight - BODY_FONT_SIZE) / 2 - 1;
        let cx = x + horizontalPadding;
        const dateText = payment.date ? moment(payment.date).format(momentFormat) : '-';
        doc.text( dateText, cx, textY, { width: colWidths[0] - 8, lineBreak: false } );
        cx += colWidths[0];
        const typeText = payment.type || '-';
        doc.text( typeText, cx + 2, textY, { width: colWidths[1] - 8, lineBreak: false } );
        cx += colWidths[1];
        const amount = Number(payment.amount) || 0;
        doc.text( `£${amount.toFixed(2)}`, cx + 2, textY, { width: colWidths[2] - 8, align: 'right', lineBreak: false } );
    });
    doc.restore();
    return tableHeight;
}

const generateSalesLedgerPDF = async (ids, startDate, endDate) => {
    return new Promise(async (resolve, reject) => {
        try {
            const idArray = typeof ids === 'string' ? ids.split(',') : ids;
            const invoices = await InvoiceModel.find({ _id: { $in: idArray } }).populate('customer', 'customer_name').lean();
            if (!invoices || invoices.length === 0) { throw new Error('No sales data found for the provided IDs');}
            const salesData = invoices.map(invoice => {
                const totalPaid = (invoice.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
                const totalAmount = invoice.total_incl_vat || 0;
                const outstanding = Math.max(0, totalAmount - totalPaid);
                return {
                    _id: invoice._id,
                    sale_number: invoice.sale_number || 'N/A',
                    invoice_date: invoice.ot_date,
                    customer: {
                        name: invoice.customer?.customer_name || 'Unknown Customer'
                    },
                    total_incl_vat: totalAmount,
                    payments: invoice.payments || [],
                    total_paid: totalPaid,
                    balance_due: outstanding,
                    status: outstanding === 0 ? 'PAID' : (totalPaid > 0 ? 'PARTIAL' : 'UNPAID')
                };
            });
            const doc = new PDFDocument(PAGE_OPTIONS);
            pdfkit_service.registerFont(doc);
            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            const currentInvoiceConfigData = getInvoiceConfigForDate(new Date());
            const pageWidth = doc.page.width;
            const marginLeft = doc.page.margins.left;
            const marginRight = doc.page.margins.right;
            const headerY = doc.y;
            const logoWidth = 160;
            const rightColWidth = 220;
            try {
                if (currentConfig.logo) {
                    doc.image(currentConfig.logo, marginLeft, headerY, { width: logoWidth });
                }
            } catch (error) {
                console.log('Logo not found');
            }
            const rightX = pageWidth - marginRight - rightColWidth;
            const companyName = currentConfig.companyName || 'Company Name';
            doc.font('Roboto-Bold').fontSize(12).text(companyName, rightX, headerY, { width: rightColWidth, alignment: 'right' });
            doc.font('Roboto-normal').fontSize(9).text(currentInvoiceConfigData.addressLines.join('\n'), rightX, headerY + 16, { width: rightColWidth, alignment: 'right', lineGap: 2 });
            const titleY = doc.y;
            const titleWidth = 300;
            const titleX = (pageWidth - titleWidth) / 2;
            doc.font('Roboto-Bold').fontSize(20).text('SALES LEDGER', titleX, titleY, { width: titleWidth, align: 'center' })
            doc.moveTo(titleX, doc.y + 4).lineTo(titleX + titleWidth, doc.y + 4).lineWidth(2).strokeColor('#34495e').stroke();        
            doc.moveDown(1);
            doc.font('Roboto-normal').fontSize(11).fillColor('#7f8c8d')
                .text(`Date Range: ${moment(startDate).format(momentFormat)} - ${moment(endDate).format(momentFormat)}`, { align: 'right' }).fillColor('black');
            doc.moveDown(0.5);
            const totalSales = salesData.length;
            const totalValue = salesData.reduce((sum, item) => sum + (item.total_incl_vat || 0), 0);
            const totalPaid = salesData.reduce((sum, item) => sum + (item.total_paid || 0), 0);
            const totalOutstanding = salesData.reduce((sum, item) => sum + (item.balance_due || 0), 0);
            const statsY = doc.y;
            const statsWidth = pageWidth - marginLeft - marginRight;
            doc.rect(marginLeft, statsY, statsWidth, 38).fill('#f0f4f8');
            doc.rect(marginLeft, statsY, statsWidth, 38).lineWidth(1).strokeColor('#dce4ec').stroke();
            doc.fillColor('#2c3e50');
            const statItems = [
                { label: 'Total Invoices', value: totalSales.toString() },
                { label: 'Total Value', value: `£${totalValue.toFixed(2)}` },
                { label: 'Total Paid', value: `£${totalPaid.toFixed(2)}` },
                { label: 'Total Outstanding', value: `£${totalOutstanding.toFixed(2)}` }
            ];
            const statWidth = statsWidth / statItems.length;
            statItems.forEach((item, index) => {
                const x = marginLeft + (index * statWidth);
                doc.font('Roboto-normal').fontSize(9).fillColor('#7f8c8d')
                    .text(item.label, x + 12, statsY + 6, { width: statWidth - 24, align: 'center' });
                doc.font('Roboto-Bold').fontSize(14).fillColor('#2c3e50')
                    .text(item.value, x + 12, statsY + 18, { width: statWidth - 24, align: 'center' });
            });
            doc.fillColor('black');
            doc.moveDown(0.8);
            let tableTop = doc.y;
            const tableWidth = pageWidth - marginLeft - marginRight;
            const colWidths = {
                invoiceNo: tableWidth * 0.07,
                date: tableWidth * 0.08,
                customer: tableWidth * 0.20,
                totalAmount: tableWidth * 0.09,
                paymentMethods: tableWidth * 0.30,
                paid: tableWidth * 0.08,
                outstanding: tableWidth * 0.09,
                status: tableWidth * 0.08
            };
            const drawTableHeader = (top) => {
                const headerHeight = 24;
                doc.rect(marginLeft, top, tableWidth, headerHeight).fill('#2c3e50');
                doc.fillColor('white');
                doc.font('Roboto-Bold').fontSize(9);
                let headerX = marginLeft;
                doc.text('Invoice #', headerX + 6, top + 7, { width: colWidths.invoiceNo - 12 });
                headerX += colWidths.invoiceNo;
                doc.text('Date', headerX + 6, top + 7, { width: colWidths.date - 12 });
                headerX += colWidths.date;
                doc.text('Customer', headerX + 6, top + 7, { width: colWidths.customer - 12 });
                headerX += colWidths.customer;
                doc.text('Total', headerX + 6, top + 7, { width: colWidths.totalAmount - 12, alignment: 'right' });
                headerX += colWidths.totalAmount;
                doc.text('Payment Methods', headerX + 6, top + 7, { width: colWidths.paymentMethods - 12 });
                headerX += colWidths.paymentMethods;
                doc.text('Paid', headerX + 6, top + 7, { width: colWidths.paid - 12, alignment: 'right' });
                headerX += colWidths.paid;
                doc.text('Outstanding', headerX + 6, top + 7, { width: colWidths.outstanding - 12, alignment: 'right' });
                headerX += colWidths.outstanding;
                doc.text('Status', headerX + 6, top + 7, { width: colWidths.status - 12 });
                doc.fillColor('black');
                return headerHeight;
            };

            const headerHeight = drawTableHeader(tableTop);
            let currentYPos = tableTop + headerHeight;
            let rowIndex = 0;
            for (const sale of salesData) {
                const payments = sale.payments || [];
                const paymentsBlockHeight = payments.length > 0
                    ? PAYMENT_HEADER_HEIGHT + (payments.length * PAYMENT_ROW_HEIGHT) + 4 : PAYMENT_ROW_HEIGHT + 6;  
                const rowHeight = Math.max(28, paymentsBlockHeight + 6);
                if (currentYPos + rowHeight > doc.page.height - 80) {
                    doc.addPage();
                    currentYPos = doc.page.margins.top;
                    const newHeaderHeight = drawTableHeader(currentYPos);
                    currentYPos += newHeaderHeight;
                }
                const rowY = currentYPos;
                if (rowIndex % 2 === 0) {
                    doc.rect(marginLeft, rowY, tableWidth, rowHeight).fill('#ffffff');
                } else {
                    doc.rect(marginLeft, rowY, tableWidth, rowHeight).fill('#f8f9fa');
                }
                doc.fillColor('black');
                doc.rect(marginLeft, rowY, tableWidth, rowHeight).lineWidth(0.5).strokeColor('#e0e0e0').stroke();
                let itemX = marginLeft;
                const rowCenterY = rowY + 6;
                doc.font('Roboto-Bold').fontSize(9).text(sale.sale_number || 'N/A', itemX + 6, rowCenterY, { width: colWidths.invoiceNo - 12 });
                itemX += colWidths.invoiceNo;
                doc.font('Roboto-normal').fontSize(9).text(sale.invoice_date ? moment(sale.invoice_date).format(momentFormat) : '-',
                        itemX + 6, rowCenterY, { width: colWidths.date - 12 });
                itemX += colWidths.date;
                const customerName = sale.customer?.name || 'Unknown';
                doc.font('Roboto-normal').fontSize(9).text(customerName.length > 20 ? customerName.substring(0, 18) + '...' : customerName,
                        itemX + 6, rowCenterY, { width: colWidths.customer - 12 });
                itemX += colWidths.customer;
                doc.font('Roboto-Bold').fontSize(9).text(`£${(sale.total_incl_vat || 0).toFixed(2)}`,
                        itemX + 6, rowCenterY, { width: colWidths.totalAmount - 12, alignment: 'right' });
                itemX += colWidths.totalAmount;
                drawPaymentsMiniTable(doc, payments, itemX + 4, rowY + 4, colWidths.paymentMethods - 8);
                itemX += colWidths.paymentMethods;
                doc.font('Roboto-normal').fontSize(9).text(`£${(sale.total_paid || 0).toFixed(2)}`,
                        itemX + 6, rowCenterY, { width: colWidths.paid - 12, alignment: 'right' });
                itemX += colWidths.paid;
                const outstanding = sale.balance_due || 0;
                doc.font('Roboto-Bold').fontSize(9).fillColor(outstanding > 0 ? '#e74c3c' : '#27ae60').text(`£${outstanding.toFixed(2)}`,
                        itemX + 6, rowCenterY, { width: colWidths.outstanding - 12, alignment: 'right' }).fillColor('black');
                itemX += colWidths.outstanding;
                const status = sale.status || 'UNPAID';
                const statusColor = status === 'PAID' ? '#27ae60' : status === 'PARTIAL' ? '#f39c12' : '#e74c3c';
                const statusBg = status === 'PAID' ? '#d5f5e3' : status === 'PARTIAL' ? '#fdebd0' : '#fadbd8';
                const statusText = status;
                const badgeWidth = Math.max(40, statusText.length * 6 + 12);
                const badgeX = itemX + (colWidths.status - badgeWidth) / 2;
                doc.rect(badgeX, rowY + 4, badgeWidth, 18).fill(statusBg).stroke();
                doc.font('Roboto-Bold').fontSize(9).fillColor(statusColor).text(statusText, badgeX + 6, rowY + 6, { width: badgeWidth - 12, align: 'center' }).fillColor('black');
                currentYPos += rowHeight;
                rowIndex++;
            }
            doc.rect(marginLeft, currentYPos, tableWidth, 2).fill('#2c3e50');
            doc.fillColor('black');
            pdfkit_service.PDFFooter(doc);
            doc.end();
        } catch (error) {
            console.error('Error generating sales ledger PDF:', error);
            reject(error);
        }
    });
};

const generatePurchaseLedgerPDF = async (ids, startDate, endDate) => {
    return new Promise(async (resolve, reject) => {
        try {
            const idArray = typeof ids === 'string' ? ids.split(',') : ids;
            const purchases = await SupplierInvoicesModel.find({ _id: { $in: idArray } }).populate('supplier', 'name').lean();
            if (!purchases || purchases.length === 0) { throw new Error('No purchase data found for the provided IDs'); }
            const purchaseData = purchases.map(purchase => {
                const totalPaid = (purchase.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
                const grossAmount = purchase.total || 0;
                const outstanding = Math.max(0, grossAmount - totalPaid);      
                return {
                    _id: purchase._id,
                    invoice_number: purchase.invoice_number || 'N/A',
                    purchase_date: purchase.invoice_date,
                    supplier: { name: purchase.supplier?.name || 'Unknown Supplier' },
                    gross_amount: grossAmount,
                    payments: purchase.payments || [],
                    total_paid: totalPaid,
                    amount_outstanding: outstanding,
                    payment_date: purchase.payments && purchase.payments.length > 0  ? purchase.payments[purchase.payments.length - 1].date  : null,
                    status: outstanding === 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Unpaid')
                };
            });
            const doc = new PDFDocument(PAGE_OPTIONS);
            pdfkit_service.registerFont(doc);
            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            const currentInvoiceConfigData = getInvoiceConfigForDate(new Date());
            const pageWidth = doc.page.width;
            const marginLeft = doc.page.margins.left;
            const marginRight = doc.page.margins.right;
            const headerY = doc.y;
            const logoWidth = 160;
            const rightColWidth = 220;
            try {
                if (currentConfig.logo) {
                    doc.image(currentConfig.logo, marginLeft, headerY, { width: logoWidth });
                }
            } catch (error) {
                console.log('Logo not found');
            }
            const rightX = pageWidth - marginRight - rightColWidth;
            const companyName = currentConfig.companyName || 'Company Name';
            doc.font('Roboto-Bold').fontSize(12).text(companyName, rightX, headerY, { width: rightColWidth, alignment: 'right' });
            doc.font('Roboto-normal').fontSize(9).text(currentInvoiceConfigData.addressLines.join('\n'), rightX, headerY + 16, { width: rightColWidth, alignment: 'right', lineGap: 2 });
            const titleY = doc.y;
            const titleWidth = 300;
            const titleX = (pageWidth - titleWidth) / 2;
            doc.font('Roboto-Bold').fontSize(20).text('PURCHASE LEDGER', titleX, titleY, { width: titleWidth, align: 'center' })       
            doc.moveTo(titleX, doc.y + 4).lineTo(titleX + titleWidth, doc.y + 4).lineWidth(2).strokeColor('#34495e').stroke();        
            doc.moveDown(1);
            doc.font('Roboto-normal').fontSize(11).fillColor('#7f8c8d')
                .text(`Date Range: ${moment(startDate).format(momentFormat)} - ${moment(endDate).format(momentFormat)}`, { align: 'right' }).fillColor('black');
            doc.moveDown(0.5);
            const totalPurchases = purchaseData.length;
            const totalSpend = purchaseData.reduce((sum, item) => sum + (item.gross_amount || 0), 0);
            const totalPaid = purchaseData.reduce((sum, item) => sum + (item.total_paid || 0), 0);
            const totalOutstanding = purchaseData.reduce((sum, item) => sum + (item.amount_outstanding || 0), 0);
            const statsY = doc.y;
            const statsWidth = pageWidth - marginLeft - marginRight;
            doc.rect(marginLeft, statsY, statsWidth, 38).fill('#f0f4f8');
            doc.rect(marginLeft, statsY, statsWidth, 38).lineWidth(1).strokeColor('#dce4ec').stroke();  
            doc.fillColor('#2c3e50');
            const statItems = [
                { label: 'Total Purchases', value: totalPurchases.toString() },
                { label: 'Total Spend', value: `£${totalSpend.toFixed(2)}` },
                { label: 'Total Paid', value: `£${totalPaid.toFixed(2)}` },
                { label: 'Total Outstanding', value: `£${totalOutstanding.toFixed(2)}` }
            ];
            const statWidth = statsWidth / statItems.length;
            statItems.forEach((item, index) => {
                const x = marginLeft + (index * statWidth);
                doc.font('Roboto-normal').fontSize(9).fillColor('#7f8c8d').text(item.label, x + 12, statsY + 6, { width: statWidth - 24, align: 'center' });
                doc.font('Roboto-Bold').fontSize(14).fillColor('#2c3e50').text(item.value, x + 12, statsY + 18, { width: statWidth - 24, align: 'center' });
            });
            doc.fillColor('black');
            doc.moveDown(0.8);
            let tableTop = doc.y;
            const tableWidth = pageWidth - marginLeft - marginRight;
            const colWidths = {
                invoiceNo: tableWidth * 0.08,
                date: tableWidth * 0.08,
                supplier: tableWidth * 0.20,
                grossAmount: tableWidth * 0.08,
                paymentDate: tableWidth * 0.09,
                paymentMethods: tableWidth * 0.30,
                outstanding: tableWidth * 0.09,
                status: tableWidth * 0.08
            };
            const drawTableHeader = (top) => {
                const headerHeight = 24;
                doc.rect(marginLeft, top, tableWidth, headerHeight).fill('#2c3e50');
                doc.fillColor('white');
                doc.font('Roboto-Bold').fontSize(9);
                let headerX = marginLeft;
                doc.text('Invoice #', headerX + 6, top + 7, { width: colWidths.invoiceNo - 12 });
                headerX += colWidths.invoiceNo;
                doc.text('Date', headerX + 6, top + 7, { width: colWidths.date - 12 });
                headerX += colWidths.date;
                doc.text('Supplier', headerX + 6, top + 7, { width: colWidths.supplier - 12 });
                headerX += colWidths.supplier;
                doc.text('Gross', headerX + 6, top + 7, { width: colWidths.grossAmount - 12, alignment: 'right' });
                headerX += colWidths.grossAmount;
                doc.text('Payment Date', headerX + 6, top + 7, { width: colWidths.paymentDate - 12 });
                headerX += colWidths.paymentDate;
                doc.text('Payment Methods', headerX + 6, top + 7, { width: colWidths.paymentMethods - 12 });
                headerX += colWidths.paymentMethods;
                doc.text('Outstanding', headerX + 6, top + 7, { width: colWidths.outstanding - 12, alignment: 'right' });
                headerX += colWidths.outstanding;
                doc.text('Status', headerX + 6, top + 7, { width: colWidths.status - 12 });
                
                doc.fillColor('black');
                return headerHeight;
            };
            const headerHeight = drawTableHeader(tableTop);
            let currentYPos = tableTop + headerHeight;
            let rowIndex = 0;
            for (const purchase of purchaseData) {
                const payments = purchase.payments || [];
                const paymentsBlockHeight = payments.length > 0
                    ? PAYMENT_HEADER_HEIGHT + (payments.length * PAYMENT_ROW_HEIGHT) + 4 : PAYMENT_ROW_HEIGHT + 6;
                const rowHeight = Math.max(28, paymentsBlockHeight + 6);
                if (currentYPos + rowHeight > doc.page.height - 80) {
                    doc.addPage();
                    currentYPos = doc.page.margins.top;
                    const newHeaderHeight = drawTableHeader(currentYPos);
                    currentYPos += newHeaderHeight;
                }
                const rowY = currentYPos;
                if (rowIndex % 2 === 0) {
                    doc.rect(marginLeft, rowY, tableWidth, rowHeight).fill('#ffffff');
                } else {
                    doc.rect(marginLeft, rowY, tableWidth, rowHeight).fill('#f8f9fa');
                }
                doc.fillColor('black');
                doc.rect(marginLeft, rowY, tableWidth, rowHeight).lineWidth(0.5).strokeColor('#e0e0e0').stroke();
                let itemX = marginLeft;
                const rowCenterY = rowY + 6;
                doc.font('Roboto-Bold').fontSize(9).text(purchase.invoice_number || 'N/A', itemX + 6, rowCenterY, { width: colWidths.invoiceNo - 12 });
                itemX += colWidths.invoiceNo;
                doc.font('Roboto-normal').fontSize(9).text(purchase.purchase_date ? moment(purchase.purchase_date).format(momentFormat) : 'N/A',
                        itemX + 6, rowCenterY, { width: colWidths.date - 12 });
                itemX += colWidths.date;
                const supplierName = purchase.supplier?.name || 'Unknown';
                doc.font('Roboto-normal').fontSize(9).text(supplierName.length > 20 ? supplierName.substring(0, 18) + '...' : supplierName,
                        itemX + 6, rowCenterY, { width: colWidths.supplier - 12 });
                itemX += colWidths.supplier;
                doc.font('Roboto-Bold').fontSize(9).text(`£${(purchase.gross_amount || 0).toFixed(2)}`,
                        itemX + 6, rowCenterY, { width: colWidths.grossAmount - 12, alignment: 'right' });
                itemX += colWidths.grossAmount;
                doc.font('Roboto-normal').fontSize(9).text(purchase.payment_date ? moment(purchase.payment_date).format(momentFormat) : 'N/A',
                        itemX + 6, rowCenterY, { width: colWidths.paymentDate - 12 });
                itemX += colWidths.paymentDate;
                drawPaymentsMiniTable(doc, payments, itemX + 4, rowY + 4, colWidths.paymentMethods - 8);
                itemX += colWidths.paymentMethods;
                const outstanding = purchase.amount_outstanding || 0;
                doc.font('Roboto-Bold').fontSize(8).fillColor(outstanding > 0 ? '#e74c3c' : '#27ae60').text(`£${outstanding.toFixed(2)}`,
                        itemX + 6, rowCenterY, { width: colWidths.outstanding - 12, alignment: 'right' })
                    .fillColor('black');
                itemX += colWidths.outstanding;
                const status = purchase.status || 'Unpaid';
                const statusColor = status === 'Paid' ? '#27ae60' : status === 'Partial' ? '#f39c12' : '#e74c3c';
                const statusBg = status === 'Paid' ? '#d5f5e3' : status === 'Partial' ? '#fdebd0' : '#fadbd8';
                const statusText = status;
                const badgeWidth = Math.max(40, statusText.length * 6 + 12);
                const badgeX = itemX + (colWidths.status - badgeWidth) / 2;
                doc.rect(badgeX, rowY + 4, badgeWidth, 18).fill(statusBg).stroke();
                doc.font('Roboto-Bold').fontSize(9).fillColor(statusColor)
                    .text(statusText, badgeX + 6, rowY + 6, { width: badgeWidth - 12, align: 'center' }).fillColor('black');
                currentYPos += rowHeight;
                rowIndex++;
            }
            doc.rect(marginLeft, currentYPos, tableWidth, 2).fill('#2c3e50');
            doc.fillColor('black');
            pdfkit_service.PDFFooter(doc);
            doc.end();
        } catch (error) {
            console.error('Error generating purchase ledger PDF:', error);
            reject(error);
        }
    });
};

module.exports = {
    generateSalesLedgerPDF,
    generatePurchaseLedgerPDF
};
