
const { Op } =
    require('sequelize')

const XLSX = require('xlsx')

const fs = require('fs')

const VisitPlan =
    require('../models/visitPlan.model')

const User =
    require('../models/user.model')

const Customer =
    require('../models/customer.model')

const Visit =
    require('../models/visit.model')

const { sendServerError } =
    require('../utils/response.util')

const {
    localDateString,
    addDaysLocal,
} = require('../utils/date.util')

const {
    resolveSubordinateUserIds,
} = require('../utils/access.util')



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

            if (bolehDilihat !== null) {

                whereCondition = {

                    user_id: {
                        [Op.in]: bolehDilihat
                    }

                }

            }

            // SPG melihat rencana hari ini dan besok. Rentangnya
            // eksplisit lewat spgDateRange — sebelumnya tanggalnya
            // dihitung UTC, sehingga tiap pagi 00:00-07:00 WIB yang
            // muncul adalah kemarin + hari ini.
            if (loginUser.role === 'SPG') {

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

            const data =
                await VisitPlan.create({

                    ...req.body,

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

exports.update =
    async (req, res) => {

        try {

            const loginUser =
                await User.findByPk(
                    req.user.id
                )

            const visitPlan =
                await VisitPlan.findByPk(

                    req.params.id,

                    {

                        include: [User]

                    }

                )

            // NOT FOUND

            if (!visitPlan) {

                return res.status(404).json({

                    message:
                        'Visit Plan tidak ditemukan'

                })

            }

            // ======================
            // SPG
            // ======================

            if (

                loginUser.role ===
                'SPG'

            ) {

                return res.status(403).json({

                    message:
                        'SPG tidak boleh edit visit plan'

                })

            }

            // ======================
            // SUPERVISOR
            // ======================

            if (

                loginUser.role ===
                'SUPERVISOR'

            ) {

                if (

                    visitPlan.User.supervisor_id
                    !==
                    loginUser.id

                ) {

                    return res.status(403).json({

                        message:
                            'Visit plan bukan bawahan supervisor ini'

                    })

                }

            }

            // ======================
            // MANAGER
            // ======================

            if (

                loginUser.role ===
                'MANAGER'

            ) {

                if (

                    visitPlan.User.area_id
                    !==
                    loginUser.area_id

                    ||

                    visitPlan.User.channel_id
                    !==
                    loginUser.channel_id

                ) {

                    return res.status(403).json({

                        message:
                            'Visit plan bukan area/channel manager'

                    })

                }

            }

            // ======================
            // UPDATE
            // ======================

            await visitPlan.update({

                customer_id:
                    req.body.customer_id,

                visit_date:
                    req.body.visit_date,

                notes:
                    req.body.notes

            })


            if (

                visitPlan.status
                !==
                'PENDING'

            ) {

                return res.status(400).json({

                    message:
                        'Visit plan tidak bisa diedit'

                })

            }



            res.json({

                message:
                    'Visit Plan berhasil diupdate'

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

            const loginUser =
                await User.findByPk(
                    req.user.id
                )

            const visitPlan =
                await VisitPlan.findByPk(

                    req.params.id,

                    {

                        include: [User]

                    }

                )

            if (!visitPlan) {

                return res.status(404).json({

                    message:
                        'Visit Plan tidak ditemukan'

                })

            }

            // ======================
            // SPG
            // ======================

            if (

                loginUser.role ===
                'SPG'

            ) {

                return res.status(403).json({

                    message:
                        'SPG tidak boleh delete visit plan'

                })

            }

            // ======================
            // SUPERVISOR
            // ======================

            if (

                loginUser.role ===
                'SUPERVISOR'

            ) {

                if (

                    visitPlan.User.supervisor_id
                    !==
                    loginUser.id

                ) {

                    return res.status(403).json({

                        message:
                            'Visit plan bukan bawahan supervisor ini'

                    })

                }

            }

            // ======================
            // MANAGER
            // ======================

            if (

                loginUser.role ===
                'MANAGER'

            ) {

                if (

                    visitPlan.User.area_id
                    !==
                    loginUser.area_id

                    ||

                    visitPlan.User.channel_id
                    !==
                    loginUser.channel_id

                ) {

                    return res.status(403).json({

                        message:
                            'Visit plan bukan area/channel manager'

                    })

                }

            }

            // ======================
            // DELETE
            // ======================

            await visitPlan.destroy()


            if (

                visitPlan.status
                !==
                'PENDING'

            ) {

                return res.status(400).json({

                    message:
                        'Visit plan tidak bisa dihapus'

                })

            }



            res.json({

                message:
                    'Visit Plan berhasil dihapus'

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

        const workbook =
            XLSX.readFile(req.file.path)

        const sheet =
            workbook.Sheets[
            workbook.SheetNames[0]
            ]

        const rows =
            XLSX.utils.sheet_to_json(sheet)

        console.log(rows[0])

        let inserted = 0
        let duplicate = 0

        const errors = []

        for (const row of rows) {

            //--------------------------------
            // Ambil data dari Excel
            //--------------------------------

            const salesCode =
                row["Sales Code"]

            const customerCode =
                row["Customer Code"]

            const excelDate =
                row["Visit Date"]

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

const path = require('path')
exports.downloadTemplate = (req, res) => {


    const filePath = path.join(

        process.cwd(),

        'templates',

        'visit-plan-template.xlsx'

    )

    console.log(filePath)

    console.log(fs.existsSync(filePath))

    res.download(filePath)

}

exports.spgDateRange = spgDateRange