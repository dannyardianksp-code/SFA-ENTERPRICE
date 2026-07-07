const { DataTypes } = require('sequelize')
const db = require('../config/database')
const User = require('./user.model')
const Customer = require('./customer.model')
const Visit = require('./visit.model')

const SalesOrder = db.define('SalesOrder', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    doc_no: DataTypes.STRING,
    user_id: DataTypes.INTEGER,
    customer_id: DataTypes.INTEGER,
    doc_date: DataTypes.DATE,
    total: DataTypes.DECIMAL,
    status: DataTypes.STRING
}, {
    tableName: 'sales_orders',
    timestamps: false
})

SalesOrder.belongsTo(User, { foreignKey: 'user_id' })
SalesOrder.belongsTo(Customer, { foreignKey: 'customer_id' })
SalesOrder.belongsTo(Visit, { foreignKey: 'visit_id' })

module.exports = SalesOrder