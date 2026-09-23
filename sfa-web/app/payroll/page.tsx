'use client'

import { useEffect, useMemo, useState } from 'react'

import { API_BASE_URL } from '@/app/utils/api-config'

type PayrollRow = {
    id: number
    name: string
    role: string
    area: { id: number; code: string; name: string } | null
    dailyRate: number | null
    hariKerja: number
    hariHadir: number
    total: number
}

type IncentiveMember = {
    userId: number
    name: string
    visited: number
    pct: number
    dapatBonus: boolean
    bonus: number
    penuh: boolean
}

type IncentiveRuleProgress = {
    rule: {
        id: number
        nama: string
        jenis: 'CUSTOMER_GROUP_VISIT' | 'ACTIVITY'
        target: number
        frekuensi: 'HARIAN' | 'BULANAN'
        bonus: number
        ambang_minimal: number
    }
    members: IncentiveMember[]
}

type IncentiveRule = {
    id: number
    nama: string
    jenis: 'CUSTOMER_GROUP_VISIT' | 'ACTIVITY'
    criteria_ids: number[]
    target: number
    frekuensi: 'HARIAN' | 'BULANAN'
    bonus: number
    ambang_minimal: number
    roles: string[]
    aktif: boolean
}

type Option = { id: number; code: string; name: string }

const ROLE_OPTIONS = ['MD', 'SPG', 'SALES', 'SUPERVISOR', 'MANAGER', 'REGIONAL MANAGER', 'GENERAL MANAGER']

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

const currentPeriod = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const periodOptions = () => {
    const opts: { value: string; label: string }[] = []
    const now = new Date()
    for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
        opts.push({ value, label })
    }
    return opts
}

const emptyForm = () => ({
    id: null as number | null,
    nama: '',
    jenis: 'CUSTOMER_GROUP_VISIT' as 'CUSTOMER_GROUP_VISIT' | 'ACTIVITY',
    criteriaIds: [] as number[],
    target: 1,
    frekuensi: 'BULANAN' as 'HARIAN' | 'BULANAN',
    bonus: 0,
    ambangMinimal: 80,
    roles: ['MD'] as string[],
})

export default function PayrollPage() {

    const [role, setRole] = useState('')
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<'payroll' | 'insentif' | 'ringkasan' | 'pengaturan'>('payroll')
    const [period, setPeriod] = useState(currentPeriod())

    const [payroll, setPayroll] = useState<PayrollRow[]>([])
    const [incentiveProgress, setIncentiveProgress] = useState<IncentiveRuleProgress[]>([])
    const [rules, setRules] = useState<IncentiveRule[]>([])
    const [customerGroups, setCustomerGroups] = useState<Option[]>([])
    const [activities, setActivities] = useState<Option[]>([])

    const [savingCell, setSavingCell] = useState<string | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState(emptyForm())
    const [saving, setSaving] = useState(false)
    const [formError, setFormError] = useState('')

    useEffect(() => {
        setRole(localStorage.getItem('role') || '')
    }, [])

    const authHeaders = () => ({
        Authorization: `Bearer ${localStorage.getItem('token')}`,
    })

    const fetchPayroll = async () => {
        const res = await fetch(`${API_BASE_URL}/payroll?period=${period}`, { headers: authHeaders() })
        if (!res.ok) return
        const data = await res.json()
        setPayroll(data.data)
    }

    const fetchIncentiveProgress = async () => {
        const res = await fetch(`${API_BASE_URL}/incentive-rules/progress?period=${period}`, { headers: authHeaders() })
        if (!res.ok) { setIncentiveProgress([]); return }
        const data = await res.json()
        setIncentiveProgress(data.rules)
    }

    const fetchRules = async () => {
        const res = await fetch(`${API_BASE_URL}/incentive-rules`, { headers: authHeaders() })
        if (!res.ok) return
        setRules(await res.json())
    }

    const fetchOptions = async () => {
        const [groupsRes, activitiesRes] = await Promise.all([
            fetch(`${API_BASE_URL}/customer-groups`, { headers: authHeaders() }),
            fetch(`${API_BASE_URL}/activities`, { headers: authHeaders() }),
        ])
        if (groupsRes.ok) setCustomerGroups(await groupsRes.json())
        if (activitiesRes.ok) setActivities(await activitiesRes.json())
    }

    useEffect(() => {

        const load = async () => {
            setLoading(true)
            await Promise.all([fetchPayroll(), fetchIncentiveProgress(), fetchRules(), fetchOptions()])
            setLoading(false)
        }

        load()

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [period])

    // ======================
    // PAYROLL -- inline edit tarif & hari kerja
    // ======================

    const saveDailyRate = async (userId: number, value: number) => {
        setSavingCell(`rate-${userId}`)
        const res = await fetch(`${API_BASE_URL}/payroll/${userId}/rate`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ daily_rate: value }),
        })
        if (res.ok) {
            setPayroll(prev => prev.map(p => p.id === userId ? { ...p, dailyRate: value, total: p.hariHadir * value } : p))
        }
        setSavingCell(null)
    }

    const saveHariKerja = async (userId: number, value: number) => {
        setSavingCell(`hari-${userId}`)
        const res = await fetch(`${API_BASE_URL}/payroll/${userId}/hari-kerja`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ period, hari_kerja: value }),
        })
        if (res.ok) {
            setPayroll(prev => prev.map(p => p.id === userId ? { ...p, hariKerja: value } : p))
        }
        setSavingCell(null)
    }

    // ======================
    // RINGKASAN -- gabungan gaji pokok + total insentif per user
    // ======================

    const ringkasan = useMemo(() => {

        const insentifByUser = new Map<number, number>()

        for (const { members } of incentiveProgress) {
            for (const m of members) {
                insentifByUser.set(m.userId, (insentifByUser.get(m.userId) || 0) + m.bonus)
            }
        }

        return payroll
            .map(p => {
                const insentif = insentifByUser.get(p.id) || 0
                return { id: p.id, name: p.name, gajiPokok: p.total, insentif, total: p.total + insentif }
            })
            .sort((a, b) => b.total - a.total)

    }, [payroll, incentiveProgress])

    const totalGajiPokok = ringkasan.reduce((sum, r) => sum + r.gajiPokok, 0)
    const totalInsentif = ringkasan.reduce((sum, r) => sum + r.insentif, 0)

    // ======================
    // SKEMA INSENTIF -- CRUD
    // ======================

    const openCreate = () => {
        setForm(emptyForm())
        setFormError('')
        setModalOpen(true)
    }

    const openEdit = (rule: IncentiveRule) => {
        setForm({
            id: rule.id,
            nama: rule.nama,
            jenis: rule.jenis,
            criteriaIds: rule.criteria_ids,
            target: rule.target,
            frekuensi: rule.frekuensi,
            bonus: rule.bonus,
            ambangMinimal: rule.ambang_minimal,
            roles: rule.roles,
        })
        setFormError('')
        setModalOpen(true)
    }

    const toggleCriteria = (id: number) => {
        setForm(prev => ({
            ...prev,
            criteriaIds: prev.criteriaIds.includes(id)
                ? prev.criteriaIds.filter(x => x !== id)
                : [...prev.criteriaIds, id],
        }))
    }

    const toggleRole = (r: string) => {
        setForm(prev => ({
            ...prev,
            roles: prev.roles.includes(r) ? prev.roles.filter(x => x !== r) : [...prev.roles, r],
        }))
    }

    const saveRule = async () => {

        if (!form.nama.trim()) return setFormError('Nama skema wajib diisi.')
        if (form.criteriaIds.length === 0) return setFormError('Pilih minimal 1 customer group / activity.')
        if (form.roles.length === 0) return setFormError('Pilih minimal 1 role.')

        setSaving(true)
        setFormError('')

        const payload = {
            nama: form.nama,
            jenis: form.jenis,
            criteria_ids: form.criteriaIds,
            target: Number(form.target),
            frekuensi: form.frekuensi,
            bonus: Number(form.bonus),
            ambang_minimal: Number(form.ambangMinimal),
            roles: form.roles,
        }

        const url = form.id ? `${API_BASE_URL}/incentive-rules/${form.id}` : `${API_BASE_URL}/incentive-rules`
        const method = form.id ? 'PUT' : 'POST'

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify(payload),
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            setFormError(err.message || 'Gagal menyimpan skema.')
            setSaving(false)
            return
        }

        setModalOpen(false)
        setSaving(false)
        await Promise.all([fetchRules(), fetchIncentiveProgress()])

    }

    const toggleRuleAktif = async (id: number) => {
        const res = await fetch(`${API_BASE_URL}/incentive-rules/${id}/toggle`, { method: 'PUT', headers: authHeaders() })
        if (res.ok) {
            await Promise.all([fetchRules(), fetchIncentiveProgress()])
        }
    }

    const deleteRule = async (id: number) => {
        if (!confirm('Hapus skema insentif ini?')) return
        const res = await fetch(`${API_BASE_URL}/incentive-rules/${id}`, { method: 'DELETE', headers: authHeaders() })
        if (res.ok) {
            await Promise.all([fetchRules(), fetchIncentiveProgress()])
        }
    }

    // ======================
    // UI
    // ======================

    if (role && role !== 'ADMINISTRATOR') {
        return (
            <div className="p-6">
                <div className="bg-white rounded-3xl p-6 shadow-lg">
                    <p className="text-slate-600">Hanya administrator yang boleh mengakses Payroll & Insentif.</p>
                </div>
            </div>
        )
    }

    const tabBtn = (key: typeof tab, label: string) => (
        <button
            onClick={() => setTab(key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold shadow ${tab === key ? 'bg-blue-600 text-white' : 'bg-white text-slate-500'}`}
        >
            {label}
        </button>
    )

    const criteriaOptions = form.jenis === 'CUSTOMER_GROUP_VISIT' ? customerGroups : activities

    return (
        <div className="p-6 max-w-[1400px] mx-auto">

            <div className="mb-8">
                <h1 className="text-4xl font-bold text-slate-900">💰 Payroll &amp; Insentif</h1>
                <p className="text-slate-500 mt-2">Rekap gaji harian dan insentif kunjungan/activity</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-6">
                <label className="text-sm font-semibold text-slate-600">Periode</label>
                <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="bg-white rounded-2xl shadow px-4 py-2.5 text-sm font-semibold text-slate-700 border-0"
                >
                    {periodOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </div>

            <div className="flex gap-2 mb-5 flex-wrap">
                {tabBtn('payroll', '🗓️ Payroll Harian')}
                {tabBtn('insentif', '🎯 Insentif')}
                {tabBtn('ringkasan', '📊 Ringkasan Pendapatan')}
                {tabBtn('pengaturan', '⚙️ Pengaturan')}
            </div>

            {loading && <p className="text-slate-400 text-sm mb-4">Memuat...</p>}

            {tab === 'payroll' && (
                <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="p-4 text-sm font-semibold text-slate-500">Nama</th>
                                    <th className="p-4 text-sm font-semibold text-slate-500">Role</th>
                                    <th className="p-4 text-sm font-semibold text-slate-500">Area</th>
                                    <th className="p-4 text-sm font-semibold text-slate-500 text-right">Hari Kerja</th>
                                    <th className="p-4 text-sm font-semibold text-slate-500 text-right">Hari Hadir</th>
                                    <th className="p-4 text-sm font-semibold text-slate-500 text-right">Tarif Harian</th>
                                    <th className="p-4 text-sm font-semibold text-slate-500 text-right">Total Gaji</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {payroll.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50">
                                        <td className="p-4 font-semibold text-slate-900">{p.name}</td>
                                        <td className="p-4 text-slate-600">{p.role}</td>
                                        <td className="p-4 text-slate-600">{p.area?.code || '-'}</td>
                                        <td className="p-4 text-right">
                                            <input
                                                type="number"
                                                defaultValue={p.hariKerja}
                                                key={`hari-${p.id}-${p.hariKerja}`}
                                                onBlur={(e) => {
                                                    const v = Number(e.target.value)
                                                    if (v !== p.hariKerja) saveHariKerja(p.id, v)
                                                }}
                                                className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-right"
                                            />
                                            {savingCell === `hari-${p.id}` && <span className="text-xs text-slate-400 ml-1">...</span>}
                                        </td>
                                        <td className="p-4 text-right text-slate-600">{p.hariHadir}</td>
                                        <td className="p-4 text-right">
                                            <input
                                                type="number"
                                                defaultValue={p.dailyRate ?? ''}
                                                key={`rate-${p.id}-${p.dailyRate}`}
                                                placeholder="belum diset"
                                                onBlur={(e) => {
                                                    const v = Number(e.target.value)
                                                    if (e.target.value !== '' && v !== p.dailyRate) saveDailyRate(p.id, v)
                                                }}
                                                className="w-28 border border-slate-200 rounded-lg px-2 py-1 text-right"
                                            />
                                            {savingCell === `rate-${p.id}` && <span className="text-xs text-slate-400 ml-1">...</span>}
                                        </td>
                                        <td className="p-4 text-right font-bold text-slate-900">{rupiah(p.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {tab === 'insentif' && (
                <div className="flex flex-col gap-6">
                    {incentiveProgress.length === 0 && !loading && (
                        <div className="bg-white rounded-2xl shadow p-4 text-sm text-slate-500">
                            Belum ada skema insentif bulanan yang aktif -- atur di tab Pengaturan.
                        </div>
                    )}
                    {incentiveProgress.map(({ rule, members }) => (
                        <div key={rule.id} className="bg-white rounded-3xl shadow-lg overflow-hidden">
                            <div className="p-5 border-b border-slate-200">
                                <h2 className="font-bold text-slate-900">{rule.nama}</h2>
                                <p className="text-sm text-slate-500 mt-1">
                                    Target {rule.target} -- di bawah {rule.ambang_minimal}% bonus Rp 0, proporsional sampai maksimal {rupiah(rule.bonus)} di 100%.
                                </p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="p-4 text-sm font-semibold text-slate-500">Nama</th>
                                            <th className="p-4 text-sm font-semibold text-slate-500">Progress</th>
                                            <th className="p-4 text-sm font-semibold text-slate-500">Status</th>
                                            <th className="p-4 text-sm font-semibold text-slate-500 text-right">Bonus</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {members.map(m => {
                                            const barColor = m.penuh ? '#16a34a' : (m.dapatBonus ? '#2563eb' : '#94a3b8')
                                            const badge = m.penuh
                                                ? { label: 'Tercapai', cls: 'bg-green-100 text-green-700' }
                                                : m.dapatBonus
                                                    ? { label: 'Bonus Sebagian', cls: 'bg-blue-50 text-blue-700' }
                                                    : { label: 'Belum Tercapai', cls: 'bg-slate-100 text-slate-500' }
                                            return (
                                                <tr key={m.userId} className="hover:bg-slate-50">
                                                    <td className="p-4 font-semibold text-slate-900">{m.name}</td>
                                                    <td className="p-4" style={{ minWidth: 220 }}>
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                                <div style={{ width: `${m.pct}%`, background: barColor }} className="h-full rounded-full" />
                                                            </div>
                                                            <span className="text-sm font-semibold text-slate-600 whitespace-nowrap">{m.visited}/{rule.target} ({m.pct}%)</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                                                    </td>
                                                    <td className={`p-4 text-right font-bold ${m.dapatBonus ? (m.penuh ? 'text-green-600' : 'text-blue-600') : 'text-slate-400'}`}>
                                                        {m.dapatBonus ? rupiah(m.bonus) : '--'}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {tab === 'ringkasan' && (
                <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="p-4 text-sm font-semibold text-slate-500">Nama</th>
                                    <th className="p-4 text-sm font-semibold text-slate-500 text-right">Gaji Pokok</th>
                                    <th className="p-4 text-sm font-semibold text-slate-500 text-right">Insentif</th>
                                    <th className="p-4 text-sm font-semibold text-slate-500 text-right">Total Pendapatan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {ringkasan.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="p-4 font-semibold text-slate-900">{r.name}</td>
                                        <td className="p-4 text-right text-slate-600">{rupiah(r.gajiPokok)}</td>
                                        <td className={`p-4 text-right ${r.insentif > 0 ? 'text-green-600 font-semibold' : 'text-slate-400'}`}>
                                            {r.insentif > 0 ? rupiah(r.insentif) : '--'}
                                        </td>
                                        <td className="p-4 text-right font-bold text-slate-900">{rupiah(r.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 border-t-2 border-slate-200">
                                    <td className="p-4 font-bold text-slate-900">Total Semua</td>
                                    <td className="p-4 text-right font-bold text-slate-900">{rupiah(totalGajiPokok)}</td>
                                    <td className="p-4 text-right font-bold text-slate-900">{rupiah(totalInsentif)}</td>
                                    <td className="p-4 text-right font-bold text-blue-600">{rupiah(totalGajiPokok + totalInsentif)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {tab === 'pengaturan' && (
                <div className="flex flex-col gap-6">

                    <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-slate-200">
                            <div>
                                <h2 className="font-bold text-slate-900">Skema Insentif</h2>
                                <p className="text-sm text-slate-500 mt-1">Bisa lebih dari satu rule aktif sekaligus.</p>
                            </div>
                            <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
                                + Tambah Skema
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="p-4 text-sm font-semibold text-slate-500">Nama</th>
                                        <th className="p-4 text-sm font-semibold text-slate-500">Berlaku Untuk</th>
                                        <th className="p-4 text-sm font-semibold text-slate-500">Jenis</th>
                                        <th className="p-4 text-sm font-semibold text-slate-500 text-right">Target</th>
                                        <th className="p-4 text-sm font-semibold text-slate-500">Frekuensi</th>
                                        <th className="p-4 text-sm font-semibold text-slate-500 text-right">Bonus</th>
                                        <th className="p-4 text-sm font-semibold text-slate-500">Status</th>
                                        <th className="p-4 text-sm font-semibold text-slate-500">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rules.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50">
                                            <td className="p-4 font-semibold text-slate-900">{r.nama}</td>
                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {r.roles.map(rl => (
                                                        <span key={rl} className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">{rl}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-600 text-sm">
                                                {r.jenis === 'CUSTOMER_GROUP_VISIT' ? 'Kunjungan Customer Group' : 'Activity'}
                                            </td>
                                            <td className="p-4 text-right font-bold text-slate-900">{r.target}</td>
                                            <td className="p-4 text-slate-600">{r.frekuensi === 'HARIAN' ? 'Per Hari' : 'Per Bulan'}</td>
                                            <td className="p-4 text-right font-bold text-slate-900">{rupiah(r.bonus)}</td>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => toggleRuleAktif(r.id)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold ${r.aktif ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
                                                >
                                                    {r.aktif ? 'Aktif' : 'Nonaktif'}
                                                </button>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex gap-3">
                                                    <button onClick={() => openEdit(r)} className="text-blue-600 hover:text-blue-700 text-sm font-semibold">Edit</button>
                                                    <button onClick={() => deleteRule(r.id)} className="text-red-600 hover:text-red-700 text-sm font-semibold">Hapus</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {rules.length === 0 && (
                                        <tr><td colSpan={8} className="p-6 text-center text-slate-400">Belum ada skema insentif.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            )}

            {modalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

                        <div className="flex items-center justify-between p-5 border-b border-slate-200">
                            <h3 className="font-bold text-slate-900 text-lg">{form.id ? 'Edit' : 'Tambah'} Skema Insentif</h3>
                            <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
                        </div>

                        <div className="p-5 flex flex-col gap-4">

                            {formError && (
                                <div className="bg-red-50 text-red-700 text-sm rounded-xl p-3">{formError}</div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1.5">Nama Skema</label>
                                <input
                                    type="text"
                                    value={form.nama}
                                    onChange={(e) => setForm({ ...form, nama: e.target.value })}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1.5">Jenis Kriteria</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, jenis: 'CUSTOMER_GROUP_VISIT', criteriaIds: [] })}
                                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border ${form.jenis === 'CUSTOMER_GROUP_VISIT' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'border-slate-200 text-slate-500'}`}
                                    >
                                        🏪 Kunjungan Customer Group
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, jenis: 'ACTIVITY', criteriaIds: [] })}
                                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border ${form.jenis === 'ACTIVITY' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'border-slate-200 text-slate-500'}`}
                                    >
                                        📋 Activity
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1.5">Berlaku untuk Role</label>
                                <div className="flex flex-wrap gap-2">
                                    {ROLE_OPTIONS.map(r => (
                                        <label key={r} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm cursor-pointer">
                                            <input type="checkbox" checked={form.roles.includes(r)} onChange={() => toggleRole(r)} /> {r}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-4 flex flex-col gap-3">
                                <label className="block text-sm font-semibold text-slate-600">
                                    {form.jenis === 'CUSTOMER_GROUP_VISIT' ? 'Customer Group' : 'Jenis Activity'}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {criteriaOptions.map(opt => (
                                        <label key={opt.id} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm cursor-pointer">
                                            <input type="checkbox" checked={form.criteriaIds.includes(opt.id)} onChange={() => toggleCriteria(opt.id)} /> {opt.code || opt.name}
                                        </label>
                                    ))}
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">Target</label>
                                    <input
                                        type="number"
                                        value={form.target}
                                        onChange={(e) => setForm({ ...form, target: Number(e.target.value) })}
                                        className="w-24 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                                    />
                                    <p className="text-xs text-slate-400 mt-1.5">Angka ini juga patokan persentase pencapaian di tab Insentif.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1.5">Frekuensi Penilaian</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, frekuensi: 'HARIAN' })}
                                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border ${form.frekuensi === 'HARIAN' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'border-slate-200 text-slate-500'}`}
                                    >
                                        Per Hari
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, frekuensi: 'BULANAN' })}
                                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border ${form.frekuensi === 'BULANAN' ? 'bg-blue-50 border-blue-600 text-blue-700' : 'border-slate-200 text-slate-500'}`}
                                    >
                                        Per Bulan
                                    </button>
                                </div>
                                {form.frekuensi === 'HARIAN' && (
                                    <p className="text-xs text-amber-600 mt-1.5">
                                        Catatan: progress rule &ldquo;Per Hari&rdquo; belum ditampilkan di tab Insentif (baru dihitung per bulan). Rule tetap tersimpan.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1.5">Nominal Bonus (100% target)</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-500">Rp</span>
                                    <input
                                        type="number"
                                        value={form.bonus}
                                        onChange={(e) => setForm({ ...form, bonus: Number(e.target.value) })}
                                        className="w-32 border border-slate-200 rounded-xl px-3 py-2.5 font-semibold"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1.5">Ambang Minimal Dapat Bonus</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={form.ambangMinimal}
                                        onChange={(e) => setForm({ ...form, ambangMinimal: Number(e.target.value) })}
                                        className="w-24 border border-slate-200 rounded-xl px-3 py-2.5 font-semibold"
                                    />
                                    <span className="text-sm text-slate-500">% dari target</span>
                                </div>
                            </div>

                        </div>

                        <div className="flex justify-end gap-2 p-5 border-t border-slate-200 bg-slate-50">
                            <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600">Batal</button>
                            <button onClick={saveRule} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
                                {saving ? 'Menyimpan...' : 'Simpan Skema'}
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    )

}
