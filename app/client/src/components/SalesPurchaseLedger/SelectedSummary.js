import React from 'react';
import { Paper, Stack, Typography, Button } from '@mui/material';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { money } from '../Common/formatters';

const SelectedSummary = ({ selectedIds, tabValue, selectedData, onGeneratePDF, isPdfLoading = false }) => {
  if (selectedIds.length === 0) return null;
  let totalInvoice = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  if (tabValue === '0') {
    totalInvoice = selectedData.reduce((sum, item) => sum + (item.total_incl_vat || 0), 0);
    totalPaid = selectedData.reduce((sum, item) => sum + (item.total_paid || 0), 0);
    totalOutstanding = selectedData.reduce((sum, item) => sum + (item.balance_due || 0), 0);
  } else {
    totalInvoice = selectedData.reduce((sum, item) => sum + (item.gross_amount || 0), 0);
    totalPaid = selectedData.reduce((sum, item) => sum + (item.total_paid || 0), 0);
    totalOutstanding = selectedData.reduce((sum, item) => sum + (item.amount_outstanding || 0), 0);
  }
  return (
    <Paper sx={{ p: 2, bgcolor: '#1a1a1a', border: '1px solid', borderColor: '#333', borderRadius: 1, marginTop: 2 }}>
      <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
        <Typography variant="subtitle2" sx={{ color: '#fff' }}>
          Selected:<strong style={{ color: '#90caf9', margin: '6px' }}>{selectedIds.length}</strong>
          {tabValue === '0' ? 'invoices' : 'purchases'}
        </Typography>
        <Typography variant="subtitle2" sx={{ color: '#fff' }}>
          Total Invoice: <strong style={{ color: '#ffa726' }}>{money(totalInvoice)}</strong>
        </Typography>
        <Typography variant="subtitle2" sx={{ color: '#fff' }}>
          Total Paid: <strong style={{ color: '#81c784' }}>{money(totalPaid)}</strong>
        </Typography>
        <Typography variant="subtitle2" sx={{ color: '#fff' }}>
          Total Outstanding: <strong style={{ color: totalOutstanding > 0 ? '#ef5350' : '#81c784' }}>
            {money(totalOutstanding)}
          </strong>
        </Typography>
        <Button 
          variant="contained" 
          size="small"
          startIcon={<ReceiptIcon />}
          onClick={onGeneratePDF}
          disabled={isPdfLoading}
          sx={{ bgcolor: '#d32f2f', '&:hover': { bgcolor: '#b71c1c' } }}
        >
          {isPdfLoading ? 'Generating PDF...' : 'Generate PDF'}
        </Button>
      </Stack>
    </Paper>
  );
};

export default SelectedSummary;