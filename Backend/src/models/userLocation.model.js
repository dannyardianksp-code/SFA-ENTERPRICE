const { DataTypes } = require('sequelize')
const db = require('../config/database')

// 1 baris per user (PK = user_id), ditimpa tiap ping -- bukan
// history/log perjalanan, cuma posisi TERAKHIR yang diketahui.
const UserLocation = db.define('UserLocation', {

    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
    },

    latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
    },

    longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
    },

    accuracy: DataTypes.DECIMAL(7, 2),

    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
    },

}, {
    tableName: 'user_locations',
    timestamps: false,
})

module.exports = UserLocation
