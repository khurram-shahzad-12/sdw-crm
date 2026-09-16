const CounterModel = require('./model');

const getNextQuotationNumber = async () => {
    const counter = await CounterModel.findByIdAndUpdate({_id: 'quotationNo'}, {$inc: {seq: 1}}, {new: true, upsert: true});
    return counter.seq;
}
const getNextCreditNoteNumber = async () => {
    const counter = await CounterModel.findByIdAndUpdate({_id: 'creditNoteNo'}, {$inc: {seq: 1}},{new: true, upsert: true, setDefaultsOnInsert: true});
    const startNumber = 5000;
    const currentNumber = startNumber + counter.seq - 1;
    return `CN-${currentNumber}`;
}
module.exports={
    getNextQuotationNumber,
    getNextCreditNoteNumber,
}