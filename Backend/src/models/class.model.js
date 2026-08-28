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
            }

        },

        {

            tableName: 'classes',

            freezeTableName: true

        }

    )

module.exports = Class
