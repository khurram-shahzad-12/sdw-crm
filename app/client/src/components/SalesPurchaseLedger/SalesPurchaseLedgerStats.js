import React from 'react';
import { Grid, Paper, Typography } from '@mui/material';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CurrencyPoundIcon from '@mui/icons-material/CurrencyPound';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import WarningIcon from '@mui/icons-material/Warning';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { money } from '../Common/formatters';

const SalesPurchaseLedgerStats = ({ tabValue, salesStats, purchaseStats }) => {
  if (tabValue === '0') {
    return (
      <>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, borderLeft: 4, borderLeftColor: 'primary.main' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ReceiptIcon fontSize="small" sx={{ color: '#1976d2' }} /> Total Sales
            </Typography>
            <Typography variant="h6" fontWeight={600}> {salesStats.total_sales || 0} </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, borderLeft: 4, borderLeftColor: 'success.main' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CurrencyPoundIcon fontSize="small" sx={{ color: '#2e7d32' }} /> Total Value
            </Typography>
            <Typography variant="h6" fontWeight={600}> {money(salesStats.total_value || 0)} </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, borderLeft: 4, borderLeftColor: 'warning.main' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <MoneyOffIcon fontSize="small" sx={{ color: '#ed6c02' }} /> Outstanding
            </Typography>
            <Typography variant="h6" fontWeight={600} color="error.main"> {money(salesStats.total_outstanding || 0)} </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, borderLeft: 4, borderLeftColor: 'error.main' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <WarningIcon fontSize="small" sx={{ color: '#d32f2f' }} /> Unpaid Invoices
            </Typography>
            <Typography variant="h6" fontWeight={600}> {salesStats.unpaid_count || 0} </Typography>
          </Paper>
        </Grid>
      </>
    );
  }
  return (
    <>
      <Grid item xs={6} sm={3}>
        <Paper sx={{ p: 2, borderLeft: 4, borderLeftColor: 'primary.main' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ShoppingCartIcon fontSize="small" sx={{ color: '#1976d2' }} /> Total Purchases
          </Typography>
          <Typography variant="h6" fontWeight={600}> {purchaseStats.total_purchases || 0} </Typography>
        </Paper>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Paper sx={{ p: 2, borderLeft: 4, borderLeftColor: 'success.main' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TrendingUpIcon fontSize="small" sx={{ color: '#2e7d32' }} /> Total Spend
          </Typography>
          <Typography variant="h6" fontWeight={600}> {money(purchaseStats.total_spend || 0)} </Typography>
        </Paper>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Paper sx={{ p: 2, borderLeft: 4, borderLeftColor: 'warning.main' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <MoneyOffIcon fontSize="small" sx={{ color: '#ed6c02' }} /> Outstanding
          </Typography>
          <Typography variant="h6" fontWeight={600} color="error.main"> {money(purchaseStats.total_outstanding || 0)} </Typography>
        </Paper>
      </Grid>
      <Grid item xs={6} sm={3}>
        <Paper sx={{ p: 2, borderLeft: 4, borderLeftColor: 'error.main' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <WarningIcon fontSize="small" sx={{ color: '#d32f2f' }} /> Unpaid Invoices
          </Typography>
          <Typography variant="h6" fontWeight={600}> {purchaseStats.unpaid_count || 0} </Typography>
        </Paper>
      </Grid>
    </>
  );
};

export default SalesPurchaseLedgerStats;