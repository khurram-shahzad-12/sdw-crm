const activityModel = require("./model");
const leadModel = require("../lead/model");

const createActivity = async (data) => {
    await leadModel.findByIdAndUpdate(data.lead, {last_activity_at: new Date()})
    return await activityModel.create(data);
}

module.exports = {
    createActivity,
}