import React, { useEffect, useState } from "react";
import axiosDefault from "../../components/axiosDefault/axiosDefault";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import { Button, Dialog, TextField } from '@mui/material';
import DatePicker from "@mui/lab/DatePicker";
import moment from "moment";
import {
    defaultLoadedFieldData,
    defaultSnackState,
    fetchDropdownField,
    momentFormat,
    dateStringComparator,
    fetchEntries,
    getCreditNoteReportsInNewTab,
} from "../../components/formFunctions/FormFunctions";
import DataViewGrid from "../../components/DataViewGrid/DataViewGrid";
import CustomisedSnackBar from "../../components/customisedSnackBar/CustomisedSnackBar";
import displaySnackState from "../../components/customisedSnackBar/DisplaySnackState";
import DialogClosingTitleBar from "../../components/DialogClosingTitleBar/DialogClosingTitleBar";
import { PriceCellRenderer } from "../../components/cellRenderers/PriceCellRenderer";
import InvoiceForm from "../../components/InvoiceForm/InvoiceForm";
import { CreditNoteActionCellRenderer } from "../../components/cellRenderers/CreditNoteActionCellRenderer";
import ApplyCreditDialog from "../../components/CreditInvoice/ApplyCreditDialog";

const CreditNotes = props => {
    const axios = axiosDefault();
    const requiredCreditEditPermissions = process.env.REACT_APP_EDIT_CREDIT_NOTES_CLAIM;
    const requiredApplyCreditPermissions = process.env.REACT_APP_CREDIT_NOTES_APPLY_CLAIM;
    const [dialogState, setDialogState] = useState({ open: false });
    const [sendingData, setSendingData] = useState(false);
    const [creditNotesList, setCreditNotesList] = useState([]);
    const [customersList, setCustomersList] = useState(defaultLoadedFieldData);
    const [invoicesList, setInvoicesList] = useState(defaultLoadedFieldData);
    const [selectedCreditNotes, setSelectedCreditNotes] = useState([]);
    const [startDate, setStartDate] = useState(moment().subtract(30, 'days').format(momentFormat));
    const [endDate, setEndDate] = useState(moment().format(momentFormat));
    const [snackState, setSnackState] = useState(defaultSnackState);
    const [vatData, setVatData] = useState(defaultLoadedFieldData);
    const [productsList, setProductsList] = useState(defaultLoadedFieldData);
    const [applyCreditDialogOpen, setApplyCreditDialogOpen] = useState(false);
    const [selectedCreditNoteForApply, setSelectedCreditNotesForApply] = useState(null);
    const handleCloseDialog = () => setDialogState({ open: false });

    const getVatData = () => { fetchDropdownField("/vat", setVatData, setSnackState, false); };
    const getProductsData = () => { fetchDropdownField("/inventory", setProductsList, setSnackState, false); };
    const getCreditNotesList = () => {
        setSendingData(true);
        const params = { start_date: startDate, end_date: endDate };
        axios.get(`${process.env.REACT_APP_URL_ROOT}/api/creditnote`, { params })
            .then(response => { setCreditNotesList(response.data || []); }).catch(error => {
                displaySnackState(`Failed to load credit notes - ${error.response ? error.response.data : error.message}`, "error", setSnackState);
            }).finally(() => { setSendingData(false); });
    };

    const getCustomersData = () => { fetchDropdownField("/customer", setCustomersList, setSnackState, false); };
    const getInvoicesData = () => { fetchDropdownField("/invoice", setInvoicesList, setSnackState, false); };
    const handleDateChange = (newDate, dateType) => {
        const momentDate = moment(newDate).format(momentFormat);
        if (dateType === "start") {
            setStartDate(momentDate);
        } else {
            setEndDate(momentDate);
        }
    };
    const rowSelectionChanged = event => { setSelectedCreditNotes(event.api.getSelectedNodes().map(node => node.data._id)); };
    const PrintCreditInvoice = (creditNoteId) => { getCreditNoteReportsInNewTab([creditNoteId], "creditnote.pdf", setSnackState); };
    const printMultipleCreditNotes = () => { getCreditNoteReportsInNewTab(selectedCreditNotes, 'creditnote.pdf', setSnackState); }
    const editCreditNote = (creditNoteData) => {
        setDialogState({ open: true, mode: "EDIT", canEdit: true, creditNoteData: creditNoteData, selectedCustomer: customersList.map[creditNoteData.customer_id], isCreditNote: true, });
    };

    const postSubmitCallback = () => { getCreditNotesList(); setDialogState({ open: false }); };

    const applyCreditToInvoice = (creditNoteId) => {
        const creditNote = creditNotesList.find(cn => cn._id === creditNoteId);
        if (!creditNote) { displaySnackState("Credit note not found", "error", setSnackState); return; }
        if (creditNote.remaining_credit <= 0) { displaySnackState("This credit note has no remaining credit to apply", 'warning', setSnackState); return; }
        setSelectedCreditNotesForApply(creditNote)
        setApplyCreditDialogOpen(true);
    };

    const handleapplyCreditSuccess = (result) => {
        displaySnackState(`Successfully applied credit. Remaining: £${result.remaining_credit.toFixed(2)}`, 'success', setSnackState);
        getCreditNotesList();
    }

    const getCustomerNameFromID = (params) => {
        if (!customersList.loaded) { return "Loading..."; }
        try {
            return customersList.map[params.data.customer_id]?.customer_name || "Unknown";
        } catch (err) {
            return `Mapping missing for ${params.data.customer_id}`;
        }
    };

    const getOriginalInvoiceNumber = (params) => { return params.data.original_invoice_number || "N/A"; };

    const getStatusWithColor = (status) => {
        const statusMap = {
            'PENDING': { color: '#FFA500', label: 'Pending' },
            'APPLIED': { color: '#4CAF50', label: 'Applied' },
            'PARTIALLY_APPLIED': { color: '#2196F3', label: 'Partially Applied' },
        };
        return statusMap[status] || { color: '#757575', label: status };
    };


    const creditNotesColDef = [
        {
            headerName: "#",
            width: 50,
            resizable: false,
            filter: false,
            floatingFilter: false,
            valueGetter: params => params.node.rowIndex + 1
        },
        {
            headerName: "Credit Note #",
            width: 130,
            resizable: false,
            field: "credit_note_number",
            cellStyle: { fontWeight: 'bold' }
        },
        {
            headerName: "Customer",
            field: "customer_id",
            valueGetter: getCustomerNameFromID,
            width: 200
        },
        {
            headerName: "Original Invoice",
            field: "original_invoice_number",
            valueGetter: getOriginalInvoiceNumber,
            width: 130
        },
        {
            headerName: "Total Amount",
            field: "total_credit_amount",
            type: "rightAligned",
            valueGetter: PriceCellRenderer,
            width: 130,
            cellStyle: { fontWeight: 'bold' }
        },
        {
            headerName: "Remaining",
            field: "remaining_credit",
            type: "rightAligned",
            valueGetter: PriceCellRenderer,
            width: 130,
            cellStyle: {
                fontWeight: 'bold',
                color: params => params.value > 0 ? '#2196F3' : '#4CAF50'
            }
        },
        {
            headerName: "Status",
            field: "status",
            width: 140,
            cellRenderer: (params) => {
                const status = getStatusWithColor(params.value);
                return React.createElement('span', {
                    style: {
                        color: status.color,
                        fontWeight: 'bold',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: status.color + '20'
                    }
                }, status.label);
            }
        },
        {
            headerName: "Reason",
            field: "reason_description",
            width: 140,
            filter: 'agTextColumnFilter',
            floatingFilter: true,
            valueGetter: (params) => params.data?.reason_description || 'N/A'
        },
        {
            headerName: "Created Date",
            width: 150,
            field: "created_at",
            valueGetter: params => moment(params.data.created_at).format("DD/MM/YYYY HH:mm"),
            comparator: dateStringComparator
        },
        {
            headerName: "Created By",
            field: "created_by",
            width: 130
        },
        {
            headerName: "Actions",
            field: "_id",
            filter: false,
            width: 200,
            cellRenderer: CreditNoteActionCellRenderer,
            cellRendererParams: {
                PrintCreditInvoice: PrintCreditInvoice,
                editCreditNote: editCreditNote,
                applyCredit: applyCreditToInvoice,
                requiredCreditEditPermissions: requiredCreditEditPermissions,
                requiredApplyCreditPermissions: requiredApplyCreditPermissions
            }
        },
        {
            headerName: "",
            checkboxSelection: true,
            headerCheckboxSelection: true,
            headerCheckboxSelectionFilteredOnly: true,
            filter: false,
            minWidth: 90,
            maxWidth: 90
        }
    ];

    // Fetch all initial data
    const fetchAllData = () => {
        getCustomersData();
        getInvoicesData();
        getCreditNotesList();
        getVatData();
        getProductsData();
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        getCreditNotesList();
        setSelectedCreditNotes([]);
    }, [startDate, endDate]);

    const getSelectedCount = () => {
        return selectedCreditNotes.length > 0 ? `(${selectedCreditNotes.length})` : "";
    };

    return (
        <div style={{ width: "100%", height: "90%" }}>
            <CustomisedSnackBar {...snackState} setClosed={setSnackState} />
            <ApplyCreditDialog
                open={applyCreditDialogOpen}
                creditNote={selectedCreditNoteForApply}
                customersList={customersList}
                onClose={() => {
                    setApplyCreditDialogOpen(false);
                    setSelectedCreditNotesForApply(null);
                }}
                onSuccess={handleapplyCreditSuccess}
            />
            <Dialog open={dialogState.open} onClose={handleCloseDialog} fullScreen>
                <DialogClosingTitleBar
                    title={`${dialogState.mode || 'VIEW'} CREDIT NOTE`}
                    handleClose={handleCloseDialog}
                />
                {dialogState.open && (
                    <InvoiceForm
                        dialogDetails={dialogState}
                        customersList={customersList}
                        invoicesList={invoicesList}
                        productsList={productsList}
                        vatData={vatData}
                        postSubmitCallback={postSubmitCallback}
                        collection_invoice={false}
                    />
                )}
            </Dialog>
            <Card sx={{ width: "95%", marginLeft: "2.5%" }}>
                <CardContent>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <span>From</span>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                                label="Start Date"
                                value={startDate}
                                onChange={newDate => handleDateChange(newDate, "start")}
                                inputFormat="dd/MM/yyyy"
                                renderInput={(params) => <TextField {...params} size="small" />}
                            />
                        </LocalizationProvider>
                        <span>To</span>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <DatePicker
                                label="End Date"
                                value={endDate}
                                onChange={newDate => handleDateChange(newDate, "end")}
                                inputFormat="dd/MM/yyyy"
                                renderInput={(params) => <TextField {...params} size="small" />}
                            />
                        </LocalizationProvider>
                        <Button variant="contained" onClick={fetchAllData}>Reload</Button>
                        <Button
                            variant="contained"
                            disabled={selectedCreditNotes.length === 0}
                            onClick={() => {
                                printMultipleCreditNotes(selectedCreditNotes);
                            }}
                        >
                            Print Credit Note(s) {getSelectedCount()}
                        </Button>
                    </div>
                </CardContent>
            </Card>
            <div style={{ height: "75%" }}>
                <DataViewGrid
                    rowData={creditNotesList}
                    columnDefs={creditNotesColDef}
                    loading={!customersList.loaded || sendingData}
                    agGridProps={{
                        rowSelection: "multiple",
                        suppressRowClickSelection: true,
                        checkboxSelection: true,
                        onSelectionChanged: rowSelectionChanged,
                        pagination: true,
                        paginationPageSize: 50,
                        enableCellTextSelection: true,
                        ensureDomOrder: true
                    }}
                />
            </div>
        </div>
    );
};

export default CreditNotes;