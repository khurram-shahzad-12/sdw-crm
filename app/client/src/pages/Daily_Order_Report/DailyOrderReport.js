import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Box, Grid, Typography, Tab, Button, TextField, Autocomplete, Chip, Avatar, Tooltip, Stack } from '@mui/material';
import { TabList, TabContext, TabPanel } from '@mui/lab';
import DatePicker from '@mui/lab/DatePicker';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import PendingOutlinedIcon from '@mui/icons-material/PendingOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import CurrencyPoundIcon from '@mui/icons-material/CurrencyPound';
import PeopleIcon from '@mui/icons-material/People';
import moment from 'moment';
import axiosDefault from '../../components/axiosDefault/axiosDefault';
import displaySnackState from '../../components/customisedSnackBar/DisplaySnackState';
import CustomisedSnackBar from '../../components/customisedSnackBar/CustomisedSnackBar';
import StatCard from '../../components/dailyorderreport/StatCard';
import ExpectedOrders from '../../components/dailyorderreport/ExpectedOrders';
import ConfirmedOrders from '../../components/dailyorderreport/ConfirmedOrders';
import PendingCustomers from '../../components/dailyorderreport/PendingCustomers';
import CancelledOrders from '../../components/dailyorderreport/CancelledOrders';
import CompareDialog from '../../components/dailyorderreport/CompareDialog';

const TABS = [
  { value: '0', label: 'Expected Orders' },
  { value: '1', label: 'Confirmed Orders' },
  { value: '2', label: 'Pending Orders' },
  { value: '3', label: 'Cancelled Orders' },
];

const money = (n) => `£${(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DailyOrderReport = () => {
  const axios = axiosDefault();
  const [tabValue, setTabValue] = useState('0');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [compareOrder, setCompareOrder] = useState(null);
  const [snackState, setSnackState] = useState('');
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({ expected: 0, confirmed: 0, totalValue: 0, pending: 0, cancelled: 0 });
  const [customerHistory, setCustomerHistory] = useState({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expectedCustomers, setExpectedCustomers] = useState([]);
  const [cancelledCustomers, setCancelledCustomers] = useState([]);
  const isInitialMount = useRef(true);
  const isFetching = useRef(false);

  const handleTabChange = (event, newValue) => setTabValue(newValue);
  const getDateOrderReport = useCallback(async () => {
    if (isFetching.current) return; 
    isFetching.current = true;
    setLoading(true);
    try {
      const params = {};
      if (selectedDate) { params.ot_date = moment(selectedDate).format('YYYY-MM-DD');}
      if (selectedCustomer?._id) { params.customer_id = selectedCustomer._id; }
      const response = await axios.get(`${process.env.REACT_APP_URL_ROOT}/api/dailyorderreport`, { params });
      if (response.data.success) {
        const data = response.data.data;
        setOrders(data.orders || []);
        setCustomers(data.customers || []);
        setStats(data.stats || { expected: 0, confirmed: 0, totalValue: 0, pending: 0, cancelled: 0 });
        setExpectedCustomers(data.expectedCustomers || []);
        setCancelledCustomers(data.cancelledCustomers || []);
        displaySnackState('Orders loaded successfully', 'success', setSnackState);
      } else { displaySnackState('Failed to load orders', 'error', setSnackState); }
    } catch (error) {
      displaySnackState( `Failed to load orders - ${error.response?.data?.message || error.message}`, 'error', setSnackState );
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [axios, selectedDate, selectedCustomer]);

  const fetchCustomerOrderHistory = useCallback(async (customerId, invoiceDate = null, limit = 10) => {
    if (!customerId) return;
    setHistoryLoading(true);
    try {
      const params = { limit };
      if (invoiceDate) { params.invoiceDate = moment(invoiceDate).format('YYYY-MM-DD'); }  
      const response = await axios.get(`${process.env.REACT_APP_URL_ROOT}/api/dailyorderreport/customer-history/${customerId}`, { params: params });
      if (response.data.success) {
        setCustomerHistory(prev => ({
          ...prev,
          [customerId]: response.data.data || []
        }));
      }
    } catch (error) {
      displaySnackState( `Failed to load customer history - ${error.response?.data?.message || error.message}`, 'error', setSnackState );
    } finally { setHistoryLoading(false); }
  }, [axios]);
  const handleRefresh = () => { getDateOrderReport(); };
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      getDateOrderReport();
    }
  }, []);

  useEffect(() => {
    if (isInitialMount.current) { return; }
    getDateOrderReport();
  }, [selectedDate, selectedCustomer]);

  const pendingCustomers = useMemo(() => {
    const customersWithOrders = new Set(orders.map(o => o.customer?._id).filter(id => id));
    const cancelledCustomerIds = new Set(cancelledCustomers.map(c => c._id)); 
    return expectedCustomers.filter(c => !customersWithOrders.has(c._id) && !cancelledCustomerIds.has(c._id) );
  }, [expectedCustomers, orders, cancelledCustomers]);

  const confirmedCustomers = useMemo(() => {
    const customersWithOrders = new Set(orders.map(o => o.customer?._id).filter(id => id));
    return expectedCustomers.filter(c => customersWithOrders.has(c._id));
  }, [expectedCustomers, orders]);

  const cancelledExpectedCustomers = useMemo(() => {
    const cancelledCustomerIds = new Set(cancelledCustomers.map(c => c._id));
    return expectedCustomers.filter(c => cancelledCustomerIds.has(c._id));
  }, [expectedCustomers, cancelledCustomers]);

  const formatDate = (date) => {
    if (!date) return '';
    return moment(date).format('MMM D, YYYY');
  };
  const handleCompareOrder = (order) => {
    setCompareOrder(order);
    if (order?.customer?._id) {
      const invoiceDate = order.invoice_date;
      fetchCustomerOrderHistory(order.customer._id, invoiceDate);
    }
  };
  const filterCustomers = (customerList) => {
    if (!selectedCustomer) return customerList;
    return customerList.filter(c => c._id === selectedCustomer._id);
  };
  const filterOrders = (orderList) => {
    if (!selectedCustomer) return orderList;
    return orderList.filter(o => o.customer?._id === selectedCustomer._id);
  };
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <CustomisedSnackBar {...snackState} setClosed={setSnackState} />
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Grid item xs={12} md={4}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <AssessmentOutlinedIcon color="primary" fontSize="large" />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                  Daily Order Report
                </Typography>
                <Typography variant="body2" color="text.secondary"> {moment(selectedDate).format('dddd, MMMM D, YYYY')} </Typography>
              </Box>
            </Stack>
          </Grid>
          <Grid item xs={12} md={5} sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'center' }} >
            <TabContext value={tabValue}>
              <TabList onChange={handleTabChange} aria-label="order status tabs" variant="scrollable">
                {TABS.map((t) => ( <Tab key={t.value} label={t.label} value={t.value} /> ))}
              </TabList>
            </TabContext>
          </Grid>
          <Grid item xs={6} md={1.6}>
            <DatePicker
              label="Select Date"
              value={selectedDate}
              onChange={(newValue) => setSelectedDate(newValue || new Date())}
              inputFormat="dd/MM/yyyy"
              renderInput={(params) => <TextField {...params} fullWidth />}
            />
          </Grid>
          <Grid item xs={6} md={1.4}>
            <Button variant="contained" onClick={handleRefresh} startIcon={<RefreshIcon />} fullWidth sx={{ height: 56 }} > Reload </Button>
          </Grid>
        </Grid>
        <Box sx={{ mb: 3, maxWidth: 320 }}>
          <Autocomplete
            options={customers}
            getOptionLabel={(option) => option.name || ''}
            value={selectedCustomer}
            onChange={(event, newValue) => setSelectedCustomer(newValue)}
            isOptionEqualToValue={(option, value) => option._id === value?._id}
            renderInput={(params) => <TextField {...params} label="Filter by Customer" size="small" />}
          />
        </Box>
        {tabValue !== '0' && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={4} md={2.4}>
              <StatCard 
                label="Expected" 
                value={stats.expected} 
                color="grey.500"
                icon={<PeopleIcon fontSize="small" />}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2.4}>
              <StatCard 
                label="Confirmed" 
                value={stats.confirmed} 
                color="success.main"
                icon={<CheckCircleOutlineIcon fontSize="small" />}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2.4}>
              <StatCard 
                label="Order Value" 
                value={money(stats.totalValue)} 
                color="primary.main"
                icon={<CurrencyPoundIcon fontSize="small" />}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2.4}>
              <StatCard 
                label="Pending" 
                value={stats.pending} 
                color="warning.main"
                icon={<PendingOutlinedIcon fontSize="small" />}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2.4}>
              <StatCard 
                label="Cancelled" 
                value={stats.cancelled} 
                color="error.main"
                icon={<CancelOutlinedIcon fontSize="small" />}
              />
            </Grid>
          </Grid>
        )}
        <TabContext value={tabValue}>
          {TABS.map((t) => (
            <TabPanel key={t.value} value={t.value} sx={{ px: 0 }}>
              {t.value === '0' && (
                <ExpectedOrders 
                  expectedCustomers={expectedCustomers}
                  confirmedCustomers={confirmedCustomers}
                  pendingCustomers={pendingCustomers}
                  cancelledExpectedCustomers={cancelledExpectedCustomers}
                  cancelledCustomers={cancelledCustomers}
                  orders={orders}
                  loading={loading}
                  filterCustomers={filterCustomers}
                />
              )}
              {t.value === '1' && (
                <ConfirmedOrders 
                  orders={orders}
                  loading={loading}
                  selectedCustomer={selectedCustomer}
                  formatDate={formatDate}
                  handleCompareOrder={handleCompareOrder}
                />
              )}
              {t.value === '2' && (
                <PendingCustomers 
                  pendingCustomers={pendingCustomers}
                  loading={loading}
                  filterCustomers={filterCustomers}
                />
              )}
              {t.value === '3' && (
                <CancelledOrders 
                  orders={orders}
                  cancelledCustomers={cancelledCustomers}
                  filterCustomers={filterCustomers}
                  filterOrders={filterOrders}
                  setSnackState={setSnackState}
                  fetchAll={getDateOrderReport}
                />
              )}
            </TabPanel>
          ))}
        </TabContext>
        <CompareDialog 
          order={compareOrder} 
          onClose={() => setCompareOrder(null)}
          history={compareOrder?.customer?._id ? customerHistory[compareOrder.customer._id] : []}
          historyLoading={historyLoading}
        />
      </Box>
    </LocalizationProvider>
  );
};
export default DailyOrderReport;