'use client'

import { useEffect, useState } from 'react'

const pad2 = (n: number) => String(n).padStart(2, '0')

const awalBulanIni = () => {
    const d = new Date()
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`
}

const akhirBulanIni = () => {
    const d = new Date()
    const akhir = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return `${akhir.getFullYear()}-${pad2(akhir.getMonth() + 1)}-${pad2(akhir.getDate())}`
}

export default function AttendanceReportPage() {

    const [attendances, setAttendances] = useState<any[]>([])
    const [users, setUsers] = useState<any[]>([])
    const [areas, setAreas] = useState<any[]>([])

    const [dateFrom, setDateFrom] = useState(awalBulanIni())
    const [dateTo, setDateTo] = useState(akhirBulanIni())
    const [areaFilter, setAreaFilter] = useState('ALL')
    const [salesFilter, setSalesFilter] = useState('ALL')

    const [loading, setLoading] = useState(false)

    // ======================
    // FETCH
    // ======================
    const fetchData = async () => {

        setLoading(true)

        const token = localStorage.getItem('token')

        const params = new URLSearchParams()
        if (dateFrom) params.append('from', dateFrom)
        if (dateTo) params.append('to', dateTo)

        const [attRes, uRes, arRes] = await Promise.all([

            fetch(`http://localhost:1000/api/attendances?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            }),

            fetch('http://localhost:1000/api/users', {
                headers: { Authorization: `Bearer ${token}` }
            }),

            fetch('http://localhost:1000/api/areas', {
                headers: { Authorization: `Bearer ${token}` }
            })

        ])

        const attData = await attRes.json()
        const uData = await uRes.json()
        const arData = await arRes.json()

        setAttendances(Array.isArray(attData) ? attData : [])
        setUsers(Array.isArray(uData) ? uData : [])
        setAreas(Array.isArray(arData) ? arData : [])

        setLoading(false)
    }

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ======================
    // FILTER (sales/area di client, tanggal sudah difilter server)
    // ======================
    const filtered = attendances.filter((a: any) => {

        const matchSales =
            salesFilter === 'ALL' || String(a.user_id) === salesFilter

        const matchArea =
            areaFilter === 'ALL' || String(a.User?.area_id) === areaFilter

        return matchSales && matchArea

    })

    // ======================
    // UI HELPERS
    // ======================
    const jam = (iso: string | null) =>
        iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'

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
                background: 'linear-gradient(135deg,#7c3aed,#2563eb)',
                color: 'white',
                padding: 20,
                borderRadius: 16,
                marginBottom: 15
            }}>
                <h1 style={{ margin: 0 }}>🕐 Attendance History</h1>
                <p style={{ margin: 0, opacity: 0.8 }}>
                    Riwayat absen 
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

                <div>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>
                        Dari Tanggal
                    </label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>

                <div>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>
                        Sampai Tanggal
                    </label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>

                <div>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>
                        Area
                    </label>
                    <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)}>
                        <option value="ALL">Semua Area</option>
                        {areas.map((a: any) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>
                        Nama Sales
                    </label>
                    <select value={salesFilter} onChange={e => setSalesFilter(e.target.value)}>
                        <option value="ALL">Semua Sales</option>
                        {users.map((u: any) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                </div>

                <button onClick={fetchData} style={{ alignSelf: 'flex-end' }}>
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
                                'Tanggal',
                                'Clock In',
                                'Clock Out',
                                'Map'
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
                                <td colSpan={6} style={{
                                    padding: 20,
                                    textAlign: 'center',
                                    color: '#9ca3af'
                                }}>
                                    No attendance found
                                </td>
                            </tr>
                        )}

                        {filtered.map((a: any, i: number) => (

                            <tr
                                key={a.id}
                                style={{ borderTop: '1px solid #eee' }}
                            >

                                <td style={{ padding: 12 }}>{i + 1}</td>

                                <td style={{ padding: 12 }}>
                                    {a.User?.name || '-'}
                                </td>

                                <td style={{ padding: 12 }}>
                                    {a.tanggal}
                                </td>

                                <td style={{ padding: 12 }}>
                                    {jam(a.clock_in_time)}
                                </td>

                                <td style={{ padding: 12 }}>
                                    {a.clock_out_time ? jam(a.clock_out_time) : (
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: 20,
                                            fontSize: 12,
                                            background: '#fffbeb',
                                            color: '#b45309'
                                        }}>
                                            Belum pulang
                                        </span>
                                    )}
                                </td>

                                <td style={{ padding: 12 }}>
                                    {a.clock_in_latitude && a.clock_in_longitude ? (
                                        <button
                                            onClick={() =>
                                                window.open(
                                                    `https://www.google.com/maps?q=${a.clock_in_latitude},${a.clock_in_longitude}`,
                                                    '_blank'
                                                )
                                            }
                                            style={{
                                                background: '#10b981',
                                                color: 'white',
                                                border: 'none',
                                                padding: '6px 10px',
                                                borderRadius: 8
                                            }}
                                        >
                                            Map
                                        </button>
                                    ) : '-'}
                                </td>

                            </tr>

                        ))}

                    </tbody>

                </table>

            </div>

        </div>
    )
}
