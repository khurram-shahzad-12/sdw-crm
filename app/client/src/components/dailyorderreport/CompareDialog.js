import React from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Paper, Typography, Chip, Stack, Box, Grid, Table, 
  TableBody, TableCell, TableContainer, TableHead, TableRow, Button, Divider
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import moment from 'moment';
const money = (n) => `£${(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const tableHeaderStyles = {
  bgcolor: 'primary.main',
  '& .MuiTableCell-root': {
    color: 'white',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
};
const darkPanelStyles = {
  bgcolor: 'grey.900',
  color: 'common.white',
  p: 2,
  borderRadius: 1,
};

const CompareDialog = ({ order, onClose, history = [], historyLoading = false }) => {
  if (!order) return null;

  const avgOrderValue = history.length ? history.reduce((sum, o) => sum + (o.balance_due || 0), 0) / history.length : order.balance_due || 0;
  const historyItemNames = new Set(history.flatMap((o) => o.items?.map((i) => i.name) || []));
  const currentItemNames = new Set(order.items?.map((i) => i.name) || []);
  const missingItems = [...historyItemNames].filter((n) => !currentItemNames.has(n));
  const diff = (order.balance_due || 0) - avgOrderValue;
  const formatDate = (date) => {
    if (!date) return '';
    return moment(date).format('MMM D, YYYY');
  };

  return (
    <Dialog open={Boolean(order)} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <CompareArrowsIcon color="primary" />
          <Typography variant="h6">Order Comparison</Typography>
          <Chip label={order.sale_number || order._id?.toString().slice(-6)} color="primary" size="small" />
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {historyLoading ? (
          <Typography>Loading history...</Typography>
        ) : (
          <>
            <Paper
              sx={{ ...darkPanelStyles, mb: 3, borderTop: 4, borderTopColor: 'primary.main',}} >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <PersonOutlineIcon fontSize="small" sx={{ color: 'grey.400' }} />
                <Typography variant="subtitle1">{order.customer?.name || 'Unknown'}</Typography>
              </Stack>
              <Stack direction="row" spacing={4} flexWrap="wrap">
                <Box>
                  <Typography variant="caption" sx={{ color: 'grey.400' }}>
                    Today's Order
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {money(order.balance_due)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'grey.400' }}>
                    Average (Last {history.length})
                  </Typography>
                  <Typography variant="h6" sx={{ color: 'grey.100' }}>
                    {money(avgOrderValue)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: 'grey.400' }}>
                    Difference
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      color: diff >= 0 ? 'success.light' : 'error.light',
                      fontWeight: 600,
                    }}
                  >
                    {diff >= 0 ? '+' : ''}{money(diff)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>Current Order Items</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={tableHeaderStyles}>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {order.items?.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell align="right">{money(item.total)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={2} align="right"><strong>Total</strong></TableCell>
                        <TableCell align="right"><strong>{money(order.balance_due)}</strong></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  <RemoveCircleOutlineIcon fontSize="small" color="error" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                  Missing vs. Previous Orders
                </Typography>
                {missingItems.length > 0 ? (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead sx={tableHeaderStyles}>
                        <TableRow>
                          <TableCell>Item Name</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {missingItems.map((name, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'success.50' }}>
                    <Typography variant="body2" color="success.main">
                      All previously ordered items are included in today's order.
                    </Typography>
                  </Paper>
                )}
              </Grid>

              {history.length > 0 && (
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle1" gutterBottom>Recent Orders — {order.customer?.name}</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead sx={tableHeaderStyles}>
                        <TableRow>
                          <TableCell>Order #</TableCell>
                          <TableCell>Date</TableCell>
                          <TableCell>Items</TableCell>
                          <TableCell align="right">Value</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {history.map((h) => (
                          <TableRow key={h.sale_number || h._id}>
                            <TableCell>{h.sale_number || h._id?.toString().slice(-6)}</TableCell>
                            <TableCell>{formatDate(h.invoice_date)}</TableCell>
                            <TableCell>{h.items?.length || 0} items</TableCell>
                            <TableCell align="right">{money(h.balance_due)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              )}
            </Grid>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
};
export default CompareDialog;