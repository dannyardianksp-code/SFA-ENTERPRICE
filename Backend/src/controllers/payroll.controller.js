const { Op } = require('sequelize')

const { sendError, sendServerError } = require('../utils/response.util')

const { USER_MANAGER_ROLES, FIELD_ROLES, resolveSubordinateUserIds } = require('../utils/access.util')

// Lihat laporan payroll (read-only) -- SUPERVISOR/MANAGER cuma lihat
// tim di subtree-nya sendiri (lihat scoping di getAll di bawah).
// Ubah tarif/hari kerja TETAP admin-only (lihat setDailyRate/
// setHariKerja) -- ini sengaja dipisah dari role yang boleh melihat.
const PAYROLL_VIEW_ROLES = [...USER_MANAGER_ROLES, 'SUPERVISOR', 'MANAGER']

const User = require('../models/user.model')
const Area = require('../models/area.model')
const Attendance = require('../models/attendance.model')
const UserWorkDay = require('../models/userWorkDay.model')


/**
 * 'YYYY-MM' -> { firstDay, lastDay } (Date, batas awal/akhir bulan
 * itu). Dipakai sama seperti pola firstDay/lastDay di dashboard.routes.js.
 */
const periodRange = (period) => {

    const [tahun, bulan] = period.split('-').map(Number)

    const firstDay = new Date(tahun, bulan - 1, 1)
    const lastDay = new Date(tahun, bulan, 0, 23, 59, 59)

    return { firstDay, lastDay }

}

const currentPeriod = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const isValidPeriod = (period) => /^\d{4}-(0[1-9]|1[0-2])$/.test(period)


// ======================
// GET ALL -- payroll harian per MD/SPG/SALES buat satu periode
// ======================
exports.getAll = async (req, res) => {

    try {

        if (!PAYROLL_VIEW_ROLES.includes(req.user.role)) {
            return sendError(res, 403, 'Anda tidak berhak melihat payroll.')
        }

        const period = req.query.period || currentPeriod()

        if (!isValidPeriod(period)) {
            return sendError(res, 400, 'Format period harus YYYY-MM.')
        }

        const { firstDay, lastDay } = periodRange(period)

        // null (ADMINISTRATOR) = tanpa batas. Selain itu, dibatasi ke
        // subtree sendiri -- SUPERVISOR/MANAGER cuma lihat gaji tim
        // mereka, bukan seluruh perusahaan.
        const subtreeIds = await resolveSubordinateUserIds(req.user)

        const userWhere = { role: { [Op.in]: FIELD_ROLES } }

        if (subtreeIds !== null) {
            userWhere.id = { [Op.in]: subtreeIds }
        }

        const users = await User.findAll({
            where: userWhere,
            attributes: ['id', 'name', 'role', 'daily_rate'],
            include: [{ model: Area, attributes: ['id', 'code', 'name'] }],
            order: [['name', 'ASC']],
        })

        const userIds = users.map(u => u.id)

        const [workDayRows, attendanceRows] = await Promise.all([

            UserWorkDay.findAll({
                where: { user_id: { [Op.in]: userIds }, period },
            }),

            Attendance.findAll({
                where: {
                    user_id: { [Op.in]: userIds },
                    tanggal: { [Op.between]: [firstDay, lastDay] },
                    clock_in_time: { [Op.ne]: null },
                },
                attributes: ['user_id'],
            }),

        ])

        const hariKerjaByUser = new Map(
            workDayRows.map(w => [w.user_id, w.hari_kerja])
        )

        const hariHadirByUser = new Map()

        for (const row of attendanceRows) {
            hariHadirByUser.set(
                row.user_id,
                (hariHadirByUser.get(row.user_id) || 0) + 1
            )
        }

        const data = users.map(u => {

            const dailyRate = u.daily_rate !== null ? Number(u.daily_rate) : null
            const hariKerja = hariKerjaByUser.get(u.id) || 0
            const hariHadir = hariHadirByUser.get(u.id) || 0
            const total = dailyRate !== null ? hariHadir * dailyRate : 0

            return {
                id: u.id,
                name: u.name,
                role: u.role,
                area: u.Area ? { id: u.Area.id, code: u.Area.code, name: u.Area.name } : null,
                dailyRate,
                hariKerja,
                hariHadir,
                total,
            }

        })

        res.json({ period, data })

    } catch (err) {
        return sendServerError(res, err, 'PAYROLL GET ALL')
    }

}


// ======================
// SET TARIF HARIAN
// ======================
exports.setDailyRate = async (req, res) => {

    try {

        if (!USER_MANAGER_ROLES.includes(req.user.role)) {
            return sendError(res, 403, 'Hanya administrator yang boleh mengubah tarif harian.')
        }

        const { daily_rate } = req.body

        if (daily_rate === undefined || Number(daily_rate) < 0 || Number.isNaN(Number(daily_rate))) {
            return sendError(res, 400, 'daily_rate wajib berupa angka >= 0.')
        }

        const user = await User.findByPk(req.params.userId)

        if (!user) {
            return sendError(res, 404, 'User tidak ditemukan.')
        }

        user.daily_rate = Number(daily_rate)
        await user.save()

        res.json({ id: user.id, dailyRate: Number(user.daily_rate) })

    } catch (err) {
        return sendServerError(res, err, 'PAYROLL SET DAILY RATE')
    }

}


// ======================
// SET HARI KERJA (per periode)
// ======================
exports.setHariKerja = async (req, res) => {

    try {

        if (!USER_MANAGER_ROLES.includes(req.user.role)) {
            return sendError(res, 403, 'Hanya administrator yang boleh mengubah hari kerja.')
        }

        const { period, hari_kerja } = req.body

        if (!period || !isValidPeriod(period)) {
            return sendError(res, 400, 'Format period harus YYYY-MM.')
        }

        if (hari_kerja === undefined || Number(hari_kerja) < 0 || Number.isNaN(Number(hari_kerja))) {
            return sendError(res, 400, 'hari_kerja wajib berupa angka >= 0.')
        }

        const user = await User.findByPk(req.params.userId)

        if (!user) {
            return sendError(res, 404, 'User tidak ditemukan.')
        }

        const [row] = await UserWorkDay.findOrCreate({
            where: { user_id: user.id, period },
            defaults: { hari_kerja: Number(hari_kerja) },
        })

        if (row.hari_kerja !== Number(hari_kerja)) {
            row.hari_kerja = Number(hari_kerja)
            await row.save()
        }

        res.json({ userId: user.id, period, hariKerja: row.hari_kerja })

    } catch (err) {
        return sendServerError(res, err, 'PAYROLL SET HARI KERJA')
    }

}


module.exports.periodRange = periodRange
module.exports.isValidPeriod = isValidPeriod
module.exports.PAYROLL_VIEW_ROLES = PAYROLL_VIEW_ROLES
