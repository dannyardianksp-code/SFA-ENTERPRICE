const router = require('express').Router()

const { Op } = require('sequelize')

const Activity =
    require('../models/activity.model')

const VisitActivity =
    require('../models/visitActivity.model')

const ActivityFieldDefinition =
    require('../models/activityFieldDefinition.model')

const auth =
    require('../middleware/auth.middleware')

const { sendError, sendServerError } =
    require('../utils/response.util')

const { RESTRICTED_ROLES, USER_MANAGER_ROLES } =
    require('../utils/access.util')

const db =
    require('../config/database')

const FIELD_TYPE_VALUES = ['TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'PRODUCT', 'PHOTO']

// Kategori produk tetap (lihat product.model.js) -- field PRODUCT boleh
// dibatasi ke SATU kategori ini (mis. activity Competitor cuma ambil
// item kategori COMPETITOR), atau tidak dibatasi (options null = semua
// kategori).
const PRODUCT_CATEGORY_VALUES = ['JUAL', 'PROMOSI', 'COMPETITOR']


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

// ======================
// FIELD DEFINITIONS -- form dinamis per activity
// ======================

// GET -- dibaca mobile (generate form) dan web (panel Atur Field).
// Tidak perlu gerbang tambahan: siapa pun yang sudah bisa lihat
// activity-nya lewat GET / boleh lihat field-nya.
router.get(
    '/:id/fields',
    auth,
    async (req, res) => {

        try {

            const fields = await ActivityFieldDefinition.findAll({
                where: { activity_id: req.params.id },
                order: [['display_order', 'ASC']],
            })

            res.json(fields)

        } catch (err) {
            return sendServerError(res, err, 'GET ACTIVITY FIELDS')
        }

    }
)

// PUT -- ADMINISTRATOR saja. Ganti SELURUH daftar field activity ini
// sekaligus (hapus-lalu-tulis-ulang dalam satu transaksi) -- sama pola
// dengan roleMenuAccess.controller.js saveForRole, karena panel Atur
// Field di web selalu mengirim daftar lengkap, bukan delta.
router.put(
    '/:id/fields',
    auth,
    async (req, res) => {

        try {

            if (!req.user || !USER_MANAGER_ROLES.includes(req.user.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya administrator yang boleh mengatur field activity.'
                )
            }

            const activity = await Activity.findByPk(req.params.id)

            if (!activity) {
                return sendError(res, 404, 'Activity tidak ditemukan.')
            }

            const { fields } = req.body

            if (!Array.isArray(fields)) {
                return sendError(res, 400, 'fields wajib berupa array.')
            }

            for (const f of fields) {

                if (!f.label || typeof f.label !== 'string') {
                    return sendError(res, 400, 'Setiap field wajib punya label.')
                }

                if (!FIELD_TYPE_VALUES.includes(f.field_type)) {
                    return sendError(
                        res,
                        400,
                        `field_type wajib salah satu dari ${FIELD_TYPE_VALUES.join(', ')}.`
                    )
                }

                if (f.field_type === 'DROPDOWN') {
                    if (!Array.isArray(f.options) || f.options.length === 0 || !f.options.every(o => typeof o === 'string' && o.trim())) {
                        return sendError(res, 400, 'Field DROPDOWN wajib punya minimal 1 pilihan.')
                    }
                }

                // PRODUCT: options OPSIONAL -- null/tidak ada berarti
                // ambil dari semua kategori produk, atau array berisi
                // TEPAT SATU kategori ("JUAL"/"PROMOSI"/"COMPETITOR")
                // buat membatasi activity ini cuma ambil item kategori
                // itu (mis. activity Competitor cuma ambil item
                // COMPETITOR).
                if (f.field_type === 'PRODUCT' && f.options !== null && f.options !== undefined) {
                    if (
                        !Array.isArray(f.options) ||
                        f.options.length !== 1 ||
                        !PRODUCT_CATEGORY_VALUES.includes(f.options[0])
                    ) {
                        return sendError(
                            res,
                            400,
                            `Field PRODUCT: options wajib null atau array berisi satu dari ${PRODUCT_CATEGORY_VALUES.join(', ')}.`
                        )
                    }
                }

            }

            await db.transaction(async (t) => {

                await ActivityFieldDefinition.destroy({
                    where: { activity_id: activity.id },
                    transaction: t,
                })

                if (fields.length > 0) {
                    await ActivityFieldDefinition.bulkCreate(
                        fields.map((f, i) => ({
                            activity_id: activity.id,
                            label: f.label,
                            field_type: f.field_type,
                            options:
                                f.field_type === 'DROPDOWN' ? f.options :
                                f.field_type === 'PRODUCT' ? (f.options || null) :
                                null,
                            required: !!f.required,
                            display_order: i,
                        })),
                        { transaction: t }
                    )
                }

            })

            const hasil = await ActivityFieldDefinition.findAll({
                where: { activity_id: activity.id },
                order: [['display_order', 'ASC']],
            })

            res.json(hasil)

        } catch (err) {
            return sendServerError(res, err, 'SAVE ACTIVITY FIELDS')
        }

    }
)

module.exports = router
