'use client'

import { useMemo, useState } from 'react'
import { API_BASE_URL } from '@/app/utils/api-config'

const DAY_HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

const MONTH_NAMES_ID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const DAY_NAMES_ID = [
    'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
]

const pad2 = (n: number) => String(n).padStart(2, '0')

const dateKeyOf = (year: number, month0: number, day: number) =>
    `${year}-${pad2(month0 + 1)}-${pad2(day)}`

const formatIndonesianDate = (dateKey: string) => {
    const [y, m, d] = dateKey.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return `${DAY_NAMES_ID[dt.getDay()]}, ${d} ${MONTH_NAMES_ID[m - 1]} ${y}`
}

// Senin di kolom 0 -- Minggu, bukan Minggu di kolom 0 seperti default
// getDay() JS -- biar cocok sama urutan header (Sen..Min) yang lazim
// dipakai kalender kerja di Indonesia.
type GridCell = { day: number; inMonth: boolean; dateKey: string | null }

const buildMonthGrid = (year: number, month0: number): GridCell[][] => {
    const firstOfMonth = new Date(year, month0, 1)
    const startDow = (firstOfMonth.getDay() + 6) % 7
    const daysInMonth = new Date(year, month0 + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month0, 0).getDate()

    const cells: GridCell[] = []

    for (let i = 0; i < startDow; i++) {
        cells.push({
            day: daysInPrevMonth - startDow + 1 + i,
            inMonth: false,
            dateKey: null,
        })
    }

    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, inMonth: true, dateKey: dateKeyOf(year, month0, d) })
    }

    let trailing = 1
    while (cells.length % 7 !== 0) {
        cells.push({ day: trailing, inMonth: false, dateKey: null })
        trailing++
    }

    const weeks: GridCell[][] = []
    for (let i = 0; i < cells.length; i += 7) {
        weeks.push(cells.slice(i, i + 7))
    }
    return weeks
}

interface VisitPlanCalendarProps {
    customers: any[]
    users: any[]
    plans: any[]
    onCreated: () => void
}

type PanelStep = 1 | 2 | 3

export default function VisitPlanCalendar({
    customers,
    users,
    plans,
    onCreated,
}: VisitPlanCalendarProps) {

    const today = new Date()
    const [year, setYear] = useState(today.getFullYear())
    const [month, setMonth] = useState(today.getMonth())

    const [panelOpen, setPanelOpen] = useState(false)
    const [panelDate, setPanelDate] = useState<string | null>(null)
    const [step, setStep] = useState<PanelStep>(1)

    const [searchToko, setSearchToko] = useState('')
    const [searchSales, setSearchSales] = useState('')

    const [selectedToko, setSelectedToko] = useState<any>(null)
    const [selectedSales, setSelectedSales] = useState<any>(null)

    const [saving, setSaving] = useState(false)

    // Ditampilkan di panel biar user tau apa aja yang udah kesimpan
    // dalam sesi "buka panel" ini -- panel sengaja TIDAK ditutup abis
    // Simpan (lihat handleSave), jadi tanpa daftar ini user gak ada
    // sinyal visual kalau assignment sebelumnya beneran nyimpen.
    const [addedThisSession, setAddedThisSession] = useState<
        { tokoName: string; salesName: string }[]
    >([])

    const todayKey = dateKeyOf(today.getFullYear(), today.getMonth(), today.getDate())

    // Plans dikelompokkan per tanggal sekali per render -- tiap sel
    // kalender tinggal ambil dari map ini, bukan filter ulang array
    // penuh 30x (satu per sel).
    const plansByDate = useMemo(() => {
        const map: Record<string, any[]> = {}
        for (const p of plans) {
            if (!p.visit_date) continue
            if (!map[p.visit_date]) map[p.visit_date] = []
            map[p.visit_date].push(p)
        }
        return map
    }, [plans])

    const weeks = useMemo(() => buildMonthGrid(year, month), [year, month])

    const openPanel = (dateKey: string) => {
        setPanelOpen(true)
        setPanelDate(dateKey)
        setStep(1)
        setSearchToko('')
        setSearchSales('')
        setSelectedToko(null)
        setSelectedSales(null)
        setAddedThisSession([])
    }

    const closePanel = () => setPanelOpen(false)

    const goPrevMonth = () => {
        if (month === 0) {
            setMonth(11)
            setYear((y) => y - 1)
        } else {
            setMonth((m) => m - 1)
        }
    }

    const goNextMonth = () => {
        if (month === 11) {
            setMonth(0)
            setYear((y) => y + 1)
        } else {
            setMonth((m) => m + 1)
        }
    }

    const filteredToko = customers.filter((c: any) =>
        (c.name || '').toLowerCase().includes(searchToko.toLowerCase())
    )

    const filteredSales = users.filter((u: any) =>
        (u.name || '').toLowerCase().includes(searchSales.toLowerCase())
    )

    const handleSave = async () => {
        // Guard di awal fungsi, bukan cuma disabled={saving} di tombol --
        // disabled itu telat satu render tick, jadi klik dobel yang
        // super cepat (sebelum re-render sempat jalan) masih bisa
        // lolos dan ngirim 2 request. Cek state di sini langsung
        // memblokirnya di eksekusi kedua, apa pun kecepatan kliknya.
        if (saving) return
        if (!panelDate || !selectedToko || !selectedSales) return

        setSaving(true)

        try {
            const token = localStorage.getItem('token')

            const res = await fetch(`${API_BASE_URL}/visit-plans`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    user_id: selectedSales.id,
                    customer_id: selectedToko.id,
                    visit_date: panelDate,
                }),
            })

            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                alert(err.message || 'Gagal menyimpan visit plan')
                return
            }

            // Panel SENGAJA tidak ditutup -- balik ke step 1 supaya bisa
            // langsung nambah toko+sales lain di tanggal yang sama tanpa
            // klik ulang tanggalnya. alert() dihapus dari alur ini
            // (beda dari form satu-satu): kalau tiap simpan munculin
            // dialog blocking, nambah banyak toko berturut-turut jadi
            // lebih lambat daripada isi form biasa -- kebalikan dari
            // tujuan fitur ini. Daftar addedThisSession di bawah yang
            // jadi sinyal visualnya.
            setAddedThisSession((prev) => [
                ...prev,
                { tokoName: selectedToko.name, salesName: selectedSales.name },
            ])
            setStep(1)
            setSelectedToko(null)
            setSelectedSales(null)
            setSearchToko('')
            setSearchSales('')
            onCreated()
        } catch {
            alert('Gagal menyimpan visit plan')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="bg-white rounded-3xl shadow-lg p-6">

            <div className="flex items-center justify-between mb-5">
                <button
                    onClick={goPrevMonth}
                    className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                >
                    ‹
                </button>

                <div className="text-lg font-bold text-slate-900">
                    {MONTH_NAMES_ID[month]} {year}
                </div>

                <button
                    onClick={goNextMonth}
                    className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                >
                    ›
                </button>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2">
                {DAY_HEADERS.map((label, idx) => (
                    <div
                        key={label}
                        className={`text-center text-xs font-bold uppercase ${idx >= 5 ? 'text-rose-600' : 'text-slate-400'
                            }`}
                    >
                        {label}
                    </div>
                ))}
            </div>

            {weeks.map((week, wIdx) => (
                <div key={wIdx} className="grid grid-cols-7 gap-2 mb-2">
                    {week.map((cell, cIdx) => {
                        const isWeekend = cIdx === 5 || cIdx === 6
                        const isToday = cell.dateKey === todayKey
                        const chips = cell.dateKey ? (plansByDate[cell.dateKey] || []) : []
                        const visibleChips = chips.slice(0, 2)
                        const extraCount = Math.max(0, chips.length - 2)

                        return (
                            <div
                                key={cIdx}
                                onClick={() => cell.inMonth && cell.dateKey && openPanel(cell.dateKey)}
                                className={`rounded-2xl p-2 min-h-[96px] flex flex-col gap-1.5 border-2 ${cell.inMonth ? 'cursor-pointer' : ''
                                    } ${isToday
                                        ? 'border-blue-600'
                                        : isWeekend && cell.inMonth
                                            ? 'border-rose-200'
                                            : 'border-slate-200'
                                    } ${!cell.inMonth
                                        ? 'bg-slate-50'
                                        : isWeekend
                                            ? 'bg-rose-50'
                                            : 'bg-white'
                                    }`}
                            >
                                <div
                                    className={`text-sm font-bold ${!cell.inMonth
                                            ? 'text-slate-300'
                                            : isWeekend
                                                ? 'text-rose-600'
                                                : 'text-slate-900'
                                        }`}
                                >
                                    {cell.day}
                                </div>

                                {visibleChips.map((p: any) => (
                                    <div key={p.id} className="bg-blue-50 rounded-lg px-1.5 py-1">
                                        <div className="text-[11px] font-bold text-blue-700 truncate">
                                            🏪 {p.Customer?.name}
                                        </div>
                                        <div className="text-[10px] text-blue-500 truncate">
                                            👤 {p.User?.name}
                                        </div>
                                    </div>
                                ))}

                                {extraCount > 0 && (
                                    <div className="text-[10px] font-bold text-slate-400">
                                        +{extraCount} lagi
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ))}

            {panelOpen && (
                <>
                    <div
                        onClick={closePanel}
                        className="fixed inset-0 bg-slate-900/45 z-40"
                    />

                    <div className="fixed top-0 right-0 h-screen w-[420px] max-w-[92vw] bg-white shadow-2xl z-50 p-7 flex flex-col gap-5 overflow-y-auto">

                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                                    Tambah Visit Plan
                                </div>
                                <div className="text-lg font-bold text-slate-900 mt-1">
                                    {panelDate ? formatIndonesianDate(panelDate) : ''}
                                </div>
                            </div>
                            <button
                                onClick={closePanel}
                                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                            {[
                                { n: 1, label: 'Toko' },
                                { n: 2, label: 'Sales' },
                                { n: 3, label: 'Konfirmasi' },
                            ].map((s, idx) => {
                                const state =
                                    step === s.n ? 'active' : step > s.n ? 'done' : 'pending'
                                return (
                                    <div key={s.n} className="flex items-center gap-1.5 flex-1">
                                        <div
                                            className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${state === 'active'
                                                    ? 'bg-blue-600 text-white'
                                                    : state === 'done'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-slate-100 text-slate-400'
                                                }`}
                                        >
                                            {s.n}
                                        </div>
                                        <div
                                            className={`text-[11px] font-semibold ${state === 'pending' ? 'text-slate-300' : 'text-slate-600'
                                                }`}
                                        >
                                            {s.label}
                                        </div>
                                        {idx < 2 && <div className="flex-1 h-0.5 bg-slate-200" />}
                                    </div>
                                )
                            })}
                        </div>

                        {addedThisSession.length > 0 && (
                            <div className="bg-green-50 border border-green-200 rounded-2xl p-3.5 flex flex-col gap-2">
                                <div className="text-xs font-bold text-green-700">
                                    ✅ Sudah ditambahkan ({addedThisSession.length})
                                </div>
                                <div className="flex flex-col gap-1">
                                    {addedThisSession.map((a, idx) => (
                                        <div key={idx} className="text-xs text-green-700">
                                            🏪 {a.tokoName} · 👤 {a.salesName}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {step === 1 && (
                            <div className="flex flex-col gap-3">
                                <div className="text-sm font-bold text-slate-900">Pilih Toko</div>
                                <input
                                    type="text"
                                    placeholder="🔍 Cari toko..."
                                    value={searchToko}
                                    onChange={(e) => setSearchToko(e.target.value)}
                                    className="border border-slate-200 rounded-xl px-3.5 py-3 text-sm outline-none"
                                />
                                <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto">
                                    {filteredToko.map((c: any) => (
                                        <div
                                            key={c.id}
                                            onClick={() => {
                                                setSelectedToko(c)
                                                setStep(2)
                                                setSearchSales('')
                                            }}
                                            className="px-3.5 py-3 rounded-xl border border-slate-200 hover:bg-blue-50 hover:border-blue-200 cursor-pointer text-sm font-semibold text-slate-900"
                                        >
                                            🏪 {c.name}
                                        </div>
                                    ))}
                                    {filteredToko.length === 0 && (
                                        <div className="text-sm text-slate-400 px-1 py-2">
                                            Tidak ada toko yang cocok.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-bold text-slate-900">Pilih Sales</div>
                                    <button
                                        onClick={() => {
                                            setStep(1)
                                            setSelectedToko(null)
                                        }}
                                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                                    >
                                        Ganti Toko
                                    </button>
                                </div>
                                <div className="bg-blue-50 rounded-xl px-3.5 py-2.5 text-sm font-bold text-blue-700">
                                    🏪 {selectedToko?.name}
                                </div>
                                <input
                                    type="text"
                                    placeholder="🔍 Cari sales..."
                                    value={searchSales}
                                    onChange={(e) => setSearchSales(e.target.value)}
                                    className="border border-slate-200 rounded-xl px-3.5 py-3 text-sm outline-none"
                                />
                                <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto">
                                    {filteredSales.map((u: any) => (
                                        <div
                                            key={u.id}
                                            onClick={() => {
                                                setSelectedSales(u)
                                                setStep(3)
                                            }}
                                            className="px-3.5 py-3 rounded-xl border border-slate-200 hover:bg-blue-50 hover:border-blue-200 cursor-pointer text-sm font-semibold text-slate-900"
                                        >
                                            👤 {u.name}
                                        </div>
                                    ))}
                                    {filteredSales.length === 0 && (
                                        <div className="text-sm text-slate-400 px-1 py-2">
                                            Tidak ada sales yang cocok.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="flex flex-col gap-4">
                                <div className="text-sm font-bold text-slate-900">Konfirmasi</div>
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-2.5">
                                    <div className="text-sm font-bold text-slate-900">
                                        🏪 {selectedToko?.name}
                                    </div>
                                    <div className="text-sm font-bold text-slate-900">
                                        👤 {selectedSales?.name}
                                    </div>
                                    <div className="text-sm font-bold text-slate-900">
                                        📅 {panelDate ? formatIndonesianDate(panelDate) : ''}
                                    </div>
                                </div>
                                <div className="flex gap-2.5">
                                    <button
                                        onClick={() => {
                                            setStep(2)
                                            setSelectedSales(null)
                                        }}
                                        className="flex-1 bg-white border border-slate-300 rounded-xl py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                    >
                                        ‹ Ganti Sales
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 rounded-xl py-3 text-sm font-bold text-white"
                                    >
                                        {saving ? 'Menyimpan...' : '✅ Simpan'}
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </>
            )}

        </div>
    )
}
