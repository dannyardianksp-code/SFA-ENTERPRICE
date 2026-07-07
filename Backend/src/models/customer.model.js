const { DataTypes } = require('sequelize')
const db = require('../config/database')

const Customer = db.define('Customer', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    code: DataTypes.STRING,
    name: DataTypes.STRING,
    address: DataTypes.TEXT,
    owner_name: DataTypes.STRING,
    phone: DataTypes.STRING,
    latitude: DataTypes.STRING,
    longitude: DataTypes.STRING,
    channel: DataTypes.STRING,
    customer_group_id: DataTypes.INTEGER
}, {
    tableName: 'customers',
    timestamps: false
})

module.exports = Customer