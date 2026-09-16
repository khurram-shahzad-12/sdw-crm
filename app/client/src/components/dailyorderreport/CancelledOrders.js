import React, { useState } from 'react';
import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Stack, IconButton, Tooltip, TextField } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { handleDataFieldPatchSubmit } from '../../components/formFunctions/FormFunctions';

const API_NAME = '/customerCancelledInvoicesDay';
const tableHeaderStyles = {
  bgcolor: 'primary.main',
  '& .MuiTableCell-root': {
    color: 'white',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
};
const money = (n) => `£${(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const CancelledOrders = ({ orders, cancelledCustomers, filterCustomers, filterOrders, setSnackState, fetchAll }) => {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const cancelledOrders = filterOrders(orders);
  const hasCancelledOrders = cancelledOrders.length > 0;
  const cancelledDayCustomers = filterCustomers(cancelledCustomers.filter(c => !cancelledOrders.some(o => o.customer?._id === c._id)));
  const hasCancelledDays = cancelledDayCustomers.length > 0;
  const startEdit = (customer) => { setEditingId(customer.recordId); setDraft(customer.remarks || "") };
  const cancelEdit = () => { setEditingId(null); setDraft(""); }
  const submitRemarks = (customer, value) => { handleDataFieldPatchSubmit(API_NAME, customer.recordId, { remarks: (value ?? '').trim() }, setSaving, setSnackState, () => { cancelEdit(); fetchAll?.() }) }
  if (!hasCancelledOrders && !hasCancelledDays) {
    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="body2" color="text.secondary"> No cancelled orders for this date </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      {hasCancelledDays && (
        <>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, mt: 3, color: 'error.main' }}>
            Cancelled Order Days ({cancelledDayCustomers.length})
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead sx={{ ...tableHeaderStyles, bgcolor: 'error.main' }}>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Customer Name</TableCell>
                  <TableCell>Cancellation Reason</TableCell>
                  <TableCell sx={{ minWidth: 320 }}>Final Remarks</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cancelledDayCustomers.map((customer, index) => {
                  const isEditing = editingId === customer.recordId;
                  const hasRemarks = !!(customer.remarks && customer.remarks.trim());
                  return (
                    <TableRow key={customer.recordId} hover>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{customer.name || 'Unknown'}</TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <WarningAmberIcon color="error" fontSize="small" />
                          <Typography variant="body2">{customer.reason || 'No reason provided'}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <TextField
                              size="small"
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              placeholder="Add final remarks..."
                              fullWidth
                              autoFocus
                              multiline
                              maxRows={3}
                              disabled={saving}
                            />
                            <Tooltip title="Save">
                              <span>
                                <IconButton color="primary" size="small" disabled={saving} onClick={() => submitRemarks(customer, draft)} >
                                  <SaveIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Cancel">
                              <span>
                                <IconButton size="small" disabled={saving} onClick={cancelEdit}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        ) : (
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            justifyContent="space-between" 
                            >
                            <Typography
                              variant="body2"
                              sx={{
                                flex: 1,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                color: hasRemarks ? 'text.primary' : 'text.secondary',
                                fontStyle: hasRemarks ? 'normal' : 'italic',
                              }}
                            >
                              {hasRemarks ? customer.remarks : 'No remarks added'}
                            </Typography>

                            <Stack direction="row" spacing={0.5}>
                              {hasRemarks && (
                                <Tooltip title="Clear remarks">
                                  <span>
                                    <IconButton size="small" color="error" disabled={saving} onClick={() => submitRemarks(customer, '')} >
                                      <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              )}
                              <Tooltip title={hasRemarks ? 'Edit remarks' : 'Add remarks'}>
                                <span>
                                  <IconButton size="small" color="primary" disabled={saving} onClick={() => startEdit(customer)} >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>)
                }
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
};

export default CancelledOrders;