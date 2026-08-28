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
            }

        },
        {

            tableName: 'areas',

            freezeTableName: true

        }

    )

module.exports = Area