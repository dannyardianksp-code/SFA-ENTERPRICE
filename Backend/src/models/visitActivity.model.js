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

            // int(11) dengan FK ke activities.id -- model ini
            // sebelumnya salah mendeklarasikan STRING, kebetulan tidak
            // masalah karena koersi longgar MySQL, tapi salah.
            activity_id:
                DataTypes.INTEGER,

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