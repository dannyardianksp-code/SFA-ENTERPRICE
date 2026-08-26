const { DataTypes } = require('sequelize')
const db = require('../config/database')

const Product = db.define('Product', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    code: DataTypes.STRING,
    name: DataTypes.STRING,
    price: DataTypes.DECIMAL,
    uom: DataTypes.STRING,
    is_active: DataTypes.BOOLEAN,

    // Nilai bebas di database (VARCHAR), tapi konvensi aplikasi cuma
    // dua: 'JUAL' dan 'PROMOSI'. null/nilai lain diperlakukan sebagai
    // 'JUAL' di sisi klien (default kategori paling umum), bukan
    // dipaksa lewat kolom database supaya baris lama yang belum diisi
    // tidak perlu migrasi data terpisah.
    category: DataTypes.STRING,

    photo_url: DataTypes.TEXT,
}, {
    tableName: 'products',
    timestamps: false
})

module.exports = Product