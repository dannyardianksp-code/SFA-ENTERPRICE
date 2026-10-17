const {
    DataTypes
} = require('sequelize')

const sequelize =
    require('../config/database')

const Area =
    sequelize.define(

        'Area',

        {

            code: {
                type: DataTypes.STRING
            },

            name: {
                type: DataTypes.STRING
            },

            // NULL = pakai default global (lihat DEFAULT_CHECKIN_RADIUS_METERS
            // di visit.controller.js). Cuma diisi buat area yang butuh
            // radius beda dari 50m (mis. sinyal GPS jelek).
            checkin_radius_meters: {
                type: DataTypes.INTEGER
            },

            // IANA timezone zona area ini -- dipakai nampilin jam/tanggal
            // report (Attendance, dst) sesuai waktu SETEMPAT pegawai,
            // bukan dipaksa WIB. Default 'Asia/Jakarta' (WIB) -- area di
            // luar Jawa/Sumatra diubah manual ke 'Asia/Makassar' (WITA)
            // atau 'Asia/Jayapura' (WIT) lewat Area Management.
            timezone: {
                type: DataTypes.STRING,
                defaultValue: 'Asia/Jakarta',
            }

        },
        {

            tableName: 'areas',

            freezeTableName: true

        }

    )

module.exports = Area