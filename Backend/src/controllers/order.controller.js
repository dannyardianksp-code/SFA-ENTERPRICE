const SalesOrder = require('../models/salesOrder.model')
const SalesOrderItem = require('../models/salesOrderItem.model')
const Product = require('../models/product.model')
const User = require('../models/user.model')
const Customer = require('../models/customer.model')
const { Op } = require('sequelize')
const Visit = require('../models/visit.model')

const { sendServerError } = require('../utils/response.util')
const {
    resolveSubordinateUserIds,
    ownerWhere,
} = require('../utils/access.util')

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
        return sendServerError(res, err, 'CREATE ORDER')
    }
}

exports.getAll = async (req, res) => {
    try {

        // SalesOrder punya user_id sendiri, jadi kepemilikannya langsung
        // — tidak perlu lewat relasi Visit.
        const bolehDilihat =
            await resolveSubordinateUserIds(req.user)

        const where = ownerWhere(bolehDilihat)

        // ?mine=1 -- opt-in eksplisit dipakai mobile (layar Report Order
        // adalah riwayat PRIBADI). Pola sama dengan ?mine=1 di
        // GET /api/visits dan GET /api/visit-plans. Perilaku default
        // (tanpa param) TIDAK berubah -- sfa-web/app/orders/page.tsx
        // memanggil endpoint ini tanpa parameter apa pun dan
        // mengharapkan daftar subtree penuh.
        if (req.query.mine === '1') {
            where.user_id = req.user.id
        }

        const orders = await SalesOrder.findAll({
            where,
            include: [
                { model: Visit },
                { model: Customer, attributes: ['name'] },
                // attributes DIBATASI dengan sengaja: relasi ini
                // mengambil dari tabel users, dan tanpa batas ini
                // seluruh baris termasuk hash bcrypt masuk ke respons.
                { model: User, attributes: ['name'] }
            ]
        })

        res.json(orders)
    } catch (err) {
        return sendServerError(res, err, 'GET ALL ORDER')
    }
}
