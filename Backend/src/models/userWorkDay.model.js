const { DataTypes } = require('sequelize')
const db = require('../config/database')

// Hari kerja per user per periode -- lihat migration 019 buat alasan
// kenapa ini diisi manual, bukan dihitung dari kalender.
const UserWorkDay = db.define('UserWorkDay', {

    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    // 'YYYY-MM'
    period: {
        type: DataTypes.STRING(7),
        allowNull: false
    },

    hari_kerja: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    }

}, {

    tableName: 'user_work_days',
    createdAt: false,
    updatedAt: 'updated_at'

})

module.exports = UserWorkDay
