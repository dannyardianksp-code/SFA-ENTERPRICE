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
        type: DataTypes.ENUM('SPG', 'ADMIN', 'SPV'),
        defaultValue: 'SPG'
    },
    area_id: DataTypes.INTEGER,
    channel_id: DataTypes.INTEGER,
    supervisor_id: DataTypes.INTEGER,
}, {
    tableName: 'users',
    timestamps: false
})

module.exports = User