import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Grid, Paper, Typography, Tab, Button, TextField, Chip, Stack, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete, InputAdornment } from '@mui/material';
import { TabList, TabContext, TabPanel } from '@mui/lab';
import DatePicker from '@mui/lab/DatePicker';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptIcon from '@mui/icons-material/Receipt';
import moment from 'moment';
import axiosDefault from '../../components/axiosDefault/axiosDefault';
import displaySnackState from '../../components/customisedSnackBar/DisplaySnackState';
import CustomisedSnackBar from '../../components/customisedSnackBar/CustomisedSnackBar';
import DataViewGrid from '../../components/DataViewGrid/DataViewGrid';
import { PriceCellRenderer } from '../../components/cellRenderers/PriceCellRenderer';
import { stringValueToNumberComparator } from '../../components/formFunctions/FormFunctions';
import { getSalesLedgerReportsInNewTab, getPurchaseLedgerReportsInNewTab } from '../../components/formFunctions/FormFunctions';
import SalesPurchaseLedgerStats from '../../components/SalesPurchaseLedger/SalesPurchaseLedgerStats';
import SelectedSummary from '../../components/SalesPurchaseLedger/SelectedSummary';

const TABS = [{ value: '0', label: 'Sales Ledger' }, { value: '1', label: 'Purchase Ledger' },];
const money = (n) => `£${(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const METHOD_COLORS = {
  'Cash': '#4CAF50',
  'Bank Transfer': '#2196F3',
  'Credit Card': '#FF9800',
  'Debit Card': '#9C27B0',
  'Cheque': '#795548',
  'Online Payment': '#00BCD4',
  'Not Specified': '#9E9E9E'
};
const chipRowSx = {
  display: 'flex',
  flexWrap: 'nowrap',
  alignItems: 'center',
  height: '100%',
  overflowX: 'auto',
  overflowY: 'hidden',
  gap: '4px',
  '&::-webkit-scrollbar': { height: '4px' },
  '&::-webkit-scrollbar-thumb': { bgcolor: '#555', borderRadius: '2px' },
  '&::-webkit-scrollbar-track': { bgcolor: 'transparent' }
};

const SalesPurchaseLedger = () => {
  const axios = axiosDefault();
  const [tabValue, setTabValue] = useState('0');
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(1)));
  const [endDate, setEndDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [snackState, setSnackState] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [gridApi, setGridApi] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [purchaseData, setPurchaseData] = useState([]);
  const [salesStats, setSalesStats] = useState({ total_sales: 0, total_value: 0, total_outstanding: 0, unpaid_count: 0 });
  const [purchaseStats, setPurchaseStats] = useState({ total_purchases: 0, total_spend: 0, total_outstanding: 0, unpaid_count: 0 });
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false); 
  const isInitialMount = useRef(true);
  const isFetching = useRef(false);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setSelectedIds([]);
  };
  const formatDateForAPI = (date) => {
    if (!date) return '';
    return moment(date).format('YYYY-MM-DD');
  };
  const fetchSalesLedger = useCallback(async () => {
    if (isFetching.current) return;
    isFetching.current = true;
    setLoading(true);
    try {
      const params = { startDate: formatDateForAPI(startDate), endDate: formatDateForAPI(endDate) };
      if (selectedCustomer?._id) { params.customer_id = selectedCustomer._id; }
      const response = await axios.get(`${process.env.REACT_APP_URL_ROOT}/api/sale_purchase_ledger/sales-ledger`, { params });
      if (response.data.success) {
        const data = response.data.data;
        setSalesData(data.sales || []);
        setSalesStats(data.stats || { total_sales: 0, total_value: 0, total_outstanding: 0, unpaid_count: 0 });
        setCustomers(data.customers || []);
        displaySnackState('Sales ledger loaded successfully', 'success', setSnackState);
      } else {
        displaySnackState('Failed to load sales ledger', 'error', setSnackState);
      }
    } catch (error) {
      displaySnackState(`Failed to load sales ledger - ${error.response?.data?.message || error.message}`, 'error', setSnackState);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [axios, startDate, endDate, selectedCustomer]);

  const fetchPurchaseLedger = useCallback(async () => {
    if (isFetching.current) return;
    isFetching.current = true;
    setLoading(true);
    try {
      const params = { startDate: formatDateForAPI(startDate), endDate: formatDateForAPI(endDate) };
      if (selectedSupplier?._id) { params.supplier_id = selectedSupplier._id; }
      const response = await axios.get(`${process.env.REACT_APP_URL_ROOT}/api/sale_purchase_ledger/purchase-ledger`, { params });
      if (response.data.success) {
        const data = response.data.data;
        setPurchaseData(data.purchases || []);
        setPurchaseStats(data.stats || { total_purchases: 0, total_spend: 0, total_outstanding: 0, unpaid_count: 0 });
        setSuppliers(data.suppliers || []);
        displaySnackState('Purchase ledger loaded successfully', 'success', setSnackState);
      } else {
        displaySnackState('Failed to load purchase ledger', 'error', setSnackState);
      }
    } catch (error) {
      displaySnackState(`Failed to load purchase ledger - ${error.response?.data?.message || error.message}`, 'error', setSnackState);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [axios, startDate, endDate, selectedSupplier]);

  const handleReload = () => {
    if (tabValue === '0') { fetchSalesLedger(); } else { fetchPurchaseLedger(); }
  };
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchSalesLedger();
    }
  }, []);
  useEffect(() => {
    if (isInitialMount.current) return;
    setSelectedIds([]);
    if (tabValue === '0') {
      fetchSalesLedger();
    } else { fetchPurchaseLedger(); }
  }, [startDate, endDate, tabValue]);

  useEffect(() => {
    if (isInitialMount.current) return;
    setSelectedIds([]);
    if (tabValue === '0') {
      fetchSalesLedger();
    } else { fetchPurchaseLedger(); }
  }, [selectedCustomer, selectedSupplier]);

  const formatDateDisplay = (date) => {
    if (!date) return '-';
    return moment(date).format('DD/MM/YYYY');
  };

  const getPaymentMethods = (payments) => {
    if (!payments || payments.length === 0) return [{ type: 'Not Paid', amount: 0 }];
    return payments.map(p => ({
      type: p.type || 'Not Specified',
      amount: p.amount || 0
    }));
  };

  const getSelectedData = () => {
    const currentData = tabValue === '0' ? salesData : purchaseData;
    return currentData.filter(item => selectedIds.includes(item._id));
  };

  const rowSelectionChanged = (event) => { setSelectedIds(event.api.getSelectedNodes().map(node => node.data._id)); };
  const handleGeneratePDF = async () => {
    if (selectedIds.length === 0) { displaySnackState('Please select at least one invoice', 'warning', setSnackState); return; }
    setIsPdfLoading(true);
    try {
      const currentData = tabValue === '0' ? salesData : purchaseData;
      const selectedData = currentData.filter(item => selectedIds.includes(item._id));
      const ids = selectedData.map(item => item._id);
      const startDateFormatted = formatDateForAPI(startDate);
      const endDateFormatted = formatDateForAPI(endDate);
      if (tabValue === '0') {
        await getSalesLedgerReportsInNewTab(ids, startDateFormatted, endDateFormatted, setSnackState);
      } else {await getPurchaseLedgerReportsInNewTab(ids, startDateFormatted, endDateFormatted, setSnackState); }
    } catch (error) {
      displaySnackState('Failed to load ledger pdf', 'error', setSnackState)
    } finally {setIsPdfLoading(false);}
  };

  const handleSinglePDF = (id) => {
    const startDateFormatted = formatDateForAPI(startDate);
    const endDateFormatted = formatDateForAPI(endDate);
    if (tabValue === '0') {
      getSalesLedgerReportsInNewTab([id], startDateFormatted, endDateFormatted, setSnackState);
    } else { getPurchaseLedgerReportsInNewTab([id], startDateFormatted, endDateFormatted, setSnackState); }
  };

  const getPaymentMethodsDisplay = (params) => {
    const payments = params.data?.payments || [];
    if (!payments || payments.length === 0) { return <Chip label="Not Paid" size="small" sx={{ bgcolor: '#f44336', color: '#fff', fontWeight: 'bold', fontSize: '11px', height: '24px' }} />; }
    return (
      <Box sx={chipRowSx}>
        {payments.map((p, index) => {
          const color = METHOD_COLORS[p.type] || '#607D8B';
          return (
            <Chip
              key={index}
              label={`${p.type || 'Not Specified'}: ${money(p.amount || 0)}`}
              size="small"
              sx={{ bgcolor: color, color: '#fff', fontWeight: 'bold', fontSize: '11px', height: '24px', flexShrink: 0 }}
            />
          );
        })}
      </Box>
    );
  };

  const salesColDefs = [
    {
      headerName: "",
      checkboxSelection: true,
      headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      filter: false,
      minWidth: 60,
      maxWidth: 60
    },
    {
      headerName: "Invoice No",
      field: "sale_number",
      width: 120,
      filter: 'agTextColumnFilter',
      floatingFilter: true,
      valueGetter: (params) => params.data?.sale_number || 'N/A'
    },
    {
      headerName: "Customer Name",
      field: "customer_name",
      width: 180,
      filter: 'agTextColumnFilter',
      floatingFilter: true,
      valueGetter: (params) => params.data?.customer?.name || 'Unknown'
    },
    {
      headerName: "Date",
      field: "invoice_date",
      width: 120,
      filter: 'agTextColumnFilter',
      floatingFilter: true,
      valueGetter: (params) => formatDateDisplay(params.data?.invoice_date),
    },
    {
      headerName: "Total Amount",
      field: "total_incl_vat",
      width: 130,
      type: "rightAligned",
      filter: 'agNumberColumnFilter',
      floatingFilter: true,
      valueGetter: (params) => params.data?.total_incl_vat || 0,
      valueFormatter: (params) => money(params.value)
    },
    {
      headerName: "Payment Methods",
      field: "payment_methods",
      width: 280,
      filter: 'agTextColumnFilter',
      floatingFilter: true,
      valueGetter: (params) => {
        const payments = params.data?.payments || [];
        if (payments.length === 0) return 'Not Paid';
        return payments.map(p => `${p.type}: ${money(p.amount)}`).join(', ');
      },
      cellRenderer: getPaymentMethodsDisplay,
      cellStyle: { display: 'flex', alignItems: 'center', overflow: 'hidden', padding: '0 8px' }
    },
    {
      headerName: "Paid",
      field: "total_paid",
      width: 120,
      type: "rightAligned",
      filter: 'agNumberColumnFilter',
      floatingFilter: true,
      valueGetter: (params) => params.data?.total_paid || 0,
      valueFormatter: (params) => money(params.value),
    },
    {
      headerName: "Outstanding",
      field: "balance_due",
      width: 130,
      type: "rightAligned",
      filter: 'agNumberColumnFilter',
      floatingFilter: true,
      valueGetter: (params) =>  params.data?.balance_due || 0,
      valueFormatter: (params) => money(params.value),
      cellStyle: (params) => {
        const value = params.data?.balance_due || 0;
        return { color: value > 0 ? 'red' : 'green', fontWeight: 'bold' };
      }
    },
  {
  headerName: "Status",
  field: "status",
  width: 120,
  filter: 'agTextColumnFilter',
  floatingFilter: true,
  filterParams: {filterOptions:['equals'], defaultOption:'equals',trimInput: true, caseSensitive: false},
  valueGetter: (params) => (params.data?.status || 'UNPAID').toUpperCase(),
  cellRenderer: (params) => {
    const status = params.value || 'UNPAID'; // now always uppercase
    const color = status === 'PAID' ? 'success' : status === 'PARTIAL' ? 'warning' : 'error';
    return <Chip label={status} size="small" color={color} />;
  }
},
    {
      headerName: "Action",
      field: "_id",
      width: 80,
      filter: false,
      floatingFilter: false,
      cellRenderer: (params) => (
        <Tooltip title="View/Print PDF">
          <IconButton
            color="primary"
            size="small"
            onClick={() => handleSinglePDF(params.data._id)}
          >
            <ReceiptIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )
    }
  ];

  const purchaseColDefs = [
    {
      headerName: "",
      checkboxSelection: true,
      headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      filter: false,
      minWidth: 60,
      maxWidth: 60
    },
    {
      headerName: "Invoice No",
      field: "invoice_number",
      width: 120,
      filter: 'agTextColumnFilter',
      floatingFilter: true,
      valueGetter: (params) => params.data?.invoice_number || 'N/A'
    },
    {
      headerName: "Supplier Name",
      field: "supplier_name",
      width: 180,
      filter: 'agTextColumnFilter',
      floatingFilter: true,
      valueGetter: (params) => params.data?.supplier?.name || 'Unknown'
    },
    {
      headerName: "Date",
      field: "purchase_date",
      width: 130,
      filter: 'agTextColumnFilter',
      floatingFilter: true,
      valueGetter: (params) => formatDateDisplay(params.data?.purchase_date),
    },
    {
      headerName: "Total Amount",
      field: "gross_amount",
      width: 130,
      type: "rightAligned",
      filter: 'agNumberColumnFilter',
      floatingFilter: true,
      valueGetter: (params) => money(params.data?.gross_amount || 0),
      comparator: stringValueToNumberComparator
    },
    {
      headerName: "Payment Date",
      field: "payment_date",
      width: 130,
      filter: 'agTextColumnFilter',
      floatingFilter: true,
      valueGetter: (params) => params.data?.payment_date ? formatDateDisplay(params.data.payment_date) : '-',
    },
    {
      headerName: "Payment Methods",
      field: "payments",
      width: 280,
      filter: 'agTextColumnFilter',
      floatingFilter: true,
      valueGetter: (params) => {
        const payments = params.data?.payments || [];
        if (payments.length === 0) return 'Not Paid';
        return payments.map(p => `${p.type || 'Not Specified'}: ${money(p.amount || 0)}`).join(', ');
      },
      cellRenderer: (params) => {
        const payments = params.data?.payments || [];
        if (!payments || payments.length === 0) { return <Chip label="Not Paid" size="small" sx={{ bgcolor: '#f44336', color: '#fff', fontWeight: 'bold', fontSize: '11px', height: '24px' }} />; }
        return (
          <Box sx={chipRowSx}>
            {payments.map((payment, index) => {
              const methodName = payment.type || 'Not Specified';
              const amount = payment.amount || 0;
              const color = METHOD_COLORS[methodName] || '#607D8B';
              return (
                <Chip
                  key={index}
                  label={`${methodName}: ${money(amount)}`}
                  size="small"
                  sx={{ bgcolor: color, color: '#fff', fontWeight: 'bold', fontSize: '11px', height: '24px', flexShrink: 0 }}
                />
              );
            })}
          </Box>
        );
      },
      cellStyle: { display: 'flex', alignItems: 'center', overflow: 'hidden', padding: '0 8px' }
    },
    {
      headerName: "Outstanding",
      field: "amount_outstanding",
      width: 130,
      type: "rightAligned",
      filter: 'agNumberColumnFilter',
      floatingFilter: true,
      valueGetter: (params) => money(params.data?.amount_outstanding || 0),
      comparator: stringValueToNumberComparator,
      cellStyle: (params) => {
        const value = params.data?.amount_outstanding || 0;
        return { color: value > 0 ? 'red' : 'green', fontWeight: 'bold' };
      }
    },
    {
      headerName: "Status",
      field: "status",
      width: 120,
      filter: 'agTextColumnFilter',
      floatingFilter: true,
      filterParams: {
        filterOptions: [
          'equals',
          {
            displayKey: 'equals',
            displayName: 'Equals',
            predicate: ([filterValue], cellValue) => String(cellValue).toUpperCase() === String(filterValue).trim().toUpperCase(),
            numberOfInputs: 1,
          },
        ],
        defaultOption: 'equals',
        trimInput: true,
        caseSensitive: false,
      },
      valueGetter: (params) => (params.data?.status || 'UNPAID').toUpperCase(),
      cellRenderer: (params) => {
        const status = params.value || 'UNPAID';
        const color = status === 'PAID' ? 'success' : status === 'PARTIAL' ? 'warning' : 'error';
        return <Chip label={status} size="small" color={color} />;
      }
    },
    {
      headerName: "Action",
      field: "_id",
      width: 80,
      filter: false,
      floatingFilter: false,
      cellRenderer: (params) => (
        <Tooltip title="View/Print PDF">
          <IconButton
            color="primary"
            size="small"
            onClick={() => handleSinglePDF(params.data._id)}
          >
            <ReceiptIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )
    }
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <CustomisedSnackBar {...snackState} setClosed={setSnackState} />
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Grid container spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <Grid item xs={12} md={3}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <ReceiptLongIcon color="primary" fontSize="large" />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 600, lineHeight: 1.2 }}> Sales & Purchase Ledger </Typography>
                <Typography variant="body2" color="text.secondary"> Track all sales and purchase transactions </Typography>
              </Box>
            </Stack>
          </Grid>
          <Grid item xs={12} md={4}>
            <TabContext value={tabValue}>
              <TabList
                onChange={handleTabChange}
                aria-label="ledger tabs"
                variant="scrollable"
                sx={{
                  '& .MuiTab-root': {
                    minWidth: 'auto',
                    px: 2,
                    py: 1,
                    fontSize: '0.875rem'
                  },
                  '& .MuiTabs-indicator': { height: 3 }
                }}
              >
                {TABS.map((t) => (
                  <Tab
                    key={t.value}
                    label={t.label}
                    value={t.value}
                    icon={t.value === '0' ? <ReceiptLongIcon /> : <ShoppingCartIcon />}
                    iconPosition="start"
                  />
                ))}
              </TabList>
            </TabContext>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="flex-end">
              <DatePicker
                label="From Date"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue || new Date())}
                inputFormat="dd/MM/yyyy"
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="medium"
                    sx={{
                      width: 400,
                      '& .MuiInputBase-root': { height: '40px' }
                    }}
                  />
                )}
              />
              <DatePicker
                label="To Date"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue || new Date())}
                inputFormat="dd/MM/yyyy"
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="medium"
                    sx={{
                      width: 400,
                      '& .MuiInputBase-root': { height: '40px' }
                    }}
                  />
                )}
              />
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={handleReload}
                size="large"
                sx={{
                  bgcolor: '#1976d2',
                  '&:hover': { bgcolor: '#1565c0' },
                  height: '48px',
                  px: 3,
                  minWidth: '100px'
                }}
              >
                Reload
              </Button>
            </Stack>
          </Grid>
        </Grid>
        <Grid container spacing={2}>
          <SalesPurchaseLedgerStats
            tabValue={tabValue}
            salesStats={salesStats}
            purchaseStats={purchaseStats}
          />
        </Grid>
        <SelectedSummary
          selectedIds={selectedIds}
          tabValue={tabValue}
          selectedData={getSelectedData()}
          onGeneratePDF={handleGeneratePDF}
          isPdfLoading={isPdfLoading}
        />
        <TabContext value={tabValue}>
          <TabPanel value="0" sx={{ px: 0, height: '70vh' }}>
            <DataViewGrid
              getGridApi={setGridApi}
              rowData={salesData}
              columnDefs={salesColDefs}
              loading={loading}
              agGridProps={{
                rowSelection: "multiple",
                suppressRowClickSelection: true,
                onSelectionChanged: rowSelectionChanged,
                defaultColDef: {
                  sortable: true,
                  filter: true,
                  floatingFilter: true,
                  resizable: true,
                }
              }}
            />
          </TabPanel>
          <TabPanel value="1" sx={{ px: 0, height: '70vh' }}>
            <DataViewGrid
              getGridApi={setGridApi}
              rowData={purchaseData}
              columnDefs={purchaseColDefs}
              loading={loading}
              agGridProps={{
                rowSelection: "multiple",
                suppressRowClickSelection: true,
                onSelectionChanged: rowSelectionChanged,
                defaultColDef: {
                  sortable: true,
                  filter: true,
                  floatingFilter: true,
                  resizable: true,
                }
              }}
            />
          </TabPanel>
        </TabContext>
      </Box>
    </LocalizationProvider>
  );
};

export default SalesPurchaseLedger;