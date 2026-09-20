const env = require('../config.env');

const appConfig = {
    development: {
        companyName: 'SDW',
        logo: 'public/testserver_logo.jpeg',
        // email:'sales@sdw-ds.com',
        // phone: '0044 20 3627 0522',
        address: 'Office No 19, Floor 2, Al Arif Shipping Building, Dubai UAE',
    },
    production: {
        companyName: 'SDW',
        logo: 'public/testserver_logo.jpeg',
        // email:'sales@sdw-ds.com',
        // phone: '0044 20 3627 0522',
        address: 'Office No 19, Floor 2, Al Arif Shipping Building, Dubai UAE',
    }
}
const currentConfig = appConfig[env.APP_ENV]
module.exports = currentConfig;