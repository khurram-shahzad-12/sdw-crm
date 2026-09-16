import React from 'react';
import { Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Avatar, Tooltip, IconButton, Stack } from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';

const tableHeaderStyles = {
  bgcolor: 'primary.main',
  '& .MuiTableCell-root': {
    color: 'white',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
};
const money = (n) => `£${(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const StatusChip = ({ status, size = 'small' }) => (
  <Chip label="Confirmed" color="success" size={size}  variant="filled" />
);
const ConfirmedOrders = ({ orders, loading, selectedCustomer, formatDate, handleCompareOrder }) => {
  const filteredOrders = selectedCustomer ? orders.filter(o => o.customer?._id === selectedCustomer._id) : orders;
  if (!loading && filteredOrders.length === 0) {
    return (
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead sx={tableHeaderStyles}>
            <TableRow>
              <TableCell>Order #</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>OT Date</TableCell>
              <TableCell>Items</TableCell>
              <TableCell align="right">Total Value</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                <Typography variant="body2" color="text.secondary">
                  {loading ? 'Loading orders…' : 'No confirmed orders for this date'}
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    );
  }
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead sx={tableHeaderStyles}>
          <TableRow>
            <TableCell>Order #</TableCell>
            <TableCell>Customer</TableCell>
            <TableCell>OT Date</TableCell>
            <TableCell>Items</TableCell>
            <TableCell align="right">Total Value</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="center">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                <Typography variant="body2" color="text.secondary"> Loading orders… </Typography>
              </TableCell>
            </TableRow>
          ) : (
            filteredOrders.map((order) => (
              <TableRow key={order.sale_number || order._id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>
                    {order.sale_number || order._id?.toString().slice(-6)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Avatar sx={{ width: 26, height: 26, fontSize: '0.75rem', bgcolor: 'primary.main' }}>
                      {order.customer?.name?.charAt(0) || '?'}
                    </Avatar>
                    <Typography variant="body2">{order.customer?.name || 'Unknown'}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>{formatDate(order.invoice_date)}</TableCell>
                <TableCell>
                  <Tooltip title={order.items?.map((i) => `${i.name} (${i.quantity})`).join(', ') || ''}>
                    <Chip label={`${order.items?.length || 0} items`} size="small" variant="outlined" />
                  </Tooltip>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={600}> {money(order.balance_due)} </Typography>
                </TableCell>
                <TableCell>
                  <StatusChip status="CONFIRMED" />
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Compare with previous orders">
                    <IconButton 
                      color="primary" 
                      size="small" 
                      onClick={() => handleCompareOrder(order)}
                    >
                      <CompareArrowsIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
export default ConfirmedOrders;