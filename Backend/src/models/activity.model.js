const { DataTypes } = require('sequelize')
const db = require('../config/database')

const Activity = db.define('Activity', {

    code: {
        type: DataTypes.STRING,
        allowNull: false
    },

    name: {
        type: DataTypes.STRING,
        allowNull: false
    }

}, {

    tableName: 'activities'

})

module.exports = Activity