const router = require('express').Router()

const CustomerGroup =
    require('../models/customerGroup.model')

const Customer =
    require('../models/customer.model')

const auth =
    require('../middleware/auth.middleware')

const { sendError, sendServerError } =
    require('../utils/response.util')

const { USER_MANAGER_ROLES } =
    require('../utils/access.util')

router.get(
    '/',
    auth,
    async (req, res) => {

        const data =
            await CustomerGroup.findAll()

        res.json(data)

    }
)

// CREATE -- ADMINISTRATOR saja.
router.post(

    '/',

    auth,

    async (req, res) => {

        try {

            if (!req.user || !USER_MANAGER_ROLES.includes(req.user.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya administrator yang boleh mengelola customer group.'
                )
            }

            const { code, name } = req.body

            if (typeof code !== 'string' || code.trim() === '') {
                return sendError(res, 400, 'Code wajib diisi.')
            }

            if (typeof name !== 'string' || name.trim() === '') {
                return sendError(res, 400, 'Name wajib diisi.')
            }

            const grup = await CustomerGroup.create({
                code: code.trim(),
                name: name.trim(),
            })

            res.json(grup)

        } catch (err) {
            return sendServerError(res, err, 'CREATE CUSTOMER GROUP')
        }

    }

)

// UPDATE -- ADMINISTRATOR saja.
router.put(

    '/:id',

    auth,

    async (req, res) => {

        try {

            if (!req.user || !USER_MANAGER_ROLES.includes(req.user.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya administrator yang boleh mengelola customer group.'
                )
            }

            const grup = await CustomerGroup.findByPk(req.params.id)

            if (!grup) {
                return sendError(res, 404, 'Customer group tidak ditemukan.')
            }

            const { code, name } = req.body

            const perubahan = {}

            if (code !== undefined) perubahan.code = code
            if (name !== undefined) perubahan.name = name

            await grup.update(perubahan)

            res.json(grup)

        } catch (err) {
            return sendServerError(res, err, 'UPDATE CUSTOMER GROUP')
        }

    }

)

// DELETE -- ADMINISTRATOR saja. Ditolak (400) kalau customer group ini
// masih dipakai Customer -- customers.customer_group_id TIDAK punya FK
// constraint di database, jadi tanpa pengecekan manual ini penghapusan
// akan "berhasil" tapi meninggalkan baris Customer yang menunjuk ke
// customer_group_id yang sudah tidak ada.
router.delete(

    '/:id',

    auth,

    async (req, res) => {

        try {

            if (!req.user || !USER_MANAGER_ROLES.includes(req.user.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya administrator yang boleh mengelola customer group.'
                )
            }

            const grup = await CustomerGroup.findByPk(req.params.id)

            if (!grup) {
                return sendError(res, 404, 'Customer group tidak ditemukan.')
            }

            const jumlahCustomer = await Customer.count({
                where: { customer_group_id: req.params.id }
            })

            if (jumlahCustomer > 0) {
                return sendError(
                    res,
                    400,
                    `Customer group ini tidak bisa dihapus -- masih dipakai oleh ${jumlahCustomer} customer.`
                )
            }

            await grup.destroy()

            res.json({ message: 'Customer group berhasil dihapus.' })

        } catch (err) {
            return sendServerError(res, err, 'DELETE CUSTOMER GROUP')
        }

    }

)

module.exports = router
