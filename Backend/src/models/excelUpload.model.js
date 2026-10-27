const { DataTypes } = require('sequelize')
const db = require('../config/database')

// Metadata file Excel yang disimpan di S3 (isi file-nya sendiri TIDAK
// di database). s3_bucket disimpan per baris supaya file lama tetap
// bisa diakses walaupun setting bucket diganti sesudahnya.
const ExcelUpload = db.define('ExcelUpload', {

    original_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },

    s3_bucket: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },

    s3_key: {
        type: DataTypes.STRING(1024),
        allowNull: false,
    },

    size_bytes: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },

    content_type: DataTypes.STRING(255),

    uploaded_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
    },

}, {
    tableName: 'excel_uploads',
    timestamps: false,
})

module.exports = ExcelUpload
