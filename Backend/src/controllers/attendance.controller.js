const fs = require('fs')
const { Op } = require('sequelize')
const Attendance = require('../models/attendance.model')
const User = require('../models/user.model')
const Area = require('../models/area.model')
const { localDateString } = require('../utils/date.util')
const { resolveUserTimezone } = require('../utils/area.util')
const {
    parseCoordinate,
    isValidLatitude,
    isValidLongitude,
} = require('../utils/geo.util')
const { sendError, sendServerError } = require('../utils/response.util')
const {
    resolveSubordinateUserIds,
    ownerWhere,
    USER_ROLES,
} = require('../utils/access.util')
const {
    resolveTimezoneFromUser,
    buildReportRow,
    summarize,
} = require('../utils/attendanceReport.util')

exports.checkIn = async (req, res) => {

    try {

        const { latitude, longitude, accuracy } = req.body

        // "Hari ini" versi pegawai ini sendiri (WIB/WITA/WIT sesuai
        // areanya) -- bukan dipaksa WIB, supaya absen dini hari yang
        // sudah hari baru menurut jam lokalnya tidak kecatat sebagai
        // hari kemarin (lihat resolveUserTimezone).
        const timezone = await resolveUserTimezone(req.user.id)
        const tanggal = localDateString(new Date(), timezone)

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

        // Lokasi WAJIB, sama seperti check-in kunjungan customer --
        // dicatat sebagai bukti, bukan syarat radius (tidak ada gerbang
        // jarak di attendance), tapi kehadiran & validitasnya sendiri
        // tidak boleh diloloskan begitu saja. Sebelumnya ketiganya cuma
        // divalidasi KALAU dikirim, sehingga request tanpa lokasi sama
        // sekali tetap diterima.
        if (latitude === undefined || longitude === undefined || accuracy === undefined) {
            fs.unlinkSync(req.file.path)
            return sendError(res, 400, 'Lokasi wajib diisi untuk absen masuk.')
        }

        const accuracyNum = Number(accuracy)

        if (!Number.isFinite(accuracyNum) || accuracyNum <= 0) {
            fs.unlinkSync(req.file.path)
            return sendError(res, 400, 'Akurasi lokasi tidak valid.')
        }

        const lat = parseCoordinate(latitude)
        const lng = parseCoordinate(longitude)

        if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
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

        // Sama alasannya dengan checkIn -- lokasi wajib, bukan opsional.
        if (latitude === undefined || longitude === undefined || accuracy === undefined) {
            fs.unlinkSync(req.file.path)
            return sendError(res, 400, 'Lokasi wajib diisi untuk absen pulang.')
        }

        const accuracyNum = Number(accuracy)

        if (!Number.isFinite(accuracyNum) || accuracyNum <= 0) {
            fs.unlinkSync(req.file.path)
            return sendError(res, 400, 'Akurasi lokasi tidak valid.')
        }

        const lat = parseCoordinate(latitude)
        const lng = parseCoordinate(longitude)

        if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
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

        const timezone = await resolveUserTimezone(req.user.id)
        const tanggal = localDateString(new Date(), timezone)

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


// ======================
// GET REPORT -- endpoint BARU, BERDIRI SENDIRI. Tidak dipakai dan
// tidak mengubah apa pun di getAll/getToday/checkIn/checkOut di atas,
// dan BELUM dipakai web/mobile yang sudah ada -- murni tambahan.
//
// Beda dengan getAll (baris mentah): di sini tanggal/jam sudah
// diformat di zona waktu PEGAWAI masing-masing (bukan dipaksa WIB),
// status (LENGKAP/BELUM_PULANG) sudah dihitung, dan ada rekap
// (summary) di atas daftarnya -- pemanggil tinggal render, tidak perlu
// fetch /users + /areas terpisah atau hitung ulang sendiri.
//
// Query (semua opsional): ?mine=1, ?from=YYYY-MM-DD&to=YYYY-MM-DD,
// ?area_id=, ?user_id=, ?role= (satu atau lebih, dipisah koma, mis.
// "MD,SPG" -- bukan dikunci di kode, supaya pemanggil yang menentukan
// jabatan mana saja tanpa perlu ubah endpoint tiap kebutuhannya beda)
// ======================
exports.getReport = async (req, res) => {

    try {

        const bolehDilihat = await resolveSubordinateUserIds(req.user)

        const where = ownerWhere(bolehDilihat)

        if (req.query.mine === '1') {
            where.user_id = req.user.id
        }

        // ?user_id eksplisit WAJIB tetap di dalam subtree yang boleh
        // dilihat pemanggil -- bolehDilihat null berarti tidak
        // dibatasi (ADMINISTRATOR dkk), jadi langsung dipakai apa
        // adanya kalau begitu.
        const userIdDiminta = Number(req.query.user_id)

        if (Number.isInteger(userIdDiminta) && userIdDiminta > 0) {

            if (bolehDilihat !== null && !bolehDilihat.includes(userIdDiminta)) {
                return res.json({ summary: { hadir: 0, belum_pulang: 0 }, rows: [] })
            }

            where.user_id = userIdDiminta

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
            order: [['tanggal', 'DESC']],
        })

        if (data.length === 0) {
            return res.json({ summary: { hadir: 0, belum_pulang: 0 }, rows: [] })
        }

        // User + area-nya di-bulk-fetch SATU query buat semua baris
        // sekaligus -- bukan satu query per baris -- supaya laporan
        // sebulan penuh buat satu tim tidak menghasilkan ratusan query
        // database hanya untuk tahu zona waktu tiap orang.
        const userIds = [...new Set(data.map((a) => a.user_id))]

        const users = await User.findAll({
            where: { id: { [Op.in]: userIds } },
            attributes: ['id', 'name', 'role', 'area_id'],
            include: [
                {
                    model: Area,
                    as: 'AssignedAreas',
                    attributes: ['id', 'name', 'timezone'],
                    through: { attributes: [] },
                },
                {
                    model: Area,
                    attributes: ['id', 'name', 'timezone'],
                },
            ],
        })

        const userById = new Map(users.map((u) => [u.id, u]))

        // area_id dari query -- disaring di JS (BUKAN di SQL), karena
        // "area milik user" bisa dari AssignedAreas (bisa lebih dari
        // satu) ATAU area_id legacy, sama pola dengan filter Area di
        // web Report Attendance sekarang.
        const areaIdDiminta = Number(req.query.area_id)
        const areaFilterAktif = Number.isInteger(areaIdDiminta) && areaIdDiminta > 0

        const cocokAreaFilter = (user) => {

            if (!areaFilterAktif) return true

            if (user?.AssignedAreas?.length) {
                return user.AssignedAreas.some((ar) => ar.id === areaIdDiminta)
            }

            return user?.area_id === areaIdDiminta

        }

        // Nilai yang tidak dikenal (salah ketik, role yang sudah tidak
        // ada) diam-diam dibuang -- bukan 400. ?role=MD,xxx tetap
        // jalan sebagai "MD saja", bukan gagal total gara-gara satu
        // token yang salah.
        const roleDiminta = new Set(
            String(req.query.role ?? '')
                .split(',')
                .map((r) => r.trim().toUpperCase())
                .filter((r) => USER_ROLES.includes(r))
        )

        const roleFilterAktif = roleDiminta.size > 0

        const cocokRoleFilter = (user) =>
            !roleFilterAktif || roleDiminta.has(user?.role)

        const rows = []

        for (const baris of data) {

            const user = userById.get(baris.user_id) ?? null

            if (!cocokAreaFilter(user)) continue
            if (!cocokRoleFilter(user)) continue

            const timezone = resolveTimezoneFromUser(user)

            const areaUntukNama =
                user?.AssignedAreas?.[0] ?? user?.Area ?? null

            rows.push(
                buildReportRow(
                    baris.toJSON(),
                    { name: user?.name ?? null, area_name: areaUntukNama?.name ?? null },
                    timezone
                )
            )

        }

        res.json({ summary: summarize(rows), rows })

    } catch (err) {
        return sendServerError(res, err, 'ATTENDANCE GET REPORT')
    }

}
