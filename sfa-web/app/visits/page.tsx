'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function VisitHistoryPage() {

    const [visits, setVisits] = useState<any[]>([])
    const [users, setUsers] = useState<any[]>([])
    const [areas, setAreas] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [role, setRole] = useState('')

    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [areaFilter, setAreaFilter] = useState('ALL')
    const [salesFilter, setSalesFilter] = useState('ALL')

    const router = useRouter()

    // ======================
    // FETCH
    // ======================
    const fetchData = async () => {

        const token = localStorage.getItem('token')

        const [vRes, uRes, aRes] = await Promise.all([

            fetch('http://localhost:1000/api/visits', {
                headers: { Authorization: `Bearer ${token}` }
            }),

            // Area ada di tabel users, bukan di visits -- dipakai buat
            // memetakan User.id (di setiap visit) ke Area-nya.
            fetch('http://localhost:1000/api/users', {
                headers: { Authorization: `Bearer ${token}` }
            }),

            fetch('http://localhost:1000/api/areas', {
                headers: { Authorization: `Bearer ${token}` }
            })

        ])

        const vData = await vRes.json()
        const uData = await uRes.json()
        const aData = await aRes.json()

        setVisits(Array.isArray(vData) ? vData : [])
        setUsers(Array.isArray(uData) ? uData : [])
        setAreas(Array.isArray(aData) ? aData : [])
    }

    useEffect(() => {
        setRole(localStorage.getItem('role') || '')
        fetchData()
    }, [])

    // user_id -> area_id, dari daftar users (visit sendiri tidak
    // membawa area).
    const areaByUserId = new Map(
        users.map((u: any) => [u.id, u.area_id])
    )

    // ======================
    // FILTER
    // ======================
    const filtered = visits.filter((v) => {

        const matchSearch =
            v.Customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
            v.User?.name?.toLowerCase().includes(search.toLowerCase())

        const checkinDate = v.checkin_time?.slice(0, 10)

        const matchDateFrom = !dateFrom || (checkinDate && checkinDate >= dateFrom)
        const matchDateTo = !dateTo || (checkinDate && checkinDate <= dateTo)

        const matchSales =
            salesFilter === 'ALL' || String(v.User?.id) === salesFilter

        const matchArea =
            areaFilter === 'ALL' ||
            String(areaByUserId.get(v.User?.id)) === areaFilter

        return matchSearch && matchDateFrom && matchDateTo && matchSales && matchArea

    })

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

            {/* FILTER */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                marginBottom: 15
            }}>

                <div>
                    <label style={{ fontSize: 12, color: '#6b7280' }}>
                        Dari Tanggal
                    </label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        style={{
                            display: 'block',
                            padding: 12,
                            borderRadius: 12,
                            border: '1px solid #ddd'
                        }}
                    />
                </div>

                <div>
                    <label style={{ fontSize: 12, color: '#6b7280' }}>
                        Sampai Tanggal
                    </label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        style={{
                            display: 'block',
                            padding: 12,
                            borderRadius: 12,
                            border: '1px solid #ddd'
                        }}
                    />
                </div>

                <div>
                    <label style={{ fontSize: 12, color: '#6b7280' }}>
                        Area
                    </label>
                    <select
                        value={areaFilter}
                        onChange={(e) => setAreaFilter(e.target.value)}
                        style={{
                            display: 'block',
                            padding: 12,
                            borderRadius: 12,
                            border: '1px solid #ddd'
                        }}
                    >
                        <option value="ALL">Semua Area</option>
                        {areas.map((a: any) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={{ fontSize: 12, color: '#6b7280' }}>
                        Nama Sales
                    </label>
                    <select
                        value={salesFilter}
                        onChange={(e) => setSalesFilter(e.target.value)}
                        style={{
                            display: 'block',
                            padding: 12,
                            borderRadius: 12,
                            border: '1px solid #ddd'
                        }}
                    >
                        <option value="ALL">Semua Sales</option>
                        {users.map((u: any) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </select>
                </div>

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