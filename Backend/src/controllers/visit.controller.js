const Visit = require('../models/visit.model')
const Customer = require('../models/customer.model')
const User = require('../models/user.model')
const Area = require('../models/area.model')
const CustomerGroup = require('../models/customerGroup.model')
const Product = require('../models/product.model')
const { getDistance } = require('geolib')
const VisitPlan = require('../models/visitPlan.model')
const VisitActivity = require('../models/visitActivity.model')
const { Op } = require('sequelize')
const { localDateString } = require('../utils/date.util')

const {
    parseCoordinate,
    isValidLatitude,
    isValidLongitude,
} = require('../utils/geo.util')

const {
    sendError,
    sendServerError,
} = require('../utils/response.util')

const {
    resolveSubordinateUserIds,
    ownerWhere,
    assertWithinSubtree,
    assertAreaChannelAccess,
} = require('../utils/access.util')

const { parseId } = require('../utils/id.util')

/**
 * Mengambil user beserta area yang di-assign, bentuk yang dibutuhkan
 * assertAreaChannelAccess. req.user dari auth.middleware TIDAK
 * memuat AssignedAreas (tidak ada include di sana), jadi dipanggil
 * ulang di sini -- sama seperti findUserWithAreas di
 * customer.controller.js.
 */
const findUserWithAreas = (id) =>
    User.findByPk(id, {
        include: [
            {
                model: Area,
                as: 'AssignedAreas',
                attributes: ['id'],
                through: { attributes: [] },
            },
        ],
    })



// CHECK-IN

exports.checkIn = async (req, res) => {

    try {

        const {
            visit_plan_id,
            latitude,
            longitude,
            accuracy,
        } = req.body

        const plan = await VisitPlan.findByPk(visit_plan_id)

        if (!plan) {
            return sendError(res, 404, 'Visit plan tidak ditemukan.')
        }

        // Check-in adalah tindakan personal -- SPG berdiri di toko,
        // memakai perangkatnya sendiri. Beda dengan checkOut dan
        // endpoint bacaan lain yang memakai assertWithinSubtree:
        // supervisor tidak check-in atas nama bawahannya.
        if (plan.user_id !== req.user.id) {
            return sendError(
                res,
                403,
                'Visit plan ini bukan milik Anda.'
            )
        }

        if (plan.status !== 'PENDING') {
            return sendError(res, 400, 'Visit already started')
        }

        // visit_date bertipe DATEONLY -- Sequelize mengembalikannya
        // sebagai string 'YYYY-MM-DD', jadi aman dibandingkan langsung
        // secara leksikografis dengan tanggal lokal WIB. SPG boleh
        // susulan check-in untuk tanggal lampau (hari ini atau
        // sebelumnya), tapi belum boleh mendahului jadwal masa depan --
        // rencana kunjungan besok cuma tampil sebagai lihat-lihat.
        if (plan.visit_date > localDateString()) {
            return sendError(
                res,
                400,
                'Kunjungan ini terjadwal nanti, belum bisa check-in.'
            )
        }

        // customer_id DIKUNCI dari plan, bukan dari body. Body yang
        // mengirim customer_id berbeda tidak boleh membuat kunjungan
        // tercatat di lokasi yang salah.
        const customer = await Customer.findByPk(plan.customer_id)

        if (!customer) {
            return sendError(res, 404, 'Customer tidak ditemukan')
        }

        // Akurasi diperiksa SEBELUM jarak. Bacaan GPS yang buruk bisa
        // kebetulan menghasilkan jarak terhitung yang tampak dekat,
        // padahal posisi sebenarnya jauh.
        //
        // typeof dipakai, bukan Number(accuracy) -- Number(null) adalah
        // 0, dan 0 <= 50 lolos sebagai bacaan GPS SEMPURNA. accuracy
        // null/""/array hanya bisa ditolak dengan memeriksa tipenya
        // dulu, bukan cuma hasil koersinya.
        if (
            typeof accuracy !== 'number' ||
            !Number.isFinite(accuracy) ||
            accuracy <= 0 ||
            accuracy > 50
        ) {
            return sendError(
                res,
                400,
                `Akurasi lokasi tidak valid atau terlalu rendah (±${accuracy} meter).`
            )
        }

        // latitude/longitude divalidasi secara eksplisit sebelum dipakai
        // menghitung jarak. parseFloat(undefined)/parseFloat("abc")
        // menghasilkan NaN, dan NaN > 50 adalah false di JavaScript --
        // tanpa penjaga ini, koordinat yang hilang atau rusak lolos
        // begitu saja melewati pemeriksaan jarak di bawah.
        const lat = parseCoordinate(latitude)
        const lng = parseCoordinate(longitude)

        if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
            return sendError(res, 400, 'Koordinat tidak valid.')
        }

        // Koordinat customer juga divalidasi -- baris customer dengan
        // latitude/longitude NULL atau kosong menghasilkan NaN yang
        // persis sama, walau bukan berasal dari klien yang jahat.
        const customerLat = parseCoordinate(customer.latitude)
        const customerLng = parseCoordinate(customer.longitude)

        if (!isValidLatitude(customerLat) || !isValidLongitude(customerLng)) {
            return sendError(res, 400, 'Lokasi customer belum tercatat.')
        }

        const distance = getDistance(
            {
                latitude: lat,
                longitude: lng,
            },
            {
                latitude: customerLat,
                longitude: customerLng,
            }
        )

        if (distance > 50) {
            return res.status(400).json({
                message: `Terlalu jauh dari toko (${distance} meter)`,
                distance,
            })
        }

        // Satu aturan, sama dengan endpoint lain: multi-area lewat
        // user_areas, bukan perbandingan area_id tunggal. req.user
        // dari auth.middleware tidak memuat AssignedAreas, jadi user
        // dimuat ulang di sini -- tanpa ini assertAreaChannelAccess
        // diam-diam jatuh ke fallback area_id tunggal untuk SETIAP
        // request, tidak pernah benar-benar memeriksa user_areas.
        //
        // Gerbang area diperiksa SEBELUM cek kunjungan terbuka di
        // bawah, mengikuti urutan spec -- bukan sebaliknya seperti
        // sebelumnya.
        const userDenganArea = await findUserWithAreas(req.user.id)

        const gerbangArea = assertAreaChannelAccess(
            userDenganArea,
            customer.area_id,
            customer.channel_id
        )

        if (gerbangArea) {
            return sendError(res, gerbangArea.status, gerbangArea.message)
        }

        // Dikunci ke visit_plan_id, bukan ke pasangan user_id+customer_id
        // -- kunci lama mengembalikan visit MANAPUN yang masih terbuka
        // untuk user+customer ini, termasuk yang berasal dari plan LAIN,
        // sehingga check-in pada plan kedua secara diam-diam ditumpangi
        // data plan pertama tanpa pernah menyentuh plan kedua sama
        // sekali.
        const existingVisit = await Visit.findOne({
            where: {
                visit_plan_id,
                checkout_time: null,
            },
        })

        if (existingVisit) {
            return res.json({
                message: 'Visit masih berjalan',
                data: existingVisit,
            })
        }

        const visit = await Visit.create({
            user_id: req.user.id,
            customer_id: plan.customer_id,
            visit_plan_id,
            latitude,
            longitude,
            location_accuracy: accuracy,
            checkin_time: new Date(),
        })

        await VisitPlan.update(
            { status: 'ON VISIT' },
            { where: { id: visit_plan_id } }
        )

        res.json({
            message: 'Check-in berhasil',
            distance,
            data: visit,
        })

    } catch (err) {
        return sendServerError(res, err, 'VISIT CHECK-IN')
    }

}

// GET VISIT HISTORY
exports.getAll = async (req, res) => {

    try {

        // User dimuat dari database, bukan dipercaya dari token: token
        // yang rolenya sudah berubah di database tidak boleh menentukan
        // apa yang terlihat.
        const loginUser = await User.findByPk(req.user.id)

        if (!loginUser) {
            return sendError(res, 404, 'User tidak ditemukan.')
        }

        const bolehDilihat =
            await resolveSubordinateUserIds(loginUser)

        const where = ownerWhere(bolehDilihat)

        const data = await Visit.findAll({

            where,

            include: [

                { model: User, attributes: ['name'] },

                { model: Customer, attributes: ['name'] }

            ],

            order: [['checkin_time', 'DESC']]

        })

        res.json(data)

    } catch (err) {

        return sendServerError(res, err, 'GET VISIT')

    }

}

// GET PRODUCTS BY VISIT ID
exports.getProducts = async (req, res) => {

    try {

        const id = parseId(req.params.id)

        if (id === null) {
            return sendError(res, 400, 'Id kunjungan tidak valid.')
        }

        const visit = await Visit.findByPk(id, {

            include: [
                {
                    model: Customer,
                    include: [
                        {
                            model: CustomerGroup,
                            include: [Product]
                        }
                    ]
                }
            ]

        })

        if (!visit) {
            return sendError(res, 404, 'Kunjungan tidak ditemukan.')
        }

        const bolehDilihat =
            await resolveSubordinateUserIds(req.user)

        const gerbang =
            assertWithinSubtree(bolehDilihat, visit.user_id)

        if (gerbang) {
            return sendError(res, gerbang.status, gerbang.message)
        }

        // Relasi mana pun di rantai ini bisa kosong kalau datanya belum
        // lengkap. Tanpa penjaga ini, customer tanpa group menjadi 500
        // alih-alih daftar kosong.
        const products =
            visit.Customer?.CustomerGroup?.Products ?? []

        res.json(products)

    } catch (err) {

        return sendServerError(res, err, 'GET VISIT PRODUCTS')

    }

}

exports.getById = async (
    req,
    res
) => {

    try {

        const data =
            await Visit.findByPk(
                req.params.id,
                {
                    include: [
                        Customer,
                        { model: User, attributes: ['id', 'name'] }
                    ]
                }
            )

        if (!data) {
            return sendError(res, 404, 'Kunjungan tidak ditemukan.')
        }

        const loginUser = await User.findByPk(req.user.id)

        if (!loginUser) {
            return sendError(res, 404, 'User tidak ditemukan.')
        }

        // null berarti tidak dibatasi. Untuk yang lain: pemilik atau
        // siapa pun di dalam subtree-nya.
        const bolehDilihat =
            await resolveSubordinateUserIds(loginUser)

        const gerbang =
            assertWithinSubtree(bolehDilihat, data.user_id)

        if (gerbang) {
            return sendError(res, gerbang.status, gerbang.message)
        }

        res.json(data)

    } catch (err) {

        return sendServerError(res, err, 'VISIT')

    }

}

exports.checkOut = async (req, res) => {

    try {

        const id = parseId(req.params.id)

        if (id === null) {
            return sendError(res, 400, 'Id kunjungan tidak valid.')
        }

        const visit = await Visit.findByPk(id)

        if (!visit) {
            return sendError(res, 404, 'Kunjungan tidak ditemukan.')
        }

        // visit.user_id -- pemilik kunjungan, bukan pemanggil. Untuk
        // SPG yang checkout kunjungannya sendiri, visit.user_id ===
        // req.user.id selalu ada di subtree-nya sendiri. Supervisor
        // yang membantu menutup kunjungan bawahannya juga tercakup.
        const bolehDilihat = await resolveSubordinateUserIds(req.user)

        const gerbang = assertWithinSubtree(bolehDilihat, visit.user_id)

        if (gerbang) {
            return sendError(res, gerbang.status, gerbang.message)
        }

        // Tanpa penjaga ini, checkout kedua pada visit yang sama diam-
        // diam menimpa checkout_time yang sudah tercatat -- baik dari
        // tap ganda di mobile maupun panggilan ulang dari sfa-web.
        if (visit.checkout_time) {
            return sendError(res, 400, 'Kunjungan ini sudah di-checkout sebelumnya.')
        }

        // Tujuan utama kunjungan adalah mencatat aktivitas di lapangan --
        // tanpa gerbang ini, fitur activity bisa jadi rutin dilewati
        // begitu saja dan checkout tetap lolos tanpa data apa pun.
        const jumlahActivity = await VisitActivity.count({
            where: { visit_id: visit.id },
        })

        if (jumlahActivity === 0) {
            return sendError(
                res,
                400,
                'Minimal satu activity harus dicatat sebelum check-out.'
            )
        }

        visit.checkout_time = new Date()
        await visit.save()

        // Ditulis SEBELUM respons dikirim -- sebelumnya res.json
        // dikirim lebih dulu, sehingga kalau update ini gagal, klien
        // sudah terlanjur menerima jawaban sukses.
        await VisitPlan.update(
            { status: 'COMPLETED' },
            { where: { id: visit.visit_plan_id } }
        )

        res.json({
            message: 'Check-out berhasil',
            data: visit,
        })

    } catch (err) {
        return sendServerError(res, err, 'VISIT CHECK-OUT')
    }

}