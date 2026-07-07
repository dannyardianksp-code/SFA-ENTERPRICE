const SalesOrder = require('../models/salesOrder.model')
const SalesOrderItem = require('../models/salesOrderItem.model')
const Product = require('../models/product.model')
const User = require('../models/user.model')
const Customer = require('../models/customer.model')
const { Op } = require('sequelize')
const Visit = require('../models/visit.model')

// CREATE ORDER
exports.create = async (req, res) => {
    try {
        const { customer_id, items } = req.body
        const user_id = req.user.id

        // 🔥 1. CARI VISIT TERDEKAT (OPSIONAL)
        const now = new Date()
        const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000))

        const visit = await Visit.findOne({
            where: {
                user_id,
                customer_id,
                checkin_time: {
                    [Op.gte]: oneHourAgo
                }
            },
            order: [['checkin_time', 'DESC']]
        })

        // 🔥 2. HITUNG TOTAL
        let total = 0

        for (let item of items) {
            const product = await Product.findByPk(item.product_id)
            total += product.price * item.qty
            item.price = product.price
        }

        // 🔥 3. CREATE ORDER (MASUKIN visit_id)
        const order = await SalesOrder.create({
            doc_no: 'SO-' + Date.now(),
            user_id,
            customer_id,
            doc_date: new Date(),
            total,
            status: 'DRAFT',
            visit_id: visit ? visit.id : null
        })

        // 🔥 4. CREATE ITEMS
        for (let item of items) {
            await SalesOrderItem.create({
                sales_order_id: order.id,
                product_id: item.product_id,
                qty: item.qty,
                price: item.price
            })
        }

        res.json({
            message: 'Order created',
            order_id: order.id,
            visit_id: visit ? visit.id : null
        })

    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

exports.getAll = async (req, res) => {
    try {
        const orders = await SalesOrder.findAll({
            include: [
                { model: Visit },
                { model: Customer, attributes: ['name'] },
                { model: User, attributes: ['name'] }
            ]
        })

        res.json(orders)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}