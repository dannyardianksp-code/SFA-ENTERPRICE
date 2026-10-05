'use client'

import { useEffect, useState } from 'react'
import { API_BASE_URL, UPLOADS_ORIGIN } from '@/app/utils/api-config'
import { exportToExcel } from '@/app/utils/export-excel'

const pad2 = (n: number) => String(n).padStart(2, '0')

// Awal dan akhir bulan berjalan, "YYYY-MM-DD" -- sama seperti default
// di Report Visit.
const awalBulanIni = () => {
    const d = new Date()
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`
}

const akhirBulanIni = () => {
    const d = new Date()
    const akhir = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return `${akhir.getFullYear()}-${pad2(akhir.getMonth() + 1)}-${pad2(akhir.getDate())}`
}

export default function ActivityListPage() {

    const [activities, setActivities] = useState<any[]>([])
    const [salesUsers, setSalesUsers] = useState<any[]>([])
    const [areas, setAreas] = useState<any[]>([])
    const [activityTypes, setActivityTypes] = useState<any[]>([])

    const [dateFrom, setDateFrom] = useState(awalBulanIni())
    const [dateTo, setDateTo] = useState(akhirBulanIni())
    const [areaFilter, setAreaFilter] = useState('ALL')
    const [salesFilter, setSalesFilter] = useState('ALL')
    const [activityFilter, setActivityFilter] = useState('ALL')
    const [product, setProduct] = useState('')

    const [loading, setLoading] = useState(false)

    // ======================
    // FETCH
    // ======================
    const fetchData = async () => {

        setLoading(true)

        const token = localStorage.getItem('token')

        const [aRes, uRes, arRes, tRes] = await Promise.all([

            fetch(`${API_BASE_URL}/visit-activities`, {
                headers: { Authorization: `Bearer ${token}` }
            }),

            fetch(`${API_BASE_URL}/users`, {
                headers: { Authorization: `Bearer ${token}` }
            }),

            fetch(`${API_BASE_URL}/areas`, {
                headers: { Authorization: `Bearer ${token}` }
            }),

            fetch(`${API_BASE_URL}/activities`, {
                headers: { Authorization: `Bearer ${token}` }
            })

        ])

        const aData = await aRes.json()
        const uData = await uRes.json()
        const arData = await arRes.json()
        const tData = await tRes.json()

        setActivities(Array.isArray(aData) ? aData : [])
        setSalesUsers(Array.isArray(uData) ? uData : [])
        setAreas(Array.isArray(arData) ? arData : [])
        setActivityTypes(Array.isArray(tData) ? tData : [])

        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [])

    // user_id -> area_id, sama pola dengan Report Visit -- area ada di
    // tabel users, bukan di visit-activities.
    const areaByUserId = new Map(
        salesUsers.map((u: any) => [u.id, u.area_id])
    )

    // ======================
    // FILTER (semua di client, sama pola dengan Report Visit)
    // ======================
    const filtered = activities.filter((a: any) => {

        const tanggal = a.created_at?.slice(0, 10)

        const matchDateFrom = !dateFrom || (tanggal && tanggal >= dateFrom)
        const matchDateTo = !dateTo || (tanggal && tanggal <= dateTo)

        const matchSales =
            salesFilter === 'ALL' || String(a.Visit?.User?.id) === salesFilter

        const matchArea =
            areaFilter === 'ALL' ||
            String(areaByUserId.get(a.Visit?.User?.id)) === areaFilter

        const matchActivity =
            activityFilter === 'ALL' || String(a.activity_id) === activityFilter

        // Field activity sekarang dinamis (lihat field_values +
        // Activity.FieldDefinitions) -- cari di SEMUA nilai field baris
        // ini, bukan cuma product_name yang sudah tidak mewakili semua
        // tipe activity lagi.
        const nilaiField = fieldValuesArray(a)
        const matchProduct =
            !product ||
            nilaiField.some(({ label, value }: any) =>
                label.toLowerCase().includes(product.toLowerCase()) ||
                String(value).toLowerCase().includes(product.toLowerCase())
            )

        return matchDateFrom && matchDateTo && matchSales && matchArea && matchActivity && matchProduct

    })

    // ======================
    // UI HELPERS
    // ======================

    /**
     * [{label, type, value}] untuk satu baris activity -- dipasangkan
     * dari Activity.FieldDefinitions (label/tipe) dengan field_values
     * (nilai, dikunci angka ATAU string tergantung sumbernya JS atau
     * JSON.parse). Dipakai bersama oleh filter pencarian, kolom Detail,
     * dan export Excel supaya ketiganya tidak pernah membaca field
     * dengan cara berbeda.
     */
    const fieldValuesArray = (a: any) => {

        const defs = a.Activity?.FieldDefinitions || []
        const values = a.field_values || {}

        return defs
            .slice()
            .sort((x: any, y: any) => x.display_order - y.display_order)
            .map((def: any) => ({
                label: def.label,
                type: def.field_type,
                value: values[def.id] ?? values[String(def.id)],
            }))
            .filter((f: any) => f.value !== undefined && f.value !== null && f.value !== '')

    }

    // ======================
    // EXPORT EXCEL
    // ======================
    // Sama pola dengan Report Visit -- ekspor `filtered` (yang lagi
    // kelihatan di tabel), bukan `activities` mentah. Kolom field
    // sekarang dinamis: satu kolom per LABEL field yang benar-benar
    // muncul di baris yang diekspor (union semua activity yang
    // tercampur dalam satu laporan), bukan kolom tetap Qty/Harga/dst
    // yang cuma cocok buat sebagian activity.
    const handleExport = () => {

        const semuaBaris = filtered.map((a: any) => ({
            activity: a,
            fields: fieldValuesArray(a).filter((f: any) => f.type !== 'PHOTO'),
        }))

        const labelUnik = Array.from(
            new Set(semuaBaris.flatMap(({ fields }) => fields.map((f: any) => f.label)))
        )

        const rows = semuaBaris.map(({ activity: a, fields }) => {

            const nilaiPerLabel = Object.fromEntries(fields.map((f: any) => [f.label, f.value]))

            const baris: Record<string, any> = {
                'ID': a.id,
                'Tanggal': new Date(a.created_at).toLocaleDateString('id-ID'),
                'Sales': a.Visit?.User?.name || '-',
                'Customer': a.Visit?.Customer?.name || '-',
                'Activity': a.Activity?.name || '-',
            }

            for (const label of labelUnik) {
                baris[label] = nilaiPerLabel[label] ?? ''
            }

            return baris

        })

        exportToExcel(
            `report-activity_${dateFrom}_${dateTo}`,
            'Activity',
            rows
        )

    }

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
                        {salesUsers.map((u: any) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>
                        Kegiatan / Activity
                    </label>
                    <select value={activityFilter} onChange={e => setActivityFilter(e.target.value)}>
                        <option value="ALL">Semua Kegiatan</option>
                        {activityTypes.map((t: any) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block' }}>
                        Cari Isi Field
                    </label>
                    <input
                        placeholder="Cari di field apa saja..."
                        value={product}
                        onChange={e => setProduct(e.target.value)}
                    />
                </div>

                <button
                    onClick={fetchData}
                    style={{ alignSelf: 'flex-end' }}
                >
                    🔄 Refresh
                </button>

                <button
                    onClick={handleExport}
                    style={{
                        alignSelf: 'flex-end',
                        background: '#16a34a',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: 8,
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    📥 Export Excel
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
                                    'Detail',
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

                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{
                                        padding: 20,
                                        textAlign: 'center',
                                        color: '#9ca3af'
                                    }}>
                                        No activity found
                                    </td>
                                </tr>
                            )}

                            {filtered.map((a: any) => (
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

                                    <td style={{ padding: 12, minWidth: 260 }}>
                                        {fieldValuesArray(a)
                                            .filter((f: any) => f.type !== 'PHOTO')
                                            .map((f: any) => (
                                                <div key={f.label} style={{ fontSize: 12.5 }}>
                                                    <span style={{ color: '#9ca3af' }}>{f.label}: </span>
                                                    <span>{String(f.value)}</span>
                                                </div>
                                            ))}
                                    </td>

                                    <td style={{ padding: 12 }}>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {fieldValuesArray(a)
                                                .filter((f: any) => f.type === 'PHOTO')
                                                .map((f: any) => (
                                                    <a key={f.label} href={`${UPLOADS_ORIGIN}${f.value}`} target="_blank" rel="noopener noreferrer">
                                                        <img
                                                            src={`${UPLOADS_ORIGIN}${f.value}`}
                                                            style={{
                                                                width: 40,
                                                                height: 40,
                                                                objectFit: 'cover',
                                                                borderRadius: 8
                                                            }}
                                                        />
                                                    </a>
                                                ))}
                                            {fieldValuesArray(a).filter((f: any) => f.type === 'PHOTO').length === 0 && '-'}
                                        </div>
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
