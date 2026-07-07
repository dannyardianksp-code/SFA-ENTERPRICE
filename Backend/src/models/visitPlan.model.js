const { DataTypes } =
    require('sequelize')

const sequelize =
    require('../config/database')

const VisitPlan =
    sequelize.define(
        'VisitPlan',
        {

            user_id: {
                type: DataTypes.INTEGER
            },

            customer_id: {
                type: DataTypes.INTEGER
            },

            visit_date: {
                type: DataTypes.DATEONLY
            },

            status: {
                type: DataTypes.STRING,
                defaultValue: 'PENDING'
            }

        },
        {
            tableName: 'visit_plans',
            timestamps: false
        }
    )

module.exports = VisitPlan