const { DataTypes } = require('sequelize')

const db =
    require('../config/database')

const VisitActivity =
    db.define(

        'VisitActivity',

        {

            visit_id: {

                type: DataTypes.INTEGER,

                allowNull: false

            },

            activity_id:
                DataTypes.STRING,

            product_name:
                DataTypes.STRING,

            qty:
                DataTypes.INTEGER,

            expired_date:
                DataTypes.DATEONLY,

            normal_price:
                DataTypes.DECIMAL(18, 2),

            promo_price:
                DataTypes.DECIMAL(18, 2),

            notes:
                DataTypes.TEXT,

            photo_url:
                DataTypes.TEXT,

            created_at:
                DataTypes.DATE

        },

        {

            tableName:
                'visit_activities',

            timestamps: false

        }

    )

module.exports =
    VisitActivity