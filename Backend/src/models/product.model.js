const { DataTypes } = require('sequelize')
const db = require('../config/database')

const Product = db.define('Product', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    code: DataTypes.STRING,
    name: DataTypes.STRING,
    price: DataTypes.DECIMAL,
    uom: DataTypes.STRING
}, {
    tableName: 'products',
    timestamps: false
})

module.exports = Product