const env = require('../config.env');

const appConfig = {
    development: {
        companyName: 'SDW',
        logo: 'public/testserver_logo.jpeg',
        email:'sales@sdw-ds.com',
        phone: '0044 20 3627 0522',
        address: 'Office No 19, Floor 2, Al Arif Shipping Building, Dubai UAE',
    },
    production: {
        companyName: 'SPICE DIRECT WHOLESALE',
        logo: 'public/0.png',
        email: 'orders@spicedirectwholesale.co.uk',
        phone: '0141 530 3120',
        address: '225 Bernard Street, Glasgow, G403NX',
    }
}
const currentConfig = appConfig[env.APP_ENV]
module.exports = currentConfig;