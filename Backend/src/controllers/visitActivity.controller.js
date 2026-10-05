const fs = require('fs')

const { Op } =
    require('sequelize')

const VisitActivity =
    require('../models/visitActivity.model')

const Visit =
    require('../models/visit.model')

const Customer =
    require('../models/customer.model')

const User =
    require('../models/user.model')

const Activity =
    require('../models/activity.model')

const ActivityFieldDefinition =
    require('../models/activityFieldDefinition.model')

const { sendError, sendServerError } =
    require('../utils/response.util')

const {
    resolveSubordinateUserIds,
    ownerWhere,
} = require('../utils/access.util')

const { parseId } =
    require('../utils/id.util')

/**
 * Hapus SEMUA file yang multer sudah tulis ke disk untuk request ini
 * (upload.any() -- bisa nol, satu, atau beberapa file foto sekaligus).
 * Dipanggil di setiap exit path gagal, persis alasan yang sama dengan
 * fs.unlinkSync(req.file.path) versi lama: /uploads disajikan tanpa
 * autentikasi, jadi berkas yang tidak dihapus di sini bisa dibaca siapa
 * pun tanpa token.
 */
const hapusSemuaFile = (req) => {
    for (const file of req.files || []) {
        fs.unlinkSync(file.path)
    }
}

/**
 * Validasi + susun field_values dari body+files terhadap daftar
 * field_definitions activity yang dipilih. Menggantikan
 * ACTIVITY_FIELD_RULES/validateActivityFields yang hardcode di kode --
 * sekarang field activity dibaca dari database (activity_field_definitions),
 * jadi activity baru tidak perlu deploy ulang.
 *
 * @returns {{error: string}|{fieldValues: object}}
 */
const validateDanSusunFieldValues = (fieldDefs, body, files) => {

    let mentah = {}

    if (typeof body.values === 'string' && body.values) {
        try {
            mentah = JSON.parse(body.values)
        } catch {
            return { error: 'Format values tidak valid (harus JSON).' }
        }
    }

    const fieldValues = {}

    for (const def of fieldDefs) {

        if (def.field_type === 'PHOTO') {

            const file = files.find(f => f.fieldname === `photo_${def.id}`)

            if (!file) {
                if (def.required) {
                    return { error: `Foto "${def.label}" wajib diisi.` }
                }
                continue
            }

            fieldValues[def.id] = `/uploads/${file.filename}`
            continue

        }

        const nilai = mentah[def.id]

        if (nilai === undefined || nilai === null || String(nilai).trim() === '') {
            if (def.required) {
                return { error: `Field "${def.label}" wajib diisi.` }
            }
            continue
        }

        if (def.field_type === 'NUMBER') {
            if (Number.isNaN(Number(nilai))) {
                return { error: `Field "${def.label}" harus berupa angka.` }
            }
            fieldValues[def.id] = Number(nilai)
            continue
        }

        if (def.field_type === 'DROPDOWN') {
            if (!def.options || !def.options.includes(nilai)) {
                return { error: `Pilihan "${def.label}" tidak valid.` }
            }
            fieldValues[def.id] = nilai
            continue
        }

        // TEXT, DATE -- disimpan apa adanya (string).
        fieldValues[def.id] = String(nilai)

    }

    return { fieldValues }

}

// ======================
// CREATE
// ======================

exports.create = async (req, res) => {

    try {

        const files = req.files || []

        const visitId = parseId(req.body.visit_id)

        if (visitId === null) {
            // Multer sudah menulis berkasnya ke disk sebelum handler ini
            // sempat memeriksa apa pun. /uploads disajikan tanpa
            // autentikasi (lihat tests/README.md), jadi berkas yang tidak
            // dihapus di sini menjadi bisa dibaca siapa pun tanpa token --
            // penolakan yang tidak membersihkan dirinya sendiri sama saja
            // dengan menerima uploadnya.
            hapusSemuaFile(req)
            return sendError(res, 400, 'Id kunjungan tidak valid.')
        }

        const visit = await Visit.findByPk(visitId)

        if (!visit) {
            // Sama seperti di atas -- kunjungan tidak ditemukan tidak
            // boleh meninggalkan berkas yang sudah terlanjur ditulis
            // multer sebelum baris ini dievaluasi.
            hapusSemuaFile(req)
            return sendError(res, 404, 'Kunjungan tidak ditemukan.')
        }

        // Personal, sama seperti checkIn -- SPG mencatat activity
        // kunjungannya sendiri, bukan milik orang lain.
        if (visit.user_id !== req.user.id) {
            // Sama seperti di atas -- penolakan kepemilikan bukan alasan
            // untuk membiarkan berkas yang sudah tertulis ke disk.
            hapusSemuaFile(req)
            return sendError(res, 403, 'Kunjungan ini bukan milik Anda.')
        }

        const activityId = parseId(req.body.activity_id)

        if (activityId === null) {
            hapusSemuaFile(req)
            return sendError(res, 400, 'Id tipe activity tidak valid.')
        }

        const activityDipilih = await Activity.findByPk(activityId)

        if (!activityDipilih) {
            hapusSemuaFile(req)
            return sendError(res, 400, 'Tipe activity tidak ditemukan.')
        }

        // Activity yang channel_id-nya diisi hanya boleh dipakai di
        // customer dengan channel yang sama -- NULL berarti berlaku di
        // semua channel. Ini cek server-side, bukan cuma sembunyikan
        // pilihan di UI: mencegah panggilan API langsung memilih
        // activity channel lain lewat dropdown yang seharusnya sudah
        // difilter.
        if (activityDipilih.channel_id !== null) {

            const customer = await Customer.findByPk(visit.customer_id)

            if (
                !customer ||
                customer.channel_id !== activityDipilih.channel_id
            ) {
                hapusSemuaFile(req)
                return sendError(
                    res,
                    400,
                    'Tipe activity ini tidak berlaku untuk channel customer ini.'
                )
            }

        }

        // client_ref: dibikin di HP (lihat activity-queue di mobile),
        // dipakai antrian offline biar retry (otomatis tiap 30 detik
        // atau tombol "Sync Sekarang") tidak bikin activity dobel kalau
        // request sebelumnya SEBENARNYA sudah sukses tapi respons-nya
        // yang gagal sampai ke HP (mis. koneksi putus pas balik).
        const clientRef =
            typeof req.body.client_ref === 'string' && req.body.client_ref
                ? req.body.client_ref
                : null

        if (clientRef) {

            const sudahAda = await VisitActivity.findOne({
                where: { client_ref: clientRef },
                include: [{
                    model: Activity,
                    as: 'Activity',
                    include: [{ model: ActivityFieldDefinition, as: 'FieldDefinitions' }],
                }],
            })

            if (sudahAda) {
                // Sudah pernah dibuat lewat request client_ref yang sama
                // -- berkas baru yang baru saja diupload multer di
                // request KEDUA ini duplikat, tidak dipakai.
                hapusSemuaFile(req)
                return res.json(sudahAda)
            }

        }

        const fieldDefs = await ActivityFieldDefinition.findAll({
            where: { activity_id: activityId },
            order: [['display_order', 'ASC']],
        })

        const hasilValidasi = validateDanSusunFieldValues(fieldDefs, req.body, files)

        if (hasilValidasi.error) {
            // Sama seperti di atas -- validasi field yang gagal juga
            // tidak boleh meninggalkan berkas yatim di /uploads.
            hapusSemuaFile(req)
            return sendError(res, 400, hasilValidasi.error)
        }

        // Berkas yang ter-upload tapi TIDAK cocok dengan field PHOTO mana
        // pun di activity ini (nama field salah, field sudah dihapus
        // admin, dst) juga yatim -- bukan cuma yang gagal validasi.
        const idFotoValid = new Set(
            fieldDefs.filter(d => d.field_type === 'PHOTO').map(d => `photo_${d.id}`)
        )

        for (const file of files) {
            if (!idFotoValid.has(file.fieldname)) {
                fs.unlinkSync(file.path)
            }
        }

        // Field eksplisit, bukan spread req.body -- pelajaran yang sama
        // dari POST /api/visit-plans di sub-proyek kebocoran data. Kolom
        // tetap lama (product_name..photo_url) SENGAJA tidak diisi lagi
        // -- field_values satu-satunya sumber data untuk baris baru.
        const activity = await VisitActivity.create({
            visit_id: visitId,
            activity_id: activityId,
            field_values: hasilValidasi.fieldValues,
            client_ref: clientRef,
        })

        // Dimuat ulang dengan include Activity supaya bentuk responsnya
        // sama dengan getAll/getByVisit -- mobile langsung dapat nama
        // tipe tanpa request kedua.
        const hasil = await VisitActivity.findByPk(activity.id, {
            include: [{
                    model: Activity,
                    as: 'Activity',
                    include: [{ model: ActivityFieldDefinition, as: 'FieldDefinitions' }],
                }],
        })

        res.json(hasil)

    } catch (err) {
        return sendServerError(res, err, 'CREATE VISIT ACTIVITY')
    }

}

// ======================
// GET ALL
// ======================

exports.getAll = async (req, res) => {

    try {


        const loginUser =

            await User.findByPk(

                req.user.id

            )

        if (!loginUser) {
            return sendError(res, 404, 'User tidak ditemukan.')
        }

        // Satu aturan: rantai supervisor_id. null berarti tidak
        // dibatasi, jadi visitWhere dibiarkan kosong — tapi
        // `required: true` pada include Visit di bawah TETAP, karena itu
        // yang menjamin activity tanpa kunjungan induk tidak ikut
        // terkirim.
        const bolehDilihat =
            await resolveSubordinateUserIds(loginUser)

        const visitWhere = ownerWhere(bolehDilihat)

        // ?mine=1 dan ?customer_id opsional -- opt-in eksplisit dipakai
        // layar Report Customer (mobile), sama pola dengan ?mine=1 dan
        // ?customer_id di GET /api/visits. Perilaku default (tanpa
        // parameter) TIDAK berubah -- sfa-web/app/visits/activity/list
        // /page.tsx memanggil endpoint ini tanpa mine/customer_id sama
        // sekali dan mengharapkan daftar subtree penuh.
        if (req.query.mine === '1') {
            visitWhere.user_id = loginUser.id
        }

        const customerId = Number(req.query.customer_id)
        if (Number.isInteger(customerId) && customerId > 0) {
            visitWhere.customer_id = customerId
        }

        const {

            startDate,

            endDate,

            product

        } = req.query

        const whereCondition = {}

        // ======================
        // FILTER DATE
        // ======================

        if (

            startDate &&
            endDate

        ) {

            whereCondition.created_at = {

                [Op.between]: [

                    new Date(startDate),

                    new Date(endDate)

                ]

            }

        }

        if (product) {

            whereCondition.product_name = {

                [Op.substring]:
                    product

            }

        }



        const data =

            await VisitActivity.findAll({

                where:
                    whereCondition,

                include: [

                    // ======================
                    // VISIT
                    // ======================

                    {

                        model: Visit,

                        required: true,

                        where: visitWhere,

                        include: [

                            {
                                model: Customer
                            },

                            {
                                model: User,
                                attributes: ['id', 'name']
                            }

                        ]

                    },

                    // ======================
                    // ACTIVITY
                    // ======================

                    {

                        model: Activity,

                        as: 'Activity',

                        include: [{ model: ActivityFieldDefinition, as: 'FieldDefinitions' }],

                    }

                ],

                order: [

                    ['created_at', 'DESC']

                ]

            })




        res.json(data)



    }

    catch (err) {

        return sendServerError(
            res,
            err,
            'GET ALL VISIT ACTIVITY'
        )

    }

}

// ======================
// GET BY VISIT
// ======================

exports.getByVisit =
    async (req, res) => {

        try {

            const id = parseId(req.params.id)

            if (id === null) {
                return sendError(res, 400, 'Id kunjungan tidak valid.')
            }

            const bolehDilihat =
                await resolveSubordinateUserIds(req.user)

            const data =

                await VisitActivity.findAll({

                    where: {

                        visit_id: id

                    },

                    include: [

                        {
                            model: Visit,

                            // required: true WAJIB. Tanpa itu Sequelize
                            // menghasilkan LEFT JOIN, dan baris activity
                            // yang visit_id-nya menunjuk kunjungan tidak
                            // ada — atau di luar subtree — tetap lolos
                            // dengan Visit: null.
                            required: true,

                            where: ownerWhere(bolehDilihat),
                        },

                        // Include asli, dipertahankan supaya
                        // sfa-web/app/visit-detail/[id]/page.tsx tetap
                        // dapat a.Activity?.name.
                        {

                            model: Activity,

                            as: 'Activity',

                            include: [{ model: ActivityFieldDefinition, as: 'FieldDefinitions' }],

                        }

                    ],

                    order: [

                        ['created_at', 'DESC']

                    ]

                })

            res.json(data)

        }

        catch (err) {

            return sendServerError(
                res,
                err,
                'VISIT ACTIVITY'
            )

        }

    }

// Diekspor cuma buat tes unit -- fungsi murni, tidak menyentuh
// req/res/DB, jadi bisa diuji langsung tanpa server.
exports.validateDanSusunFieldValues = validateDanSusunFieldValues

