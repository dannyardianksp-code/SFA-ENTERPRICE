const {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
} = require('@aws-sdk/client-s3')

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

const AppSetting = require('../models/appSetting.model')

const { normalizePrefix, SUBFOLDER_MODES } = require('../utils/excelUpload.util')

/**
 * Penyimpanan S3 untuk menu Excel Uploader.
 *
 * Pembagian sengaja:
 * - Lokasi (bucket, region, endpoint, prefix, mode sub-folder) ada di
 *   tabel app_settings, diatur ADMINISTRATOR dari web.
 * - Kredensial (S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY) HANYA di .env
 *   server -- tidak pernah disimpan di database dan tidak pernah
 *   dikirim balik lewat API, jadi bocornya database / akun admin web
 *   tidak ikut membocorkan kunci S3.
 */

const SETTING_KEYS = {
    bucket: 's3.bucket',
    region: 's3.region',
    endpoint: 's3.endpoint',
    prefix: 's3.prefix',
    subfolder_mode: 's3.subfolder_mode',
}

const DEFAULTS = {
    bucket: '',
    region: 'ap-southeast-3',
    endpoint: '',
    prefix: 'excel-upload/',
    subfolder_mode: 'YEAR_MONTH',
}

/** Link download berlaku 5 menit -- bucket tetap privat. */
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60

const credentialsFromEnv = () => {

    const accessKeyId = process.env.S3_ACCESS_KEY_ID || ''
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || ''

    return accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : null

}

/** Info kredensial yang AMAN ditampilkan -- cuma 4 karakter terakhir
 *  access key, secret tidak pernah. */
const credentialsInfo = () => {

    const cred = credentialsFromEnv()

    return {
        credentials_configured: !!cred,
        access_key_hint: cred ? `••••${cred.accessKeyId.slice(-4)}` : null,
    }

}

const loadSettings = async () => {

    const rows = await AppSetting.findAll({
        where: { setting_key: Object.values(SETTING_KEYS) },
    })

    const byKey = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]))

    const hasil = {}

    for (const [field, key] of Object.entries(SETTING_KEYS)) {
        hasil[field] = byKey[key] ?? DEFAULTS[field]
    }

    return hasil

}

/**
 * Validasi + rapikan input setting dari web. Mengembalikan
 * { error } atau { settings }.
 */
const validateSettings = (input) => {

    const bucket = String(input.bucket ?? '').trim()
    const region = String(input.region ?? '').trim()
    const endpoint = String(input.endpoint ?? '').trim()
    const prefix = normalizePrefix(input.prefix)
    const subfolder_mode = String(input.subfolder_mode ?? 'YEAR_MONTH')

    // Aturan nama bucket S3: 3-63 karakter, huruf kecil/angka/titik/strip.
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
        return { error: 'Nama bucket tidak valid (3-63 karakter, huruf kecil, angka, titik, strip).' }
    }

    if (!/^[a-z0-9-]{2,32}$/.test(region)) {
        return { error: 'Region tidak valid, contoh: ap-southeast-3.' }
    }

    if (endpoint !== '' && !/^https?:\/\/[^\s]+$/i.test(endpoint)) {
        return { error: 'Endpoint harus URL http(s)://..., atau dikosongkan untuk AWS S3.' }
    }

    if (prefix === null) {
        return { error: "Folder tidak boleh mengandung '..'." }
    }

    if (prefix.length > 512) {
        return { error: 'Folder terlalu panjang (maks. 512 karakter).' }
    }

    if (!SUBFOLDER_MODES.includes(subfolder_mode)) {
        return { error: `Sub-folder wajib salah satu dari ${SUBFOLDER_MODES.join(', ')}.` }
    }

    return { settings: { bucket, region, endpoint, prefix, subfolder_mode } }

}

const saveSettings = async (settings, userId) => {

    const now = new Date()

    await AppSetting.bulkCreate(
        Object.entries(SETTING_KEYS).map(([field, key]) => ({
            setting_key: key,
            setting_value: settings[field],
            updated_by: userId,
            updated_at: now,
        })),
        { updateOnDuplicate: ['setting_value', 'updated_by', 'updated_at'] }
    )

}

/**
 * Client S3 untuk satu setting. `endpoint` kosong = AWS S3 asli;
 * diisi = layanan kompatibel S3 (MinIO, dll) yang umumnya butuh
 * path-style URL.
 */
const createClient = (settings) => {

    const credentials = credentialsFromEnv()

    if (!credentials) {
        const err = new Error('Kredensial S3 belum dipasang di server (.env).')
        err.userFacing = true
        throw err
    }

    return new S3Client({
        region: settings.region,
        endpoint: settings.endpoint || undefined,
        forcePathStyle: !!settings.endpoint,
        credentials,
    })

}

const putObject = (client, bucket, key, body, contentType) =>
    client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType || 'application/octet-stream',
    }))

const deleteObject = (client, bucket, key) =>
    client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))

const presignDownload = (client, bucket, key, fileName) =>
    getSignedUrl(
        client,
        new GetObjectCommand({
            Bucket: bucket,
            Key: key,
            ResponseContentDisposition:
                `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        }),
        { expiresIn: DOWNLOAD_URL_TTL_SECONDS }
    )

/**
 * Terjemahkan error SDK ke pesan yang bisa dibaca admin. Nama error S3
 * (AccessDenied, NoSuchBucket, ...) bukan rahasia, jadi aman ditampilkan.
 */
const describeS3Error = (err) => {

    if (err?.userFacing) return err.message

    const nama = err?.name || err?.Code || err?.code || 'Error'

    const pesan = {
        NoSuchBucket: 'Bucket tidak ditemukan.',
        AccessDenied: 'Akses ditolak -- cek izin IAM untuk bucket/folder ini.',
        InvalidAccessKeyId: 'Access key di .env server tidak dikenal.',
        SignatureDoesNotMatch: 'Secret key di .env server salah.',
        PermanentRedirect: 'Region tidak cocok dengan region bucket.',
        AuthorizationHeaderMalformed: 'Region tidak cocok dengan region bucket.',
        ENOTFOUND: 'Endpoint S3 tidak bisa dihubungi (DNS).',
        ECONNREFUSED: 'Endpoint S3 menolak koneksi.',
        ETIMEDOUT: 'Koneksi ke S3 timeout.',
    }[nama]

    return pesan ? `${pesan} (${nama})` : `Gagal menghubungi S3 (${nama}).`

}

module.exports = {
    DEFAULTS,
    DOWNLOAD_URL_TTL_SECONDS,
    credentialsInfo,
    loadSettings,
    validateSettings,
    saveSettings,
    createClient,
    putObject,
    deleteObject,
    presignDownload,
    describeS3Error,
}
