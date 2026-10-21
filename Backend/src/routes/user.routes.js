const router =
    require('express').Router()

const bcrypt =
    require('bcryptjs')

const User =
    require('../models/user.model')

const Area =
    require('../models/area.model')

const Channel =
    require('../models/channel.model')

const UserArea =
    require('../models/userArea.model')

const auth =
    require('../middleware/auth.middleware')

const db =
    require('../config/database')

require('../models/relations')

const {
    sendError,
    sendServerError,
} = require('../utils/response.util')

const {
    assertUserManagement,
    USER_ROLES,
    wouldRemoveLastActiveAdministrator,
    resolveSubordinateUserIds,
    ownerWhere,
    assertWithinSubtree,
} = require('../utils/access.util')

const {
    parseId,
} = require('../utils/id.util')

const {
    isLockConflictError,
    withShortLockWait,
} = require('../utils/lock.util')

const {
    nullableUpdate,
} = require('../utils/update.util')

const fs =
    require('fs')

const XLSX =
    require('xlsx')

const ExcelJS =
    require('exceljs')

const upload =
    require('../middleware/upload.middleware')


/**
 * Jawaban seragam untuk kedua handler saat transaksinya kalah balapan
 * lock.
 *
 * 503, bukan 409. Lantai administrator sudah memakai 409 untuk penolakan
 * yang TIDAK boleh diulang — mengulangnya akan ditolak lagi selamanya
 * sampai ada administrator lain diangkat. Kontensi lock kebalikannya:
 * permintaannya sah dan kemungkinan besar berhasil kalau dikirim ulang.
 * Memberi keduanya 409 berarti klien tidak bisa membedakan "jangan
 * diulang" dari "ulangi saja", padahal itu satu-satunya hal yang perlu
 * diketahui klien di sini.
 *
 * 503 juga lebih jujur soal sebabnya: server yang sementara tidak bisa
 * menyelesaikan permintaan yang valid, bukan permintaan yang bentrok
 * dengan keadaan sumber daya. Retry-After membuat sinyal itu bisa dibaca
 * mesin, bukan hanya manusia yang membaca pesannya.
 */
const sendLockConflict = (res) => {

    res.set('Retry-After', '1')

    return sendError(
        res,
        503,
        'Sistem sedang memproses perubahan akun lain. Silakan coba lagi.'
    )

}


/**
 * Query yang sama dipakai kedua handler yang bisa mengurangi jumlah
 * administrator aktif, dan SELALU dijalankan lebih dulu di dalam
 * transaksinya.
 *
 * Sengaja satu tempat: dua handler yang mengambil lock atas baris yang
 * sama dengan urutan berbeda tidak berakhir sebagai penolakan yang rapi,
 * melainkan sebagai deadlock MySQL yang muncul di klien sebagai 500.
 *
 * `lock: t.LOCK.UPDATE` menghasilkan SELECT ... FOR UPDATE. Inilah yang
 * membuat pemeriksaan lantai administrator benar saat dua request
 * berjalan bersamaan: transaksi kedua menunggu yang pertama commit, lalu
 * membaca ulang dan melihat jumlah yang sudah berkurang. Tanpa lock,
 * keduanya membaca angka yang sama dan sama-sama lolos.
 *
 * Kolom role dan status TIDAK berindeks, jadi FOR UPDATE di sini adalah
 * full scan yang mengunci setiap baris users beserta gap-nya, bukan hanya
 * kedua baris administrator. Diukur langsung: selama transaksi ini
 * terbuka, UPDATE atas baris SPG yang tidak berkaitan pun terblokir
 * sampai ER_LOCK_WAIT_TIMEOUT.
 *
 * JANGAN menambahkan index (role, status) untuk mempersempitnya tanpa
 * membaca catatan di tests/README.md lebih dulu. Sudah dicoba dan diukur:
 * index itu memang mempersempit lock bacanya, tapi UPDATE yang menulis
 * kolom role harus ikut memelihara entri index sekundernya, dan itu
 * membuat dua administrator yang saling menurunkan role berakhir
 * ER_LOCK_DEADLOCK pada 5 dari 6 percobaan — padahal tanpa index angkanya
 * 0 dari 8. Deadlock lebih buruk daripada lock yang lebar: yang satu
 * menggagalkan operasi yang sebelumnya berhasil, yang lain hanya
 * memperlambatnya.
 *
 * Yang MEMANG membatasi kerusakan lock lebar ini adalah batas tunggu
 * per-sesi di withShortLockWait: pemegang koneksi menyerah setelah 5
 * detik, bukan 50, sehingga pool tidak kering.
 */
const hitungAdminAktifTerkunci = async (t) => {

    const baris = await User.findAll({

        where: {
            role: 'ADMINISTRATOR',
            status: 'ACTIVE',
        },

        attributes: ['id'],

        transaction: t,

        lock: t.LOCK.UPDATE,

    })

    return baris.length

}




// ======================
// GET USERS
// ======================

router.get(

    '/',

    auth,

    async (req, res) => {

        try {

            // Dibaca dari req.user, bukan dimuat ulang: middleware auth
            // sudah mengambil baris segar dari database setiap request.
            // Memuat ulang di sini hanya menambah satu query yang bisa
            // mengembalikan null — dan `null.role` di bawah akan menjadi
            // 500 tanpa sebab yang jelas.

            // Satu aturan untuk seluruh bacaan: subtree supervisor_id.
            // Aturan lama membandingkan area_id tunggal — kolom yang
            // dikosongkan setiap penyuntingan lewat web — dan hanya
            // menurun satu tingkat. Akibatnya SPG melihat seluruh bagan
            // organisasi sementara MANAGER justru melihat kedua
            // administrator dan nol bawahannya.
            const bolehDilihat =
                await resolveSubordinateUserIds(req.user)

            // Kolomnya `id`, bukan `user_id`: yang difilter adalah baris
            // user itu sendiri, bukan baris milik user.
            const whereCondition = ownerWhere(bolehDilihat, 'id')


            const data =
                await User.findAll({

                    where:
                        whereCondition,

                    attributes: {

                        exclude: [
                            'password'
                        ]

                    },

                    include: [

                        {
                            model: Area
                        },

                        // Area cover sebenarnya (bisa lebih dari satu) --
                        // dipakai list User Management di web supaya
                        // kolom Area tidak cuma nampilin area_id
                        // tunggal yang legacy.
                        {
                            model: Area,
                            as: 'AssignedAreas',
                            attributes: ['id', 'code', 'name'],
                            through: { attributes: [] },
                        },

                        {
                            model: Channel
                        },

                        {
                            model: User,
                            as: 'Supervisor',

                            attributes: [
                                'id',
                                'name',
                                'role'
                            ]
                        }


                    ]



                })



            res.json(data)




        }

        catch (err) {

            console.log(err)

            res.status(500).json({

                error:
                    err.message

            })

        }

    }

)






// ======================
// CREATE USER
// ======================

router.post(

    '/',

    auth,

    async (req, res) => {

        try {

            const gerbang = assertUserManagement(req.user)

            if (gerbang) {
                return sendError(res, gerbang.status, gerbang.message)
            }

            const {

                code,

                name,

                email,

                password,

                role,

                area_id,

                area_ids,

                channel_id,

                supervisor_id,

                can_access_web

            } = req.body

            // Ditolak di sini supaya jadi 400 yang jelas, bukan 500 dari
            // MySQL saat nilainya tidak cocok dengan ENUM kolomnya.
            if (role !== undefined && !USER_ROLES.includes(role)) {
                return sendError(
                    res,
                    400,
                    'Role tidak dikenal.'
                )
            }

            // area_ids (multi) adalah sumber kebenaran kalau dikirim --
            // dipakai buat visibilitas customer & gerbang check-in
            // (lihat AssignedAreas di customer.controller.js dan
            // visit.controller.js). area_id tunggal cuma field lama buat
            // tampilan/filter ringkas (mis. Report di web); diturunkan
            // dari elemen pertama area_ids kalau area_ids dikirim, biar
            // dua-duanya tetap konsisten.
            const daftarAreaId =
                Array.isArray(area_ids)
                    ? area_ids
                        .map((id) => Number(id))
                        .filter((id) => Number.isInteger(id) && id > 0)
                    : []

            // HASH PASSWORD
            const hashedPassword =
                await bcrypt.hash(

                    password,

                    10

                )

            // CREATE USER
            const user =
                await User.create({

                    code,

                    name,

                    email,

                    password:
                        hashedPassword,

                    role,

                    area_id:
                        daftarAreaId.length > 0
                            ? daftarAreaId[0]
                            : (area_id || null),

                    channel_id:
                        channel_id || null,

                    supervisor_id:
                        supervisor_id || null,

                    // Tidak dikirim klien -> default berdasar role, MD
                    // tetap terkunci dari web kecuali admin membukanya
                    // eksplisit. Dikirim eksplisit (termasuk false) ->
                    // pilihan admin menang.
                    can_access_web:
                        can_access_web !== undefined
                            ? can_access_web
                            : !['MD', 'SPG', 'SALES'].includes(role)

                })

            if (daftarAreaId.length > 0) {

                await UserArea.bulkCreate(

                    daftarAreaId.map((areaId) => ({
                        user_id: user.id,
                        area_id: areaId,
                    }))

                )

            }

            // Password TIDAK BOLEH ikut terkirim: instance dari create()
            // memuat hash bcrypt-nya, dan toJSON() menyertakan seluruh
            // kolom.
            const {
                password: _password,
                ...userWithoutPassword
            } = user.toJSON()

            res.json({

                message:
                    'User berhasil dibuat',

                user:
                    userWithoutPassword

            })

        }

        catch (err) {

            console.log(err)

            res.status(500).json({

                error:
                    err.message,

                detail:
                    err.errors

            })

        }

    }

)


// ======================
// ACTIVE / INACTIVE USER
// ======================

router.put(

    '/:id/status',

    auth,

    async (req, res) => {

        try {

            const gerbang = assertUserManagement(req.user)

            if (gerbang) {
                return sendError(res, gerbang.status, gerbang.message)
            }

            // parseId, bukan Number(req.params.id): MySQL mengoersi
            // '2abc' menjadi 2 saat dibandingkan dengan kolom id, tapi
            // Number('2abc') adalah NaN sehingga tidak akan pernah sama
            // dengan req.user.id. Penjaga yang membandingkan nilai
            // mentah bisa dilewati hanya dengan menambahkan huruf ke
            // URL, sementara findByPk tetap menyasar baris yang sama.
            const id = parseId(req.params.id)

            if (id === null) {
                return sendError(res, 400, 'Id user tidak valid.')
            }

            // Larangan menonaktifkan diri sendiri. Ini MENGURANGI peluang
            // nol administrator, tapi tidak menutupnya: penjaga ini hanya
            // melihat pemanggil vs sasaran, sedangkan dua administrator
            // yang saling menonaktifkan pada milidetik yang sama
            // sama-sama lolos. Lantai administrator dijaga oleh transaksi
            // di bawah, bukan oleh baris ini.
            if (id === req.user.id) {
                return sendError(
                    res,
                    400,
                    'Anda tidak bisa mengubah status akun Anda sendiri.'
                )
            }

            // Baca-lalu-tulis harus berada dalam SATU transaksi dengan
            // locking read. Tanpa itu, admin 2 menonaktifkan admin 29 dan
            // admin 29 menonaktifkan admin 2 dalam beberapa milidetik
            // yang sama: keduanya lolos setiap pemeriksaan (sasaran
            // masing-masing bukan dirinya sendiri), kedua UPDATE commit,
            // dan tidak ada administrator aktif yang tersisa. Reset
            // password pun ADMINISTRATOR-saja, jadi tidak ada jalur
            // pemulihan selain akses langsung ke database.
            // withShortLockWait: batas tunggu lock dipendekkan di dalam
            // transaksi ini saja. Yang kalah balapan harus MELEPAS koneksi
            // pool-nya dengan cepat — menunggu 50 detik sambil memegang
            // koneksi adalah cara lima administrator menghabiskan pool
            // (max = 5) dan menjatuhkan traffic yang tidak berkaitan,
            // termasuk login mobile.
            const hasil = await db.transaction(withShortLockWait(async (t) => {

                // Locking read DULU, sebelum baris sasaran, dengan query
                // yang persis sama seperti di PUT /:id — urutan lock yang
                // berbeda antar handler berakhir sebagai deadlock, bukan
                // sebagai penolakan.
                const jumlahAdminAktif =
                    await hitungAdminAktifTerkunci(t)

                const user = await User.findByPk(id, {

                    transaction: t,

                    lock: t.LOCK.UPDATE,

                })

                if (!user) {

                    return {
                        status: 404,
                        message: 'User tidak ditemukan',
                    }

                }

                const statusBaru =

                    user.status === 'ACTIVE'

                        ?

                        'INACTIVE'

                        :

                        'ACTIVE'

                if (
                    wouldRemoveLastActiveAdministrator(
                        user,
                        { status: statusBaru },
                        jumlahAdminAktif
                    )
                ) {

                    return {
                        status: 409,
                        message:
                            'Ini administrator aktif terakhir. Angkat administrator lain lebih dulu sebelum menonaktifkannya.',
                    }

                }

                await user.update(
                    { status: statusBaru },
                    { transaction: t }
                )

                // Password TIDAK BOLEH ikut terkirim: toJSON() Sequelize
                // menyertakan seluruh kolom, termasuk hash bcrypt.
                const {
                    password: _password,
                    ...userWithoutPassword
                } = user.toJSON()

                return { data: userWithoutPassword }

            }))

            if (hasil.status) {
                return sendError(res, hasil.status, hasil.message)
            }

            res.json({

                message:
                    'Status user berhasil diupdate',

                data:
                    hasil.data

            })

        }

        catch (err) {

            // Diperiksa SEBELUM cabang 500. Kalah balapan lock bukan bug,
            // dan 500 tidak memberi tahu pemanggil bahwa mengulang akan
            // berhasil.
            if (isLockConflictError(err)) {
                return sendLockConflict(res)
            }

            console.log(err)

            res.status(500).json({

                error:
                    err.message

            })

        }

    }

)


// ======================
// DOWNLOAD TEMPLATE -- bulk create user lewat Excel
// ======================

/**
 * Header kolom sheet "Input User" HARUS cocok persis dengan yang
 * dibaca router.post('/upload') di bawah -- satu sumber kebenaran,
 * ditulis di sini, dibaca di sana (pola sama dengan
 * visitPlan.controller.js downloadTemplate/uploadExcel).
 *
 * Area TIDAK pakai dropdown kayak Channel/Role -- satu user bisa
 * punya lebih dari satu area (area_ids), dan Excel data validation
 * list cuma mendukung pilihan TUNGGAL per sel. Kolom "Nama Area" jadi
 * teks bebas dipisah koma, dicocokkan ke daftar nama di sheet
 * Referensi sebagai panduan copy-paste, bukan dropdown.
 *
 * Didaftarkan SEBELUM GET /:id di bawah -- Express mencocokkan rute
 * sesuai urutan daftar, dan /:id menerima string apa pun termasuk
 * "template". Didaftarkan sesudahnya, request ke /users/template akan
 * ketangkap /:id duluan (id="template") dan tidak pernah sampai ke
 * sini.
 */
router.get(

    '/template',

    auth,

    async (req, res) => {

        try {

            const gerbang = assertUserManagement(req.user)

            if (gerbang) {
                return sendError(res, gerbang.status, gerbang.message)
            }

            const channelList = await Channel.findAll({
                attributes: ['name'],
                order: [['name', 'ASC']],
            })

            const areaList = await Area.findAll({
                attributes: ['name'],
                order: [['name', 'ASC']],
            })

            const wb = new ExcelJS.Workbook()

            // ---- SHEET REFERENSI (sumber dropdown Channel + panduan nama Area) ----
            const ref = wb.addWorksheet('Referensi')

            ref.columns = [
                { header: 'Channel', key: 'channel', width: 20 },
                { header: '', key: 'gap', width: 3 },
                { header: 'Nama Area (panduan, bukan dropdown)', key: 'area', width: 32 },
            ]

            channelList.forEach((c, i) => {
                ref.getRow(i + 2).getCell('channel').value = c.name
            })

            areaList.forEach((a, i) => {
                ref.getRow(i + 2).getCell('area').value = a.name
            })

            ref.getRow(1).font = { bold: true }
            ref.state = 'hidden'

            const channelCount = channelList.length

            // ---- SHEET INPUT (yang diisi admin) ----
            const sheet = wb.addWorksheet('Input User')

            sheet.mergeCells('A1:I1')
            const instruksi = sheet.getCell('A1')
            instruksi.value =
                'Petunjuk: Code/Name/Email/Password/Role wajib diisi. Role & Channel pilih dari dropdown. ' +
                'Nama Area diisi manual, dipisah koma kalau lebih dari satu (lihat daftar nama yang valid di sheet Referensi/Area Management) -- boleh dikosongkan. ' +
                'Kode Atasan opsional, isi kode user yang sudah ada kalau mau langsung diatur. ' +
                'Web Access opsional -- dikosongkan berarti ikut default per Role (field = Tidak, lainnya = Ya).'
            instruksi.alignment = { wrapText: true, vertical: 'middle' }
            instruksi.font = { italic: true, color: { argb: 'FF555555' } }
            sheet.getRow(1).height = 70

            const headerRow = sheet.getRow(2)
            headerRow.values = [
                'Code', 'Name', 'Email', 'Password', 'Role',
                'Channel', 'Nama Area', 'Kode Atasan', 'Web Access',
            ]
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
            headerRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
                cell.alignment = { horizontal: 'center' }
            })

            sheet.columns = [
                { key: 'code', width: 14 },
                { key: 'name', width: 24 },
                { key: 'email', width: 26 },
                { key: 'password', width: 16 },
                { key: 'role', width: 18 },
                { key: 'channel', width: 16 },
                { key: 'area', width: 28 },
                { key: 'supervisorCode', width: 16 },
                { key: 'webAccess', width: 12 },
            ]

            const TOTAL_BARIS_DISIAPKAN = 200

            const ROLE_LIST = [
                'MD', 'SPG', 'SALES', 'SUPERVISOR', 'MANAGER',
                'REGIONAL MANAGER', 'GENERAL MANAGER', 'ADMINISTRATOR',
            ].join(',')

            for (let i = 0; i < TOTAL_BARIS_DISIAPKAN; i++) {

                const r = sheet.getRow(3 + i)

                r.getCell(5).dataValidation = {
                    type: 'list',
                    allowBlank: false,
                    formulae: [`"${ROLE_LIST}"`],
                    showErrorMessage: true,
                    errorTitle: 'Pilihan tidak valid',
                    error: 'Pilih Role dari daftar dropdown.',
                }

                if (channelCount > 0) {
                    r.getCell(6).dataValidation = {
                        type: 'list',
                        allowBlank: true,
                        formulae: [`Referensi!$A$2:$A$${1 + channelCount}`],
                        showErrorMessage: true,
                        errorTitle: 'Pilihan tidak valid',
                        error: 'Pilih Channel dari daftar dropdown, jangan ketik manual.',
                    }
                }

                r.getCell(9).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: ['"Ya,Tidak"'],
                    showErrorMessage: true,
                    errorTitle: 'Pilihan tidak valid',
                    error: 'Pilih Ya atau Tidak dari dropdown.',
                }

            }

            sheet.views = [{ state: 'frozen', ySplit: 2 }]

            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            res.setHeader(
                'Content-Disposition',
                'attachment; filename="user-template.xlsx"'
            )

            await wb.xlsx.write(res)
            res.end()

        } catch (err) {
            return sendServerError(res, err, 'DOWNLOAD USER TEMPLATE')
        }

    }

)


// ======================
// GET USER BY ID
// ======================

router.get(

    '/:id',

    auth,

    async (req, res) => {

        try {

            // parseId juga di route yang belum punya penjaga apa pun.
            // Invariannya dijaga secara struktural, bukan per-route:
            // selama SEMUA route :id menormalkan idnya, penjaga yang
            // ditambahkan siapa pun besok tidak bisa lagi salah
            // membandingkan nilai yang berbeda dari yang dieksekusi
            // `where`. GET /api/users/2abc sebelumnya mengembalikan baris
            // id 2 karena MySQL mengoersi stringnya.
            const id = parseId(req.params.id)

            if (id === null) {
                return sendError(res, 400, 'Id user tidak valid.')
            }

            const bolehDilihat =
                await resolveSubordinateUserIds(req.user)

            const gerbang = assertWithinSubtree(bolehDilihat, id)

            if (gerbang) {
                return sendError(res, gerbang.status, gerbang.message)
            }

            const data =
                await User.findByPk(

                    id,

                    {

                        attributes: {

                            exclude: [
                                'password'
                            ]

                        },

                        // Layar Edit User (web) butuh ini buat
                        // pre-select checkbox Area multi-nya -- tanpa
                        // include ini area_ids selalu mulai kosong,
                        // seolah-olah user tidak punya area sama sekali.
                        include: [
                            {
                                model: Area,
                                as: 'AssignedAreas',
                                attributes: ['id', 'code', 'name'],
                                through: { attributes: [] },
                            },
                        ],

                    }

                )

            if (!data) {

                return res.status(404).json({

                    message:
                        'User tidak ditemukan'

                })

            }

            res.json(data)




        }

        catch (err) {

            console.log(err)

            res.status(500).json({

                error:
                    err.message

            })

        }

    }

)


// ======================
// UPDATE USER
// ======================

router.put(

    '/:id',

    auth,

    async (req, res) => {

        try {

            const gerbang = assertUserManagement(req.user)

            if (gerbang) {
                return sendError(res, gerbang.status, gerbang.message)
            }

            // MySQL mengoersi string ke angka saat dibandingkan dengan
            // kolom numerik: WHERE id = '2abc' tetap cocok dengan baris
            // id 2. Kalau penjaga di bawah membandingkan req.params.id
            // mentah-mentah, '2abc' akan lolos dari penjaga (NaN tidak
            // pernah sama dengan apa pun) padahal where-nya tetap
            // menyasar baris yang sama. Menormalkan sekali di sini dan
            // memakai hasilnya di keduanya menutup celah itu.
            const targetId = parseId(req.params.id)

            if (targetId === null) {
                return sendError(res, 400, 'Id user tidak valid.')
            }

            const {

                code,

                name,

                email,

                role,

                area_id,

                area_ids,

                channel_id,

                supervisor_id,

                can_access_web

            } = req.body

            if (role !== undefined && !USER_ROLES.includes(role)) {
                return sendError(
                    res,
                    400,
                    'Role tidak dikenal.'
                )
            }

            // area_ids TIDAK melalui nullableUpdate/perubahan seperti
            // field lain -- ini bukan kolom users, tapi tabel terpisah
            // (user_areas) yang disinkron penuh (hapus semua baris lama,
            // tulis ulang yang baru) di dalam transaksi yang sama di
            // bawah. undefined berarti "field ini tidak dikirim, jangan
            // sentuh area sama sekali" -- form lain yang PUT tanpa
            // area_ids (kalau ada) tidak boleh diam-diam mengosongkan
            // area user.
            const daftarAreaIdBaru =
                Array.isArray(area_ids)
                    ? area_ids
                        .map((areaId) => Number(areaId))
                        .filter((areaId) => Number.isInteger(areaId) && areaId > 0)
                    : null

            // Membandingkan NILAI, bukan keberadaan field: form user di
            // web mengirim kembali seluruh objeknya, sehingga admin yang
            // sekadar mengubah namanya sendiri tetap ikut mengirim role,
            // email, dan code yang sama. Menolak berdasarkan keberadaan
            // field akan menguncinya dari mengedit namanya sendiri.
            //
            // Ini penjaga per-request dan hanya melihat pemanggil vs
            // sasaran; lantai administrator aktif dijaga oleh transaksi di
            // bawah, bukan oleh blok ini.
            if (targetId === req.user.id) {

                if (
                    role !== undefined &&
                    role !== req.user.role
                ) {
                    return sendError(
                        res,
                        400,
                        'Anda tidak bisa mengubah role akun Anda sendiri.'
                    )
                }

                // email adalah identitas login, jadi mengubahnya sendiri
                // adalah cara mengunci diri sendiri keluar yang tidak
                // ketahuan sampai tokennya kedaluwarsa — dan token
                // berlaku 1 hari. Barisnya tetap ADMINISTRATOR dan ACTIVE
                // sehingga lantai administrator di bawah tidak melihat
                // apa pun yang salah, padahal tidak ada lagi
                // administrator yang bisa login untuk mereset password
                // siapa pun. Sunting profil sendiri memang di luar
                // lingkup endpoint ini.
                if (
                    email !== undefined &&
                    email !== req.user.email
                ) {
                    return sendError(
                        res,
                        400,
                        'Anda tidak bisa mengubah email akun Anda sendiri.'
                    )
                }

                // Dinormalkan lewat nullableUpdate, PERSIS fungsi yang
                // sama dipakai saat ditulis di bawah -- bukan cuma pola
                // yang mirip. Yang dijamin: penjaga ini dan baris tulis
                // di bawah SELALU sepakat tentang apakah suatu nilai
                // sama dengan "tidak berubah", karena keduanya memanggil
                // fungsi normalisasi yang sama persis.
                //
                // `|| null` yang lama TIDAK menjamin itu. Kedua
                // administrator sungguhan (id 2 dan 29) punya code NULL.
                // Admin yang mengirim { code: 0 } ke akunnya sendiri:
                // penjaga lama menghitung `0 || null` -> null, sama
                // dengan code-nya sekarang (null), jadi PENJAGA MELIHAT
                // "tidak ada perubahan" dan meloloskannya -- padahal
                // baris tulis di bawah memakai nullableUpdate(0), yang
                // mengembalikan 0 apa adanya (bukan string kosong, bukan
                // null), lalu MySQL menyimpannya sebagai string '0'.
                // `false` bernasib sama: `false || null` juga jatuh ke
                // null di sisi penjaga sementara nullableUpdate(false)
                // tetap false. Guard yang lama meloloskan perubahan
                // sungguhan sebagai "tidak ada perubahan" justru karena
                // ia TIDAK memakai fungsi yang sama dengan baris tulis.
                if (
                    code !== undefined &&
                    nullableUpdate(code) !== nullableUpdate(req.user.code)
                ) {
                    return sendError(
                        res,
                        400,
                        'Anda tidak bisa mengubah code akun Anda sendiri.'
                    )
                }

                // Sama alasannya dengan email di atas: mematikan akses
                // web akun sendiri mengunci diri sendiri keluar dari
                // sfa-web pada login berikutnya, tanpa jalan buka
                // sendiri lagi lewat UI.
                if (can_access_web === false) {
                    return sendError(
                        res,
                        400,
                        'Anda tidak bisa mematikan akses web akun Anda sendiri.'
                    )
                }

            }

            // Baca-lalu-tulis harus berada dalam SATU transaksi dengan
            // locking read. Tanpa itu, admin 2 mengirim
            // PUT /api/users/29 {role:'SPG'} dan admin 29 mengirim
            // PUT /api/users/2 {role:'SPG'} dalam beberapa milidetik yang
            // sama: keduanya lolos setiap pemeriksaan di atas (sasaran
            // masing-masing bukan dirinya sendiri), kedua UPDATE commit,
            // dan nol administrator tersisa. Reset password pun
            // ADMINISTRATOR-saja, jadi tidak ada jalur pemulihan selain
            // akses langsung ke database.
            // withShortLockWait: alasannya sama seperti di PUT /:id/status
            // — yang kalah balapan lock harus melepas koneksi pool-nya
            // dalam hitungan detik, bukan menahannya sampai 50 detik dan
            // mengeringkan pool untuk request yang tidak berkaitan.
            const hasil = await db.transaction(withShortLockWait(async (t) => {

                // Locking read DULU, sebelum baris sasaran, dengan query
                // yang persis sama seperti di PUT /:id/status — urutan
                // lock yang berbeda antar handler berakhir sebagai
                // deadlock, bukan sebagai penolakan.
                const jumlahAdminAktif =
                    await hitungAdminAktifTerkunci(t)

                const target = await User.findByPk(targetId, {

                    transaction: t,

                    lock: t.LOCK.UPDATE,

                })

                if (
                    wouldRemoveLastActiveAdministrator(
                        target,
                        { role },
                        jumlahAdminAktif
                    )
                ) {

                    return {
                        status: 409,
                        message:
                            'Ini administrator aktif terakhir. Angkat administrator lain lebih dulu sebelum menurunkan rolenya.',
                    }

                }

                const perubahan = { name, email, role }

                // Field yang TIDAK dikirim klien tidak boleh ditulis NULL.
                // Sequelize membuang key bernilai undefined, tapi pola lama
                // `field || null` mengubah undefined menjadi null — dan
                // null tidak dibuang. Form edit di web tidak mengirim code
                // maupun area_id, sehingga setiap penyuntingan nama
                // mengosongkan keduanya.
                for (const field of [
                    'code',
                    'area_id',
                    'channel_id',
                    'supervisor_id',
                    'can_access_web',
                ]) {
                    if (req.body[field] !== undefined) {
                        perubahan[field] = nullableUpdate(req.body[field])
                    }
                }

                // area_ids (multi) menang atas area_id tunggal kalau
                // dua-duanya dikirim -- konsisten dengan POST /
                // (create), area_id legacy diturunkan dari elemen
                // pertama supaya filter Area yang sudah ada (Report)
                // tetap benar.
                if (daftarAreaIdBaru !== null) {
                    perubahan.area_id =
                        daftarAreaIdBaru.length > 0
                            ? daftarAreaIdBaru[0]
                            : null
                }

                await User.update(

                    perubahan,

                    {

                        where: {

                            id:
                                targetId

                        },

                        transaction: t

                    }

                )

                // Sinkron penuh -- hapus assignment lama, tulis ulang
                // yang baru. Hanya kalau area_ids benar-benar dikirim;
                // request tanpa field ini (mis. sekadar ganti nama)
                // tidak boleh diam-diam mengosongkan area user.
                if (daftarAreaIdBaru !== null) {

                    await UserArea.destroy({
                        where: { user_id: targetId },
                        transaction: t,
                    })

                    if (daftarAreaIdBaru.length > 0) {
                        await UserArea.bulkCreate(
                            daftarAreaIdBaru.map((areaId) => ({
                                user_id: targetId,
                                area_id: areaId,
                            })),
                            { transaction: t }
                        )
                    }

                }

                return null

            }))

            if (hasil) {
                return sendError(res, hasil.status, hasil.message)
            }

            res.json({

                message:
                    'User updated'

            })

        }

        catch (err) {

            // Diperiksa SEBELUM cabang 500. Kalah balapan lock bukan bug,
            // dan 500 tidak memberi tahu pemanggil bahwa mengulang akan
            // berhasil.
            if (isLockConflictError(err)) {
                return sendLockConflict(res)
            }

            console.log(err)

            res.status(500).json({

                error:
                    err.message

            })

        }

    }

)


// ======================
// RESET PASSWORD
// ======================

router.put(

    '/:id/reset-password',

    auth,

    async (req, res) => {

        try {

            // Gerbang yang SAMA dengan route penulisan user lainnya.
            // Sebelumnya route ini mengulang aturannya sendiri: memuat
            // ulang pemanggil dari database (padahal middleware auth
            // sudah memasok baris segar), memeriksa rolenya inline, dan
            // menjawab dengan pesan yang berbeda. Dua tempat yang
            // menghitung wewenang yang sama akan berbeda pada perubahan
            // berikutnya — dan reset password adalah pengambilalihan akun
            // yang sah, jadi cabang yang tertinggal di sini paling mahal.
            //
            // Cabang 404 "akun Anda tidak ditemukan" ikut hilang: ia
            // sudah tidak bisa dicapai sejak middleware menolak 401 untuk
            // user yang tidak ada.
            const gerbang = assertUserManagement(req.user)

            if (gerbang) {
                return sendError(res, gerbang.status, gerbang.message)
            }

            // parseId juga di sini: tanpa penormalan, `2abc` mereset
            // password baris id 2 karena MySQL mengoersi stringnya.
            const id = parseId(req.params.id)

            if (id === null) {
                return sendError(res, 400, 'Id user tidak valid.')
            }

            // Diperiksa SETELAH otorisasi: pemanggil yang tidak berhak
            // tidak perlu diberi tahu apakah id targetnya ada.
            const user =
                await User.findByPk(id)

            if (!user) {

                return sendError(
                    res,
                    404,
                    'User tidak ditemukan.'
                )

            }

            // Admin yang menentukan password barunya sendiri -- tidak
            // di-generate otomatis, supaya admin bisa kasih password
            // yang dia mau, bukan string acak yang harus disampaikan
            // ulang ke sales.
            const password =
                typeof req.body.password === 'string'
                    ? req.body.password.trim()
                    : ''

            if (!password) {

                return sendError(
                    res,
                    400,
                    'Password baru wajib diisi.'
                )

            }

            user.password =
                await bcrypt.hash(password, 10)

            await user.save()

            res.json({

                message:
                    'Password berhasil direset',

            })

        }

        catch (err) {

            return sendServerError(
                res,
                err,
                'RESET PASSWORD'
            )

        }

    }

)


// ======================
// UPLOAD EXCEL -- bulk create user
// ======================
router.post(

    '/upload',

    auth,

    upload.single('file'),

    async (req, res) => {

        try {

            // Gerbang role dulu, sebelum file apa pun dibaca -- sama pola
            // dengan visitPlan.controller.js uploadExcel. Multer sudah
            // menulis berkasnya ke disk sebelum handler ini sempat
            // memeriksa apa pun; berkas yang tidak dihapus di sini jadi
            // bisa dibaca siapa pun tanpa token lewat /uploads.
            const gerbang = assertUserManagement(req.user)

            if (gerbang) {
                if (req.file) fs.unlinkSync(req.file.path)
                return sendError(res, gerbang.status, gerbang.message)
            }

            if (!req.file) {
                return sendError(res, 400, 'File wajib diunggah.')
            }

            const workbook =
                XLSX.readFile(req.file.path)

            const sheet =
                workbook.Sheets['Input User'] ||
                workbook.Sheets[workbook.SheetNames[0]]

            // range: 1 -- baris pertama sheet ini berisi teks petunjuk
            // (satu sel digabung), bukan header kolom. Header sebenarnya
            // di baris kedua.
            const rows =
                XLSX.utils.sheet_to_json(sheet, { range: 1 })

            let inserted = 0

            const errors = []

            // Code/email yang baru dibuat DALAM request ini -- dicek di
            // samping query DB, karena dua baris dalam FILE YANG SAMA
            // bisa saja memakai code/email yang sama persis (DB belum
            // tahu soal baris pertama saat baris kedua diperiksa).
            const codeTerpakai = new Set()
            const emailTerpakai = new Set()

            for (const row of rows) {

                // Baris kosong (dari Excel yang nge-save seluruh 200
                // baris yang disiapkan walau tidak semua diisi) --
                // dilewati diam-diam, bukan dihitung gagal.
                const kosong =
                    !row['Code'] && !row['Name'] &&
                    !row['Email'] && !row['Password']

                if (kosong) continue

                const code = String(row['Code'] ?? '').trim()
                const name = String(row['Name'] ?? '').trim()
                const email = String(row['Email'] ?? '').trim()
                const password = String(row['Password'] ?? '')
                const role = String(row['Role'] ?? '').trim()
                const channelName = String(row['Channel'] ?? '').trim()
                const areaNamesRaw = String(row['Nama Area'] ?? '').trim()
                const supervisorCode = String(row['Kode Atasan'] ?? '').trim()
                const webAccessRaw = String(row['Web Access'] ?? '').trim().toLowerCase()

                if (!code || !name || !email || !password || !role) {
                    errors.push({ row, reason: 'Code/Name/Email/Password/Role ada yang kosong' })
                    continue
                }

                if (!USER_ROLES.includes(role)) {
                    errors.push({ row, reason: 'Role tidak dikenal' })
                    continue
                }

                if (codeTerpakai.has(code) || await User.findOne({ where: { code } })) {
                    errors.push({ row, reason: 'Code sudah dipakai' })
                    continue
                }

                if (emailTerpakai.has(email) || await User.findOne({ where: { email } })) {
                    errors.push({ row, reason: 'Email sudah dipakai' })
                    continue
                }

                let channelId = null

                if (channelName) {

                    const channel = await Channel.findOne({ where: { name: channelName } })

                    if (!channel) {
                        errors.push({ row, reason: `Channel "${channelName}" tidak ditemukan` })
                        continue
                    }

                    channelId = channel.id

                }

                let areaIds = []

                if (areaNamesRaw) {

                    const namaList = areaNamesRaw.split(',').map((s) => s.trim()).filter(Boolean)

                    let semuaKetemu = true

                    for (const nama of namaList) {

                        const area = await Area.findOne({ where: { name: nama } })

                        if (!area) {
                            errors.push({ row, reason: `Area "${nama}" tidak ditemukan` })
                            semuaKetemu = false
                            break
                        }

                        areaIds.push(area.id)

                    }

                    if (!semuaKetemu) continue

                }

                let supervisorId = null

                if (supervisorCode) {

                    const supervisor = await User.findOne({ where: { code: supervisorCode } })

                    if (!supervisor) {
                        errors.push({ row, reason: `Kode Atasan "${supervisorCode}" tidak ditemukan` })
                        continue
                    }

                    supervisorId = supervisor.id

                }

                const canAccessWeb =
                    webAccessRaw === 'ya'
                        ? true
                        : webAccessRaw === 'tidak'
                            ? false
                            : !['MD', 'SPG', 'SALES'].includes(role)

                try {

                    const hashedPassword = await bcrypt.hash(password, 10)

                    const user = await User.create({
                        code,
                        name,
                        email,
                        password: hashedPassword,
                        role,
                        area_id: areaIds.length > 0 ? areaIds[0] : null,
                        channel_id: channelId,
                        supervisor_id: supervisorId,
                        can_access_web: canAccessWeb,
                    })

                    if (areaIds.length > 0) {
                        await UserArea.bulkCreate(
                            areaIds.map((areaId) => ({
                                user_id: user.id,
                                area_id: areaId,
                            }))
                        )
                    }

                    codeTerpakai.add(code)
                    emailTerpakai.add(email)
                    inserted++

                } catch (errBaris) {

                    errors.push({ row, reason: 'Gagal menyimpan baris ini: ' + errBaris.message })

                }

            }

            fs.unlinkSync(req.file.path)

            res.json({
                success: true,
                total: rows.length,
                inserted,
                failed: errors.length,
                errors,
            })

        } catch (err) {

            if (req.file?.path) {
                fs.unlinkSync(req.file.path)
            }

            return sendServerError(res, err, 'UPLOAD USER EXCEL')

        }

    }

)


module.exports =
    router