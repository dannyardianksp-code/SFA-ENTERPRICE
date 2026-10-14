'use client'

import { useEffect, useState } from 'react'

import { API_BASE_URL } from '@/app/utils/api-config'
import { SIDEBAR_MENU_GROUPS, isMenuVisibleByDefault } from '@/app/utils/sidebar-menu'

// Harus sama persis dengan CONFIGURABLE_ROLES di backend
// (roleMenuAccess.controller.js) -- tidak ada tempat berbagi konstanta
// role antara Backend dan sfa-web di codebase ini, jadi ditulis ulang
// di sini mengikuti pola yang sudah ada di seluruh halaman admin lain.
// - ADMINISTRATOR tidak termasuk -- selalu lihat semua menu.
// - MD, SPG, SALES tidak termasuk -- ketiga role ini defaultnya TIDAK
//   PUNYA akses web sama sekali (can_access_web default false, cuma
//   dibuka manual per-user lewat form Edit User), jadi percuma diatur
//   Menu Access-nya.
const CONFIGURABLE_ROLES = [
    'SUPERVISOR',
    'MANAGER',
    'REGIONAL MANAGER',
    'GENERAL MANAGER',
]

// Kunci access disimpan per "<channel_id>|<role>" -- TIDAK ADA baris
// "semua channel", tiap channel ngatur sendiri-sendiri dari titik awal
// yang sama (default per grup), persis seperti tiap role sebelumnya.
type AccessByChannelRole = Record<string, Record<string, boolean>>

type ChannelRow = { id: number; code: string; name: string }

const accessKey = (channelId: number | string, role: string) => `${channelId}|${role}`

const buildDefaultAccess = (channels: ChannelRow[]): AccessByChannelRole => {
    const acc: AccessByChannelRole = {}

    channels.forEach((ch) => {
        CONFIGURABLE_ROLES.forEach((role) => {
            acc[accessKey(ch.id, role)] = {}

            SIDEBAR_MENU_GROUPS.forEach((group) => {
                group.items.forEach((item) => {
                    acc[accessKey(ch.id, role)][item.key] = isMenuVisibleByDefault(group.key)
                })
            })
        })
    })

    return acc
}

export default function MenuAccessPage() {

    const [role, setRole] = useState('')
    const [loading, setLoading] = useState(true)
    const [channels, setChannels] = useState<ChannelRow[]>([])
    const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null)
    const [selectedRole, setSelectedRole] = useState('SUPERVISOR')
    const [access, setAccess] = useState<AccessByChannelRole>({})
    const [saving, setSaving] = useState(false)
    const [savedFor, setSavedFor] = useState<string | null>(null)

    useEffect(() => {
        setRole(localStorage.getItem('role') || '')
    }, [])

    useEffect(() => {

        const fetchAccess = async () => {

            setLoading(true)

            const token = localStorage.getItem('token')

            const [chRes, accessRes] = await Promise.all([
                fetch(`${API_BASE_URL}/channels`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`${API_BASE_URL}/role-menu-access`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ])

            if (!chRes.ok) {
                setLoading(false)
                return
            }

            const chData: ChannelRow[] = await chRes.json()
            setChannels(chData)
            setSelectedChannelId((prev) => prev ?? chData[0]?.id ?? null)

            if (!accessRes.ok) {
                setAccess(buildDefaultAccess(chData))
                setLoading(false)
                return
            }

            const rows: { channel_id: number; role: string; menu_key: string; visible: boolean }[] =
                await accessRes.json()

            // Mulai dari default per grup -- baris dari server cuma
            // override (lihat migration 025-add-channel-id-to-role-menu-overrides.sql),
            // bukan matriks penuh, jadi harus digabung di sini supaya
            // checkbox-nya nunjukin status SEBENARNYA (default ATAU
            // override), bukan cuma yang eksplisit tersimpan.
            const merged = buildDefaultAccess(chData)

            rows.forEach((row) => {
                const key = accessKey(row.channel_id, row.role)
                if (!merged[key]) return
                merged[key][row.menu_key] = !!row.visible
            })

            setAccess(merged)
            setLoading(false)

        }

        fetchAccess()

    }, [])

    const currentKey = selectedChannelId !== null ? accessKey(selectedChannelId, selectedRole) : ''

    const toggleItem = (menuKey: string) => {

        if (!currentKey) return

        setAccess((prev) => ({
            ...prev,
            [currentKey]: {
                ...prev[currentKey],
                [menuKey]: !prev[currentKey]?.[menuKey],
            },
        }))

        setSavedFor(null)

    }

    const handleSave = async () => {

        if (selectedChannelId === null) return

        setSaving(true)

        const token = localStorage.getItem('token')

        const items = SIDEBAR_MENU_GROUPS.flatMap((group) =>
            group.items.map((item) => ({
                menu_key: item.key,
                visible: !!access[currentKey]?.[item.key],
            }))
        )

        try {

            const res = await fetch(`${API_BASE_URL}/role-menu-access`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    channel_id: selectedChannelId,
                    role: selectedRole,
                    items,
                }),
            })

            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                alert(err.message || 'Gagal menyimpan menu access')
                return
            }

            setSavedFor(currentKey)

        } finally {

            setSaving(false)

        }

    }

    if (role && role !== 'ADMINISTRATOR') {
        return (
            <div className="p-6">
                <div className="bg-white rounded-3xl p-6 shadow-lg">
                    <p className="text-slate-600">
                        Hanya administrator yang boleh mengatur Menu Access.
                    </p>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="p-6">
                <div className="bg-white rounded-3xl p-6 shadow-lg">
                    <p className="text-slate-500">Memuat...</p>
                </div>
            </div>
        )
    }

    if (channels.length === 0) {
        return (
            <div className="p-6">
                <div className="bg-white rounded-3xl p-6 shadow-lg">
                    <p className="text-slate-500">
                        Belum ada Channel -- tambah Channel dulu sebelum mengatur Menu Access.
                    </p>
                </div>
            </div>
        )
    }

    const roleAccess = access[currentKey] || {}

    return (
        <div className="p-6 flex flex-col lg:flex-row gap-6">

            {/* LEFT: CONFIG */}
            <div className="flex-1">

                <div className="bg-white rounded-3xl p-6 shadow-lg mb-5">
                    <h1 className="text-3xl font-bold text-slate-900">🔐 Menu Access</h1>
                    <p className="text-slate-500 mt-2">
                        Atur menu mana yang keliatan di sidebar per channel &amp; role --
                        tiap channel ngatur sendiri, tidak ada aturan bersama.
                    </p>
                </div>

                <div className="mb-1 text-xs font-bold text-slate-400 uppercase tracking-wide">
                    1. Channel
                </div>
                <div className="flex gap-2 mb-4 flex-wrap">
                    {channels.map((ch) => (
                        <button
                            key={ch.id}
                            onClick={() => { setSelectedChannelId(ch.id); setSavedFor(null) }}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold border ${ch.id === selectedChannelId
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                }`}
                        >
                            {ch.name}
                        </button>
                    ))}
                </div>

                <div className="mb-1 text-xs font-bold text-slate-400 uppercase tracking-wide">
                    2. Jabatan
                </div>
                <div className="flex gap-2 mb-2 flex-wrap">
                    {CONFIGURABLE_ROLES.map((r) => (
                        <button
                            key={r}
                            onClick={() => { setSelectedRole(r); setSavedFor(null) }}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold border ${r === selectedRole
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>

                <p className="text-xs text-slate-400 mb-5">
                    ADMINISTRATOR selalu lihat semua menu -- gak bisa diubah di sini.
                </p>

                {SIDEBAR_MENU_GROUPS.map((group) => (
                    <div
                        key={group.key}
                        className="bg-white rounded-2xl shadow p-2 mb-4"
                    >
                        <div className="text-xs font-bold text-slate-400 uppercase px-3 pt-2 pb-1">
                            {group.label}
                        </div>

                        {group.items.map((item) => {
                            const Icon = item.icon
                            const checked = !!roleAccess[item.key]

                            return (
                                <div
                                    key={item.key}
                                    onClick={() => toggleItem(item.key)}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-50"
                                >
                                    <div
                                        className={`w-5 h-5 rounded-md border-[1.8px] flex items-center justify-center flex-shrink-0 ${checked
                                            ? 'bg-blue-600 border-blue-600'
                                            : 'bg-white border-slate-300'
                                            }`}
                                    >
                                        {checked && (
                                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                <path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </div>
                                    <Icon size={17} />
                                    <div className="text-sm font-semibold text-slate-900">
                                        {item.label}
                                    </div>
                                </div>
                            )
                        })}

                    </div>
                ))}

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-6 py-3 rounded-xl font-bold text-sm"
                >
                    {saving ? 'Menyimpan...' : 'Simpan Menu Access'}
                </button>

                {savedFor === currentKey && (
                    <p className="text-sm font-semibold text-green-600 mt-3">
                        ✅ Tersimpan buat {channels.find((c) => c.id === selectedChannelId)?.name} -- {selectedRole}
                    </p>
                )}

            </div>

            {/* RIGHT: LIVE PREVIEW */}
            <div className="w-full lg:w-72 flex-shrink-0 bg-slate-950 rounded-3xl p-5 flex flex-col gap-5 self-start">

                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Preview sidebar -- {channels.find((c) => c.id === selectedChannelId)?.name} -- {selectedRole}
                </div>

                <div className="border-b border-slate-800 pb-4">
                    <div className="text-white font-bold text-lg">SRA PRO</div>
                    <div className="text-slate-600 text-[11px] mt-0.5">Sales Route Automation</div>
                </div>

                <div className="flex flex-col gap-4">
                    {SIDEBAR_MENU_GROUPS.map((group) => {
                        const visibleItems = group.items.filter((item) => !!roleAccess[item.key])

                        if (visibleItems.length === 0) return null

                        return (
                            <div key={group.key}>
                                <div className="text-[10px] font-bold text-slate-600 uppercase mb-2">
                                    {group.label}
                                </div>
                                <div className="flex flex-col gap-1">
                                    {visibleItems.map((item) => {
                                        const Icon = item.icon
                                        return (
                                            <div
                                                key={item.key}
                                                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-slate-300"
                                            >
                                                <Icon size={16} />
                                                <div className="text-[13px]">{item.label}</div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>

            </div>

        </div>
    )

}
