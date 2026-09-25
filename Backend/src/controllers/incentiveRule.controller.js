const { Op } = require('sequelize')

const { sendError, sendServerError } = require('../utils/response.util')

const { USER_MANAGER_ROLES, USER_ROLES, resolveSubordinateUserIds } = require('../utils/access.util')

const { hitungBonus } = require('../utils/incentive.util')

const { periodRange, isValidPeriod, PAYROLL_VIEW_ROLES } = require('./payroll.controller')

const IncentiveRule = require('../models/incentiveRule.model')
const User = require('../models/user.model')
const Visit = require('../models/visit.model')
const Customer = require('../models/customer.model')
const VisitActivity = require('../models/visitActivity.model')

const JENIS_VALUES = ['CUSTOMER_GROUP_VISIT', 'ACTIVITY']
const FREKUENSI_VALUES = ['HARIAN', 'BULANAN']


/**
 * Validasi payload create/update -- dipakai dua endpoint supaya tidak
 * ada rule yang lolos tersimpan dengan bentuk yang bikin hitungBonus
 * atau getProgress meledak.
 */
const validatePayload = (body) => {

    const { nama, jenis, criteria_ids, target, frekuensi, bonus, ambang_minimal, roles } = body

    if (!nama || typeof nama !== 'string') {
        return 'nama wajib diisi.'
    }

    if (!JENIS_VALUES.includes(jenis)) {
        return `jenis wajib salah satu dari ${JENIS_VALUES.join(', ')}.`
    }

    if (!Array.isArray(criteria_ids) || criteria_ids.length === 0 || !criteria_ids.every(id => Number.isInteger(id))) {
        return 'criteria_ids wajib array angka, minimal 1.'
    }

    if (!Number.isInteger(target) || target <= 0) {
        return 'target wajib angka bulat > 0.'
    }

    if (!FREKUENSI_VALUES.includes(frekuensi)) {
        return `frekuensi wajib salah satu dari ${FREKUENSI_VALUES.join(', ')}.`
    }

    if (typeof bonus !== 'number' || bonus < 0) {
        return 'bonus wajib angka >= 0.'
    }

    const ambang = ambang_minimal ?? 80

    if (!Number.isInteger(ambang) || ambang < 0 || ambang > 100) {
        return 'ambang_minimal wajib angka bulat 0-100.'
    }

    if (!Array.isArray(roles) || roles.length === 0 || !roles.every(r => USER_ROLES.includes(r))) {
        return 'roles wajib array role yang valid, minimal 1.'
    }

    return null

}


// ======================
// GET ALL -- daftar semua rule (termasuk nonaktif) buat tab Pengaturan
// ======================
exports.getAll = async (req, res) => {

    try {

        if (!USER_MANAGER_ROLES.includes(req.user.role)) {
            return sendError(res, 403, 'Hanya administrator yang boleh melihat skema insentif.')
        }

        const rules = await IncentiveRule.findAll({ order: [['created_at', 'ASC']] })

        res.json(rules)

    } catch (err) {
        return sendServerError(res, err, 'INCENTIVE RULE GET ALL')
    }

}


// ======================
// CREATE
// ======================
exports.create = async (req, res) => {

    try {

        if (!USER_MANAGER_ROLES.includes(req.user.role)) {
            return sendError(res, 403, 'Hanya administrator yang boleh menambah skema insentif.')
        }

        const pesanError = validatePayload(req.body)

        if (pesanError) {
            return sendError(res, 400, pesanError)
        }

        const { nama, jenis, criteria_ids, target, frekuensi, bonus, ambang_minimal, roles, aktif } = req.body

        const rule = await IncentiveRule.create({
            nama,
            jenis,
            criteria_ids,
            target,
            frekuensi,
            bonus,
            ambang_minimal: ambang_minimal ?? 80,
            roles,
            aktif: aktif !== undefined ? !!aktif : true,
        })

        res.status(201).json(rule)

    } catch (err) {
        return sendServerError(res, err, 'INCENTIVE RULE CREATE')
    }

}


// ======================
// UPDATE
// ======================
exports.update = async (req, res) => {

    try {

        if (!USER_MANAGER_ROLES.includes(req.user.role)) {
            return sendError(res, 403, 'Hanya administrator yang boleh mengubah skema insentif.')
        }

        const rule = await IncentiveRule.findByPk(req.params.id)

        if (!rule) {
            return sendError(res, 404, 'Skema insentif tidak ditemukan.')
        }

        const pesanError = validatePayload(req.body)

        if (pesanError) {
            return sendError(res, 400, pesanError)
        }

        const { nama, jenis, criteria_ids, target, frekuensi, bonus, ambang_minimal, roles, aktif } = req.body

        await rule.update({
            nama,
            jenis,
            criteria_ids,
            target,
            frekuensi,
            bonus,
            ambang_minimal: ambang_minimal ?? 80,
            roles,
            aktif: aktif !== undefined ? !!aktif : rule.aktif,
        })

        res.json(rule)

    } catch (err) {
        return sendServerError(res, err, 'INCENTIVE RULE UPDATE')
    }

}


// ======================
// TOGGLE AKTIF
// ======================
exports.toggleAktif = async (req, res) => {

    try {

        if (!USER_MANAGER_ROLES.includes(req.user.role)) {
            return sendError(res, 403, 'Hanya administrator yang boleh mengubah status skema insentif.')
        }

        const rule = await IncentiveRule.findByPk(req.params.id)

        if (!rule) {
            return sendError(res, 404, 'Skema insentif tidak ditemukan.')
        }

        rule.aktif = !rule.aktif
        await rule.save()

        res.json({ id: rule.id, aktif: rule.aktif })

    } catch (err) {
        return sendServerError(res, err, 'INCENTIVE RULE TOGGLE AKTIF')
    }

}


// ======================
// DELETE
// ======================
exports.remove = async (req, res) => {

    try {

        if (!USER_MANAGER_ROLES.includes(req.user.role)) {
            return sendError(res, 403, 'Hanya administrator yang boleh menghapus skema insentif.')
        }

        const rule = await IncentiveRule.findByPk(req.params.id)

        if (!rule) {
            return sendError(res, 404, 'Skema insentif tidak ditemukan.')
        }

        await rule.destroy()

        res.json({ message: 'Skema insentif berhasil dihapus.' })

    } catch (err) {
        return sendServerError(res, err, 'INCENTIVE RULE DELETE')
    }

}


// ======================
// GET PROGRESS -- progress + bonus per user, per rule BULANAN aktif.
//
// Rule HARIAN SENGAJA tidak dihitung di sini -- bonus hariannya
// bersifat pass/fail per hari, jadi tidak pas ditampilkan sebagai satu
// persentase bulanan. Agregasi bulanan buat rule harian (mis. total N
// hari tercapai x bonus per hari) belum diimplementasikan; ini gap
// yang diketahui, bukan bug.
// ======================
exports.getProgress = async (req, res) => {

    try {

        if (!PAYROLL_VIEW_ROLES.includes(req.user.role)) {
            return sendError(res, 403, 'Anda tidak berhak melihat progress insentif.')
        }

        const period = req.query.period

        if (!period || !isValidPeriod(period)) {
            return sendError(res, 400, 'Format period harus YYYY-MM.')
        }

        const { firstDay, lastDay } = periodRange(period)

        // null (ADMINISTRATOR) = tanpa batas. SUPERVISOR/MANAGER cuma
        // lihat progress tim di subtree-nya sendiri, sama seperti
        // payroll.controller.js getAll.
        const subtreeIds = await resolveSubordinateUserIds(req.user)

        const rules = await IncentiveRule.findAll({
            where: { frekuensi: 'BULANAN', aktif: true },
            order: [['created_at', 'ASC']],
        })

        const hasil = []

        for (const rule of rules) {

            const roleWhere = { role: { [Op.in]: rule.roles } }

            if (subtreeIds !== null) {
                roleWhere.id = { [Op.in]: subtreeIds }
            }

            const users = await User.findAll({
                where: roleWhere,
                attributes: ['id', 'name'],
                order: [['name', 'ASC']],
            })

            const userIds = users.map(u => u.id)

            const visitedByUser = new Map()

            if (userIds.length > 0) {

                if (rule.jenis === 'CUSTOMER_GROUP_VISIT') {

                    const visits = await Visit.findAll({
                        where: {
                            user_id: { [Op.in]: userIds },
                            checkin_time: { [Op.between]: [firstDay, lastDay] },
                        },
                        include: [{
                            model: Customer,
                            attributes: ['id', 'customer_group_id'],
                            where: { customer_group_id: { [Op.in]: rule.criteria_ids } },
                        }],
                        attributes: ['user_id', 'customer_id'],
                    })

                    for (const v of visits) {
                        if (!visitedByUser.has(v.user_id)) {
                            visitedByUser.set(v.user_id, new Set())
                        }
                        visitedByUser.get(v.user_id).add(v.customer_id)
                    }

                } else {

                    const activities = await VisitActivity.findAll({
                        where: {
                            activity_id: { [Op.in]: rule.criteria_ids },
                            created_at: { [Op.between]: [firstDay, lastDay] },
                        },
                        include: [{
                            model: Visit,
                            attributes: ['user_id'],
                            where: { user_id: { [Op.in]: userIds } },
                        }],
                        attributes: ['id'],
                    })

                    for (const a of activities) {
                        const uid = a.Visit.user_id
                        visitedByUser.set(uid, (visitedByUser.get(uid) || 0) + 1)
                    }

                }

            }

            const members = users.map(u => {

                const visitedRaw = visitedByUser.get(u.id)

                const visited =
                    visitedRaw instanceof Set
                        ? visitedRaw.size
                        : (visitedRaw || 0)

                const { pct, dapatBonus, bonus, penuh } = hitungBonus(visited, rule)

                return { userId: u.id, name: u.name, visited, pct, dapatBonus, bonus, penuh }

            })

            hasil.push({
                rule: {
                    id: rule.id,
                    nama: rule.nama,
                    jenis: rule.jenis,
                    target: rule.target,
                    frekuensi: rule.frekuensi,
                    bonus: Number(rule.bonus),
                    ambang_minimal: rule.ambang_minimal,
                },
                members,
            })

        }

        res.json({ period, rules: hasil })

    } catch (err) {
        return sendServerError(res, err, 'INCENTIVE RULE GET PROGRESS')
    }

}
