const router =
    require('express').Router()

const Channel =
    require('../models/channel.model')

const Area =
    require('../models/area.model')

const Class =
    require('../models/class.model')

const Activity =
    require('../models/activity.model')

const User =
    require('../models/user.model')

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
            await Channel.findAll()

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
                    'Hanya administrator yang boleh mengelola channel.'
                )
            }

            const { code, name } = req.body

            if (typeof code !== 'string' || code.trim() === '') {
                return sendError(res, 400, 'Code wajib diisi.')
            }

            if (typeof name !== 'string' || name.trim() === '') {
                return sendError(res, 400, 'Name wajib diisi.')
            }

            const channel = await Channel.create({
                code: code.trim(),
                name: name.trim(),
            })

            res.json(channel)

        } catch (err) {
            return sendServerError(res, err, 'CREATE CHANNEL')
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
                    'Hanya administrator yang boleh mengelola channel.'
                )
            }

            const channel = await Channel.findByPk(req.params.id)

            if (!channel) {
                return sendError(res, 404, 'Channel tidak ditemukan.')
            }

            const { code, name } = req.body

            const perubahan = {}

            if (code !== undefined) perubahan.code = code
            if (name !== undefined) perubahan.name = name

            await channel.update(perubahan)

            res.json(channel)

        } catch (err) {
            return sendServerError(res, err, 'UPDATE CHANNEL')
        }

    }

)

// DELETE -- ADMINISTRATOR saja. Ditolak (400) kalau channel ini masih
// dipakai Area/Class/Activity/User -- semuanya nyimpen channel_id
// langsung tanpa FK constraint di database, jadi tanpa pengecekan
// manual ini penghapusan akan "berhasil" tapi meninggalkan baris-baris
// itu menunjuk ke channel_id yang sudah tidak ada.
router.delete(

    '/:id',

    auth,

    async (req, res) => {

        try {

            if (!req.user || !USER_MANAGER_ROLES.includes(req.user.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya administrator yang boleh mengelola channel.'
                )
            }

            const channel = await Channel.findByPk(req.params.id)

            if (!channel) {
                return sendError(res, 404, 'Channel tidak ditemukan.')
            }

            const [jumlahArea, jumlahClass, jumlahActivity, jumlahUser] =
                await Promise.all([
                    Area.count({ where: { channel_id: req.params.id } }),
                    Class.count({ where: { channel_id: req.params.id } }),
                    Activity.count({ where: { channel_id: req.params.id } }),
                    User.count({ where: { channel_id: req.params.id } }),
                ])

            const jumlahDipakai =
                jumlahArea + jumlahClass + jumlahActivity + jumlahUser

            if (jumlahDipakai > 0) {

                const rincian = [
                    jumlahArea > 0 ? `${jumlahArea} area` : null,
                    jumlahClass > 0 ? `${jumlahClass} class` : null,
                    jumlahActivity > 0 ? `${jumlahActivity} activity` : null,
                    jumlahUser > 0 ? `${jumlahUser} user` : null,
                ].filter(Boolean).join(', ')

                return sendError(
                    res,
                    400,
                    `Channel ini tidak bisa dihapus -- masih dipakai oleh ${rincian}.`
                )
            }

            await channel.destroy()

            res.json({ message: 'Channel berhasil dihapus.' })

        } catch (err) {
            return sendServerError(res, err, 'DELETE CHANNEL')
        }

    }

)

module.exports =
    router
