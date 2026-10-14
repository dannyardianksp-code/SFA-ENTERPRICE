const { DataTypes } = require('sequelize')
const db = require('../config/database')

// Cuma nyimpen OVERRIDE dari default per grup menu (lihat migration
// 016) -- tidak ada baris berarti "pakai default", bukan "sembunyikan
// semua". Sejak migration 025, override-nya per (channel, role) --
// tiap channel ngatur sendiri, TIDAK ADA baris "semua channel".
const RoleMenuOverride = db.define('RoleMenuOverride', {
    channel_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
    },
    role: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    menu_key: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    visible: DataTypes.BOOLEAN,
}, {
    tableName: 'role_menu_overrides',
    timestamps: false,
})

module.exports = RoleMenuOverride
