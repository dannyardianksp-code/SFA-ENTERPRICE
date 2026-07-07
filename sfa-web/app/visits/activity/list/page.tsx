'use client'

import { useEffect, useState } from 'react'

export default function ActivityListPage() {

    const [activities, setActivities] = useState<any[]>([])
    const [salesUsers, setSalesUsers] = useState<any[]>([])

    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [sales, setSales] = useState('')
    const [product, setProduct] = useState('')
    const [role, setRole] = useState('')

    const [loading, setLoading] = useState(false)

    // ======================
    // FETCH
    // ======================
    const fetchData = async () => {

        setLoading(true)

        const token = localStorage.getItem('token')

        // USERS
        const uRes = await fetch('http://localhost:1000/api/users', {
            headers: { Authorization: `Bearer ${token}` }
        })

        const uData = await uRes.json()
        setSalesUsers(Array.isArray(uData) ? uData : [])

        // BUILD URL
        let url = 'http://localhost:1000/api/visit-activities'
        const params = new URLSearchParams()

        if (startDate) params.append('startDate', startDate)
        if (endDate) params.append('endDate', endDate)
        if (sales) params.append('sales', sales)
        if (product) params.append('product', product)

        url += `?${params.toString()}`

        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        })

        const data = await res.json()

        setActivities(Array.isArray(data) ? data : [])

        setLoading(false)
    }

    useEffect(() => {

        const userRole = localStorage.getItem('role')
        setRole(userRole || '')

        fetchData()

    }, [startDate, endDate, sales, product])

    // ======================
    // UI HELPERS
    // ======================
    const money = (val: any) =>
        Number(val || 0).toLocaleString('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        })

    const badge = (text: string) => (
        <span style={{
            padding: '4px 10px',
            borderRadius: 20,
            fontSize: 12,
            background: '#eef2ff',
            color: '#4338ca'
        }}>
            {text}
        </span>
    )

    // ======================
    // RENDER
    // ======================
    return (

        <div style={{
            padding: 20,
            background: '#f4f6fb',
            minHeight: '100vh',
            fontFamily: 'sans-serif'
        }}>

            {/* HEADER */}
            <div style={{
                background: 'linear-gradient(135deg,#2563eb,#06b6d4)',
                color: 'white',
                padding: 20,
                borderRadius: 16,
                marginBottom: 15
            }}>
                <h1 style={{ margin: 0 }}>📊 Activity History</h1>
                <p style={{ margin: 0, opacity: 0.8 }}>
                    Monitor semua aktivitas visit sales
                </p>
            </div>

            {/* FILTER CARD */}
            <div style={{
                background: 'white',
                padding: 15,
                borderRadius: 16,
                marginBottom: 15,
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                boxShadow: '0 5px 15px rgba(0,0,0,0.05)'
            }}>

                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />

                {role !== 'SPG' && (
                    <select value={sales} onChange={e => setSales(e.target.value)}>
                        <option value="">All Sales</option>
                        {salesUsers.map((u: any) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                )}

                <input
                    placeholder="Search product..."
                    value={product}
                    onChange={e => setProduct(e.target.value)}
                />

                <button onClick={fetchData}>
                    🔄 Refresh
                </button>

            </div>

            {/* LOADING */}
            {loading && (
                <div style={{ marginBottom: 10 }}>
                    Loading data...
                </div>
            )}

            {/* TABLE WRAPPER */}
            <div style={{
                background: 'white',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 5px 20px rgba(0,0,0,0.05)'
            }}>

                <div style={{
                    overflowX: 'auto'
                }}>

                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        minWidth: 1200
                    }}>

                        <thead style={{
                            position: 'sticky',
                            top: 0,
                            background: '#f9fafb'
                        }}>
                            <tr>
                                {[
                                    'ID',
                                    'Date',
                                    'Sales',
                                    'Customer',
                                    'Activity',
                                    'Notes',
                                    'Product',
                                    'Qty',
                                    'Expired',
                                    'Normal Price',
                                    'Promo Price',
                                    'Photo'
                                ].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            textAlign: 'left',
                                            padding: 12,
                                            fontSize: 13,
                                            color: '#6b7280'
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>

                            {activities.length === 0 && (
                                <tr>
                                    <td colSpan={12} style={{
                                        padding: 20,
                                        textAlign: 'center',
                                        color: '#9ca3af'
                                    }}>
                                        No activity found
                                    </td>
                                </tr>
                            )}

                            {activities.map((a: any) => (
                                <tr
                                    key={a.id}
                                    style={{
                                        borderTop: '1px solid #eee',
                                        cursor: 'pointer'
                                    }}
                                >

                                    <td style={{ padding: 12 }}>{a.id}</td>

                                    <td style={{ padding: 12 }}>
                                        {new Date(a.created_at).toLocaleDateString('id-ID')}
                                    </td>

                                    <td style={{ padding: 12 }}>
                                        {badge(a.Visit?.User?.name || '-')}
                                    </td>

                                    <td style={{ padding: 12 }}>
                                        {badge(a.Visit?.Customer?.name || '-')}
                                    </td>

                                    <td style={{ padding: 12 }}>
                                        {badge(a.Activity?.name || '-')}
                                    </td>

                                    <td style={{ padding: 12 }}>{a.notes}</td>

                                    <td style={{ padding: 12 }}>
                                        {a.product_name}
                                    </td>

                                    <td style={{ padding: 12 }}>{a.qty}</td>

                                    <td style={{ padding: 12 }}>{a.expired_date}</td>

                                    <td style={{ padding: 12 }}>{money(a.normal_price)}</td>

                                    <td style={{ padding: 12 }}>{money(a.promo_price)}</td>

                                    <td style={{ padding: 12 }}>
                                        {a.photo_url ? (
                                            <img
                                                src={`http://localhost:1000${a.photo_url}`}
                                                style={{
                                                    width: 40,
                                                    height: 40,
                                                    objectFit: 'cover',
                                                    borderRadius: 8
                                                }}
                                            />
                                        ) : '-'}
                                    </td>

                                </tr>
                            ))}

                        </tbody>

                    </table>

                </div>

            </div>

        </div>
    )
}