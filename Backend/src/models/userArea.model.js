
const { DataTypes } =
    require('sequelize')

const db =
    require('../config/database')

const UserArea =
    db.define(

        'UserArea',

        {

            user_id: {

                type:
                    DataTypes.INTEGER,

                allowNull:
                    false

            },

            area_id: {

                type:
                    DataTypes.INTEGER,

                allowNull:
                    false

            }

        },

        {

            tableName:
                'user_areas',

            timestamps:
                false

        }

    )

module.exports =
    UserArea

