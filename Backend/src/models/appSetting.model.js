const { DataTypes } = require('sequelize')
const db = require('../config/database')

// Setting global key/value yang diatur ADMINISTRATOR dari web. JANGAN
// simpan rahasia di sini (password, secret key) -- tabel ini dibaca
// balik utuh lewat API setting.
const AppSetting = db.define('AppSetting', {

    setting_key: {
        type: DataTypes.STRING(64),
        primaryKey: true,
    },

    setting_value: DataTypes.TEXT,

    updated_by: DataTypes.INTEGER,

    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
    },

}, {
    tableName: 'app_settings',
    timestamps: false,
})

module.exports = AppSetting
