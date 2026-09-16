import { Button, ButtonGroup, Tooltip } from '@mui/material';
import { Receipt as ReceiptIcon, Edit as EditIcon, CheckCircle as ApplyIcon, } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

export const CreditNoteActionCellRenderer = (params) => {
    const {hasPermission} = useAuth();
    const { PrintCreditInvoice, editCreditNote, applyCredit, requiredCreditEditPermissions, requiredApplyCreditPermissions } = params;
    const data = params.data;
    const canEdit = hasPermission(requiredCreditEditPermissions);
    const canApplyCredit = hasPermission(requiredApplyCreditPermissions);

    return (
        <ButtonGroup variant="outlined" size="small">
            <Tooltip title="Print Credit Invoice">
                <Button onClick={() => PrintCreditInvoice(data._id)} color='secondary'>
                    <ReceiptIcon fontSize="small" />
                </Button>
            </Tooltip>
            {canEdit && (
                <Tooltip title="Edit">
                    <Button onClick={() => editCreditNote(data)} color="primary">
                        <EditIcon fontSize="small" />
                    </Button>
                </Tooltip>
            )}
            {canApplyCredit && (
                <Tooltip title="Apply Credit">
                    <Button onClick={() => applyCredit(data._id)} color="success">
                        <ApplyIcon fontSize="small" />
                    </Button>
                </Tooltip>
            )}
        </ButtonGroup>
    );
};  