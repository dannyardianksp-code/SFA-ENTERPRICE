const { DataTypes } = require('sequelize')
const db = require('../config/database')

const CustomerGroup = db.define('CustomerGroup', {

    name: DataTypes.STRING

}, {
    tableName: 'customer_groups',
    timestamps: false
})

module.exports = CustomerGroup