'use client'

import { useEffect, useState } from 'react'

import { API_BASE_URL } from '@/app/utils/api-config'
import { SIDEBAR_MENU_GROUPS, isMenuVisibleByDefault } from '@/app/utils/sidebar-menu'
import { MOBILE_MENU_GROUPS, isMobileMenuVisibleByDefault } from '@/app/utils/mobile-menu'

type Platform = 'WEB' | 'MOBILE'

// Harus sama persis dengan CONFIGURABLE_ROLES_BY_PLATFORM di backend
// (roleMenuAccess.controller.js) -- tidak ada tempat berbagi konstanta
// role antara Backend dan sfa-web di codebase ini, jadi ditulis ulang
// di sini mengikuti pola yang sudah ada di seluruh halaman admin lain.
// - ADMINISTRATOR tidak pernah termasuk, di platform MANA PUN --
//   selalu lihat semua menu (sidebar penuh di web, menu "Setting"
//   tersendiri di mobile), tidak bisa diatur dari sini sama sekali.
// - Web: MD/SPG/SALES tidak termasuk -- ketiga role ini defaultnya
//   TIDAK PUNYA akses web sama sekali (can_access_web default false,
//   cuma dibuka manual per-user lewat form Edit User).
// - Mobile: SEMUA role selain ADMINISTRATOR termasuk -- tidak cuma
//   role lapangan, SUPERVISOR ke atas juga bisa login & dikasih menu
//   mobile sendiri.
const CONFIGURABLE_ROLES_BY_PLATFORM: Record<Platform, string[]> = {
    WEB: ['SUPERVISOR', 'MANAGER', 'REGIONAL MANAGER', 'GENERAL MANAGER'],
    MOBILE: ['SPG', 'MD', 'SALES', 'SUPERVISOR', 'MANAGER', 'REGIONAL MANAGER', 'GENERAL MANAGER'],
}

// Kunci access disimpan per "<platform>|<channel_id>|<role>" -- TIDAK
// ADA baris "semua channel", tiap channel ngatur sendiri-sendiri dari
// titik awal yang sama (default per grup).
type AccessByKey = Record<string, Record<string, boolean>>

type ChannelRow = { id: number; code: string; name: string }

const accessKey = (platform: Platform, channelId: number | string, role: string) =>
    `${platform}|${channelId}|${role}`

const buildDefaultAccess = (channels: ChannelRow[]): AccessByKey => {
    const acc: AccessByKey = {}

    channels.forEach((ch) => {

        CONFIGURABLE_ROLES_BY_PLATFORM.WEB.forEach((role) => {
            const key = accessKey('WEB', ch.id, role)
            acc[key] = {}
            SIDEBAR_MENU_GROUPS.forEach((group) => {
                group.items.forEach((item) => {
                    acc[key][item.key] = isMenuVisibleByDefault(group.key)
                })
            })
        })

        CONFIGURABLE_ROLES_BY_PLATFORM.MOBILE.forEach((role) => {
            const key = accessKey('MOBILE', ch.id, role)
            acc[key] = {}
            MOBILE_MENU_GROUPS.forEach((group) => {
                group.items.forEach((item) => {
                    acc[key][item.key] = isMobileMenuVisibleByDefault()
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
    const [selectedPlatform, setSelectedPlatform] = useState<Platform>('WEB')
    const [selectedRole, setSelectedRole] = useState('SUPERVISOR')
    const [access, setAccess] = useState<AccessByKey>({})
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

            const rows: { platform: Platform; channel_id: number; role: string; menu_key: string; visible: boolean }[] =
                await accessRes.json()

            // Mulai dari default per grup -- baris dari server cuma
            // override (lihat migration 026-add-platform-to-role-menu-overrides.sql),
            // bukan matriks penuh, jadi harus digabung di sini supaya
            // checkbox-nya nunjukin status SEBENARNYA (default ATAU
            // override), bukan cuma yang eksplisit tersimpan.
            const merged = buildDefaultAccess(chData)

            rows.forEach((row) => {
                const key = accessKey(row.platform, row.channel_id, row.role)
                if (!merged[key]) return
                merged[key][row.menu_key] = !!row.visible
            })

            setAccess(merged)
            setLoading(false)

        }

        fetchAccess()

    }, [])

    const configurableRoles = CONFIGURABLE_ROLES_BY_PLATFORM[selectedPlatform]
    const menuGroups = selectedPlatform === 'WEB' ? SIDEBAR_MENU_GROUPS : MOBILE_MENU_GROUPS

    const currentKey = selectedChannelId !== null
        ? accessKey(selectedPlatform, selectedChannelId, selectedRole)
        : ''

    const switchPlatform = (platform: Platform) => {
        setSelectedPlatform(platform)
        // Role yang lagi dipilih mungkin tidak ada di platform baru
        // (mis. MD tidak ada di WEB) -- selalu jatuh ke role pertama
        // platform itu supaya tidak nyangkut di role yang tidak valid.
        setSelectedRole(CONFIGURABLE_ROLES_BY_PLATFORM[platform][0])
        setSavedFor(null)
    }

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

        const items = menuGroups.flatMap((group) =>
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
                    platform: selectedPlatform,
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
    const selectedChannelName = channels.find((c) => c.id === selectedChannelId)?.name

    return (
        <div className="p-6 flex flex-col lg:flex-row gap-6">

            {/* LEFT: CONFIG */}
            <div className="flex-1">

                <div className="bg-white rounded-3xl p-6 shadow-lg mb-5">
                    <h1 className="text-3xl font-bold text-slate-900">🔐 Menu Access</h1>
                    <p className="text-slate-500 mt-2">
                        Atur menu yang keliatan per platform, channel &amp; jabatan --
                        tiap channel ngatur sendiri, tidak ada aturan bersama.
                    </p>
                </div>

                <div className="mb-1 text-xs font-bold text-slate-400 uppercase tracking-wide">
                    1. Platform
                </div>
                <div className="flex gap-2 mb-4 flex-wrap">
                    {(['WEB', 'MOBILE'] as Platform[]).map((p) => (
                        <button
                            key={p}
                            onClick={() => switchPlatform(p)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold border ${p === selectedPlatform
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                }`}
                        >
                            {p === 'WEB' ? '💻 Web' : '📱 Mobile'}
                        </button>
                    ))}
                </div>

                <div className="mb-1 text-xs font-bold text-slate-400 uppercase tracking-wide">
                    2. Channel
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
                    3. Jabatan
                </div>
                <div className="flex gap-2 mb-2 flex-wrap">
                    {configurableRoles.map((r) => (
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
                    ADMINISTRATOR tidak ada di pilihan Jabatan manapun -- selalu lihat
                    semua menu di web, dan dapat menu &quot;Setting&quot; tersendiri di mobile,
                    tidak bisa diatur dari sini.
                </p>

                {menuGroups.map((group) => (
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
                        ✅ Tersimpan buat {selectedPlatform === 'WEB' ? 'Web' : 'Mobile'} -- {selectedChannelName} -- {selectedRole}
                    </p>
                )}

            </div>

            {/* RIGHT: LIVE PREVIEW */}
            {selectedPlatform === 'WEB' ? (

                <div className="w-full lg:w-72 flex-shrink-0 bg-slate-950 rounded-3xl p-5 flex flex-col gap-5 self-start">

                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                        Preview sidebar -- {selectedChannelName} -- {selectedRole}
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

            ) : (

                <div className="w-full lg:w-72 flex-shrink-0 self-start">

                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2 text-center">
                        Preview menu mobile -- {selectedChannelName} -- {selectedRole}
                    </div>

                    <div className="bg-white border-[6px] border-slate-900 rounded-[32px] shadow-xl overflow-hidden">

                        <div className="bg-slate-50 px-4 pt-2 pb-2 flex items-center justify-between text-[10px] font-bold text-slate-900">
                            <span>9:41</span>
                            <span>●●● 100%</span>
                        </div>

                        <div className="bg-slate-50 px-4 pb-3">
                            <div className="text-base font-bold text-slate-900">Menu Utama</div>
                        </div>

                        <div className="bg-slate-50 p-3 grid grid-cols-2 gap-2.5 min-h-[260px] content-start">

                            {MOBILE_MENU_GROUPS.flatMap((g) => g.items)
                                .filter((item) => !!roleAccess[item.key])
                                .map((item) => {
                                    const Icon = item.icon
                                    return (
                                        <div
                                            key={item.key}
                                            className="bg-white rounded-2xl p-3 flex flex-col items-center gap-1.5 shadow-sm"
                                        >
                                            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                                <Icon size={18} />
                                            </div>
                                            <div className="text-[11px] font-semibold text-slate-900 text-center">
                                                {item.label}
                                            </div>
                                        </div>
                                    )
                                })}

                            {MOBILE_MENU_GROUPS.flatMap((g) => g.items).every((item) => !roleAccess[item.key]) && (
                                <div className="col-span-2 text-center text-xs text-slate-400 py-10">
                                    Belum ada menu dipilih
                                </div>
                            )}

                        </div>

                    </div>

                </div>

            )}

        </div>
    )

}
