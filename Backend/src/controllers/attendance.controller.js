const fs = require('fs')
const { Op } = require('sequelize')
const Attendance = require('../models/attendance.model')
const User = require('../models/user.model')
const { localDateString } = require('../utils/date.util')
const {
    parseCoordinate,
    isValidLatitude,
    isValidLongitude,
} = require('../utils/geo.util')
const { sendError, sendServerError } = require('../utils/response.util')
const {
    resolveSubordinateUserIds,
    ownerWhere,
} = require('../utils/access.util')

exports.checkIn = async (req, res) => {

    try {

        const { latitude, longitude, accuracy } = req.body

        const tanggal = localDateString()

        const sudahAda = await Attendance.findOne({
            where: { user_id: req.user.id, tanggal }
        })

        if (sudahAda) {
            if (req.file) fs.unlinkSync(req.file.path)
            return sendError(res, 400, 'Anda sudah absen masuk hari ini.')
        }

        // Absen masuk hari ini DIKUNCI selama masih ada absen hari
        // sebelumnya yang belum di-checkout -- ini pemaksaan yang bisa
        // ditegakkan secara jujur (bandingkan dengan mencoba "memaksa"
        // checkout tanggal yang sudah lewat: itu butuh foto+GPS live di
        // momen yang sudah tidak ada). exports.checkOut di bawah
        // sekarang menutup absen TERLAMA yang masih terbuka -- bukan
        // cuma punya hari ini -- jadi ini yang jadi jalan keluarnya.
        const belumSelesai = await Attendance.findOne({
            where: {
                user_id: req.user.id,
                tanggal: { [Op.lt]: tanggal },
                clock_out_time: null,
            },
            order: [['tanggal', 'ASC']],
        })

        if (belumSelesai) {
            if (req.file) fs.unlinkSync(req.file.path)
            return sendError(
                res,
                409,
                `Anda belum absen pulang tanggal ${belumSelesai.tanggal}. Selesaikan dulu sebelum absen masuk hari ini.`
            )
        }

        if (!req.file) {
            return sendError(res, 400, 'Foto wajib diisi untuk absen masuk.')
        }

        const accuracyNum = accuracy === undefined ? null : Number(accuracy)

        if (
            accuracyNum !== null &&
            (!Number.isFinite(accuracyNum) || accuracyNum <= 0)
        ) {
            fs.unlinkSync(req.file.path)
            return sendError(res, 400, 'Akurasi lokasi tidak valid.')
        }

        const lat = parseCoordinate(latitude)
        const lng = parseCoordinate(longitude)

        if (
            (latitude !== undefined && !isValidLatitude(lat)) ||
            (longitude !== undefined && !isValidLongitude(lng))
        ) {
            fs.unlinkSync(req.file.path)
            return sendError(res, 400, 'Koordinat tidak valid.')
        }

        const attendance = await Attendance.create({
            user_id: req.user.id,
            tanggal,
            clock_in_time: new Date(),
            clock_in_latitude: latitude ?? null,
            clock_in_longitude: longitude ?? null,
            clock_in_accuracy: accuracyNum,
            clock_in_photo_url: `/uploads/${req.file.filename}`,
        })

        res.json(attendance)

    } catch (err) {

        // Kalau ada error database apa pun setelah multer menulis foto
        // ke disk, berkasnya harus ikut dihapus -- kalau tidak, bocor
        // permanen jadi berkas yatim di disk. Dihapus di awal blok
        // catch, terlepas dari jenis errornya.
        if (req.file) fs.unlinkSync(req.file.path)

        // Dua request checkin nyaris bersamaan bisa lolos dari cek
        // findOne di atas (race condition) SEBELUM unique constraint
        // (user_id, tanggal) di database mencegah baris kedua tercipta.
        if (err.name === 'SequelizeUniqueConstraintError') {
            return sendError(res, 400, 'Anda sudah absen masuk hari ini.')
        }

        return sendServerError(res, err, 'ATTENDANCE CHECKIN')
    }

}

exports.checkOut = async (req, res) => {

    try {

        const { latitude, longitude, accuracy } = req.body

        // Absen TERLAMA yang masih terbuka, BUKAN cuma milik hari ini
        // -- ini yang membuat layar "Absen Pulang" juga jadi jalan
        // keluar buat absen hari sebelumnya yang kelupaan (lihat
        // penjagaan baru di checkIn di atas). Diurutkan ASC supaya
        // yang paling lama diselesaikan lebih dulu kalau entah
        // bagaimana ada lebih dari satu yang menumpuk.
        const attendance = await Attendance.findOne({
            where: { user_id: req.user.id, clock_out_time: null },
            order: [['tanggal', 'ASC']],
        })

        if (!attendance) {
            if (req.file) fs.unlinkSync(req.file.path)
            return sendError(res, 400, 'Anda belum absen masuk.')
        }

        if (!req.file) {
            return sendError(res, 400, 'Foto wajib diisi untuk absen pulang.')
        }

        const accuracyNum = accuracy === undefined ? null : Number(accuracy)

        if (
            accuracyNum !== null &&
            (!Number.isFinite(accuracyNum) || accuracyNum <= 0)
        ) {
            fs.unlinkSync(req.file.path)
            return sendError(res, 400, 'Akurasi lokasi tidak valid.')
        }

        const lat = parseCoordinate(latitude)
        const lng = parseCoordinate(longitude)

        if (
            (latitude !== undefined && !isValidLatitude(lat)) ||
            (longitude !== undefined && !isValidLongitude(lng))
        ) {
            fs.unlinkSync(req.file.path)
            return sendError(res, 400, 'Koordinat tidak valid.')
        }

        const [jumlahTerupdate] = await Attendance.update(
            {
                clock_out_time: new Date(),
                clock_out_latitude: latitude ?? null,
                clock_out_longitude: longitude ?? null,
                clock_out_accuracy: accuracyNum,
                clock_out_photo_url: `/uploads/${req.file.filename}`,
            },
            {
                where: {
                    id: attendance.id,
                    // Bersyarat pada clock_out_time masih null --
                    // inilah yang membuat UPDATE ini atomik terhadap
                    // race. Kalau dua request checkout nyaris
                    // bersamaan lolos cek `findOne` di atas (baca
                    // stale), cuma SATU UPDATE yang benar-benar
                    // mengubah baris (clock_out_time waktu itu masih
                    // null); yang kedua dapat affected rows 0 karena
                    // kondisi WHERE-nya sudah tidak cocok lagi.
                    clock_out_time: null,
                },
            }
        )

        if (jumlahTerupdate === 0) {
            fs.unlinkSync(req.file.path)
            return sendError(res, 400, 'Anda sudah absen pulang hari ini.')
        }

        const hasil = await Attendance.findByPk(attendance.id)

        res.json(hasil)

    } catch (err) {

        // Kalau ada error database apa pun setelah multer menulis foto
        // ke disk, berkasnya harus ikut dihapus -- kalau tidak, bocor
        // permanen jadi berkas yatim di disk.
        if (req.file) fs.unlinkSync(req.file.path)

        return sendServerError(res, err, 'ATTENDANCE CHECKOUT')
    }

}

exports.getToday = async (req, res) => {

    try {

        const tanggal = localDateString()

        const today = await Attendance.findOne({
            where: { user_id: req.user.id, tanggal }
        })

        // Sama query dengan penjagaan di checkIn -- dipakai layar Absen
        // buat langsung tahu (tanpa perlu gagal checkin dulu) kalau ada
        // absen pulang hari sebelumnya yang belum diselesaikan.
        const staleUnresolved = await Attendance.findOne({
            where: {
                user_id: req.user.id,
                tanggal: { [Op.lt]: tanggal },
                clock_out_time: null,
            },
            order: [['tanggal', 'ASC']],
        })

        res.json({ today, staleUnresolved })

    } catch (err) {
        return sendServerError(res, err, 'ATTENDANCE GET TODAY')
    }

}

// ======================
// GET ALL -- buat Report Absen (web). Subtree-wide by default, sama
// pola dengan visits/orders. from/to opsional, "YYYY-MM-DD".
// ======================

exports.getAll = async (req, res) => {

    try {

        const bolehDilihat = await resolveSubordinateUserIds(req.user)

        const where = ownerWhere(bolehDilihat)

        // ?mine=1 -- opt-in eksplisit dipakai layar Report Absen di
        // mobile (riwayat PRIBADI, bukan dasbor tim). Pola sama dengan
        // ?mine=1 di visits/orders/visit-plans. Default (tanpa param)
        // TIDAK berubah -- Report Absen di web memanggil endpoint ini
        // tanpa mine sama sekali dan mengharapkan subtree penuh.
        if (req.query.mine === '1') {
            where.user_id = req.user.id
        }

        const cocokTanggal = (nilai) =>
            typeof nilai === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(nilai)

        const dari = cocokTanggal(req.query.from) ? req.query.from : null
        const sampai = cocokTanggal(req.query.to) ? req.query.to : null

        if (dari && sampai) {
            where.tanggal = { [Op.between]: [dari, sampai] }
        }

        const data = await Attendance.findAll({
            where,
            include: [{ model: User, attributes: ['id', 'name', 'area_id'] }],
            order: [['tanggal', 'DESC']],
        })

        res.json(data)

    } catch (err) {
        return sendServerError(res, err, 'ATTENDANCE GET ALL')
    }

}
