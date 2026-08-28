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
            'SPG',
            'SUPERVISOR',
            'MANAGER',
            'REGIONAL MANAGER',
            'GENERAL MANAGER',
            'ADMINISTRATOR'
        ),
        defaultValue: 'SPG'
    },
    area_id: DataTypes.INTEGER,
    channel_id: DataTypes.INTEGER,
    supervisor_id: DataTypes.INTEGER,
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