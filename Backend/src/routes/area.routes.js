const router =
    require('express').Router()

const Area =
    require('../models/area.model')

const User =
    require('../models/user.model')

const Customer =
    require('../models/customer.model')

const UserArea =
    require('../models/userArea.model')

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
            await Area.findAll()

        res.json(data)

    }

)

// CREATE -- ADMINISTRATOR saja. code dan name wajib; radius opsional
// (kosong = pakai default global, sama seperti update).
router.post(

    '/',

    auth,

    async (req, res) => {

        try {

            if (!req.user || !USER_MANAGER_ROLES.includes(req.user.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya administrator yang boleh mengelola area.'
                )
            }

            const { code, name, checkin_radius_meters } = req.body

            if (typeof code !== 'string' || code.trim() === '') {
                return sendError(res, 400, 'Code wajib diisi.')
            }

            if (typeof name !== 'string' || name.trim() === '') {
                return sendError(res, 400, 'Name wajib diisi.')
            }

            let radius = null

            if (checkin_radius_meters !== undefined && checkin_radius_meters !== null && checkin_radius_meters !== '') {

                radius = Number(checkin_radius_meters)

                if (!Number.isFinite(radius) || radius <= 0) {
                    return sendError(
                        res,
                        400,
                        'Radius harus berupa angka lebih besar dari 0, atau dikosongkan untuk pakai default.'
                    )
                }

            }

            const area = await Area.create({
                code: code.trim(),
                name: name.trim(),
                checkin_radius_meters: radius,
            })

            res.json(area)

        } catch (err) {
            return sendServerError(res, err, 'CREATE AREA')
        }

    }

)

// UPDATE -- ADMINISTRATOR saja, sama pola gerbang dengan user
// management.
router.put(

    '/:id',

    auth,

    async (req, res) => {

        try {

            if (!req.user || !USER_MANAGER_ROLES.includes(req.user.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya administrator yang boleh mengelola area.'
                )
            }

            const area = await Area.findByPk(req.params.id)

            if (!area) {
                return sendError(res, 404, 'Area tidak ditemukan.')
            }

            const { code, name, checkin_radius_meters } = req.body

            const perubahan = {}

            if (code !== undefined) perubahan.code = code
            if (name !== undefined) perubahan.name = name

            if (checkin_radius_meters !== undefined) {

                if (checkin_radius_meters === null || checkin_radius_meters === '') {
                    perubahan.checkin_radius_meters = null
                } else {

                    const radius = Number(checkin_radius_meters)

                    if (!Number.isFinite(radius) || radius <= 0) {
                        return sendError(
                            res,
                            400,
                            'Radius harus berupa angka lebih besar dari 0, atau dikosongkan untuk pakai default.'
                        )
                    }

                    perubahan.checkin_radius_meters = radius

                }

            }

            await area.update(perubahan)

            res.json(area)

        } catch (err) {
            return sendServerError(res, err, 'UPDATE AREA')
        }

    }

)

// DELETE -- ADMINISTRATOR saja. Ditolak (400) kalau area ini masih
// dipakai User/Customer/penugasan area (user_areas) -- users.area_id
// dan customers.area_id TIDAK punya FK constraint di database (dicek
// langsung lewat information_schema saat menulis endpoint ini), jadi
// tanpa pengecekan manual ini penghapusan akan "berhasil" tapi
// meninggalkan baris User/Customer yang menunjuk ke area_id yang
// sudah tidak ada.
router.delete(

    '/:id',

    auth,

    async (req, res) => {

        try {

            if (!req.user || !USER_MANAGER_ROLES.includes(req.user.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya administrator yang boleh mengelola area.'
                )
            }

            const area = await Area.findByPk(req.params.id)

            if (!area) {
                return sendError(res, 404, 'Area tidak ditemukan.')
            }

            const [jumlahUser, jumlahCustomer, jumlahPenugasan] = await Promise.all([
                User.count({ where: { area_id: req.params.id } }),
                Customer.count({ where: { area_id: req.params.id } }),
                UserArea.count({ where: { area_id: req.params.id } }),
            ])

            if (jumlahUser > 0 || jumlahCustomer > 0 || jumlahPenugasan > 0) {

                const bagian = []
                if (jumlahUser > 0) bagian.push(`${jumlahUser} user`)
                if (jumlahCustomer > 0) bagian.push(`${jumlahCustomer} customer`)
                if (jumlahPenugasan > 0) bagian.push(`${jumlahPenugasan} penugasan sales`)

                return sendError(
                    res,
                    400,
                    `Area ini tidak bisa dihapus -- masih dipakai oleh ${bagian.join(', ')}.`
                )

            }

            await area.destroy()

            res.json({ message: 'Area berhasil dihapus.' })

        } catch (err) {
            return sendServerError(res, err, 'DELETE AREA')
        }

    }

)

module.exports =
    router
