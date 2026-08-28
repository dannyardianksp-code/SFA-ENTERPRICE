
const express = require('express')
const router = express.Router()
const auth =
    require('../middleware/auth.middleware')

const { Op } = require('sequelize')

const { localDateString } = require('../utils/date.util')

const { sendServerError } = require('../utils/response.util')

const VisitPlan =
    require('../models/visitPlan.model')

const Visit =
    require('../models/visit.model')

const VisitActivity =
    require('../models/visitActivity.model')

const Customer =
    require('../models/customer.model')

const User =
    require('../models/user.model')

const { resolveSubordinateUserIds } =
    require('../utils/access.util')




router.get(
    '/spg',
    auth,
    async (req, res) => {

        try {

            const now = new Date()

            const today = localDateString(now)

            const firstDay =
                new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    1
                )

            const lastDay =
                new Date(
                    now.getFullYear(),
                    now.getMonth() + 1,
                    0,
                    23,
                    59,
                    59
                )

            const userId =
                req.user.id

            // TARGET VISIT

            const targetVisit =

                await VisitPlan.count({

                    where: {

                        user_id:
                            userId,

                        visit_date:
                            today

                    }

                })

            const targetVisitMonth =
                await VisitPlan.count({

                    where: {

                        user_id: userId,

                        visit_date: {

                            [Op.between]: [

                                firstDay,
                                lastDay

                            ]

                        }

                    }

                })
            // VISITED -- dihitung dari status rencana (COMPLETED), BUKAN
            // dari baris Visit dengan checkin_time hari ini. Alasan:
            // hitungan lama menghitung kunjungan yang "sedang
            // berkunjung" (belum checkout) sebagai tercapai, dan juga
            // menghitung kunjungan susulan ke customer yang sama dua
            // kali -- keduanya bikin angka "tercapai" lebih besar dari
            // targetVisit-nya sendiri. Status rencana konsisten dengan
            // targetVisit di atas (sama-sama dihitung dari VisitPlan),
            // jadi progress/remaining jadi masuk akal (target 4, ON
            // VISIT tidak ikut terhitung sampai checkout).

            const visited =
                await VisitPlan.count({

                    where: {

                        user_id:
                            userId,

                        visit_date:
                            today,

                        status:
                            'COMPLETED'

                    }

                })


            const visitedMonth =
                await VisitPlan.count({

                    where: {

                        user_id: userId,

                        visit_date: {

                            [Op.between]: [

                                firstDay,
                                lastDay

                            ]

                        },

                        status:
                            'COMPLETED'

                    }

                })
            // ACTIVITY

            const activitiesToday =
                await VisitActivity.count({

                    include: [

                        {

                            model: Visit,

                            required: true,

                            where: {

                                user_id:
                                    userId

                            }

                        }

                    ],

                    where: {

                        created_at: {

                            [Op.gte]:
                                new Date(
                                    `${today} 00:00:00`
                                )

                        }

                    }

                })

            const visitedStores =
                await Visit.findAll({

                    where: {

                        user_id: userId,

                        checkin_time: {

                            [Op.gte]:
                                new Date(`${today} 00:00:00`)

                        }

                    },

                    include: [

                        {

                            model: Customer,

                            attributes: [

                                'id',

                                'name',

                                'latitude',

                                'longitude'

                            ]

                        }

                    ]

                })

            const pendingStores =
                await VisitPlan.findAll({

                    where: {

                        user_id:
                            userId,

                        visit_date:
                            today,

                        status:
                            'PENDING'

                    },

                    include: [

                        {

                            model: Customer,

                            attributes: [

                                'id',

                                'name',

                                'latitude',

                                'longitude'

                            ]

                        }

                    ]

                })

            const remaining =
                targetVisit - visited

            const remainingMonth =
                targetVisitMonth -
                visitedMonth

            const progress =
                targetVisit === 0

                    ? 0

                    :

                    Number(

                        (

                            visited /
                            targetVisit

                        ) * 100

                    ).toFixed(2)

            const progressMonth =

                targetVisitMonth === 0

                    ? 0

                    :

                    Number(

                        (

                            visitedMonth /

                            targetVisitMonth

                        ) * 100

                    ).toFixed(2)

            // TEAM (anak buah) -- hanya buat SUPERVISOR dan MANAGER.
            // SPG tidak punya bawahan (resolveSubordinateUserIds
            // mengembalikan cuma dirinya sendiri), jadi timnya kosong
            // dan section ini otomatis tidak tampil di web tanpa perlu
            // pengecekan role terpisah di frontend.
            const TEAM_VIEW_ROLES = ['SUPERVISOR', 'MANAGER', 'REGIONAL MANAGER', 'GENERAL MANAGER']

            let team = []

            if (TEAM_VIEW_ROLES.includes(req.user.role)) {

                const subtreeIds =
                    await resolveSubordinateUserIds(req.user)

                const timIds =
                    subtreeIds.filter(id => id !== userId)

                const timUsers = await User.findAll({
                    where: { id: timIds },
                    attributes: ['id', 'name'],
                })

                team = await Promise.all(
                    timUsers.map(async (u) => {

                        const targetVisitAnggota =
                            await VisitPlan.count({
                                where: {
                                    user_id: u.id,
                                    visit_date: today,
                                },
                            })

                        const visitedAnggota =
                            await VisitPlan.count({
                                where: {
                                    user_id: u.id,
                                    visit_date: today,
                                    status: 'COMPLETED',
                                },
                            })

                        const progressAnggota =
                            targetVisitAnggota === 0
                                ? 0
                                : Number(
                                    (visitedAnggota / targetVisitAnggota) * 100
                                ).toFixed(2)

                        return {
                            id: u.id,
                            name: u.name,
                            targetVisit: targetVisitAnggota,
                            visited: visitedAnggota,
                            remaining: targetVisitAnggota - visitedAnggota,
                            progress: progressAnggota,
                        }

                    })
                )

            }

            res.json({

                today: {

                    targetVisit,

                    visited,

                    remaining,

                    progress

                },

                month: {

                    targetVisit:
                        targetVisitMonth,

                    visited:
                        visitedMonth,

                    remaining:
                        remainingMonth,

                    progress:
                        progressMonth

                },

                activitiesToday,

                visitedStores,

                pendingStores,

                team


            })



        }

        catch (err) {

            // Key `error` tidak dibaca mobile — ia hanya melihat
            // `message`, jadi sales dapat pesan generik untuk error yang
            // sebenarnya sudah dijelaskan. sendServerError juga
            // menyembunyikan detail exception saat production, yang bisa
            // membocorkan struktur tabel.
            return sendServerError(res, err, 'DASHBOARD SPG')

        }

    }

)
module.exports = router