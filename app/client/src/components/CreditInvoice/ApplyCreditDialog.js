import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Card, CardContent, Autocomplete, Grid, Chip, Divider, Alert, CircularProgress, Typography, Box } from '@mui/material';
import { CheckCircle as CheckCircleIcon, Cancel as CancelIcon, Payment as PaymentIcon } from '@mui/icons-material';
import moment from 'moment';
import axiosDefault from '../axiosDefault/axiosDefault';
import displaySnackState from '../customisedSnackBar/DisplaySnackState';
import { defaultSnackState } from '../formFunctions/FormFunctions';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import TableHead from '@mui/material/TableHead';
import { useAuth } from '../../contexts/AuthContext';

const ApplyCreditDialog = ({ open, creditNote, customersList, onClose, onSuccess }) => {
    const {user} = useAuth();
    const axios = axiosDefault();
    const [loading, setLoading] = useState(false);
    const [invoices, setInvoices] = useState([]);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [amountToApply, setAmountToApply] = useState(0);
    const [remainingCredit, setRemainingCredit] = useState(0);
    const [applying, setApplying] = useState(false);
    const [snackState, setSnackState] = useState(defaultSnackState);

    useEffect(() => {
        if (open && creditNote) {
            setRemainingCredit(creditNote.remaining_credit || 0);
            setSelectedInvoice(null);
            setAmountToApply(0);
            fetchCustomerInvoices(creditNote.customer_id);
        }
    }, [open, creditNote]);

    const fetchCustomerInvoices = (customerId) => {
        setLoading(true);
        axios.get(`${process.env.REACT_APP_URL_ROOT}/api/invoice/getUnpaidInvoices/${customerId}`).then(response => {
            setInvoices(response.data || []);
        })
            .catch(error => {
                console.error('Error fetching invoices:', error);
                displaySnackState('Failed to load unpaid invoices', 'error', setSnackState);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    const calculateTotalPayments = (invoice) => {
        if (!invoice || !invoice.payments || !Array.isArray(invoice.payments)) { return 0; }
        return invoice.payments.reduce((total, payment) => {
        return total + (payment.amount || 0); }, 0);
    };

    const calculateInvoiceBalance = (invoice) => {
        if (!invoice) return 0;
        const total = invoice.total_incl_vat || 0;
        const totalPayments = calculateTotalPayments(invoice);
        return total - totalPayments;
    };

    const handleInvoiceSelect = (event, newValue) => {
        setSelectedInvoice(newValue);
        if (newValue) {
            const invoiceBalance = calculateInvoiceBalance(newValue);
            const suggestedAmount = Math.min(remainingCredit, invoiceBalance);
            setAmountToApply(suggestedAmount);
        } else { setAmountToApply(0); }
    };

    const handleAmountChange = (event) => {
        const value = parseFloat(event.target.value) || 0;
        const maxAmount = Math.min(remainingCredit, selectedInvoice ? calculateInvoiceBalance(selectedInvoice) : 0);
        setAmountToApply(Math.min(value, maxAmount));
    };

    const handleApplyCredit = () => {
        if (!selectedInvoice) { displaySnackState('Please select an invoice', 'warning', setSnackState); return; }
        if (amountToApply <= 0) { displaySnackState('Please enter an amount to apply', 'warning', setSnackState); return; }
        if (amountToApply > remainingCredit) {
            displaySnackState(`Amount exceeds remaining credit of £${remainingCredit.toFixed(2)}`, 'warning', setSnackState);
            return;
        }
        const maxInvoiceBalance = calculateInvoiceBalance(selectedInvoice);
        if (amountToApply > maxInvoiceBalance) {
            displaySnackState(`Amount exceeds invoice balance of £${maxInvoiceBalance.toFixed(2)}`, 'warning', setSnackState);
            return;
        }
        setApplying(true);
        const payload = { creditNoteId: creditNote._id, invoiceId: selectedInvoice._id, amount: amountToApply, appliedBy: user.user_name?? 'system' };
        axios.post(`${process.env.REACT_APP_URL_ROOT}/api/creditnote/apply-credit`, payload)
            .then(response => {
                displaySnackState(`Successfully applied £${amountToApply.toFixed(2)} to invoice #${selectedInvoice.sale_number}`, 'success', setSnackState);
                if (onSuccess) { onSuccess(response.data); }
                onClose();
            })
            .catch(error => {
                console.error('Error applying credit:', error);
                displaySnackState(`Failed to apply credit - ${error.response?.data?.error || error.response?.data?.message || error.message}`, 'error', setSnackState);
            })
            .finally(() => { setApplying(false); });
    };

    const getInvoiceLabel = (invoice) => {
        if (!invoice) return '';
        const balance = calculateInvoiceBalance(invoice);
        return `#${invoice.sale_number} - £${balance.toFixed(2)} - ${moment(invoice.invoice_date).format('DD/MM/YYYY')}`;
    };

    const formatCurrency = (amount) => { return `£${(amount || 0).toFixed(2)}`; };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{ sx: { minHeight: '60vh' }}}
        >
            <DialogTitle>
                <Box display="flex" alignItems="center" gap={1}>
                    <PaymentIcon color="primary" />
                    <Typography variant="h6"> Apply Credit to Invoice </Typography>
                </Box>
            </DialogTitle>
            <DialogContent dividers>
                {creditNote && (
                    <Card sx={{ mb: 3, bgcolor: '#272219' }}>
                        <CardContent>
                            <Typography variant="subtitle2" color="textSecondary" gutterBottom> Credit Note Details </Typography>
                            <Table size="small" sx={{
                                '& .MuiTableCell-root': {
                                    borderColor: 'rgba(255, 255, 255, 0.12)',
                                    color: 'text.primary',
                                    padding: '8px 8px',
                                    textAlign: 'center'
                                }
                            }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}> Credit Note # </TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}> Customer </TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}> Total Credit </TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}> Remaining </TableCell>
                                        <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary' }}> Status </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    <TableRow>
                                        <TableCell> {creditNote.credit_note_number} </TableCell>
                                        <TableCell> {creditNote.customer_name} </TableCell>
                                        <TableCell> {formatCurrency(creditNote.total_credit_amount)} </TableCell>
                                        <TableCell sx={{ color: remainingCredit > 0 ? '#2196F3' : '#4CAF50' }}> {formatCurrency(remainingCredit)} </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={creditNote.status}
                                                size="small"
                                                color={creditNote.status === 'PENDING' ? 'warning' : 'info'}
                                                sx={{ ml: 0 }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
                <Divider sx={{ my: 2 }} />
                {loading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                        <CircularProgress />
                        <Typography sx={{ ml: 2 }}>Loading invoices...</Typography>
                    </Box>
                ) : invoices.length === 0 ? (
                    <Alert severity="info" sx={{ mt: 2 }}> No unpaid invoices found for this customer. </Alert>
                ) : (
                    <>
                        <Typography variant="subtitle1" gutterBottom>
                            Select Invoice to Apply Credit
                        </Typography>
                        <Autocomplete
                            options={invoices}
                            getOptionLabel={(option) => getInvoiceLabel(option)}
                            onChange={handleInvoiceSelect}
                            value={selectedInvoice}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Select Invoice"
                                    placeholder="Search by invoice number..."
                                    fullWidth
                                    size="small"
                                />
                            )}
                            isOptionEqualToValue={(option, value) => option._id === value?._id}
                            renderOption={(props, option) => {
                                const balance = calculateInvoiceBalance(option);
                                return (
                                    <li {...props}>
                                        <Box display="flex" justifyContent="space-between" width="100%">
                                            <span>#{option.sale_number}</span>
                                            <span>{moment(option.invoice_date).format('DD/MM/YYYY')}</span>
                                            <span style={{ fontWeight: 'bold' }}>
                                                Balance: {formatCurrency(balance)}
                                            </span>
                                        </Box>
                                    </li>
                                );
                            }}
                        />
                        {selectedInvoice && (
                            <Card sx={{ mt: 2, bgcolor: '#272219' }}>
                                <CardContent>
                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <Typography variant="body2">
                                                <strong>Invoice #:</strong> {selectedInvoice.sale_number}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="body2">
                                                <strong>Date:</strong> {moment(selectedInvoice.invoice_date).format('DD/MM/YYYY')}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="body2">
                                                <strong>Invoice Total:</strong> {formatCurrency(selectedInvoice.total_incl_vat)}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="body2">
                                                <strong>Total Payments:</strong> {formatCurrency(calculateTotalPayments(selectedInvoice))}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12}>
                                            <Typography variant="body2" sx={{ color: '#4CAF50' }}>
                                                <strong>Balance Due:</strong> {formatCurrency(calculateInvoiceBalance(selectedInvoice))}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>
                        )}
                        {selectedInvoice && (
                            <>
                                <Divider sx={{ my: 2 }} />
                                <Typography variant="subtitle1" gutterBottom>
                                    Enter Amount to Apply
                                </Typography>
                                <Grid container spacing={2} alignItems="center">
                                    <Grid item xs={6}>
                                        <TextField
                                            label="Amount to Apply"
                                            type="number"
                                            value={amountToApply}
                                            onChange={handleAmountChange}
                                            fullWidth
                                            size="small"
                                            InputProps={{
                                                startAdornment: <span style={{ marginRight: '8px' }}>£</span>,
                                            }}
                                            inputProps={{
                                                min: 0,
                                                max: Math.min(remainingCredit, calculateInvoiceBalance(selectedInvoice)),
                                                step: 0.01
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Box display="flex" flexDirection="column" gap={1}>
                                            <Typography variant="caption" color="textSecondary">
                                                Max available: {formatCurrency(Math.min(remainingCredit, calculateInvoiceBalance(selectedInvoice)))}
                                            </Typography>
                                            <Box display="flex" gap={1}>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() => {
                                                        const maxAmount = Math.min(remainingCredit, calculateInvoiceBalance(selectedInvoice));
                                                        setAmountToApply(maxAmount);
                                                    }}
                                                >
                                                    Apply Full Balance
                                                </Button>
                                            </Box>
                                        </Box>
                                    </Grid>
                                </Grid>
                                <Card sx={{ mt: 2, bgcolor: '#272219' }}>
                                    <CardContent>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Summary
                                        </Typography>
                                        <Grid container spacing={1}>
                                            <Grid item xs={6}>
                                                <Typography variant="body2">
                                                    Amount to Apply: <strong>{formatCurrency(amountToApply)}</strong>
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Typography variant="body2" sx={{ color: '#2196F3' }}>
                                                    Remaining Credit: <strong>{formatCurrency(remainingCredit - amountToApply)}</strong>
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12}>
                                                <Typography variant="caption" color="textSecondary">
                                                    {amountToApply > 0 && selectedInvoice &&
                                                        `After applying, invoice balance will be ${formatCurrency(calculateInvoiceBalance(selectedInvoice) - amountToApply)}`
                                                    }
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </>
                )}
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
                <Button
                    onClick={onClose}
                    variant="outlined"
                    color="secondary"
                    disabled={applying}
                    startIcon={<CancelIcon />}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleApplyCredit}
                    variant="contained"
                    color="primary"
                    disabled={!selectedInvoice || amountToApply <= 0 || applying || loading}
                    startIcon={applying ? <CircularProgress size={20} /> : <CheckCircleIcon />}
                >
                    {applying ? 'Applying...' : 'Apply Credit'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ApplyCreditDialog;