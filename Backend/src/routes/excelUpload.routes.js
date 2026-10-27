const router = require('express').Router()

const multer = require('multer')

const { Op } = require('sequelize')

const auth = require('../middleware/auth.middleware')

const ExcelUpload = require('../models/excelUpload.model')
const User = require('../models/user.model')

const { sendError, sendServerError } = require('../utils/response.util')
const { USER_MANAGER_ROLES } = require('../utils/access.util')
const { hasWebMenuAccess } = require('../utils/menuAccess.util')

const {
    ALLOWED_EXTENSIONS,
    MAX_FILE_BYTES,
    isAllowedExcelName,
    sanitizeFileName,
    subfolderFor,
    nextAvailableName,
} = require('../utils/excelUpload.util')

const s3 = require('../services/s3Storage.service')

// Key menu di sfa-web app/utils/sidebar-menu.ts (grup ADMIN -- default
// tersembunyi sampai dibuka di Menu Access).
const MENU_KEY = 'excelUploader'

const MAX_FILES_PER_REQUEST = 10

// Memory storage, bukan disk -- file langsung diteruskan ke S3, tidak
// pernah ditulis ke disk server.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES_PER_REQUEST },
})

const isAdmin = (user) => !!user && USER_MANAGER_ROLES.includes(user.role)

const requireMenuAccess = async (req, res, next) => {

    try {

        if (!(await hasWebMenuAccess(req.user, MENU_KEY, false))) {
            return sendError(res, 403, 'Anda tidak punya akses ke menu Excel Uploader.')
        }

    } catch (err) {
        return sendServerError(res, err, 'EXCEL UPLOAD ACCESS')
    }

    next()

}

const requireAdmin = (req, res, next) => {

    if (!isAdmin(req.user)) {
        return sendError(res, 403, 'Hanya administrator yang boleh mengatur penyimpanan S3.')
    }

    next()

}

// Error multer (file kebesaran / kebanyakan) jadi 400 yang bisa dibaca,
// bukan 500 dari error handler default Express.
const receiveFiles = (req, res, next) => {

    upload.array('files', MAX_FILES_PER_REQUEST)(req, res, (err) => {

        if (!err) return next()

        if (err instanceof multer.MulterError) {

            const pesan = {
                LIMIT_FILE_SIZE: `Ukuran file maksimal ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
                LIMIT_FILE_COUNT: `Maksimal ${MAX_FILES_PER_REQUEST} file sekali upload.`,
                LIMIT_UNEXPECTED_FILE: "Field file wajib bernama 'files'.",
            }[err.code] || 'Upload file gagal.'

            return sendError(res, 400, pesan)

        }

        return sendServerError(res, err, 'EXCEL UPLOAD RECEIVE')

    })

}


// ======================
// SETTING (ADMINISTRATOR)
// ======================
router.get('/settings', auth, requireAdmin, async (req, res) => {

    try {

        res.json({ ...(await s3.loadSettings()), ...s3.credentialsInfo() })

    } catch (err) {
        return sendServerError(res, err, 'GET EXCEL UPLOAD SETTINGS')
    }

})

router.put('/settings', auth, requireAdmin, async (req, res) => {

    try {

        const { error, settings } = s3.validateSettings(req.body || {})

        if (error) return sendError(res, 400, error)

        await s3.saveSettings(settings, req.user.id)

        res.json({ message: 'Setting S3 berhasil disimpan.', settings })

    } catch (err) {
        return sendServerError(res, err, 'SAVE EXCEL UPLOAD SETTINGS')
    }

})

// Tes pakai nilai dari form (belum tentu sudah disimpan) -- admin bisa
// mengecek dulu sebelum menekan Simpan. Tulis file kecil lalu hapus
// lagi: membuktikan izin PutObject + DeleteObject di folder itu, bukan
// cuma "bucket ada".
router.post('/settings/test', auth, requireAdmin, async (req, res) => {

    const { error, settings } = s3.validateSettings(req.body || {})

    if (error) return sendError(res, 400, error)

    const key = `${settings.prefix}.sfa-connection-test-${Date.now()}.txt`

    try {

        const client = s3.createClient(settings)

        await s3.putObject(client, settings.bucket, key, 'SFA connection test', 'text/plain')
        await s3.deleteObject(client, settings.bucket, key)

        res.json({
            message: `Terhubung ke bucket ${settings.bucket} -- tes tulis + hapus di '${settings.prefix || '/'}' berhasil.`,
        })

    } catch (err) {

        console.error('[EXCEL UPLOAD TEST S3]', err)

        return sendError(res, 400, s3.describeS3Error(err))

    }

})


// ======================
// FILES
// ======================
router.get('/', auth, requireMenuAccess, async (req, res) => {

    try {

        const rows = await ExcelUpload.findAll({
            include: [{ model: User, as: 'Uploader', attributes: ['id', 'name'] }],
            order: [['created_at', 'DESC'], ['id', 'DESC']],
            limit: 2000,
        })

        res.json(rows)

    } catch (err) {
        return sendServerError(res, err, 'GET EXCEL UPLOADS')
    }

})

router.post('/', auth, requireMenuAccess, receiveFiles, async (req, res) => {

    const files = req.files || []

    if (files.length === 0) {
        return sendError(res, 400, 'Pilih minimal satu file.')
    }

    const ditolak = files.filter((f) => !isAllowedExcelName(f.originalname))

    if (ditolak.length > 0) {
        return sendError(
            res,
            400,
            `File harus ${ALLOWED_EXTENSIONS.join(', ')}: ${ditolak.map((f) => f.originalname).join(', ')}`
        )
    }

    let settings
    let client

    try {

        settings = await s3.loadSettings()

        if (!settings.bucket) {
            return sendError(res, 400, 'Penyimpanan S3 belum di-setting administrator.')
        }

        client = s3.createClient(settings)

    } catch (err) {

        if (err.userFacing) return sendError(res, 400, err.message)

        return sendServerError(res, err, 'EXCEL UPLOAD SETTINGS')

    }

    const folder = `${settings.prefix}${subfolderFor(settings.subfolder_mode)}`

    try {

        // Nama yang sudah ada di folder ini (bucket yang sama) -- supaya
        // file bernama sama diberi akhiran _(2), tidak menimpa.
        const existing = await ExcelUpload.findAll({
            where: { s3_bucket: settings.bucket, s3_key: { [Op.startsWith]: folder } },
            attributes: ['s3_key'],
        })

        const terpakai = new Set(existing.map((r) => r.s3_key))

        const hasil = []

        // Satu per satu, bukan paralel -- nama _(n) di batch yang sama
        // harus saling melihat, dan 10 file x 20 MB paralel ke S3 cuma
        // menambah tekanan memori tanpa banyak untung.
        for (const file of files) {

            const nama = nextAvailableName(
                sanitizeFileName(file.originalname),
                (kandidat) => terpakai.has(`${folder}${kandidat}`)
            )

            const key = `${folder}${nama}`

            await s3.putObject(client, settings.bucket, key, file.buffer, file.mimetype)

            terpakai.add(key)

            const row = await ExcelUpload.create({
                original_name: nama,
                s3_bucket: settings.bucket,
                s3_key: key,
                size_bytes: file.size,
                content_type: file.mimetype || null,
                uploaded_by: req.user.id,
                created_at: new Date(),
            })

            hasil.push(row)

        }

        res.json({ message: `${hasil.length} file berhasil di-upload.`, files: hasil })

    } catch (err) {

        console.error('[EXCEL UPLOAD PUT]', err)

        // Error SDK S3 -> pesan yang bisa ditindaklanjuti; selain itu 500.
        if (err?.$metadata || err?.code || err?.userFacing) {
            return sendError(res, 502, s3.describeS3Error(err))
        }

        return sendServerError(res, err, 'EXCEL UPLOAD')

    }

})

router.get('/:id/download', auth, requireMenuAccess, async (req, res) => {

    try {

        const row = await ExcelUpload.findByPk(req.params.id)

        if (!row) return sendError(res, 404, 'File tidak ditemukan.')

        const settings = await s3.loadSettings()

        // Bucket dari baris file, bukan setting sekarang -- file lama
        // tetap bisa diunduh walau bucket di setting sudah diganti.
        const client = s3.createClient(settings)

        const url = await s3.presignDownload(client, row.s3_bucket, row.s3_key, row.original_name)

        res.json({ url, expires_in: s3.DOWNLOAD_URL_TTL_SECONDS })

    } catch (err) {

        if (err.userFacing) return sendError(res, 400, err.message)

        return sendServerError(res, err, 'EXCEL UPLOAD DOWNLOAD')

    }

})

// Hapus: yang meng-upload sendiri, atau ADMINISTRATOR.
router.delete('/:id', auth, requireMenuAccess, async (req, res) => {

    try {

        const row = await ExcelUpload.findByPk(req.params.id)

        if (!row) return sendError(res, 404, 'File tidak ditemukan.')

        if (!isAdmin(req.user) && Number(row.uploaded_by) !== Number(req.user.id)) {
            return sendError(res, 403, 'Hanya yang meng-upload atau administrator yang boleh menghapus file ini.')
        }

        const settings = await s3.loadSettings()
        const client = s3.createClient(settings)

        // S3 dulu baru database: kalau S3 gagal, baris tetap ada dan
        // bisa dicoba lagi -- kebalikannya meninggalkan file yatim di
        // bucket yang tidak kelihatan dari web.
        await s3.deleteObject(client, row.s3_bucket, row.s3_key)

        await row.destroy()

        res.json({ message: 'File berhasil dihapus.' })

    } catch (err) {

        console.error('[EXCEL UPLOAD DELETE]', err)

        if (err?.$metadata || err?.userFacing) {
            return sendError(res, 502, s3.describeS3Error(err))
        }

        return sendServerError(res, err, 'EXCEL UPLOAD DELETE')

    }

})

module.exports = router
