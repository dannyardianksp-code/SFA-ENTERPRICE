const fs = require('fs')
const Attendance = require('../models/attendance.model')
const { localDateString } = require('../utils/date.util')
const {
    parseCoordinate,
    isValidLatitude,
    isValidLongitude,
} = require('../utils/geo.util')
const { sendError, sendServerError } = require('../utils/response.util')

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

        // Dua request checkin nyaris bersamaan bisa lolos dari cek
        // findOne di atas (race condition) SEBELUM unique constraint
        // (user_id, tanggal) di database mencegah baris kedua tercipta.
        if (err.name === 'SequelizeUniqueConstraintError') {
            if (req.file) fs.unlinkSync(req.file.path)
            return sendError(res, 400, 'Anda sudah absen masuk hari ini.')
        }

        return sendServerError(res, err, 'ATTENDANCE CHECKIN')
    }

}

exports.checkOut = async (req, res) => {

    try {

        const { latitude, longitude, accuracy } = req.body

        const tanggal = localDateString()

        const attendance = await Attendance.findOne({
            where: { user_id: req.user.id, tanggal }
        })

        if (!attendance) {
            if (req.file) fs.unlinkSync(req.file.path)
            return sendError(res, 400, 'Anda belum absen masuk hari ini.')
        }

        if (attendance.clock_out_time) {
            if (req.file) fs.unlinkSync(req.file.path)
            return sendError(res, 400, 'Anda sudah absen pulang hari ini.')
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

        attendance.clock_out_time = new Date()
        attendance.clock_out_latitude = latitude ?? null
        attendance.clock_out_longitude = longitude ?? null
        attendance.clock_out_accuracy = accuracyNum
        attendance.clock_out_photo_url = `/uploads/${req.file.filename}`

        await attendance.save()

        res.json(attendance)

    } catch (err) {
        return sendServerError(res, err, 'ATTENDANCE CHECKOUT')
    }

}
