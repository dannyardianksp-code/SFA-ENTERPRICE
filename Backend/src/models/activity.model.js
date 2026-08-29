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
    },

    // NULL = berlaku di semua channel. Diisi hanya kalau activity ini
    // khusus 1 channel tertentu.
    channel_id: DataTypes.INTEGER

}, {

    tableName: 'activities'

})

module.exports = Activity