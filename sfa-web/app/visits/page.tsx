'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function VisitHistoryPage() {

    const [visits, setVisits] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [role, setRole] = useState('')

    const router = useRouter()

    // ======================
    // FETCH
    // ======================
    const fetchData = async () => {

        const token = localStorage.getItem('token')

        const res = await fetch('http://localhost:1000/api/visits', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        const data = await res.json()

        setVisits(Array.isArray(data) ? data : [])
    }

    useEffect(() => {
        setRole(localStorage.getItem('role') || '')
        fetchData()
    }, [])

    // ======================
    // FILTER
    // ======================
    const filtered = visits.filter((v) =>
        v.Customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
        v.User?.name?.toLowerCase().includes(search.toLowerCase())
    )

    // ======================
    // UI
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
                background: 'linear-gradient(135deg,#1d4ed8,#06b6d4)',
                color: 'white',
                padding: 20,
                borderRadius: 16,
                marginBottom: 15
            }}>
                <h1 style={{ margin: 0 }}>📍 Visit History</h1>
                <p style={{ margin: 0, opacity: 0.8 }}>
                    Tracking semua aktivitas kunjungan sales
                </p>
            </div>

            {/* SEARCH */}
            <div style={{
                marginBottom: 15
            }}>
                <input
                    placeholder="🔍 Search customer / sales..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid #ddd'
                    }}
                />
            </div>

            {/* TABLE CARD */}
            <div style={{
                background: 'white',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 5px 20px rgba(0,0,0,0.05)'
            }}>

                <table style={{
                    width: '100%',
                    borderCollapse: 'collapse'
                }}>

                    <thead style={{
                        background: '#f9fafb'
                    }}>
                        <tr>
                            {[
                                'No',
                                'Sales',
                                'Customer',
                                'Time',
                                'Latitude',
                                'Longitude',
                                'Action'
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

                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={7} style={{
                                    padding: 20,
                                    textAlign: 'center',
                                    color: '#9ca3af'
                                }}>
                                    No visit history found
                                </td>
                            </tr>
                        )}

                        {filtered.map((v, i) => (

                            <tr
                                key={v.id}
                                style={{
                                    borderTop: '1px solid #eee'
                                }}
                            >

                                <td style={{ padding: 12 }}>
                                    {i + 1}
                                </td>

                                <td style={{ padding: 12 }}>
                                    {v.User?.name || '-'}
                                </td>

                                <td style={{ padding: 12 }}>
                                    <b>{v.Customer?.name || '-'}</b>
                                </td>

                                <td style={{ padding: 12 }}>
                                    {v.checkin_time
                                        ? new Date(v.checkin_time).toLocaleString('id-ID')
                                        : '-'}
                                </td>

                                <td style={{ padding: 12 }}>
                                    {v.latitude}
                                </td>

                                <td style={{ padding: 12 }}>
                                    {v.longitude}
                                </td>

                                <td style={{ padding: 12 }}>

                                    {/* MAP BUTTON */}
                                    <button
                                        onClick={() =>
                                            window.open(
                                                `https://www.google.com/maps?q=${v.latitude},${v.longitude}`,
                                                '_blank'
                                            )
                                        }
                                        style={{
                                            background: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            padding: '6px 10px',
                                            borderRadius: 8,
                                            marginRight: 5
                                        }}
                                    >
                                        Map
                                    </button>

                                    {/* DETAIL BUTTON */}
                                    <button
                                        onClick={() =>
                                            router.push(`/visit-detail/${v.id}`)
                                        }
                                        style={{
                                            background: '#2563eb',
                                            color: 'white',
                                            border: 'none',
                                            padding: '6px 10px',
                                            borderRadius: 8
                                        }}
                                    >
                                        Detail
                                    </button>

                                </td>

                            </tr>

                        ))}

                    </tbody>

                </table>

            </div>

        </div>
    )
}