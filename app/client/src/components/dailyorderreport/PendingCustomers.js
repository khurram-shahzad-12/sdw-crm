import React from 'react';
import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Avatar, Stack } from '@mui/material';
import PendingOutlinedIcon from '@mui/icons-material/PendingOutlined';

const tableHeaderStyles = {
  bgcolor: 'primary.main',
  '& .MuiTableCell-root': {
    color: 'white',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
};
const PendingCustomers = ({ pendingCustomers, loading, filterCustomers }) => {
  const filteredPending = filterCustomers(pendingCustomers);
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, mt: 2 }}> Pending Orders ({filteredPending.length} customers) </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        These customers were expected to place an order today but haven't placed one yet
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table>
          <TableHead sx={tableHeaderStyles}>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Customer Name</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 5 }}>
                  <Typography variant="body2" color="text.secondary"> Loading pending customers… </Typography>
                </TableCell>
              </TableRow>
            ) : filteredPending.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 5 }}>
                  <Typography variant="body2" color="text.secondary">
                    No pending customers for today
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredPending.map((customer, index) => (
                <TableRow key={customer._id} hover>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Avatar sx={{ width: 26, height: 26, fontSize: '0.75rem', bgcolor: 'warning.main' }}>
                        {customer.name?.charAt(0) || '?'}
                      </Avatar>
                      <Typography variant="body2">{customer.name}</Typography>
                      {customer.isTemporary && ( <Chip label="Temporary" size="small" color="warning" /> )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label="PENDING" 
                      color="warning" 
                      size="small" 
                      icon={<PendingOutlinedIcon fontSize="small" />}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
export default PendingCustomers;