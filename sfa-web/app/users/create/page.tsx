'use client'

import {
    useState,
    useEffect
} from 'react'

import {
    useRouter
} from 'next/navigation'

import { API_BASE_URL } from '@/app/utils/api-config'

// Role di atas key ini yang mengawasi -- dipakai untuk filter kandidat
// atasan dan untuk menampilkan/menyembunyikan kartu Hierarchy Assignment.
// GENERAL MANAGER tidak punya entry (puncak rantai, tidak butuh atasan).
const ROLE_ABOVE: Record<string, string> = {
    MD: 'SUPERVISOR',
    SUPERVISOR: 'MANAGER',
    MANAGER: 'REGIONAL MANAGER',
    'REGIONAL MANAGER': 'GENERAL MANAGER',
}

export default function CreateUserPage() {

    const router =
        useRouter()

    // ======================
    // STATE
    // ======================

    const [areas, setAreas] =
        useState<any[]>([])

    const [channels, setChannels] =
        useState<any[]>([])

    const [supervisors, setSupervisors] =
        useState<any[]>([])

    const [form, setForm] =
        useState({

            code: '',

            name: '',

            email: '',

            password: '',

            role: 'MD',

            channel_id: '',

            supervisor_id: '',

            // Default ikut role awal (MD terkunci dari web) -- admin
            // tetap bisa override lewat checkbox sebelum submit.
            can_access_web: false

        })

    // Terpisah dari `form` -- multi-select checkbox, bukan satu value
    // teks seperti field lain yang lewat handleChange.
    const [areaIds, setAreaIds] =
        useState<number[]>([])

    const toggleArea = (id: number) => {

        setAreaIds((sekarang) =>

            sekarang.includes(id)
                ? sekarang.filter((a) => a !== id)
                : [...sekarang, id]

        )

    }

    // Semua area sudah terpilih -> checkbox "Pilih Semua" tercentang.
    // areas.length > 0 dicek supaya tidak keliru tercentang saat master
    // data area belum selesai di-fetch (array kosong).
    const semuaAreaTerpilih =
        areas.length > 0 &&
        areas.every((a: any) => areaIds.includes(a.id))

    const toggleAllAreas = () => {

        setAreaIds(
            semuaAreaTerpilih
                ? []
                : areas.map((a: any) => a.id)
        )

    }

    // ======================
    // FETCH MASTER DATA
    // ======================

    useEffect(() => {

        const fetchMasters =
            async () => {

                try {

                    const token =
                        localStorage.getItem(
                            'token'
                        )

                    // ======================
                    // VALIDASI TOKEN
                    // ======================

                    if (!token) {

                        alert(
                            'Session habis, silahkan login ulang'
                        )

                        router.push('/login')

                        return

                    }

                    // ======================
                    // AREA
                    // ======================

                    const areaRes =
                        await fetch(

                            `${API_BASE_URL}/areas`,

                            {

                                headers: {

                                    Authorization:
                                        `Bearer ${token}`

                                }

                            }

                        )

                    const areaData =
                        await areaRes.json()

                    setAreas(

                        Array.isArray(areaData.data)

                            ?

                            areaData.data

                            :

                            Array.isArray(areaData)

                                ?

                                areaData

                                :

                                []

                    )

                    // ======================
                    // CHANNEL
                    // ======================

                    const channelRes =
                        await fetch(

                            `${API_BASE_URL}/channels`,

                            {

                                headers: {

                                    Authorization:
                                        `Bearer ${token}`

                                }

                            }

                        )

                    const channelData =
                        await channelRes.json()

                    setChannels(

                        Array.isArray(channelData.data)

                            ?

                            channelData.data

                            :

                            Array.isArray(channelData)

                                ?

                                channelData

                                :

                                []

                    )

                    // ======================
                    // USERS
                    // ======================

                    const userRes =
                        await fetch(

                            `${API_BASE_URL}/users`,

                            {

                                headers: {

                                    Authorization:
                                        `Bearer ${token}`

                                }

                            }

                        )

                    const userData =
                        await userRes.json()

                    console.log(
                        'USERS:',
                        userData
                    )

                    // NORMALIZE ARRAY
                    const users =

                        Array.isArray(userData.data)

                            ?

                            userData.data

                            :

                            Array.isArray(userData)

                                ?

                                userData

                                :

                                []

                    // ======================
                    // ROLE ABOVE (peta di atas komponen)
                    // ======================

                    const roleAbove =
                        ROLE_ABOVE[form.role]

                    const filteredUsers =

                        roleAbove

                            ?

                            users.filter(

                                (u: any) =>

                                    u.role === roleAbove

                            )

                            :

                            []

                    setSupervisors(
                        filteredUsers
                    )

                }

                catch (err) {

                    console.log(err)

                }

            }

        fetchMasters()

    }, [form.role])

    // ======================
    // HANDLE CHANGE
    // ======================

    const handleChange =
        (e: any) => {

            setForm({

                ...form,

                [e.target.name]:
                    e.target.value,

                // Ganti role -> ganti default can_access_web (MD
                // terkunci, role lain terbuka). Admin masih bisa
                // override lewat checkbox sesudahnya.
                ...(e.target.name === 'role' && {
                    can_access_web: e.target.value !== 'MD'
                })

            })

        }

    const handleCanAccessWebChange =
        (e: any) => {

            setForm({

                ...form,

                can_access_web:
                    e.target.checked

            })

        }

    // ======================
    // HANDLE SUBMIT
    // ======================

    const handleSubmit =
        async (e: any) => {

            e.preventDefault()

            try {

                const token =
                    localStorage.getItem(
                        'token'
                    )

                if (!token) {

                    alert(
                        'Session habis'
                    )

                    router.push('/login')

                    return

                }

                const payload = {

                    ...form,

                    area_ids: areaIds,

                    supervisor_id:

                        form.supervisor_id || null

                }

                const res =
                    await fetch(

                        `${API_BASE_URL}/users`,

                        {

                            method: 'POST',

                            headers: {

                                'Content-Type':
                                    'application/json',

                                Authorization:
                                    `Bearer ${token}`

                            },

                            body:
                                JSON.stringify(
                                    payload
                                )

                        }

                    )

                const data =
                    await res.json()

                if (!res.ok) {

                    alert(

                        data.error ||

                        'Gagal create user'

                    )

                    return

                }

                alert(
                    'User berhasil dibuat'
                )

                router.push('/users')

            }

            catch (err) {

                console.log(err)

                alert(
                    'Terjadi kesalahan'
                )

            }

        }

    // ======================
    // RENDER
    // ======================
    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">

            {/* HEADER */}
            <div className="bg-white rounded-3xl p-6 shadow-lg">
                <h1 className="text-3xl font-bold text-slate-900">
                    👤 Create User
                </h1>
                <p className="text-slate-500 mt-1">
                    Add new user to system access management
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* BASIC INFO */}
                <div className="bg-white rounded-3xl p-6 shadow-lg space-y-4">

                    <h2 className="font-bold text-slate-900">
                        🧾 Basic Information
                    </h2>

                    <div className="grid md:grid-cols-2 gap-4">

                        <div>
                            <label className="text-sm text-slate-500">Code</label>
                            <input
                                name="code"
                                value={form.code}
                                onChange={handleChange}
                                className="w-full mt-2 border rounded-xl p-3"
                            />
                        </div>

                        <div>
                            <label className="text-sm text-slate-500">Name</label>
                            <input
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                className="w-full mt-2 border rounded-xl p-3"
                            />
                        </div>

                        <div>
                            <label className="text-sm text-slate-500">Email</label>
                            <input
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                className="w-full mt-2 border rounded-xl p-3"
                            />
                        </div>

                    </div>

                    <div>
                        <label className="text-sm text-slate-500">Password</label>
                        <input
                            type="password"
                            name="password"
                            value={form.password}
                            onChange={handleChange}
                            className="w-full mt-2 border rounded-xl p-3"
                        />
                    </div>

                </div>

                {/* ROLE & STRUCTURE */}
                <div className="bg-white rounded-3xl p-6 shadow-lg space-y-4">

                    <h2 className="font-bold text-slate-900">
                        🧠 Role & Organization
                    </h2>

                    <div>
                        <label className="text-sm text-slate-500">Role</label>
                        <select
                            name="role"
                            value={form.role}
                            onChange={handleChange}
                            className="w-full mt-2 border rounded-xl p-3"
                        >
                            <option value="ADMINISTRATOR">ADMINISTRATOR</option>
                            <option value="GENERAL MANAGER">GENERAL MANAGER</option>
                            <option value="REGIONAL MANAGER">REGIONAL MANAGER</option>
                            <option value="MANAGER">MANAGER</option>
                            <option value="SUPERVISOR">SUPERVISOR</option>
                            <option value="MD">MD</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-sm text-slate-500">
                            Area {areaIds.length > 0 && `(${areaIds.length} dipilih)`}
                        </label>

                        <label className="mt-2 flex items-center gap-2 text-sm font-medium text-blue-600 cursor-pointer w-fit">
                            <input
                                type="checkbox"
                                checked={semuaAreaTerpilih}
                                onChange={toggleAllAreas}
                            />
                            Pilih Semua Area
                        </label>

                        <div className="mt-2 border rounded-xl p-3 grid sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">

                            {areas.map((a: any) => (
                                <label
                                    key={a.id}
                                    className="flex items-center gap-2 text-sm text-slate-700"
                                >
                                    <input
                                        type="checkbox"
                                        checked={areaIds.includes(a.id)}
                                        onChange={() => toggleArea(a.id)}
                                    />
                                    {a.name}
                                </label>
                            ))}

                        </div>
                    </div>

                    <div>
                        <label className="text-sm text-slate-500">Channel</label>
                        <select
                            name="channel_id"
                            value={form.channel_id}
                            onChange={handleChange}
                            className="w-full mt-2 border rounded-xl p-3"
                        >
                            <option value="">Select Channel</option>
                            {channels.map((c: any) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="flex items-center gap-3 cursor-pointer w-fit">
                            <span className="relative inline-block w-11 h-6 shrink-0">
                                <input
                                    type="checkbox"
                                    checked={form.can_access_web}
                                    onChange={handleCanAccessWebChange}
                                    className="peer sr-only"
                                />
                                <span className="absolute inset-0 rounded-full bg-slate-300 peer-checked:bg-blue-600 transition-colors" />
                                <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                            </span>
                            <span className="text-sm text-slate-700">Web Access</span>
                        </label>
                    </div>

                </div>

                {/* HIERARCHY */}
                {ROLE_ABOVE[form.role] && (
                    <div className="bg-white rounded-3xl p-6 shadow-lg space-y-4">

                        <h2 className="font-bold text-slate-900">
                            👥 Hierarchy Assignment
                        </h2>

                        <div>
                            <label className="text-sm text-slate-500">
                                {ROLE_ABOVE[form.role]}
                            </label>

                            <select
                                name="supervisor_id"
                                value={form.supervisor_id}
                                onChange={handleChange}
                                className="w-full mt-2 border rounded-xl p-3"
                            >
                                <option value="">
                                    Select {ROLE_ABOVE[form.role]}
                                </option>

                                {supervisors.map((s: any) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                    </div>
                )}

                {/* SUBMIT */}
                <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold shadow"
                >
                    Save User
                </button>

            </form>

        </div>
    )

}