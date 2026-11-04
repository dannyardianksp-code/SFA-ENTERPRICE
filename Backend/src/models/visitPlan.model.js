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
            },

            // 'SCHEDULED' (dibuat lewat Visit Plan biasa) atau 'ADHOC'
            // (dibuat otomatis dari Visit Nearby -- lihat
            // visit.controller.js checkInNearby). Dicatat cuma buat
            // laporan nanti bisa membedakan kalau perlu; tidak mengubah
            // alur check-in/activity/checkout yang sudah ada.
            source: {
                type: DataTypes.STRING,
                defaultValue: 'SCHEDULED'
            }

        },
        {
            tableName: 'visit_plans',
            timestamps: false
        }
    )

module.exports = VisitPlan