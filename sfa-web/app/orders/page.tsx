'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchOrders } from '../services/api'
import { getToken } from '../utils/auth'
import { API_BASE_URL } from '@/app/utils/api-config'
import { exportToExcel } from '@/app/utils/export-excel'

const PAGE_SIZE = 10

export default function OrdersPage() {
    const [orders, setOrders] = useState<any[]>([])
    const [page, setPage] = useState(1)
    const router = useRouter()

    const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE))
    const halamanAman = Math.min(page, totalPages)
    const ordersHalamanIni = orders.slice(
        (halamanAman - 1) * PAGE_SIZE,
        halamanAman * PAGE_SIZE
    )

    useEffect(() => {
        const token = getToken()

        if (!token) {
            router.push('/login')
            return
        }

        fetchOrders(token).then(data => setOrders(data))
    }, [])

    const handleCheckIn = (
        customerId: number
    ) => {

        navigator.geolocation.getCurrentPosition(

            async (pos) => {

                const token =
                    localStorage.getItem(
                        'token'
                    )

                const res = await fetch(
                    `${API_BASE_URL}/visits/checkin`,
                    {

                        method: 'POST',

                        headers: {

                            'Content-Type':
                                'application/json',

                            Authorization:
                                `Bearer ${token}`

                        },

                        body: JSON.stringify({

                            customer_id:
                                customerId,

                            latitude:
                                pos.coords.latitude,

                            longitude:
                                pos.coords.longitude

                        })

                    }
                )

                const data =
                    await res.json()

                // ERROR
                if (!res.ok) {

                    alert(data.message)

                    return

                }

                // SUCCESS
                alert(

                    `${data.message}
Jarak: ${data.distance} meter`

                )

            }

        )

    }

    const handleExport = () => {

        const rows = orders.map((o, i) => ({
            'No': i + 1,
            'Doc No': o.doc_no,
            'Sales': o.User?.name || '-',
            'Customer': o.Customer?.name || '-',
            'Total': Number(o.total || 0)
        }))

        exportToExcel('report-order', 'Order', rows)

    }

    return (
        <div style={{ padding: 20 }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h1>Order Report</h1>

                <button
                    onClick={handleExport}
                    style={{
                        background: '#16a34a',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: 8,
                        fontWeight: 600,
                        cursor: 'pointer',
                        height: 'fit-content'
                    }}
                >
                    📥 Export Excel
                </button>
            </div>

            <table border={1} cellPadding={10}>
                <thead>
                    <tr>
                        <th>No</th>
                        <th>Doc No</th>
                        <th>Sales</th>
                        <th>Customer</th>
                        <th>Total</th>
                        {/* <th>Visit</th> */}
                    </tr>
                </thead>

                <tbody>
                    {ordersHalamanIni.map((o, i) => (
                        <tr key={o.id}>
                            <td>{i + 1}</td>
                            <td>{o.doc_no}</td>
                            <td>{o.User?.name}</td>
                            <td>{o.Customer?.name}</td>
                            <td>{o.total}</td>
                            {/* <td>
                                <button onClick={() => handleCheckIn(o.customer_id)}>
                                    Check-in
                                </button>
                            </td> */}
                        </tr>
                    ))}
                </tbody>
            </table>

            {totalPages > 1 && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 15
                }}>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>
                        Halaman {halamanAman} dari {totalPages} ({orders.length} data)
                    </span>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={() => setPage(halamanAman - 1)}
                            disabled={halamanAman <= 1}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 8,
                                border: '1px solid #d1d5db',
                                background: 'white',
                                opacity: halamanAman <= 1 ? 0.4 : 1,
                                cursor: halamanAman <= 1 ? 'default' : 'pointer'
                            }}
                        >
                            ‹ Sebelumnya
                        </button>

                        <button
                            onClick={() => setPage(halamanAman + 1)}
                            disabled={halamanAman >= totalPages}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 8,
                                border: '1px solid #d1d5db',
                                background: 'white',
                                opacity: halamanAman >= totalPages ? 0.4 : 1,
                                cursor: halamanAman >= totalPages ? 'default' : 'pointer'
                            }}
                        >
                            Berikutnya ›
                        </button>
                    </div>
                </div>
            )}
        </div>

    )





}