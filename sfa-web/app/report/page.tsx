'use client'

import { useRouter } from 'next/navigation'
import { MapPinned, Activity, ShoppingCart, ChevronRight } from 'lucide-react'

const KATEGORI = [

    {
        key: 'visit',
        title: 'Report Visit',
        desc: 'Riwayat kunjungan tim',
        icon: MapPinned,
        href: '/visits'
    },

    {
        key: 'activity',
        title: 'Report Activity',
        desc: 'Riwayat activity kunjungan tim',
        icon: Activity,
        href: '/visits/activity/list'
    },

    {
        key: 'order',
        title: 'Report Order',
        desc: 'Riwayat order tim',
        icon: ShoppingCart,
        href: '/orders'
    }

]

export default function ReportPage() {

    const router = useRouter()

    return (

        <div className="space-y-6">

            <div className="bg-white rounded-3xl p-6 shadow-lg">

                <h1 className="text-3xl font-bold text-slate-900">
                    📊 Report
                </h1>

                <p className="text-slate-500 mt-2">
                    Pilih laporan yang mau dilihat
                </p>

            </div>

            <div className="grid md:grid-cols-3 gap-5">

                {

                    KATEGORI.map((kategori) => {

                        const Icon = kategori.icon

                        return (

                            <div

                                key={kategori.key}

                                onClick={() => router.push(kategori.href)}

                                className="bg-white rounded-3xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition flex items-center justify-between"

                            >

                                <div className="flex items-center gap-4">

                                    <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl">
                                        <Icon size={24} />
                                    </div>

                                    <div>

                                        <h3 className="text-lg font-bold text-slate-900">
                                            {kategori.title}
                                        </h3>

                                        <p className="text-sm text-slate-500">
                                            {kategori.desc}
                                        </p>

                                    </div>

                                </div>

                                <ChevronRight className="text-slate-400" />

                            </div>

                        )

                    })

                }

            </div>

        </div>

    )

}
