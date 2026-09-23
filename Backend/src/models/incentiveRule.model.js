const { DataTypes } = require('sequelize')
const db = require('../config/database')

// Skema insentif -- lihat migration 020 buat penjelasan lengkap tiap
// kolom (criteria_ids, roles keduanya JSON, ambang_minimal % buat
// hitungBonus di src/utils/incentive.util.js).
const IncentiveRule = db.define('IncentiveRule', {

    nama: {
        type: DataTypes.STRING,
        allowNull: false
    },

    jenis: {
        type: DataTypes.ENUM('CUSTOMER_GROUP_VISIT', 'ACTIVITY'),
        allowNull: false
    },

    criteria_ids: {
        type: DataTypes.JSON,
        allowNull: false
    },

    target: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    frekuensi: {
        type: DataTypes.ENUM('HARIAN', 'BULANAN'),
        allowNull: false
    },

    bonus: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },

    ambang_minimal: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 80
    },

    roles: {
        type: DataTypes.JSON,
        allowNull: false
    },

    aktif: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }

}, {

    tableName: 'incentive_rules',
    createdAt: 'created_at',
    updatedAt: 'updated_at'

})

module.exports = IncentiveRule
