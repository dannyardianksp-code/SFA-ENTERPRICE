const { Op } = require('sequelize')

const UserLocation = require('../models/userLocation.model')
const User = require('../models/user.model')
const Area = require('../models/area.model')

// Lewat batas ini dianggap bukan "near-live" lagi -- user yang gak
// pernah buka app lagi (ping cuma sekali lalu berhenti) sebelumnya
// nyangkut permanen di list/map selamanya, gak pernah hilang walau
// datanya berbulan-bulan basi. 24 jam: kalau sales gak pernah buka
// app sepanjang hari kerja, wajar dianggap "gak lagi di-track", bukan
// sekadar "belum update sebentar".
const BATAS_BASI_MS = 24 * 60 * 60 * 1000

const { sendError, sendServerError } = require('../utils/response.util')
const {
    parseCoordinate,
    isValidLatitude,
    isValidLongitude,
} = require('../utils/geo.util')
const {
    resolveSubordinateUserIds,
    ownerWhere,
} = require('../utils/access.util')

// PING -- mobile kirim posisinya sendiri selama app kebuka. Upsert,
// bukan history: 1 baris per user, ditimpa tiap kali. Dipanggil semua
// role (tidak ada gerbang khusus di sini -- siapa pun yang login boleh
// kirim posisinya sendiri).
exports.ping = async (req, res) => {

    try {

        const { latitude, longitude, accuracy } = req.body

        const lat = parseCoordinate(latitude)
        const lng = parseCoordinate(longitude)

        if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
            return sendError(res, 400, 'Koordinat tidak valid.')
        }

        const accuracyNum = parseCoordinate(accuracy)

        await UserLocation.upsert({
            user_id: req.user.id,
            latitude: lat,
            longitude: lng,
            accuracy: accuracyNum,
            updated_at: new Date(),
        })

        res.json({ message: 'ok' })

    } catch (err) {

        return sendServerError(res, err, 'USER LOCATION PING')

    }

}

// GET -- web baca posisi terakhir tim, subtree-wide sama pola dengan
// dashboard/report lain (resolveSubordinateUserIds). Tidak ada
// gerbang "hanya admin" -- siapa pun boleh lihat bawahannya sendiri.
exports.getAll = async (req, res) => {

    try {

        const bolehDilihat = await resolveSubordinateUserIds(req.user)

        const data = await UserLocation.findAll({
            where: {
                ...ownerWhere(bolehDilihat),
                updated_at: { [Op.gte]: new Date(Date.now() - BATAS_BASI_MS) },
            },
            include: [
                {
                    model: User,
                    attributes: ['id', 'name', 'role'],
                    include: [
                        {
                            model: Area,
                            as: 'AssignedAreas',
                            attributes: ['id', 'code', 'name'],
                            through: { attributes: [] },
                        },
                    ],
                },
            ],
            order: [['updated_at', 'DESC']],
        })

        res.json(data)

    } catch (err) {

        return sendServerError(res, err, 'GET ALL USER LOCATION')

    }

}
