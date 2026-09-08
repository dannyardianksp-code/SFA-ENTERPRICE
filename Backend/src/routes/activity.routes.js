const router = require('express').Router()

const { Op } = require('sequelize')

const Activity =
    require('../models/activity.model')

const VisitActivity =
    require('../models/visitActivity.model')

const auth =
    require('../middleware/auth.middleware')

const { sendError, sendServerError } =
    require('../utils/response.util')

const { RESTRICTED_ROLES, USER_MANAGER_ROLES } =
    require('../utils/access.util')


// GET -- role dibatasi (SPG/SUPERVISOR) hanya melihat activity
// universal (channel_id NULL) atau yang cocok dengan channel_id
// miliknya sendiri. Role lain (termasuk ADMINISTRATOR yang mengelola
// Activity Master) melihat semuanya -- fail-closed: user tanpa
// channel_id yang restricted mendapat sentinel -1 supaya tetap hanya
// melihat activity universal, bukan semuanya.
router.get(
    '/',
    auth,
    async (req, res) => {

        const channelWhere =
            RESTRICTED_ROLES.includes(req.user.role)
                ? {
                    [Op.or]: [
                        { channel_id: null },
                        { channel_id: req.user.channel_id ?? -1 },
                    ],
                }
                : {}

        const data =
            await Activity.findAll({

                where: channelWhere,

                order: [
                    ['id', 'ASC']
                ]

            })

        res.json(data)

    }
)


// CREATE -- ADMINISTRATOR saja (Activity Master, sama seperti Class/Area).
router.post(
    '/',
    auth,
    async (req, res) => {

        try {

            if (!req.user || !USER_MANAGER_ROLES.includes(req.user.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya administrator yang boleh mengelola activity.'
                )
            }

            const { code, name, channel_id } = req.body

            const data =
                await Activity.create({

                    code,
                    name,
                    channel_id: channel_id || null,

                })

            res.json(data)

        } catch (err) {
            return sendServerError(res, err, 'CREATE ACTIVITY')
        }

    }
)


// UPDATE -- ADMINISTRATOR saja. Belum ada sebelumnya; form Edit di web
// sudah lama memanggil endpoint ini tanpa hasil (404 diam-diam).
router.put(
    '/:id',
    auth,
    async (req, res) => {

        try {

            if (!req.user || !USER_MANAGER_ROLES.includes(req.user.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya administrator yang boleh mengelola activity.'
                )
            }

            const activity = await Activity.findByPk(req.params.id)

            if (!activity) {
                return sendError(res, 404, 'Activity tidak ditemukan.')
            }

            const { code, name, channel_id } = req.body

            const perubahan = {}

            if (code !== undefined) perubahan.code = code
            if (name !== undefined) perubahan.name = name
            if (channel_id !== undefined) perubahan.channel_id = channel_id || null

            await activity.update(perubahan)

            res.json(activity)

        } catch (err) {
            return sendServerError(res, err, 'UPDATE ACTIVITY')
        }

    }
)

// DELETE -- ADMINISTRATOR saja. Ditolak (400, bukan 500 dari FK
// constraint mentah) kalau activity ini pernah dipakai di visit_activities
// -- menghapusnya akan merusak riwayat activity yang sudah tercatat.
router.delete(
    '/:id',
    auth,
    async (req, res) => {

        try {

            if (!req.user || !USER_MANAGER_ROLES.includes(req.user.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya administrator yang boleh mengelola activity.'
                )
            }

            const activity = await Activity.findByPk(req.params.id)

            if (!activity) {
                return sendError(res, 404, 'Activity tidak ditemukan.')
            }

            const jumlahDipakai = await VisitActivity.count({
                where: { activity_id: req.params.id }
            })

            if (jumlahDipakai > 0) {
                return sendError(
                    res,
                    400,
                    `Activity ini tidak bisa dihapus -- masih dipakai di ${jumlahDipakai} riwayat kunjungan.`
                )
            }

            await activity.destroy()

            res.json({ message: 'Activity berhasil dihapus.' })

        } catch (err) {
            return sendServerError(res, err, 'DELETE ACTIVITY')
        }

    }
)

module.exports = router
