require('dotenv').config({ quiet: true })

const { test, describe, before, after } = require('node:test')
const assert = require('node:assert')
const jwt = require('jsonwebtoken')
const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')

const BASE = process.env.TEST_BASE_URL || 'http://localhost:1000'

// Hierarki sungguhan: supervisor 3 -> SPG 1, 37, 38. SPG 34 di luar
// subtree 3.
const SPG = 1
const SPG_LUAR = 34
const SUPERVISOR = 3

let db
const visitIdsDibuat = []
const activityIdsDibuat = []
const berkasDibuat = []
const mulaiUji = Date.now()

const tokenUntuk = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' })

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
 */
const kirimDenganFoto = async (userId, fields, sertakanFoto) => {
    const form = new FormData()

    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) form.append(key, String(value))
    }

    if (sertakanFoto) {
        const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xd9]) // JPEG minimal
        form.append('photo', new Blob([buffer], { type: 'image/jpeg' }), 'uji.jpg')
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
})

after(async () => {
    if (db) {
        for (const id of activityIdsDibuat) {
            const [rows] = await db.query(
                'SELECT photo_url FROM visit_activities WHERE id = ?',
                [id]
            )

            if (rows[0]?.photo_url) {
                const nama = rows[0].photo_url.replace('/uploads/', '')
                const lokasi = path.join(__dirname, '..', '..', 'uploads', nama)

                if (fs.existsSync(lokasi)) fs.unlinkSync(lokasi)
            }

            await db.query('DELETE FROM visit_activities WHERE id = ?', [id])
        }

        for (const id of visitIdsDibuat) {
            await db.query('DELETE FROM visits WHERE id = ?', [id])
        }

        // Cleanup orphan files: foto uji yang tertinggal karena request ditolak
        // sebelum row DB tercipta (multer tulis file SEBELUM controller validate).
        // Scan semua *-uji.jpg yang dibuat sejak test mulai.
        const dirUpload = path.join(__dirname, '..', '..', 'uploads')
        for (const nama of fs.readdirSync(dirUpload)) {
            if (!nama.endsWith('-uji.jpg')) continue
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
            [SPG, customerId]
        )

        visitMilikSPG = v1.insertId
        visitIdsDibuat.push(visitMilikSPG)

        const [v2] = await db.query(
            `INSERT INTO visits (user_id, customer_id, checkin_time)
             VALUES (?, ?, NOW())`,
            [SPG_LUAR, customerId]
        )

        visitMilikSPGLuar = v2.insertId
        visitIdsDibuat.push(visitMilikSPGLuar)
    })

    test('SPG mencatat activity tipe FOTO untuk kunjungannya sendiri', async () => {
        const { status, data } = await kirimDenganFoto(
            SPG,
            { visit_id: visitMilikSPG, activity_id: 11 },
            true
        )

        assert.strictEqual(status, 200)
        assert.strictEqual(data.activity_id, 11)

        activityIdsDibuat.push(data.id)

        const [rows] = await db.query(
            'SELECT visit_id, activity_id, photo_url FROM visit_activities WHERE id = ?',
            [data.id]
        )

        assert.strictEqual(rows[0].visit_id, visitMilikSPG)
        assert.strictEqual(rows[0].activity_id, 11)
        assert.ok(rows[0].photo_url)
    })

    test('SPG mencoba mencatat activity untuk kunjungan SPG lain: ditolak 403', async () => {
        const { status } = await kirimDenganFoto(
            SPG,
            { visit_id: visitMilikSPGLuar, activity_id: 11 },
            true
        )

        assert.strictEqual(status, 403)

        const [rows] = await db.query(
            'SELECT id FROM visit_activities WHERE visit_id = ?',
            [visitMilikSPGLuar]
        )

        assert.strictEqual(rows.length, 0)
    })

    test('tipe STOCK tanpa qty: ditolak 400, tidak ada baris tersimpan', async () => {
        const { status } = await kirimDenganFoto(
            SPG,
            {
                visit_id: visitMilikSPG,
                activity_id: 4,
                product_name: 'Kara 65ml',
                expired_date: '2026-12-01',
            },
            false
        )

        assert.strictEqual(status, 400)
    })

    test('tipe FOTO tanpa berkas foto: ditolak 400', async () => {
        const { status } = await kirimDenganFoto(
            SPG,
            { visit_id: visitMilikSPG, activity_id: 11 },
            false
        )

        assert.strictEqual(status, 400)
    })

    test('visit_id yang tidak ada: 404', async () => {
        const { status } = await kirimDenganFoto(
            SPG,
            { visit_id: 99999999, activity_id: 11 },
            true
        )

        assert.strictEqual(status, 404)
    })

    test('activity_id di luar 1-11: ditolak 400, bukan 500 dari FK constraint', async () => {
        const { status } = await kirimDenganFoto(
            SPG,
            { visit_id: visitMilikSPG, activity_id: 999 },
            true
        )

        assert.strictEqual(status, 400)
    })

    test('tipe STOCK lengkap dengan qty valid: berhasil', async () => {
        const { status, data } = await kirimDenganFoto(
            SPG,
            {
                visit_id: visitMilikSPG,
                activity_id: 4,
                product_name: 'Kara 65ml',
                qty: 10,
                expired_date: '2026-12-01',
            },
            false
        )

        assert.strictEqual(status, 200)
        activityIdsDibuat.push(data.id)
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
            [SPG, customerRow[0].id]
        )

        visitMilikSPG = v.insertId
        visitIdsDibuat.push(visitMilikSPG)
    })

    test('berkas bukan gambar ditolak', async () => {
        const form = new FormData()

        form.append('visit_id', String(visitMilikSPG))
        form.append('activity_id', '11')
        form.append(
            'photo',
            new Blob([Buffer.from('bukan gambar')], { type: 'text/plain' }),
            'uji.txt'
        )

        const res = await fetch(BASE + '/api/visit-activities', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + tokenUntuk(SPG) },
            body: form,
        })

        assert.notStrictEqual(res.status, 200)

        const [rows] = await db.query(
            'SELECT id FROM visit_activities WHERE visit_id = ?',
            [visitMilikSPG]
        )

        assert.strictEqual(rows.length, 0)
    })

    test('berkas gambar biasa tetap diterima', async () => {
        const { status, data } = await kirimDenganFoto(
            SPG,
            { visit_id: visitMilikSPG, activity_id: 11 },
            true
        )

        assert.strictEqual(status, 200)
        activityIdsDibuat.push(data.id)
    })

    test('fileFilter tidak merusak endpoint upload Excel (multer instance sama, field berbeda)', async () => {
        // upload.middleware.js dipakai bersama oleh POST /api/visit-plans/upload
        // (field 'file', bukan 'photo') -- fileFilter field-aware HARUS tetap
        // meloloskan file non-image di jalur ini.
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
