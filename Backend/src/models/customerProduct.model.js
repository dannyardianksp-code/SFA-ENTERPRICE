const { DataTypes } =
    require('sequelize')

const sequelize =
    require('../config/database')

const CustomerProduct =
    sequelize.define(
        'CustomerProduct',
        {

            customer_id: {
                type: DataTypes.INTEGER,
                primaryKey: true
            },

            product_id: {
                type: DataTypes.INTEGER,
                primaryKey: true
            }

        },
        {
            tableName: 'customer_products',
            timestamps: false
        }
    )

module.exports = CustomerProduct