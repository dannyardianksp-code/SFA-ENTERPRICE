const {
    DataTypes
} = require('sequelize')

const sequelize =
    require('../config/database')

const Channel =
    sequelize.define(

        'Channel',

        {

            code: {
                type: DataTypes.STRING
            },

            name: {
                type: DataTypes.STRING
            }

        },

        {

            tableName: 'channels',

            freezeTableName: true

        }

    )

module.exports = Channel