const { DataTypes } = require('sequelize')
const db = require('../config/database')

const GroupProduct = db.define('GroupProduct', {

    customer_group_id: DataTypes.INTEGER,

    product_id: DataTypes.INTEGER

}, {
    tableName: 'group_products',
    timestamps: false
})

module.exports = GroupProduct