const { DataTypes } = require('sequelize')
const db = require('../config/database')
const User = require('./user.model')

const Attendance = db.define('Attendance', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: DataTypes.INTEGER,
    tanggal: DataTypes.DATEONLY,
    clock_in_time: DataTypes.DATE,
    clock_in_latitude: DataTypes.STRING,
    clock_in_longitude: DataTypes.STRING,
    clock_in_accuracy: DataTypes.DECIMAL(7, 2),
    clock_in_photo_url: DataTypes.TEXT,
    clock_out_time: DataTypes.DATE,
    clock_out_latitude: DataTypes.STRING,
    clock_out_longitude: DataTypes.STRING,
    clock_out_accuracy: DataTypes.DECIMAL(7, 2),
    clock_out_photo_url: DataTypes.TEXT,
    created_at: DataTypes.DATE,
}, {
    tableName: 'attendances',
    timestamps: false
})
Attendance.belongsTo(User, { foreignKey: 'user_id' })


module.exports = Attendance
