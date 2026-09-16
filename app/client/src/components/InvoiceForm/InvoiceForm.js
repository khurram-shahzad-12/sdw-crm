import React, {useEffect, useState} from "react";
import axiosDefault from "../axiosDefault/axiosDefault";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import {LoadingButton} from "../loadingButton/LoadingButton";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import {Backdrop, Button, CircularProgress, Grid, TextField} from '@mui/material';
import {
    defaultInvoiceItemEntry,
    defaultSnackState, fetchEntries,
    getGridFormInputFields, momentFormat
} from "../formFunctions/FormFunctions";
import {
    getInputFields,
    handleCheckboxChange,
    handleInputChange,
} from "../formFunctions/FormFunctions";
import displaySnackState from "../customisedSnackBar/DisplaySnackState";
import CustomisedSnackBar from "../customisedSnackBar/CustomisedSnackBar";
import {ItemDropdownChooser} from "./ItemDropdownChooser";
import { v4 as uuidv4 } from 'uuid';
import Autocomplete from "@mui/material/Autocomplete";
import moment from "moment";
import ItemHistoryDisplay from "./ItemHistoryDisplay";
import UnpaidInvoicesDisplay from "./UnpaidInvoicesDisplay";
import { useAuth } from "../../contexts/AuthContext";
import AuditModal from "../AuditModal/AuditModal";

const getDefaultInvoiceDate = (currentDate, selectedCustomer, isInPersonInvoice) => {
    if(isInPersonInvoice) {
        return currentDate;
    }

    const currentDayOfWeek = moment(currentDate).day();
    let numberOfDaysToAdd = 0;

    //look forward for next available day
    let nextAvailableDay = 0;
    let counter = currentDayOfWeek+1;
    let found = false;
    while(counter < 7 && !found) {
        if(selectedCustomer.zones[counter]) {
            found = true;
            nextAvailableDay = counter;
            numberOfDaysToAdd = nextAvailableDay - currentDayOfWeek;
        }
        counter++;
    }

    //if not found, look back for a valid previous day value, then set daysToAdd to overlap into next week
    if(!found) {
        let counter = 0;
        while(counter < currentDayOfWeek && !found) {
            if(selectedCustomer.zones[counter]) {
                found = true;
                nextAvailableDay = counter;
                numberOfDaysToAdd = 7 - (currentDayOfWeek - nextAvailableDay);
            }
            counter++;
        }
    }
    const customerDefaultInvoiceDate = moment(currentDate);
    customerDefaultInvoiceDate.add(numberOfDaysToAdd, "days");
    return customerDefaultInvoiceDate.format(momentFormat);
};

const attachUUIDToItems = items => {
    return items.map(item => ({...item, key: uuidv4()}))
};

const InvoiceForm = props => {
    const {user} = useAuth();
    const [auditModalOpen, setAuditModalOpen] = useState(false);
    const isEditMode = props.dialogDetails.mode === "EDIT";
    const isCreditMode = props.dialogDetails.creditMode === "CREDIT";
    const isCreditNoteEdit = props.dialogDetails.mode === "EDIT" && props.dialogDetails.isCreditNote === true;
    const isInPersonMode = props.collection_invoice;
    const {canEdit} = props.dialogDetails;
    const axios = axiosDefault();
    const customersArray = [];
    Object.keys(props.customersList.map).forEach(customer_id => {
        (props.customersList.map[customer_id].active && !props.customersList.map[customer_id].on_hold) &&
        customersArray.push(props.customersList.map[customer_id]);
    });
    const [selectedCustomer, setSelectedCustomer] = useState(props.dialogDetails.selectedCustomer);
    const defaultInvoiceFields = {
        invoice_date: moment().format(momentFormat),
        customer: selectedCustomer,
        ...(!isCreditMode && !isCreditNoteEdit ? {
            ot_date: isEditMode ? props.dialogDetails.invoiceData.ot_date : props.dialogDetails.selectedOTDate
        }: {}),
        ...(!isCreditMode && !isCreditNoteEdit ? {cash_invoice: isEditMode ? props.dialogDetails.invoiceData.cash_invoice : selectedCustomer.cash_invoice}: {}),
        in_person: isInPersonMode,
        invoice_type: isCreditMode || isCreditNoteEdit ? "CREDIT" : "SALE",
        remarks: "",
        driverNotes: "",
        credit_invoice_notes: "",
        credit_adjustments: [{id: uuidv4(), description: '', amount:0}],
        items: [
            {...defaultInvoiceItemEntry()},
            {...defaultInvoiceItemEntry()},
            {...defaultInvoiceItemEntry()},
            {...defaultInvoiceItemEntry()},
            {...defaultInvoiceItemEntry()},
            {...defaultInvoiceItemEntry()},
        ]
    };
    const [sendingData, setSendingData] = useState(true);
    const [formValues, setFormValues] = useState(() => {
        if (isCreditNoteEdit) {
            const creditData = props.dialogDetails.creditNoteData;
            return {
                _id: creditData._id,
                invoice_date: moment().format(momentFormat),
                customer: selectedCustomer?._id,
                customer_name: creditData.customer_name,
                in_person: false,
                invoice_type: "CREDIT",
                remarks: creditData.notes || "",
                driverNotes: "",
                credit_invoice_notes: creditData.reason_description || "",
                credit_adjustments: (creditData.credit_adjustments || []).map(adj => ({
                    ...adj,
                    id: uuidv4()
                })),
                items: attachUUIDToItems(creditData.credit_items || []),
                original_invoice_id: creditData.original_invoice_id,
                original_invoice_number: creditData.original_invoice_number,
                credit_note_id: creditData._id,
                credit_note_number: creditData.credit_note_number,
                reason: creditData.reason || 'RETURN',
                status: creditData.status,
                created_by: creditData.created_by,
                remaining_credit: creditData.remaining_credit || 0,
                total_credit_amount: creditData.total_credit_amount || 0
            }
        } else if (isCreditMode) {
            const originalInvoice = props.dialogDetails.invoiceData || {};
            return {
                ...defaultInvoiceFields,
                created_by: user.user_name,
                customer: selectedCustomer._id,
                customer_sales_rep: selectedCustomer?.sales_rep,
                invoice_date: moment().format(momentFormat),
                invoice_type: "CREDIT",
                original_invoice_id: originalInvoice._id,
                original_invoice_number: originalInvoice.sale_number,
                items: (originalInvoice.items || []).map(item => ({
                    ...item,
                    quantity: 0,
                    key: uuidv4(),
                    original_invoice_item_id: item._id
                }))
            }
        } else if (isEditMode) {
            return {
                ...props.dialogDetails.invoiceData,
                invoice_date: props.dialogDetails.invoiceData.invoice_date,
                items: attachUUIDToItems(props.dialogDetails.invoiceData.items)
           }
        }else{
            return {
            ...defaultInvoiceFields,
            created_by: user.user_name,
            customer: selectedCustomer._id,
            customer_sales_rep: selectedCustomer?.sales_rep,
            invoice_date: getDefaultInvoiceDate(defaultInvoiceFields.ot_date, selectedCustomer, isInPersonMode)
        }}
    });
    const productsList = props.productsList;
    const vatData = props.vatData;
    const [snackState, setSnackState] = useState(defaultSnackState);
    const [totalsData, setTotalsData] = useState({
        total_no_vat: 0,
        vat_total: 0,
        total_incl_vat: 0
    });
    const [customerItems, setCustomerItems] = useState(null);
    const [itemHistoryConfig, setItemHistoryConfig] = useState({visible: false});
    const [itemsAudit, setItemsAudit] = useState({});
    const [unpaidInvoicesForCustomer, setUnpaidInvoicesForCustomer] = useState([]);
    const [customerCollectionPrices, setCustomerCollectionPrices] = useState({});
    const [customerRecommendations, setCustomerRecommendations] = useState([]);

    const getCustomerRecommendations = () => {
        fetchEntries(`/customerRecommendation/${selectedCustomer._id}`, (response) => { setCustomerRecommendations(response.data);},
    (error) => {console.error(error); setCustomerRecommendations([])})
    }
    const getRecalculatedOrderTotals = () => {
        let [newTotalNoVat, newVatTotal, newTotalInclVat] = [0, 0, 0];
        formValues.items.forEach(item => {
            if(item._id === null)
                return;
            const vat_id = item.vat;
            const vat_rate = vatData.map[vat_id].rate;
            newTotalNoVat += (Number(item.quantity) * Number(item.rate));
            newVatTotal += (Number(item.quantity) * Number(item.rate)) * (vat_rate/100);
            newTotalInclVat += (Number(item.quantity) * Number(item.rate)) * (1 + vat_rate/100);
        });
        const adjustmentTotal = (formValues.credit_adjustments || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        newTotalNoVat += adjustmentTotal;
        newTotalInclVat += adjustmentTotal
        setTotalsData({total_no_vat: Number(newTotalNoVat.toFixed(2)), vat_total: Number(newVatTotal.toFixed(2)), total_incl_vat: Number(newTotalInclVat.toFixed(2))});
    };

    const handleDateChange = (newDate, fieldName) => {
        setFormValues({
            ...formValues,
            [fieldName]: moment(newDate).format(momentFormat),
        });
    };

    const checkboxChangeListener = (event) => {
        handleCheckboxChange(event, formValues, setFormValues);
    };

    const setItems = items => {
        setFormValues({
            ...formValues,
            items: [...items]
        });
    };

    const handleEditSubmit = (event) => {
        event.preventDefault();
        const filteredItems = formValues.items.filter(item => item._id !== null && item.quantity > 0);
        if (filteredItems.length > 0 && isSelectedDeliveryDateValid()) {
            setSendingData(true);
            axios.put(`${process.env.REACT_APP_URL_ROOT}/api/invoice/${props.dialogDetails.invoiceData._id}`, {
                ...formValues, items: filteredItems
            })
                .then(response => {
                    props.postSubmitCallback();
                })
                .catch(error => {
                    console.error(error);
                    displaySnackState(`Failed to modify - ${error.response ? error.response.data : error.message}`, "error", setSnackState);
                })
                .finally(() => {
                    setSendingData(false);
                })
        } else {
            displaySnackState("Please ensure at least 1 item is picked and a valid date is chosen", "warning", setSnackState);
        }
    };
    const handleCreditNoteSubmit = (event) => {
    event.preventDefault();
    const filteredItems = formValues.items.filter(item => item._id !== null && item.quantity > 0);
    if (filteredItems.length === 0) {
        displaySnackState("Please select at least one item to credit", "warning", setSnackState);
        return;
    }
    const totalCredit = totalsData.total_incl_vat;
    const originalInvoiceTotal = props.dialogDetails.invoiceData.total_incl_vat;
    const alreadyCredited = props.dialogDetails.invoiceData.total_credit_applied || 0;
    const remainingAvailable = originalInvoiceTotal - alreadyCredited;
    setSendingData(true);
    const creditAdjustments = formValues.credit_adjustments || [];
    const payload = {
        original_invoice_id: props.dialogDetails.invoiceData._id,
        original_invoice_number: props.dialogDetails.invoiceData.sale_number,
        customer_id: selectedCustomer._id,
        customer_name: selectedCustomer.customer_name,
        customer_sales_rep: selectedCustomer?.sales_rep || null,
        credit_items: filteredItems.map(item => ({
            _id: item._id,
            name: item.name,
            barcode: item.barcode,
            quantity: item.quantity,
            rate: item.rate,
            cost_price: item.cost_price || 0,
            vat: item.vat,
            tax: item.tax || 0,
            amount_excl_vat: Number((item.quantity * item.rate).toFixed(2)),
            vat_amount: Number((item.quantity * item.rate * (item.tax / 100)).toFixed(2)),
            amount_incl_vat: Number((item.quantity * item.rate * (1 + item.tax / 100)).toFixed(2)),
            weight_grams: item.weight_grams || 0,
            original_invoice_item_id: item.original_invoice_item_id || null,
            returned_to_stock: true,
            returned_to_stock_date: new Date(),
            profit_impact: Number((item.quantity * (item.rate - (item.cost_price || 0))).toFixed(2)),
        })),
        credit_adjustments: creditAdjustments
            .filter(adj => adj && (adj.amount > 0 || adj.description))
            .map(adj => ({
                description: adj.description || '',
                amount: Number(adj.amount || 0),
                type: 'OTHER'
            })),
        reason_description: formValues.credit_invoice_notes || '',
        subtotal: totalsData.total_no_vat,
        vat_total: totalsData.vat_total,
        total_credit_amount: totalsData.total_incl_vat,
        remaining_credit: totalsData.total_incl_vat,
        profit_impact: -totalsData.total_incl_vat,
        created_by: user.user_name,
        notes: formValues.remarks,
        email_sent: false,
        printed: false
    };
    axios.post(`${process.env.REACT_APP_URL_ROOT}/api/creditnote`, payload)
        .then(response => {
            displaySnackState(`Credit note #${response.data.credit_note_number} created successfully`, "success", setSnackState);
            props.postSubmitCallback();
        })
        .catch(error => {
            console.error('Error creating credit note:', error);
            displaySnackState(
                `Failed to create credit note - ${error.response ? error.response.data.error || error.response.data.message : error.message}`, 
                "error", 
                setSnackState
            );
        })
        .finally(() => {
            setSendingData(false);
        });
};
    const handleCreditNoteEditSubmit = (event) => {
        event.preventDefault();
        const filteredItems = formValues.items.filter(item => item._id !== null && item.quantity > 0);
        if(filteredItems.length === 0) {displaySnackState("Please select at least one item", "warning", setSnackState); return;}
        if (formValues.status === "APPLIED"){ displaySnackState("Cannot edit an applied credit note", "error", setSnackState); return};
        setSendingData(true);
        const payload = {
            credit_items: filteredItems.map(item => ({
                _id: item._id,
                name: item.name,
                barcode: item.barcode,
                quantity: item.quantity,
                rate: item.rate,
                cost_price: item.cost_price || 0,
                vat: item.vat,
                tax: item.tax || 0,
                amount_excl_vat: Number((item.quantity * item.rate).toFixed(2)),
                vat_amount: Number((item.quantity * item.rate * ((item.tax || 0)/100)).toFixed(2)),
                amount_incl_vat: Number((item.quantity * item.rate * (1 + (item.tax || 0)/100)).toFixed(2)),
                weight_grams: item.weight_grams || 0,
                original_invoice_item_id: item.original_invoice_item_id || null,
                returned_to_stock: item.returned_to_stock !== false,
                profit_impact: Number((item.quantity * (item.rate - (item.cost_price || 0))).toFixed(2)),

                returned_to_stock_date: item.returned_to_stock_date || new Date(),
            })),
            credit_adjustments: (formValues.credit_adjustments || []).filter(adj => adj && (Number(adj.amount) > 0 || adj.description))
            .map(adj => ({
                description: adj.description || '',
                amount: Number(adj.amount || 0),
                type: adj.type || 'OTHER'
            })),
            reason_description: formValues.credit_invoice_notes || '',
            subtotal: totalsData.total_no_vat,
            vat_total: totalsData.vat_total,
            total_credit_amount: totalsData.total_incl_vat,
            remaining_credit: totalsData.total_incl_vat - (props.dialogDetails.creditNoteData?.applied_credit || 0),
            profit_impact: -totalsData.total_incl_vat,
            notes: formValues.remarks || '',
            updated_by: user.user_name,
            updated_at: new Date(),
            status: formValues.status || 'PENDING'
        };
        axios.put(`${process.env.REACT_APP_URL_ROOT}/api/creditnote/${formValues.credit_note_id}`, payload).then(response => {
            displaySnackState("Credit note updated successfully", "success", setSnackState);
            props.postSubmitCallback();
        }).catch(error => {
            console.error('Error updating credit note:', error); displaySnackState(`Failed to update credit note - ${ error.response?.data?.message || error.message}`, 'error', setSnackState)
        }).finally(() => {setSendingData(false)});
    };
    const handleSubmit = (event) => {
        event.preventDefault();
        if (isCreditMode) { handleCreditNoteSubmit(event); return; }
        const filteredItems = formValues.items.filter(item => item._id !== null && item.quantity > 0);
        if (filteredItems.length > 0 && isSelectedDeliveryDateValid()) {
            setSendingData(true);
           const payload = {...formValues, items: filteredItems, total_no_vat: totalsData.total_no_vat, vat_total: totalsData.vat_total, total_incl_vat: totalsData.total_incl_vat};
            if(isCreditMode) {payload.linked_invoice_id = props.dialogDetails.invoiceData._id};
            axios.post(`${process.env.REACT_APP_URL_ROOT}/api/invoice/`, payload)
                .then(response => {
                    displaySnackState("Successfully added", "success", setSnackState);
                    props.postSubmitCallback();
                })
                .catch(error => {
                    console.error(error);
                    displaySnackState(`Failed to add - ${error.response ? error.response.data : error.message}`, "error", setSnackState);
                })
                .finally(() => {
                    setSendingData(false);
                })
        } else {
            displaySnackState("Please ensure at least 1 item is picked and a valid date is chosen", "warning", setSnackState);
        }
    };

    const isSelectedCustomerZonesAllNull = zonesList => {
        return zonesList.filter(zone => zone !== null).length === 0;
    }

    const isSelectedDeliveryDateValid = () => {
        return isInPersonMode ? true : isSelectedCustomerZonesAllNull(selectedCustomer.zones)? true : selectedCustomer.zones[moment(formValues.invoice_date).day()];
    };

    const datePickerDisableDay = date => {
        if(selectedCustomer) {
            if(!isSelectedCustomerZonesAllNull(selectedCustomer.zones)) {
                return !selectedCustomer.zones[date.getDay()];
            }
            return false;
        }
        return true;
    };

    const handleAddMore = () => {
        const newItemsList = [...formValues.items, defaultInvoiceItemEntry()];
        setItems(newItemsList)
    };

    const printAudit = () => {
        setAuditModalOpen(true);
    };

    const handleCustomerChange = (event, newCustomer) => {
        setSelectedCustomer(newCustomer);
    };

    const inputChangeListener = event => {
        handleInputChange(event, formValues, setFormValues)
    };

    const getCustomerItems = (setInitialItemsList, collectionPrices = {}) => {
        const onSuccess = response => {
            if(response.data && setInitialItemsList && response.data.items.length > 0) {
                let newItemsList = [];
                response.data.items.forEach(customerItem => {
                    const fullItemDetails = productsList.map[customerItem._id]
                    newItemsList.push({
                        ...fullItemDetails,
                        rate: isInPersonMode ? (collectionPrices[customerItem._id] !== undefined && collectionPrices[customerItem._id] !== null ? collectionPrices[customerItem._id] : fullItemDetails.collection_price) : customerItem.rate,
                        quantity: 0,
                        tax: props.vatData.map[fullItemDetails.vat].rate,
                        key: uuidv4()
                    })
                });
                setItems(newItemsList);
            }
            setCustomerItems(response.data);
            setSendingData(false);
        };
        const onFail = error => {
            console.error(error);
            setSendingData(false);
            displaySnackState(`Failed to fetch customer items data - ${error.response ? error.response.data : error.message}`, "error", setSnackState);
        }
        fetchEntries(`/customerItems/${selectedCustomer._id}`, onSuccess, onFail);
    };

    const showItemHistory = (item) => {
        setItemHistoryConfig({
            visible: true,
            item: item
        });
    };

    const closeItemHistory = () => {
        setItemHistoryConfig({visible: false});
    };

    const countNumberOfItemsOnOrder = () => {
        let total = 0;
        formValues.items.forEach(item => {
            if(item.quantity > 0) {
                total++;
            }
        });
        return total;
    };

    const countQuantityOfItemsOnOrder = () => {
        let total = 0;
        formValues.items.forEach(item => {
            total += item.quantity;
        });
        return total;
    };

    const invoiceData = (!isCreditMode && !isCreditNoteEdit ?
         [
        {
            field: "invoice_date",
            label: "Invoice Date",
            type: "datepicker",
            defaultValue: formValues.invoice_date,
            changeListener: newDate => handleDateChange(newDate, "invoice_date"),
            datePickerProps: {
                shouldDisableDate: datePickerDisableDay,
                disabled: selectedCustomer === null || !canEdit || isInPersonMode
            }
        },
        {
            field: "ot_date",
            label: "OT Date",
            type: "datepicker",
            defaultValue: formValues.ot_date,
            datePickerProps: {
                disabled: true
            }
        },
        {
            field: "cash_invoice",
            label: "Cash Invoice",
            type: "checkbox",
            checkboxProps: {
                disabled: !canEdit || isCreditMode,
            },
            defaultState: isCreditMode ? false : formValues.cash_invoice,
            changeListener: checkboxChangeListener
        }
    ]: [] ); 

    const alertCustomerComments = () => {
        if(selectedCustomer.comments && selectedCustomer.comments.length > 0) {
            alert(`${selectedCustomer.customer_name} NOTES:\n${selectedCustomer.comments}`);
        }
    };

    const getUnpaidInvoices = customerID => {
        const onSuccess = response => {
            setUnpaidInvoicesForCustomer(response.data);
            setSendingData(false);
        };
        const onFail = error => {
            console.error(error);
            setSendingData(false);
            displaySnackState(`Failed to fetch unpaid invoices list - ${error.response ? error.response.data : error.message}`, "error", setSnackState);
        }
        fetchEntries(`/invoice/getUnpaidInvoices/${customerID}`, onSuccess, onFail);
    };

  const getCustomerCollectionPrices = (customerId) => {
    return new Promise((resolve) => {
        const onSuccess = response => {
            if (response.data?.items) {
                const mappedPrices = {};
                response.data.items.forEach(item => {
                    mappedPrices[item.product_id] = item.collection_rate;
                });
                setCustomerCollectionPrices(mappedPrices);
                resolve(mappedPrices);
            } else {
                setCustomerCollectionPrices({});
                resolve({});
            }
        };
        const onFail = error => {
            console.error(error);
            setCustomerCollectionPrices({});
            resolve({});
        };
        fetchEntries(
            `/customerSpecificCollectionPrices/${customerId}`,
            onSuccess,
            onFail
        );
    });
};

    useEffect(() => {
        getRecalculatedOrderTotals();
     }, [formValues.items, productsList, vatData, formValues.credit_adjustments,]);

    useEffect(() => {
        setFormValues({
            ...formValues,
            customer: selectedCustomer._id,
            invoice_date: props.dialogDetails.selectedCustomer === selectedCustomer ? formValues.invoice_date : getDefaultInvoiceDate(defaultInvoiceFields.ot_date, selectedCustomer, isInPersonMode)
        });
        getCustomerItems(false);
        getUnpaidInvoices(selectedCustomer._id);
        alertCustomerComments();
        getCustomerCollectionPrices(selectedCustomer._id);
        getCustomerRecommendations();
    }, [selectedCustomer]);

    useEffect(() => {
       const loadInitialData = async () => {
         if(!isEditMode) {
            if(isInPersonMode) {
                setSendingData(true);
                const prices = await getCustomerCollectionPrices(selectedCustomer._id);
                getCustomerItems(true, prices);
            }else{
                getCustomerItems(true);
            }
        } else {
            setSendingData(false);
        }
       };
       loadInitialData();
    }, []);

    const staticCustomerFields = [
        <TextField
            name="created_by"
            label="Invoice Created By"
            value={formValues.created_by}
            variant="outlined"
            size={"small"}
            autoComplete="off"
            fullWidth
            disabled
            InputLabelProps={{ shrink: true }}
        />,
        <Autocomplete
            name="Customer"
            options={customersArray}
            onChange={(event, newCustomer) => handleCustomerChange(event, newCustomer)}
            autoComplete={false}
            value={selectedCustomer}
            disableClearable
            disabled={!canEdit}
            renderInput={(params) => (
                <TextField
                    {...params}
                    variant="standard"
                    label={"Customer"}
                />
            )}
            getOptionLabel={option => option.customer_name}
        />,
        <TextField
            name="contact_name"
            label="Contact Name"
            value={selectedCustomer?.contact_name}
            variant="outlined"
            size={"small"}
            autoComplete="off"
            fullWidth
            disabled
            InputLabelProps={{ shrink: true }}
        />,
        <TextField
            name="mobile"
            label="Contact Mobile"
            value={selectedCustomer?.mobile}
            variant="outlined"
            size={"small"}
            autoComplete="off"
            fullWidth
            disabled
            InputLabelProps={{ shrink: true }}
        />,
        <TextField
            name="address"
            label="Address"
            value={selectedCustomer?.address}
            variant="outlined"
            size={"small"}
            autoComplete="off"
            fullWidth
            disabled
            InputLabelProps={{ shrink: true }}
        />,
        <TextField
            name="city"
            label="City"
            value={selectedCustomer?.city}
            variant="outlined"
            size={"small"}
            autoComplete="off"
            fullWidth
            disabled
            InputLabelProps={{ shrink: true }}
        />,
        <TextField
            name="postcode"
            label="Postcode"
            value={selectedCustomer?.postcode}
            variant="outlined"
            size={"small"}
            autoComplete="off"
            fullWidth
            disabled
            InputLabelProps={{ shrink: true }}
        />,
              <TextField
            name="phone"
            label="Contact Landline"
            value={selectedCustomer?.phone}
            variant="outlined"
            size={"small"}
            autoComplete="off"
            fullWidth
            disabled
            InputLabelProps={{ shrink: true }}
        />,
        ...selectedCustomer?.comments ? [
            <TextField
                label={"Customer Comments"}
                name={"comments"}
                value={selectedCustomer.comments}
                variant="outlined"
                autoComplete="off"
                fullWidth
                multiline
                rows={3}
                type={"text"}
                disabled
            />
        ] : []
    ];

    const customerSegmentHeight = itemHistoryConfig.visible ? "30%" : "20%";
    const customerSegmentWidth = itemHistoryConfig.visible ? "55%" : "70%"
    const itemChooserSegmentHeight = itemHistoryConfig.visible ? "60%" : "70%";
    const addCreditAdjustment = () => {
    setFormValues({
        ...formValues,
        credit_adjustments: [
            ...(formValues.credit_adjustments || []),
            {
                id: uuidv4(),
                description: "",
                amount: 0
            }
        ]
    });
};
    const removeCreditAdjustment = (id) => {
    setFormValues({
        ...formValues,
        credit_adjustments: formValues.credit_adjustments.filter(
            item => item.id !== id
        )
    });
};

const updateCreditAdjustment = (id, field, value) => {
    setFormValues({
        ...formValues,
        credit_adjustments: formValues.credit_adjustments.map(item =>
            item.id === id
                ? { ...item, [field]: field === "amount" ? Number(value) : value }
                : item
        )
    });
};
const getSubmitHandler = () => {
    if(isCreditNoteEdit) { return handleCreditNoteEditSubmit }
    else if (isCreditMode) { return handleCreditNoteSubmit}
    else if (isEditMode) { return handleEditSubmit}
    else { return handleSubmit }
}
const getButtonLabel = () => {
    if(isCreditNoteEdit) return "UPDATE CREDIT NOTE";
    if(isCreditMode) return "CREATE CREDIT NOTE";
    if(isEditMode) return "UPDATE INVOICE";
    return "CREATE INVOICE";
}
    return (
        <div style={{width: "100%", height: "100%", minHeight: "100%", maxHeight: "100%"}}>
            <Backdrop
                sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
                open={sendingData}
            >
                <CircularProgress color="inherit" />
            </Backdrop>
            <CustomisedSnackBar {...snackState} setClosed={setSnackState} />
            {auditModalOpen && <AuditModal auditItems={itemsAudit} handleClose={() => setAuditModalOpen(false)}/>}
            <div style={{height: customerSegmentHeight, minHeight: customerSegmentHeight, maxHeight: customerSegmentHeight, display: "flex"}}>
                <Card style={{height: "100%", overflowY: "auto", width: customerSegmentWidth}}>
                    <CardContent>
                        {getGridFormInputFields([...getInputFields(invoiceData, formValues), ...staticCustomerFields])}
                    </CardContent>
                </Card>
                {
                    itemHistoryConfig.visible ?
                    <div style={{height: "100%", overflowY: "auto", width: "45%"}}>
                        <ItemHistoryDisplay
                            customer={selectedCustomer}
                            item={itemHistoryConfig.item}
                            productsList={productsList}
                            setSnackState={setSnackState}
                            closeItemHistory={closeItemHistory}
                        />
                    </div>
                        :
                        <div style={{height: "100%", overflowY: "auto", width: "30%"}}>
                            <UnpaidInvoicesDisplay invoices={unpaidInvoicesForCustomer} loading={sendingData} />
                        </div>
                }
            </div>
            <div style={{height: itemChooserSegmentHeight, minHeight: itemChooserSegmentHeight, maxHeight: itemChooserSegmentHeight, marginRight: "5%", marginLeft: "5%"}}>
                <ItemDropdownChooser
                    productsList={productsList}
                    vatData={vatData}
                    itemsList={formValues.items}
                    setItems={setItems}
                    currentCustomer={selectedCustomer}
                    customerItems={customerItems}
                    updateCustomerItems={getCustomerItems}
                    setSendingData={setSendingData}
                    showItemHistory={showItemHistory}
                    canEdit={canEdit}
                    itemsAudit={itemsAudit}
                    setItemsAudit={setItemsAudit}
                    collection_invoice={isInPersonMode}
                    customerRecommendations={customerRecommendations}
                />
            </div>
            {(isCreditMode || isCreditNoteEdit) && (
                <Card sx={{ mt: 2, mb: 2 }}>
                    <CardContent><h3>Additional Credit Adjustments</h3>
                        {(formValues.credit_adjustments || []).map(item => (
                            <Grid
                                container
                                spacing={2}
                                key={item.id}
                                alignItems="center"
                                sx={{ mb: 1 }}
                            >
                                <Grid item xs={8}>
                                    <TextField
                                        fullWidth
                                        label="Description"
                                        value={item.description}
                                        onChange={(e) => updateCreditAdjustment( item.id, "description", e.target.value ) }
                                    />
                                </Grid>
                                <Grid item xs={3}>
                                    <TextField
                                        fullWidth
                                        label="Amount"
                                        type="number"
                                        value={item.amount}
                                        onChange={(e) => updateCreditAdjustment( item.id, "amount", e.target.value ) }
                                    />
                                </Grid>
                                <Grid item xs={1}>
                                    <Button
                                        color="error"
                                        onClick={() => removeCreditAdjustment(item.id)}
                                    >
                                        X
                                    </Button>
                                </Grid>
                            </Grid>
                        ))}
                        <Button variant="contained" onClick={addCreditAdjustment} > Add Adjustment </Button>
                    </CardContent>
                </Card>
            )}
            <div style={{display: "inline-flex"}}>
                <Button variant="contained" onClick={handleAddMore} disabled={!canEdit}>ADD MORE</Button>
                <Button variant="contained" onClick={printAudit} disabled={!canEdit}>AUDIT</Button>
                <div style={{marginLeft: "5px"}}>
                    <TextField
                        name="total_items_ordered"
                        label="Total # Items"
                        value={countNumberOfItemsOnOrder()}
                        variant="outlined"
                        disabled
                    />
                    <TextField
                        name="total_items_quantity"
                        label="Total quantity"
                        value={countQuantityOfItemsOnOrder()}
                        variant="outlined"
                        disabled
                    />
                </div>
            </div>
            <div style={{width: "100%", display: "inline-flex", marginTop: "1em"}}>
                <div style={{width: "25%"}}>
                    <TextField
                        label={"Remarks"}
                        name={"remarks"}
                        value={formValues.remarks}
                        variant="outlined"
                        autoComplete="off"
                        size={"small"}
                        multiline
                        rows={3}
                        onChange={event => handleInputChange(event, formValues, setFormValues)}
                        fullWidth
                    />
                </div>
                {(isCreditMode || isCreditNoteEdit) && <div style={{width: "25%"}}>
                    <TextField
                    label={"Credit Notes"}
                    name={"credit_invoice_notes"}
                    value={formValues.credit_invoice_notes || ""}
                    variant="outlined"
                    autoComplete="off"
                    size={"small"}
                    multiline
                    rows={3}
                    onChange={event => handleInputChange(event, formValues, setFormValues)}
                    fullWidth
                    />
                    </div>}
                <div style={{width: "25%"}}>
                    <TextField
                        label={"Driver Notes"}
                        name={"driverNotes"}
                        value={formValues.driverNotes}
                        variant="outlined"
                        autoComplete="off"
                        size={"small"}
                        multiline
                        rows={3}
                        onChange={event => handleInputChange(event, formValues, setFormValues)}
                        fullWidth
                    />
                </div>
                <div style={{width: "50%", display: "flex", justifyContent: "end"}}>
                    <Grid container spacing={1}>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                name="total_no_vat"
                                label="Total(excl vat)"
                                value={`£${totalsData.total_no_vat.toFixed(2)}`}
                                variant="outlined"
                                disabled
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                name="vat_total"
                                label="Vat Total"
                                value={`£${totalsData.vat_total.toFixed(2)}`}
                                variant="outlined"
                                disabled
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                name="total_incl_vat"
                                label="Total(incl vat)"
                                value={`£${totalsData.total_incl_vat.toFixed(2)}`}
                                variant="outlined"
                                disabled
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <form style={{width: "100%", height: "100%"}} onSubmit={getSubmitHandler()}>
                                <LoadingButton loading={sendingData}
                                               icon={isCreditMode ? <AddIcon/> :isCreditNoteEdit || isEditMode ? <EditIcon/> : <AddIcon/>}
                                               buttonLabel={getButtonLabel()}
                                               disabled={sendingData || !canEdit || (isCreditNoteEdit && formValues.status === "APPLIED" || formValues.status === "PARTIALLY_APPLIED")}/>
                            </form>
                        </Grid>
                    </Grid>
                </div>
            </div>
        </div>
    );
};

export default InvoiceForm;