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
            }

        },
        {

            tableName: 'areas',

            freezeTableName: true

        }

    )

module.exports = Area