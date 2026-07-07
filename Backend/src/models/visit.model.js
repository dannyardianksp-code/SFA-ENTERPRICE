const { DataTypes } = require('sequelize')
const db = require('../config/database')
const User = require('./user.model')
const Customer = require('./customer.model')

const Visit = db.define('Visit', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: DataTypes.INTEGER,
    customer_id: DataTypes.INTEGER,
    checkin_time: DataTypes.DATE,
    latitude: DataTypes.STRING,
    longitude: DataTypes.STRING,
    checkout_time: DataTypes.DATE,
    visit_plan_id: DataTypes.INTEGER

}, {
    tableName: 'visits',
    timestamps: false
})
Visit.belongsTo(User, { foreignKey: 'user_id' })
Visit.belongsTo(Customer, { foreignKey: 'customer_id' })


module.exports = Visit