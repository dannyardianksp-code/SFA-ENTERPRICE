const {
    DataTypes
} = require('sequelize')

const sequelize =
    require('../config/database')

const Class =
    sequelize.define(

        'Class',

        {

            code: {
                type: DataTypes.STRING
            },

            name: {
                type: DataTypes.STRING
            },

            // NULL = berlaku buat semua channel (default) -- sama pola
            // dengan Activity.channel_id. Klasifikasi toko beda gaya per
            // channel (PASAR/GROSIR untuk general trade, MODERN MARKET
            // untuk modern trade, dst), jadi admin bisa membatasi
            // class tertentu cuma muncul di satu channel.
            channel_id: {
                type: DataTypes.INTEGER
            }

        },

        {

            tableName: 'classes',

            freezeTableName: true

        }

    )

module.exports = Class
