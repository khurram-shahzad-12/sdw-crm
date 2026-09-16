import React from 'react';
import { Box, Grid, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Avatar, Stack } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import PendingOutlinedIcon from '@mui/icons-material/PendingOutlined';
import PeopleIcon from '@mui/icons-material/People';
import StatCard from './StatCard';

const tableHeaderStyles = {
    bgcolor: 'primary.main',
    '& .MuiTableCell-root': {
        color: 'white',
        fontWeight: 600,
        whiteSpace: 'nowrap',
    },
};
const ExpectedOrders = ({ expectedCustomers, confirmedCustomers, pendingCustomers, cancelledExpectedCustomers, cancelledCustomers, orders, loading, filterCustomers }) => {
    const allExpected = filterCustomers(expectedCustomers || []);
    const filteredConfirmed = allExpected.filter(c => confirmedCustomers.some(conf => conf._id === c._id));
    const filteredPending = allExpected.filter(c => pendingCustomers.some(pend => pend._id === c._id));
    const filteredCancelled = allExpected.filter(c => cancelledExpectedCustomers.some(canc => canc._id === c._id));

    return (
        <Box>
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={3}>
                    <StatCard
                        label="Total Expected"
                        value={allExpected.length}
                        color="grey.500"
                        icon={<PeopleIcon fontSize="small" />}
                    />
                </Grid>
                <Grid item xs={12} sm={3}>
                    <StatCard
                        label="Confirmed"
                        value={filteredConfirmed.length}
                        color="success.main"
                        icon={<CheckCircleOutlineIcon fontSize="small" />}
                    />
                </Grid>
                <Grid item xs={12} sm={3}>
                    <StatCard
                        label="Pending"
                        value={filteredPending.length}
                        color="warning.main"
                        icon={<PendingOutlinedIcon fontSize="small" />}
                    />
                </Grid>
                <Grid item xs={12} sm={3}>
                    <StatCard
                        label="Cancelled"
                        value={filteredCancelled.length}
                        color="error.main"
                        icon={<CancelOutlinedIcon fontSize="small" />}
                    />
                </Grid>
            </Grid>
            <Typography variant="h6" sx={{ mb: 2, mt: 2 }}> Expected Orders Today ({allExpected.length} customers) </Typography>
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
                                    <Typography variant="body2" color="text.secondary"> Loading expected customers… </Typography>
                                </TableCell>
                            </TableRow>
                        ) : allExpected.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                                    <Typography variant="body2" color="text.secondary"> No expected customers for today </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            allExpected.map((customer, index) => {
                                const isCancelled = cancelledCustomers.some(c => c._id === customer._id);
                                const hasOrder = orders.some(o => o.customer?._id === customer._id);
                                let statusLabel = 'PENDING';
                                let statusColor = 'warning';
                                let statusIcon = <PendingOutlinedIcon fontSize="small" />;
                                if (isCancelled) {
                                    statusLabel = 'CANCELLED';
                                    statusColor = 'error';
                                    statusIcon = <CancelOutlinedIcon fontSize="small" />;
                                } else if (hasOrder) {
                                    statusLabel = 'CONFIRMED';
                                    statusColor = 'success';
                                    statusIcon = <CheckCircleOutlineIcon fontSize="small" />;
                                }
                                return (
                                    <TableRow key={customer._id} hover>
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Avatar sx={{ width: 26, height: 26, fontSize: '0.75rem', bgcolor: 'primary.main' }}> {customer.name?.charAt(0) || '?'} </Avatar>
                                                <Typography variant="body2">{customer.name}</Typography>
                                                {customer.isTemporary && (
                                                    <Chip label="Temporary" size="small" color="warning" />
                                                )}
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={statusLabel}
                                                color={statusColor}
                                                size="small"
                                                icon={statusIcon}
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default ExpectedOrders;