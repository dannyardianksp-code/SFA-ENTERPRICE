'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchOrders } from '../services/api'
import { getToken } from '../utils/auth'
import { API_BASE_URL } from '@/app/utils/api-config'
import { exportToExcel } from '@/app/utils/export-excel'

export default function OrdersPage() {
    const [orders, setOrders] = useState<any[]>([])
    const router = useRouter()

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
                    {orders.map((o, i) => (
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
        </div>

    )





}