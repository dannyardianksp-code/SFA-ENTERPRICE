const router =
    require('express').Router()

const Class =
    require('../models/class.model')

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
            await Class.findAll()

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
                    'Hanya administrator yang boleh mengelola class.'
                )
            }

            const { code, name } = req.body

            if (typeof code !== 'string' || code.trim() === '') {
                return sendError(res, 400, 'Code wajib diisi.')
            }

            if (typeof name !== 'string' || name.trim() === '') {
                return sendError(res, 400, 'Name wajib diisi.')
            }

            const kelas = await Class.create({
                code: code.trim(),
                name: name.trim(),
            })

            res.json(kelas)

        } catch (err) {
            return sendServerError(res, err, 'CREATE CLASS')
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
                    'Hanya administrator yang boleh mengelola class.'
                )
            }

            const kelas = await Class.findByPk(req.params.id)

            if (!kelas) {
                return sendError(res, 404, 'Class tidak ditemukan.')
            }

            const { code, name } = req.body

            const perubahan = {}

            if (code !== undefined) perubahan.code = code
            if (name !== undefined) perubahan.name = name

            await kelas.update(perubahan)

            res.json(kelas)

        } catch (err) {
            return sendServerError(res, err, 'UPDATE CLASS')
        }

    }

)

// DELETE -- ADMINISTRATOR saja. Ditolak (400) kalau class ini masih
// dipakai Customer -- customers.class_id TIDAK punya FK constraint di
// database (dicek langsung lewat information_schema saat menulis
// endpoint ini), jadi tanpa pengecekan manual ini penghapusan akan
// "berhasil" tapi meninggalkan baris Customer yang menunjuk ke
// class_id yang sudah tidak ada.
router.delete(

    '/:id',

    auth,

    async (req, res) => {

        try {

            if (!req.user || !USER_MANAGER_ROLES.includes(req.user.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya administrator yang boleh mengelola class.'
                )
            }

            const kelas = await Class.findByPk(req.params.id)

            if (!kelas) {
                return sendError(res, 404, 'Class tidak ditemukan.')
            }

            const jumlahCustomer = await Customer.count({
                where: { class_id: req.params.id }
            })

            if (jumlahCustomer > 0) {
                return sendError(
                    res,
                    400,
                    `Class ini tidak bisa dihapus -- masih dipakai oleh ${jumlahCustomer} customer.`
                )
            }

            await kelas.destroy()

            res.json({ message: 'Class berhasil dihapus.' })

        } catch (err) {
            return sendServerError(res, err, 'DELETE CLASS')
        }

    }

)

module.exports =
    router
