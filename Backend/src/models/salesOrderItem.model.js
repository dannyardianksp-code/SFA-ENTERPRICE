const { DataTypes } = require('sequelize')
const db = require('../config/database')

const SalesOrderItem = db.define('SalesOrderItem', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    sales_order_id: DataTypes.INTEGER,
    product_id: DataTypes.INTEGER,
    qty: DataTypes.INTEGER,
    price: DataTypes.DECIMAL
}, {
    tableName: 'sales_order_items',
    timestamps: false
})

module.exports = SalesOrderItem