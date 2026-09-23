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

    // get() manual: driver mysql2 yang dipakai di sini mengembalikan
    // kolom JSON sebagai STRING mentah, bukan otomatis di-parse Sequelize
    // seperti pada dialect lain -- tanpa ini setiap pemanggil menerima
    // "[1,2]" (string) dan Op.in/.map di controller meledak diam-diam.
    criteria_ids: {
        type: DataTypes.JSON,
        allowNull: false,
        get() {
            const raw = this.getDataValue('criteria_ids')
            return typeof raw === 'string' ? JSON.parse(raw) : raw
        }
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
        allowNull: false,
        get() {
            const raw = this.getDataValue('roles')
            return typeof raw === 'string' ? JSON.parse(raw) : raw
        }
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
