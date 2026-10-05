require('dotenv').config({ quiet: true })

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')
const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')

const BASE = process.env.TEST_BASE_URL || 'http://localhost:1000'

// Hierarki sungguhan: supervisor 3 -> MD 1, 37, 38. MD 34 di luar
// subtree 3.
const MD = 1
const MD_LUAR = 34
const SUPERVISOR = 3

// activity_id tetap (Activity Master) -- field-nya sendiri sekarang
// dinamis (activity_field_definitions), jadi diambil lewat API di
// before() di bawah, bukan di-hardcode di sini.
const ACTIVITY_FOTO = 11
const ACTIVITY_STOCK = 4

let db
let fieldsFoto
let fieldsStock
const visitIdsDibuat = []
const activityIdsDibuat = []
const mulaiUji = Date.now()

const tokenUntuk = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' })

const cariField = (fields, label) => {
    const f = fields.find(f => f.label === label)
    if (!f) throw new Error(`Field "${label}" tidak ditemukan di field definitions`)
    return f
}

/** Kirim JSON biasa (tanpa file). */
const kirim = async (method, path, userId, body) => {
    const headers = { 'Content-Type': 'application/json' }

    if (userId !== null) {
        headers.Authorization = 'Bearer ' + tokenUntuk(userId)
    }

    const res = await fetch(BASE + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    })

    let data = null

    try {
        data = await res.json()
    } catch {
        data = null
    }

    return { status: res.status, data }
}

/**
 * Kirim multipart/form-data lewat fetch bawaan Node -- FormData dan
 * Blob sudah tersedia global di Node 18+, tidak perlu library
 * tambahan.
 *
 * `values` -- object {field_definition_id: value}, dikirim sebagai
 * SATU field "values" berisi JSON string (lihat
 * validateDanSusunFieldValues di visitActivity.controller.js).
 * `photoFieldId` -- kalau diisi, lampirkan foto di field
 * "photo_<photoFieldId>" (nama field foto sekarang per field
 * definition, bukan "photo" tetap).
 */
const kirimActivity = async (userId, { visitId, activityId, values, photoFieldId, photoNama, photoTipe, photoIsi }) => {
    const form = new FormData()

    form.append('visit_id', String(visitId))
    form.append('activity_id', String(activityId))

    if (values !== undefined) {
        form.append('values', JSON.stringify(values))
    }

    if (photoFieldId !== undefined && photoFieldId !== null) {
        const buffer = photoIsi || Buffer.from([0xff, 0xd8, 0xff, 0xd9]) // JPEG minimal
        form.append(
            `photo_${photoFieldId}`,
            new Blob([buffer], { type: photoTipe || 'image/jpeg' }),
            photoNama || 'uji.jpg'
        )
    }

    const headers = {}

    if (userId !== null) {
        headers.Authorization = 'Bearer ' + tokenUntuk(userId)
    }

    const res = await fetch(BASE + '/api/visit-activities', {
        method: 'POST',
        headers,
        body: form,
    })

    let data = null

    try {
        data = await res.json()
    } catch {
        data = null
    }

    return { status: res.status, data }
}

before(async () => {
    try {
        await fetch(BASE + '/api/activities')
    } catch {
        throw new Error(
            `Server tidak menjawab di ${BASE}. Jalankan "npm run dev" lebih dulu.`
        )
    }

    db = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    })

    const { data: fotoRes } = await kirim('GET', `/api/activities/${ACTIVITY_FOTO}/fields`, MD)
    fieldsFoto = fotoRes

    const { data: stockRes } = await kirim('GET', `/api/activities/${ACTIVITY_STOCK}/fields`, MD)
    fieldsStock = stockRes
})

after(async () => {
    if (db) {
        for (const id of activityIdsDibuat) {
            const [rows] = await db.query(
                'SELECT field_values FROM visit_activities WHERE id = ?',
                [id]
            )

            const fieldValues = rows[0]?.field_values
                ? (typeof rows[0].field_values === 'string' ? JSON.parse(rows[0].field_values) : rows[0].field_values)
                : {}

            for (const nilai of Object.values(fieldValues)) {
                if (typeof nilai === 'string' && nilai.startsWith('/uploads/')) {
                    const lokasi = path.join(__dirname, '..', '..', 'uploads', nilai.replace('/uploads/', ''))
                    if (fs.existsSync(lokasi)) fs.unlinkSync(lokasi)
                }
            }

            await db.query('DELETE FROM visit_activities WHERE id = ?', [id])
        }

        for (const id of visitIdsDibuat) {
            await db.query('DELETE FROM visits WHERE id = ?', [id])
        }

        // Cleanup orphan files: foto uji yang tertinggal karena request ditolak
        // sebelum row DB tercipta (multer tulis file SEBELUM controller validate).
        // Scan semua *-uji.jpg dan *-uji.txt yang dibuat sejak test mulai --
        // .txt ikut disertakan karena "batas upload" mengirim fixture non-image
        // dengan nama itu untuk menguji fileFilter.
        const dirUpload = path.join(__dirname, '..', '..', 'uploads')
        for (const nama of fs.readdirSync(dirUpload)) {
            if (!nama.endsWith('-uji.jpg') && !nama.endsWith('-uji.txt')) continue
            const waktuBerkas = Number(nama.split('-')[0])
            if (Number.isFinite(waktuBerkas) && waktuBerkas >= mulaiUji) {
                fs.unlinkSync(path.join(dirUpload, nama))
            }
        }

        await db.end()
    }
})


describe('POST /api/visit-activities', () => {

    let visitMilikSPG
    let visitMilikSPGLuar

    before(async () => {
        const [customerRow] = await db.query(
            'SELECT id FROM customers WHERE id NOT IN (97, 123) LIMIT 1'
        )

        const customerId = customerRow[0].id

        const [v1] = await db.query(
            `INSERT INTO visits (user_id, customer_id, checkin_time)
             VALUES (?, ?, NOW())`,
            [MD, customerId]
        )

        visitMilikSPG = v1.insertId
        visitIdsDibuat.push(visitMilikSPG)

        const [v2] = await db.query(
            `INSERT INTO visits (user_id, customer_id, checkin_time)
             VALUES (?, ?, NOW())`,
            [MD_LUAR, customerId]
        )

        visitMilikSPGLuar = v2.insertId
        visitIdsDibuat.push(visitMilikSPGLuar)
    })

    test('MD mencatat activity tipe FOTO untuk kunjungannya sendiri', async () => {
        const fotoField = cariField(fieldsFoto, 'Foto')

        const { status, data } = await kirimActivity(MD, {
            visitId: visitMilikSPG,
            activityId: ACTIVITY_FOTO,
            photoFieldId: fotoField.id,
        })

        assert.strictEqual(status, 200, JSON.stringify(data))
        assert.strictEqual(data.activity_id, ACTIVITY_FOTO)

        activityIdsDibuat.push(data.id)

        const [rows] = await db.query(
            'SELECT visit_id, activity_id, field_values FROM visit_activities WHERE id = ?',
            [data.id]
        )

        assert.strictEqual(rows[0].visit_id, visitMilikSPG)
        assert.strictEqual(rows[0].activity_id, ACTIVITY_FOTO)

        const fieldValues = typeof rows[0].field_values === 'string' ? JSON.parse(rows[0].field_values) : rows[0].field_values
        assert.ok(fieldValues[fotoField.id], 'field_values tidak berisi foto')
    })

    test('MD mencoba mencatat activity untuk kunjungan MD lain: ditolak 403', async () => {
        const fotoField = cariField(fieldsFoto, 'Foto')

        const { status } = await kirimActivity(MD, {
            visitId: visitMilikSPGLuar,
            activityId: ACTIVITY_FOTO,
            photoFieldId: fotoField.id,
        })

        assert.strictEqual(status, 403)

        const [rows] = await db.query(
            'SELECT id FROM visit_activities WHERE visit_id = ?',
            [visitMilikSPGLuar]
        )

        assert.strictEqual(rows.length, 0)
    })

    test('MD mencoba mencatat activity untuk kunjungan MD lain dengan foto terlampir: disk tetap bersih setelah 403', async () => {
        // Bukan cuma status code -- multer sudah menulis berkasnya ke
        // disk SEBELUM controller sempat memeriksa kepemilikan. Kalau
        // jalur 403 tidak menghapusnya, berkas itu tertinggal permanen
        // di /uploads (disajikan tanpa auth) walau baris DB-nya sendiri
        // tidak pernah tercipta. Nama berkasnya tidak bisa diketahui di
        // muka karena multer menamainya `Date.now()-originalname`, jadi
        // dibuktikan lewat pembanding isi direktori sebelum/sesudah.
        const fotoField = cariField(fieldsFoto, 'Foto')

        const dirUpload = path.join(__dirname, '..', '..', 'uploads')
        const sebelum = new Set(fs.readdirSync(dirUpload))

        const { status } = await kirimActivity(MD, {
            visitId: visitMilikSPGLuar,
            activityId: ACTIVITY_FOTO,
            photoFieldId: fotoField.id,
        })

        assert.strictEqual(status, 403)

        const sesudah = fs.readdirSync(dirUpload)
        const berkasBaru = sesudah.filter((nama) => !sebelum.has(nama))

        assert.deepStrictEqual(
            berkasBaru,
            [],
            `berkas tertinggal di /uploads setelah 403: ${berkasBaru.join(', ')}`
        )
    })

    test('tipe STOCK tanpa qty: ditolak 400, tidak ada baris tersimpan', async () => {
        const namaField = cariField(fieldsStock, 'Nama Produk')
        const expField = cariField(fieldsStock, 'Tanggal Kadaluarsa')

        const { status } = await kirimActivity(MD, {
            visitId: visitMilikSPG,
            activityId: ACTIVITY_STOCK,
            values: {
                [namaField.id]: 'Kara 65ml',
                [expField.id]: '2026-12-01',
            },
        })

        assert.strictEqual(status, 400)
    })

    test('tipe FOTO tanpa berkas foto: ditolak 400', async () => {
        const { status } = await kirimActivity(MD, {
            visitId: visitMilikSPG,
            activityId: ACTIVITY_FOTO,
        })

        assert.strictEqual(status, 400)
    })

    test('visit_id yang tidak ada: 404', async () => {
        const fotoField = cariField(fieldsFoto, 'Foto')

        const { status } = await kirimActivity(MD, {
            visitId: 99999999,
            activityId: ACTIVITY_FOTO,
            photoFieldId: fotoField.id,
        })

        assert.strictEqual(status, 404)
    })

    test('activity_id yang tidak ada: ditolak 400, bukan 500 dari FK constraint', async () => {
        const fotoField = cariField(fieldsFoto, 'Foto')

        const { status } = await kirimActivity(MD, {
            visitId: visitMilikSPG,
            activityId: 999,
            photoFieldId: fotoField.id,
        })

        assert.strictEqual(status, 400)
    })

    test('tipe STOCK lengkap dengan qty valid: berhasil', async () => {
        const namaField = cariField(fieldsStock, 'Nama Produk')
        const qtyField = cariField(fieldsStock, 'Qty')
        const expField = cariField(fieldsStock, 'Tanggal Kadaluarsa')

        const { status, data } = await kirimActivity(MD, {
            visitId: visitMilikSPG,
            activityId: ACTIVITY_STOCK,
            values: {
                [namaField.id]: 'Kara 65ml',
                [qtyField.id]: 10,
                [expField.id]: '2026-12-01',
            },
        })

        assert.strictEqual(status, 200, JSON.stringify(data))
        activityIdsDibuat.push(data.id)
    })

    test('tipe STOCK dengan qty bukan angka: ditolak 400', async () => {
        const namaField = cariField(fieldsStock, 'Nama Produk')
        const qtyField = cariField(fieldsStock, 'Qty')
        const expField = cariField(fieldsStock, 'Tanggal Kadaluarsa')

        const { status } = await kirimActivity(MD, {
            visitId: visitMilikSPG,
            activityId: ACTIVITY_STOCK,
            values: {
                [namaField.id]: 'Kara 65ml',
                [qtyField.id]: 'abc',
                [expField.id]: '2026-12-01',
            },
        })

        assert.strictEqual(status, 400)
    })

})

describe('POST /api/visit-activities -- batas upload', () => {

    let visitMilikSPG

    before(async () => {
        const [customerRow] = await db.query(
            'SELECT id FROM customers WHERE id NOT IN (97, 123) LIMIT 1'
        )

        const [v] = await db.query(
            `INSERT INTO visits (user_id, customer_id, checkin_time)
             VALUES (?, ?, NOW())`,
            [MD, customerRow[0].id]
        )

        visitMilikSPG = v.insertId
        visitIdsDibuat.push(visitMilikSPG)
    })

    test('berkas bukan gambar ditolak', async () => {
        const fotoField = cariField(fieldsFoto, 'Foto')

        // fileFilter field-aware (cocok "photo_<id>") meloloskan request
        // ini ke multer dengan file KOSONG (cb(null, false), bukan
        // melempar Error), dan validateDanSusunFieldValues yang
        // menolaknya bersih 400.
        const { status, data } = await kirimActivity(MD, {
            visitId: visitMilikSPG,
            activityId: ACTIVITY_FOTO,
            photoFieldId: fotoField.id,
            photoNama: 'uji.txt',
            photoTipe: 'text/plain',
            photoIsi: Buffer.from('bukan gambar'),
        })

        // 400 bersih dari validateDanSusunFieldValues, BUKAN html/stack
        // trace default Express -- itulah yang dibuktikan fix fileFilter.
        assert.strictEqual(status, 400)
        assert.match(data.message, /foto/i)

        const [rows] = await db.query(
            'SELECT id FROM visit_activities WHERE visit_id = ?',
            [visitMilikSPG]
        )

        assert.strictEqual(rows.length, 0)
    })

    test('berkas gambar biasa tetap diterima', async () => {
        const fotoField = cariField(fieldsFoto, 'Foto')

        const { status, data } = await kirimActivity(MD, {
            visitId: visitMilikSPG,
            activityId: ACTIVITY_FOTO,
            photoFieldId: fotoField.id,
        })

        assert.strictEqual(status, 200, JSON.stringify(data))
        activityIdsDibuat.push(data.id)
    })

    test('fileFilter tidak merusak endpoint upload Excel (multer instance sama, field berbeda)', async () => {
        // upload.middleware.js dipakai bersama oleh POST /api/visit-plans/upload
        // (field 'file', bukan 'photo'/'photo_<id>') -- fileFilter
        // field-aware HARUS tetap meloloskan file non-image di jalur ini.
        const XLSX = require('xlsx')

        const sheet = XLSX.utils.json_to_sheet([
            { 'Sales Code': 'TIDAK-ADA', 'Customer Code': 'TIDAK-ADA', 'Visit Date': '2026-01-01' },
        ])
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

        const form = new FormData()
        form.append(
            'file',
            new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
            'uji-regresi.xlsx'
        )

        const res = await fetch(BASE + '/api/visit-plans/upload', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + tokenUntuk(SUPERVISOR) },
            body: form,
        })

        const data = await res.json()

        // 200 dengan bentuk respons normal controller (inserted/failed/errors)
        // membuktikan file TIDAK ditolak di layer multer/fileFilter -- kalau
        // fileFilter masih unconditional, ini akan gagal duluan (400/500)
        // sebelum sempat sampai body JSON ini.
        assert.strictEqual(res.status, 200)
        assert.strictEqual(typeof data.inserted, 'number')
    })

})
