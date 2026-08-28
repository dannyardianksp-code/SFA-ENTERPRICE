const router =
    require('express').Router()

const Area =
    require('../models/area.model')

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
// management. Cuma name/code/checkin_radius_meters, area tidak
// pernah dibuat/dihapus lewat endpoint ini (43 area sudah di-seed,
// menambah/menghapus butuh koordinasi struktur organisasi yang lebih
// luas -- di luar cakupan halaman ini).
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

module.exports =
    router
