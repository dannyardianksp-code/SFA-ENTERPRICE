const { DataTypes } = require('sequelize')
const db = require('../config/database')

const Customer = db.define('Customer', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    code: DataTypes.STRING,
    name: DataTypes.STRING,
    address: DataTypes.TEXT,
    owner_name: DataTypes.STRING,
    phone: DataTypes.STRING,
    latitude: DataTypes.STRING,
    longitude: DataTypes.STRING,
    location_accuracy: DataTypes.DECIMAL(7, 2),
    channel: DataTypes.STRING,
    customer_group_id: DataTypes.INTEGER,

    // Diisi manual oleh controller update, bukan oleh Sequelize.
    // `timestamps: false` dipertahankan: menyalakannya memaksa adanya
    // created_at juga, sedangkan customer lama tidak punya waktu
    // pembuatan dan kolom itu akan terpaksa diisi tanggal palsu.
    updated_at: DataTypes.DATE,
    updated_by: DataTypes.INTEGER
}, {
    tableName: 'customers',
    timestamps: false
})

module.exports = Customer