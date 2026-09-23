const { DataTypes } = require('sequelize')
const db = require('../config/database')

const User = db.define('User', {
    code: {
        type: DataTypes.STRING,
        unique: true
    },
    name: DataTypes.STRING,
    email: {
        type: DataTypes.STRING,
        unique: true
    },
    password: DataTypes.STRING,
    role: {
        type: DataTypes.ENUM(
            'MD',
            'SPG',
            'SALES',
            'SUPERVISOR',
            'MANAGER',
            'REGIONAL MANAGER',
            'GENERAL MANAGER',
            'ADMINISTRATOR'
        ),
        defaultValue: 'MD'
    },
    // Kontrol admin per-user: boleh/tidaknya login lewat sfa-web.
    // Dicek di auth.controller.js saat platform login === 'web'.
    can_access_web: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    area_id: DataTypes.INTEGER,
    channel_id: DataTypes.INTEGER,
    supervisor_id: DataTypes.INTEGER,
    // Tarif gaji harian -- NULL berarti belum diset (bukan Rp 0). Lihat
    // payroll.controller.js.
    daily_rate: DataTypes.DECIMAL(10, 2),
    // Kolomnya varchar(20) di database, bukan ENUM, jadi tipenya STRING.
    // defaultValue dipasang di sini supaya user yang dibuat lewat
    // POST /api/users tidak dikembalikan dengan status: undefined.
    status: {
        type: DataTypes.STRING,
        defaultValue: 'ACTIVE'
    },
}, {
    tableName: 'users',
    timestamps: false
})

module.exports = User