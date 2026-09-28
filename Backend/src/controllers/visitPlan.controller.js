
const { Op } =
    require('sequelize')

const XLSX = require('xlsx')

const ExcelJS = require('exceljs')

const fs = require('fs')

const VisitPlan =
    require('../models/visitPlan.model')

const User =
    require('../models/user.model')

const Customer =
    require('../models/customer.model')

const Area =
    require('../models/area.model')

const Visit =
    require('../models/visit.model')

const { sendError, sendServerError } =
    require('../utils/response.util')

const {
    localDateString,
    addDaysLocal,
} = require('../utils/date.util')

const {
    resolveSubordinateUserIds,
    PLAN_WRITER_ROLES,
    USER_MANAGER_ROLES,
    RESTRICTED_ROLES,
    FIELD_ROLES,
    ownerWhere,
    assertWithinSubtree,
} = require('../utils/access.util')

const { resolveAccessibleAreaIds } =
    require('../utils/area.util')

const { parseId } =
    require('../utils/id.util')



// ======================
// GET ALL
// ======================

/**
 * Rentang tanggal yang dilihat SPG: hari ini dan besok.
 *
 * Dua hari, bukan satu — sales perlu bisa bersiap untuk besok. Ini
 * keputusan produk yang sebelumnya terjadi secara kebetulan lewat
 * Op.between; sekarang eksplisit dan dijaga tes.
 *
 * Fungsi murni dan diekspor supaya batas bulan serta batas tahun bisa
 * diuji tanpa database.
 */
const spgDateRange = (now = new Date()) => [
    localDateString(now),
    addDaysLocal(now, 1),
]

exports.getAll =
    async (req, res) => {

        try {

            const loginUser =
                await User.findByPk(

                    req.user.id

                )

            if (!loginUser) {
                return sendError(res, 404, 'User tidak ditemukan.')
            }

            let whereCondition = {}

            // Satu aturan untuk "data siapa yang boleh saya lihat":
            // rantai supervisor_id, bukan area. SPG boleh punya berapa
            // pun area — ikatan ke atasannya tetap satu.
            //
            // null berarti tidak dibatasi, jadi kunci user_id tidak
            // dipasang sama sekali. Memasangnya dengan array kosong akan
            // membuat administrator melihat nol.
            const bolehDilihat =
                await resolveSubordinateUserIds(loginUser)

            Object.assign(whereCondition, ownerWhere(bolehDilihat))

            // SPG melihat rencana hari ini dan besok. Rentangnya
            // eksplisit lewat spgDateRange — sebelumnya tanggalnya
            // dihitung UTC, sehingga tiap pagi 00:00-07:00 WIB yang
            // muncul adalah kemarin + hari ini.
            //
            // PERINGATAN: cabang ini menimpa whereCondition SELURUHNYA,
            // termasuk klausa user_id dari ownerWhere(bolehDilihat) di
            // atas -- dan itu memang disengaja, BUKAN celah. Ia hanya
            // aman karena SPG adalah role daun: subtree-nya persis
            // [dirinya sendiri], sehingga user_id: loginUser.id di sini
            // MENULIS ULANG batasan yang sama persis dengan yang sudah
            // dihasilkan ownerWhere, bukan melonggarkannya. Menghapus
            // `user_id: loginUser.id` sebagai "redundan" akan membuka
            // kembali kebocoran: whereCondition tersisa hanya
            // { visit_date: {...} } tanpa batasan pemilik sama sekali,
            // dan SPG mana pun akan melihat jadwal SEMUA orang pada
            // rentang tanggal itu.
            //
            // ?mine=1 -- opt-in eksplisit dipakai mobile (layar "Rencana
            // Kunjungan" adalah jadwal PRIBADI buat check-in, bukan
            // dasbor pengawasan tim). Tanpa ini, akun non-SPG (mis.
            // supervisor yang juga punya jadwal sendiri) melihat jadwal
            // SELURUH subtree-nya tanpa batas tanggal saat login lewat
            // mobile -- persis gerbang default di bawah, sengaja tidak
            // diubah supaya sfa-web/app/visit-plans/page.tsx (dasbor
            // manajemen tim lintas tanggal) tetap jalan seperti semula.
            if (['MD', 'SPG', 'SALES'].includes(loginUser.role) || req.query.mine === '1') {

                const [hariIni, besok] = spgDateRange()

                whereCondition = {

                    user_id: loginUser.id,

                    visit_date: {

                        [Op.between]: [hariIni, besok]

                    }

                }

            }

            const data =
                await VisitPlan.findAll({

                    where: whereCondition,

                    include: [

                        {
                            model: User,
                            attributes: ['name']
                        },

                        {
                            model: Customer,

                            attributes: [

                                'id',

                                'name',

                                // code & address dipakai baris daftar
                                // di mobile — tanpa keduanya layar
                                // perlu request kedua per baris.
                                'code',

                                'address',

                                'latitude',

                                'longitude'

                            ]
                        },

                        {
                            model: Visit
                        }

                    ],

                    order: [

                        ['visit_date', 'ASC']

                    ]

                })

            // Array telanjang, sama dengan /api/customers. Tidak ada
            // konsumen yang memakai bentuk { data } — modul visit di
            // mobile masih kosong saat perubahan ini dibuat.
            res.json(data)

        } catch (err) {

            return sendServerError(
                res,
                err,
                'GET ALL VISIT PLAN'
            )

        }

    }

// ======================
// CREATE
// ======================

exports.create =
    async (req, res) => {

        try {

            // Gerbang role dulu, sebelum data apa pun disentuh.
            // update dan delete sudah punya ini sejak sub-proyek
            // visit-plan; create tidak punya apa pun.
            if (!PLAN_WRITER_ROLES.includes(req.user.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya supervisor ke atas yang boleh membuat jadwal kunjungan.'
                )
            }

            const { user_id, customer_id, visit_date } = req.body

            if (
                user_id === undefined ||
                customer_id === undefined ||
                visit_date === undefined
            ) {
                return sendError(
                    res,
                    400,
                    'user_id, customer_id, dan visit_date wajib diisi.'
                )
            }

            // Jadwal baru cuma boleh hari ini atau ke depan -- tanggal
            // yang sudah lewat cuma bisa diedit (lihat exports.update di
            // bawah), bukan dibuatkan jadwal baru. Perbandingan string
            // sah karena visit_date selalu "YYYY-MM-DD" (format yang
            // sama dipakai localDateString dan seluruh filter tanggal di
            // web) -- urutan leksikografis format itu SAMA dengan urutan
            // tanggalnya. Web sudah mencegah ini di UI (min di input
            // date, gerbang klik di kalender), tapi itu bisa dilewati
            // lewat panggilan API langsung -- gerbang yang berlaku
            // adalah yang di sini.
            if (visit_date < localDateString(new Date())) {
                return sendError(
                    res,
                    400,
                    'Tidak bisa membuat jadwal untuk tanggal yang sudah lewat.'
                )
            }

            // Dinormalkan SEBELUM gerbang kepemilikan, bukan sesudah.
            // assertWithinSubtree mengembalikan "boleh" seketika saat
            // subordinateIds === null (ADMINISTRATOR) TANPA PERNAH
            // melihat user_id -- jadi untuk administrator, validasi
            // inilah satu-satunya yang berdiri antara id yang cacat dan
            // tabelnya. Tanpa ini: user_id: null gagal di database
            // (kolom NOT NULL, sql_mode STRICT_TRANS_TABLES) dan
            // tersurat sebagai 500; user_id: 0 justru LOLOS NOT NULL
            // dan tersimpan sebagai baris yatim, karena visit_plans
            // tidak punya foreign key sama sekali.
            const targetUserId = parseId(user_id)
            const targetCustomerId = parseId(customer_id)

            if (targetUserId === null || targetCustomerId === null) {
                return sendError(
                    res,
                    400,
                    'user_id dan customer_id harus id yang sah.'
                )
            }

            const bolehDilihat =
                await resolveSubordinateUserIds(req.user)

            const gerbang =
                assertWithinSubtree(bolehDilihat, targetUserId)

            if (gerbang) {
                return sendError(res, gerbang.status, gerbang.message)
            }

            // Diperiksa SETELAH gerbang kepemilikan, sengaja: pemanggil
            // yang di luar subtree-nya tidak perlu diberi tahu apakah
            // id targetnya ada atau tidak -- ia sudah ditolak 403 lebih
            // dulu di atas.
            //
            // visit_plans TIDAK PUNYA foreign key sama sekali (diverifikasi
            // langsung ke information_schema.KEY_COLUMN_USAGE). parseId di
            // atas hanya memastikan bentuknya "bilangan bulat >= 1" --
            // ADMINISTRATOR (subordinateIds === null, lolos gerbang di atas
            // tanpa pernah melihat targetUserId) yang mengirim id yang sah
            // secara bentuk tapi tidak ada barisnya akan menulis baris
            // yatim yang menunjuk user atau customer yang tidak pernah ada,
            // dan tidak ada apa pun di bawahnya yang menangkap itu.
            const [pemilik, pelanggan] = await Promise.all([
                User.findByPk(targetUserId),
                Customer.findByPk(targetCustomerId),
            ])

            if (!pemilik || !pelanggan) {
                return sendError(
                    res,
                    400,
                    'user_id atau customer_id tidak ditemukan.'
                )
            }

            // Daftar field EKSPLISIT menggantikan { ...req.body }.
            // Spread hanya dibatasi oleh atribut yang dideklarasikan
            // model, dan user_id ada di antaranya — itulah lubang
            // kepemilikannya. Daftar eksplisit membuat kolom baru di
            // masa depan tidak otomatis bisa ditulis klien.
            //
            // user_id dan customer_id memakai nilai yang sudah
            // dinormalkan parseId, bukan req.body mentah -- keduanya
            // sudah dipastikan bilangan bulat positif di atas.
            //
            // status dipaksa PENDING dan TIDAK diambil dari body: update
            // dan delete menolak jadwal non-PENDING, sehingga jadwal
            // yang lahir COMPLETED terkunci selamanya.
            const data =
                await VisitPlan.create({

                    user_id: targetUserId,

                    customer_id: targetCustomerId,

                    visit_date,

                    status: 'PENDING'

                })

            res.json(data)

        } catch (err) {

            return sendServerError(
                res,
                err,
                'VISIT PLAN'
            )

        }

    }

// ======================
// UPDATE
// ======================

/** Field visit plan yang boleh diubah. Sisanya diabaikan. */
const UPDATABLE_FIELDS = ['customer_id', 'visit_date']

exports.update =
    async (req, res) => {

        try {

            const visitPlan =
                await VisitPlan.findByPk(req.params.id)

            if (!visitPlan) {
                return sendError(
                    res,
                    404,
                    'Visit Plan tidak ditemukan.'
                )
            }

            const loginUser =
                await User.findByPk(req.user.id)

            if (!loginUser) {
                return sendError(res, 404, 'User tidak ditemukan.')
            }

            // Jadwal adalah target. Target yang bisa diubah sendiri oleh
            // yang ditarget berhenti berfungsi sebagai target.
            //
            // Allowlist, bukan blacklist: role NULL, nilai warisan, atau
            // role baru apa pun tidak otomatis mendapat hak tulis.
            if (!PLAN_WRITER_ROLES.includes(loginUser.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya supervisor ke atas yang boleh mengubah visit plan.'
                )
            }

            const bolehDilihat =
                await resolveSubordinateUserIds(loginUser)

            const gerbang =
                assertWithinSubtree(bolehDilihat, visitPlan.user_id)

            if (gerbang) {
                return sendError(res, gerbang.status, gerbang.message)
            }

            // Status diperiksa SEBELUM data disentuh. Sebelumnya
            // datanya diubah dulu lalu 400 dikirim — penolakan datang
            // setelah datanya rusak.
            if (visitPlan.status !== 'PENDING') {
                return sendError(
                    res,
                    400,
                    `Visit plan yang berstatus ${visitPlan.status} tidak bisa diubah.`
                )
            }

            // Hanya field yang benar-benar dikirim. Sebelumnya `notes`
            // ikut ditulis — kolom yang tidak ada di tabel maupun model,
            // jadi Sequelize mengabaikannya diam-diam.
            const perubahan = {}

            for (const field of UPDATABLE_FIELDS) {
                if (req.body[field] !== undefined) {
                    perubahan[field] = req.body[field]
                }
            }

            if (Object.keys(perubahan).length === 0) {
                return sendError(
                    res,
                    400,
                    'Tidak ada field yang bisa diubah pada permintaan ini.'
                )
            }

            await visitPlan.update(perubahan)

            res.json({
                message: 'Visit Plan berhasil diupdate'
            })

        }

        catch (err) {

            return sendServerError(
                res,
                err,
                'UPDATE VISIT PLAN'
            )

        }

    }

// ======================
// DELETE
// ======================

exports.delete =
    async (req, res) => {

        try {

            const visitPlan =
                await VisitPlan.findByPk(req.params.id)

            if (!visitPlan) {
                return sendError(
                    res,
                    404,
                    'Visit Plan tidak ditemukan.'
                )
            }

            const loginUser =
                await User.findByPk(req.user.id)

            if (!loginUser) {
                return sendError(res, 404, 'User tidak ditemukan.')
            }

            // Lebih ketat dari update (PLAN_WRITER_ROLES, supervisor ke
            // atas) -- hapus permanen menghilangkan datanya sama sekali,
            // beda dengan update yang masih bisa ditelusuri riwayatnya.
            // USER_MANAGER_ROLES dipakai ulang (bukan konstanta baru)
            // supaya "siapa itu administrator" tetap satu sumber
            // kebenaran dengan gerbang pengelolaan akun user.
            if (!USER_MANAGER_ROLES.includes(loginUser.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya administrator yang boleh menghapus visit plan.'
                )
            }

            const bolehDilihat =
                await resolveSubordinateUserIds(loginUser)

            const gerbang =
                assertWithinSubtree(bolehDilihat, visitPlan.user_id)

            if (gerbang) {
                return sendError(res, gerbang.status, gerbang.message)
            }

            // Diperiksa SEBELUM destroy. Sebelumnya barisnya dihapus
            // dulu, lalu 400 dikirim — datanya sudah hilang.
            if (visitPlan.status !== 'PENDING') {
                return sendError(
                    res,
                    400,
                    `Visit plan yang berstatus ${visitPlan.status} tidak bisa dihapus.`
                )
            }

            await visitPlan.destroy()

            res.json({
                message: 'Visit Plan berhasil dihapus'
            })

        }

        catch (err) {

            return sendServerError(
                res,
                err,
                'DELETE VISIT PLAN'
            )

        }

    }

// ======================
// UPLOAD EXCEL
// ======================


exports.uploadExcel = async (req, res) => {

    try {

        // Gerbang role dulu, sebelum file apa pun dibaca -- sama seperti
        // create. Endpoint ini dulu tidak punya penjaga sama sekali: SPG
        // mana pun bisa mengunggah spreadsheet berisi kode sales siapa
        // saja dan membuat jadwal kunjungan untuk seluruh perusahaan.
        if (!PLAN_WRITER_ROLES.includes(req.user.role)) {

            // Multer sudah menulis berkasnya ke disk sebelum handler
            // ini sempat memeriksa apa pun. /uploads disajikan tanpa
            // autentikasi (lihat tests/README.md), jadi berkas yang
            // tidak dihapus di sini menjadi bisa dibaca siapa pun tanpa
            // token -- penolakan yang tidak membersihkan dirinya sendiri
            // sama saja dengan menerima uploadnya.
            fs.unlinkSync(req.file.path)

            return sendError(
                res,
                403,
                'Hanya supervisor ke atas yang boleh membuat jadwal kunjungan.'
            )
        }

        const workbook =
            XLSX.readFile(req.file.path)

        // Cari berdasarkan NAMA, bukan asumsi sheet pertama -- sheet
        // "Referensi" (dropdown/lookup) SENGAJA di-hide tapi tetap ada
        // di workbook, dan urutan sheet bisa berubah kalau user
        // mengutak-atik filenya. Fallback ke sheet pertama tetap ada
        // buat file lama/berbeda yang tidak punya sheet bernama ini.
        const sheet =
            workbook.Sheets['Input Kunjungan'] ||
            workbook.Sheets[workbook.SheetNames[0]]

        // range: 1 -- baris pertama sheet ini berisi teks petunjuk (satu
        // sel digabung), BUKAN header kolom. Header sebenarnya ada di
        // baris kedua. Tanpa range: 1, sheet_to_json menganggap baris
        // petunjuk itu sebagai header dan seluruh data bergeser satu
        // baris, membuat setiap kolom (termasuk Tanggal Kunjungan)
        // terbaca undefined.
        const rows =
            XLSX.utils.sheet_to_json(sheet, { range: 1 })

        let inserted = 0
        let duplicate = 0

        const errors = []

        // Diambil SEKALI di sini, di luar loop baris -- satu query untuk
        // seluruh file, bukan satu query per baris. Baris spreadsheet
        // bisa berjumlah ratusan; menghitung ulang subtree pemanggil
        // untuk tiap baris akan membebani database tanpa mengubah
        // jawabannya sama sekali, karena subtree pemanggil tidak
        // berubah selama satu request berjalan.
        const bolehDilihat =
            await resolveSubordinateUserIds(req.user)

        for (const row of rows) {

            //--------------------------------
            // Ambil data dari Excel
            //--------------------------------

            // Header ini HARUS cocok persis dengan header sheet "Input
            // Kunjungan" yang digenerate downloadTemplate() di bawah --
            // "Kode Sales"/"Kode Customer" adalah kolom hasil VLOOKUP
            // (terisi otomatis begitu user pilih dari dropdown "Sales"/
            // "Customer"), bukan kolom dropdown itu sendiri. Dulu
            // headernya "Sales Code"/"Customer Code"/"Visit Date" while
            // template resmi menulis "salesCode"/"customerCode"/
            // "visitDate" -- tidak pernah cocok sama sekali, jadi
            // template resmi yang diunduh lalu diunggah tanpa diubah
            // selalu gagal 100%. Sekarang keduanya satu sumber (fungsi
            // ini menulis apa yang downloadTemplate() baca).
            const salesCode =
                row["Kode Sales"]

            const customerCode =
                row["Kode Customer"]

            const excelDate =
                row["Tanggal Kunjungan"]

            //--------------------------------
            // Convert Excel Date
            //--------------------------------

            const jsDate =
                XLSX.SSF.parse_date_code(excelDate)

            const visitDate =
                `${jsDate.y}-${String(jsDate.m).padStart(2, '0')}-${String(jsDate.d).padStart(2, '0')}`

            //--------------------------------
            // SALES
            //--------------------------------

            const user =
                await User.findOne({

                    where: {

                        code: salesCode

                    }

                })

            if (!user) {

                errors.push({

                    row,

                    reason: 'Sales Code tidak ditemukan'

                })

                continue

            }

            //--------------------------------
            // KEPEMILIKAN
            //--------------------------------

            // Baris ini di luar jangkauan pemanggil. Baris lain dalam
            // file yang sama tetap diproses -- satu baris di luar
            // subtree tidak boleh menggagalkan seluruh upload, sama
            // seperti Sales Code atau Customer Code yang tidak
            // ditemukan di atas dan di bawah.
            //
            // Alasannya SENGAJA disamakan dengan "tidak ditemukan":
            // supervisor tidak perlu tahu apakah sebuah kode sales itu
            // benar-benar tidak ada atau hanya di luar jangkauannya.
            // Membedakan keduanya membuat file berisi kode tebakan bisa
            // dipakai memetakan kode sales siapa saja yang ada di
            // perusahaan, sama seperti 403-sebelum-404 di endpoint lain.
            const gerbangBaris =
                assertWithinSubtree(bolehDilihat, user.id)

            if (gerbangBaris) {

                errors.push({

                    row,

                    reason: 'Sales Code tidak ditemukan'

                })

                continue

            }

            //--------------------------------
            // CUSTOMER
            //--------------------------------

            const customer =
                await Customer.findOne({

                    where: {

                        code: customerCode

                    }

                })

            if (!customer) {

                errors.push({

                    row,

                    reason: 'Customer Code tidak ditemukan'

                })

                continue

            }


            //--------------------------------
            // DUPLICATE
            //--------------------------------

            const exist =
                await VisitPlan.findOne({

                    where: {

                        user_id: user.id,

                        customer_id: customer.id,

                        visit_date: visitDate

                    }

                })

            if (exist) {

                duplicate++

                continue

            }

            //--------------------------------
            // INSERT
            //--------------------------------

            await VisitPlan.create({

                user_id: user.id,

                customer_id: customer.id,

                visit_date: visitDate,

                status: "PENDING"

            })

            inserted++

        }

        //--------------------------------

        fs.unlinkSync(req.file.path)

        //--------------------------------

        res.json({

            success: true,

            total:
                rows.length,

            inserted,

            duplicate,

            failed:
                errors.length,

            errors

        })

    }

    catch (err) {

        // Sama alasannya dengan penolakan role: berkas yang gagal
        // diproses tidak boleh tertinggal di /uploads yang tanpa
        // autentikasi. req.file mungkin belum ada kalau error terjadi
        // sebelum multer selesai menulis.
        if (req.file?.path) {
            fs.unlinkSync(req.file.path)
        }

        return sendServerError(
            res,
            err,
            'UPLOAD VISIT PLAN EXCEL'
        )

    }

}


// ======================
// DOWNLOAD TEMPLATE
// ======================

/**
 * Template Excel DIGENERATE PER USER, bukan file statis lagi --
 * sheet "Referensi" cuma berisi sales dan customer yang boleh dilihat
 * pemanggil (subtree + area/channel, PERSIS aturan yang sama dipakai
 * di tempat lain), jadi customer baru otomatis ikut muncul tanpa perlu
 * update template manual, dan sales/customer di luar jangkauan
 * pemanggil tidak pernah bocor ke filenya.
 *
 * Header kolom "Kode Sales"/"Kode Customer"/"Tanggal Kunjungan" di
 * sheet "Input Kunjungan" HARUS cocok persis dengan yang dibaca
 * uploadExcel() di atas -- satu sumber kebenaran, ditulis di sini,
 * dibaca di sana.
 */
exports.downloadTemplate = async (req, res) => {

    try {

        if (!PLAN_WRITER_ROLES.includes(req.user.role)) {
            return sendError(
                res,
                403,
                'Hanya supervisor ke atas yang boleh mengunduh template.'
            )
        }

        // SALES -- subtree pemanggil, dipersempit ke role lapangan
        // (MD/SPG/SALES) karena merekalah yang benar-benar dijadwalkan
        // lewat file ini.
        const subtreeIds =
            await resolveSubordinateUserIds(req.user)

        const salesWhere = {
            role: { [Op.in]: FIELD_ROLES },
        }

        if (subtreeIds !== null) {
            salesWhere.id = { [Op.in]: subtreeIds }
        }

        const salesList = await User.findAll({
            where: salesWhere,
            attributes: ['code', 'name'],
            order: [['name', 'ASC']],
        })

        // CUSTOMER -- pola SAMA PERSIS dengan customer.controller.js
        // getAll, supaya customer yang muncul di template ini tidak
        // pernah berbeda dari yang terlihat di Master Customer.
        let customerWhere = { status: 'ACTIVE' }

        if (RESTRICTED_ROLES.includes(req.user.role)) {

            const userWithAreas = await User.findByPk(req.user.id, {
                include: [{
                    model: Area,
                    as: 'AssignedAreas',
                    attributes: ['id'],
                    through: { attributes: [] },
                }],
            })

            const areaIds = resolveAccessibleAreaIds(userWithAreas)

            customerWhere = {
                ...customerWhere,
                ...(areaIds.length === 0
                    ? { id: -1 }
                    : {
                        area_id: { [Op.in]: areaIds },
                        channel_id: req.user.channel_id,
                    }),
            }

        }

        const customerList = await Customer.findAll({
            where: customerWhere,
            attributes: ['code', 'name'],
            include: [{ model: Area, attributes: ['name'] }],
            order: [['name', 'ASC']],
        })

        const wb = new ExcelJS.Workbook()

        // ---- SHEET REFERENSI (sumber dropdown + VLOOKUP) ----
        const ref = wb.addWorksheet('Referensi')

        ref.columns = [
            { header: 'Pilihan Sales', key: 'salesPilihan', width: 32 },
            { header: 'Kode Sales', key: 'salesCode', width: 14 },
            { header: 'Nama Sales', key: 'salesName', width: 22 },
            { header: '', key: 'gap', width: 3 },
            { header: 'Pilihan Customer', key: 'custPilihan', width: 40 },
            { header: 'Kode Customer', key: 'custCode', width: 14 },
            { header: 'Nama Customer', key: 'custName', width: 28 },
            { header: 'Area', key: 'area', width: 16 },
        ]

        salesList.forEach((u, i) => {
            const row = ref.getRow(i + 2)
            row.getCell('salesPilihan').value = `${u.name} (${u.code})`
            row.getCell('salesCode').value = u.code
            row.getCell('salesName').value = u.name
        })

        customerList.forEach((c, i) => {
            const row = ref.getRow(i + 2)
            row.getCell('custPilihan').value = `${c.name} (${c.code})`
            row.getCell('custCode').value = c.code
            row.getCell('custName').value = c.name
            row.getCell('area').value = c.Area?.name || ''
        })

        ref.getRow(1).font = { bold: true }
        ref.state = 'hidden'

        const salesCount = salesList.length
        const custCount = customerList.length

        // ---- SHEET INPUT (yang diisi user) ----
        const sheet = wb.addWorksheet('Input Kunjungan')

        sheet.mergeCells('A1:F1')
        const instruksi = sheet.getCell('A1')
        instruksi.value =
            'Petunjuk: pilih Sales & Customer dari dropdown (klik sel, muncul panah di kanan) -- ' +
            'cari berdasarkan NAMA, kode di dalam kurung cuma buat mastiin tokonya benar kalau ada nama mirip. ' +
            'Kolom Kode & Area terisi otomatis. Isi Tanggal Kunjungan di kolom terakhir.'
        instruksi.alignment = { wrapText: true, vertical: 'middle' }
        instruksi.font = { italic: true, color: { argb: 'FF555555' } }
        sheet.getRow(1).height = 40

        const headerRow = sheet.getRow(2)
        headerRow.values = ['Sales', 'Kode Sales', 'Customer', 'Kode Customer', 'Area', 'Tanggal Kunjungan']
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        headerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
            cell.alignment = { horizontal: 'center' }
        })

        sheet.columns = [
            { key: 'salesPilihan', width: 26 },
            { key: 'salesCode', width: 13 },
            { key: 'custPilihan', width: 32 },
            { key: 'custCode', width: 14 },
            { key: 'area', width: 14 },
            { key: 'visitDate', width: 18 },
        ]

        const TOTAL_BARIS_DISIAPKAN = 200

        for (let i = 0; i < TOTAL_BARIS_DISIAPKAN; i++) {

            const r = sheet.getRow(3 + i)

            if (salesCount > 0) {
                r.getCell(1).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`Referensi!$A$2:$A$${1 + salesCount}`],
                    showErrorMessage: true,
                    errorTitle: 'Pilihan tidak valid',
                    error: 'Pilih Sales dari daftar dropdown, jangan ketik manual.',
                }
            }

            if (custCount > 0) {
                r.getCell(3).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`Referensi!$E$2:$E$${1 + custCount}`],
                    showErrorMessage: true,
                    errorTitle: 'Pilihan tidak valid',
                    error: 'Pilih Customer dari daftar dropdown, jangan ketik manual.',
                }
            }

            r.getCell(2).value = { formula: `IFERROR(VLOOKUP(A${3 + i},Referensi!$A:$C,2,0),"")` }
            r.getCell(4).value = { formula: `IFERROR(VLOOKUP(C${3 + i},Referensi!$E:$H,2,0),"")` }
            r.getCell(5).value = { formula: `IFERROR(VLOOKUP(C${3 + i},Referensi!$E:$H,4,0),"")` }

            ;[2, 4, 5].forEach((col) => {
                const cell = r.getCell(col)
                cell.protection = { locked: true }
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
                cell.font = { color: { argb: 'FF6B7280' } }
            })

            r.getCell(6).numFmt = 'dd/mm/yyyy'

        }

        sheet.views = [{ state: 'frozen', ySplit: 2 }]

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        res.setHeader(
            'Content-Disposition',
            'attachment; filename="visit-plan-template.xlsx"'
        )

        await wb.xlsx.write(res)
        res.end()

    } catch (err) {
        return sendServerError(res, err, 'DOWNLOAD VISIT PLAN TEMPLATE')
    }

}

exports.spgDateRange = spgDateRange