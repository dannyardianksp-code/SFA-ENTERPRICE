const { DataTypes } = require('sequelize')
const db = require('../config/database')

// Field dinamis per Activity -- lihat migration 022 buat penjelasan
// lengkap. field_type dibatasi 5 nilai TETAP; options cuma dipakai
// DROPDOWN.
const ActivityFieldDefinition = db.define('ActivityFieldDefinition', {

    activity_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    label: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    field_type: {
        type: DataTypes.ENUM('TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'PHOTO'),
        allowNull: false,
    },

    // get() manual: driver mysql2 di sini mengembalikan kolom JSON
    // sebagai STRING mentah, bukan otomatis di-parse Sequelize -- pola
    // sama persis dengan incentiveRule.model.js (criteria_ids/roles).
    options: {
        type: DataTypes.JSON,
        allowNull: true,
        get() {
            const raw = this.getDataValue('options')
            if (raw === null || raw === undefined) return null
            return typeof raw === 'string' ? JSON.parse(raw) : raw
        },
    },

    required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },

    display_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },

}, {

    tableName: 'activity_field_definitions',
    createdAt: 'created_at',
    updatedAt: 'updated_at',

})

module.exports = ActivityFieldDefinition
