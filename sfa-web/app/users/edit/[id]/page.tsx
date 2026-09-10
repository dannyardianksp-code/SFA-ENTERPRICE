'use client'

import {
    useEffect,
    useState
} from 'react'

import {
    useParams,
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

export default function EditUserPage() {

    const params =
        useParams()


    const router =
        useRouter()

    const [areas, setAreas] =
        useState<any[]>([])

    const [channels, setChannels] =
        useState<any[]>([])

    const [allUsers, setAllUsers] =
        useState<any[]>([])



    const [form, setForm] =
        useState({

            name: '',
            email: '',
            role: '',

            area_ids: [] as number[],

            channel_id: '',

            supervisor_id: '',

            can_access_web: true

        })


    // LOAD USER
    const fetchUser =
        async () => {

            const token =
                localStorage.getItem(
                    'token'
                )

            const res =
                await fetch(

                    `${API_BASE_URL}/users/${params.id}`,

                    {

                        headers: {

                            Authorization:
                                `Bearer ${token}`

                        }

                    }

                )

            const data =
                await res.json()

            setForm({

                name:
                    data.name || '',

                email:
                    data.email || '',

                role:
                    data.role || '',


                area_ids:

                    data.AssignedAreas

                        ? data.AssignedAreas.map(
                            (a: any) => a.id
                        )

                        : []

                ,

                channel_id:
                    data.channel_id || '',

                supervisor_id:
                    data.supervisor_id || '',

                can_access_web:
                    !!data.can_access_web

            })

        }

    const fetchMasters =
        async () => {

            const token =
                localStorage.getItem(
                    'token'
                )

            // AREA
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

                Array.isArray(areaData)

                    ? areaData

                    : []

            )

            // CHANNEL
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

                Array.isArray(channelData)

                    ? channelData

                    : []

            )

            // SUPERVISOR
            const spvRes =
                await fetch(

                    `${API_BASE_URL}/users`,

                    {

                        headers: {

                            Authorization:
                                `Bearer ${token}`

                        }

                    }

                )

            const spvData =
                await spvRes.json()

            setAllUsers(

                Array.isArray(spvData)

                    ? spvData

                    : []

            )

        }

    useEffect(() => {

        fetchMasters()

        fetchUser()

    }, [])

    // HANDLE CHANGE
    const handleChange = (
        e: any
    ) => {

        setForm({

            ...form,

            [e.target.name]:
                e.target.value

        })

    }


    const handleCanAccessWebChange = (
        e: any
    ) => {

        setForm({

            ...form,

            can_access_web:
                e.target.checked

        })

    }


    const toggleArea = (id: number) => {

        setForm((sekarang) => ({

            ...sekarang,

            area_ids:
                sekarang.area_ids.includes(id)
                    ? sekarang.area_ids.filter((a) => a !== id)
                    : [...sekarang.area_ids, id]

        }))

    }

    // Semua area sudah terpilih -> checkbox "Pilih Semua" tercentang.
    // areas.length > 0 dicek supaya tidak keliru tercentang saat master
    // data area belum selesai di-fetch (array kosong).
    const semuaAreaTerpilih =
        areas.length > 0 &&
        areas.every((a: any) => form.area_ids.includes(a.id))

    const toggleAllAreas = () => {

        setForm((sekarang) => ({

            ...sekarang,

            area_ids:
                semuaAreaTerpilih
                    ? []
                    : areas.map((a: any) => a.id)

        }))

    }





    // UPDATE USER
    const handleSubmit =
        async (
            e: any
        ) => {

            e.preventDefault()

            const token =
                localStorage.getItem(
                    'token'
                )

            const res =
                await fetch(

                    `${API_BASE_URL}/users/${params.id}`,

                    {

                        method: 'PUT',

                        headers: {

                            'Content-Type':
                                'application/json',

                            Authorization:
                                `Bearer ${token}`

                        },

                        body:
                            JSON.stringify(form)

                    }

                )

            const data =
                await res.json()

            if (!res.ok) {

                alert(
                    data.error
                )

                return

            }

            alert(
                'User berhasil diupdate'
            )

            router.push('/users')

        }

    const roleAbove =
        ROLE_ABOVE[form.role]

    const hierarchyCandidates =

        roleAbove

            ? allUsers.filter(
                (u: any) => u.role === roleAbove
            )

            : []

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">

            {/* HEADER */}
            <div className="bg-white rounded-3xl p-6 shadow-lg">
                <h1 className="text-3xl font-bold text-slate-900">
                    ✏️ Edit User
                </h1>
                <p className="text-slate-500 mt-1">
                    Update user information, role, and assignment
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

                </div>

                {/* ROLE & ORGANIZATION */}
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

                    <div className="grid md:grid-cols-2 gap-4">

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

                    {/* AREA MULTI */}
                    <div>
                        <label className="text-sm text-slate-500">
                            Area {form.area_ids.length > 0 && `(${form.area_ids.length} dipilih)`}
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
                                        checked={form.area_ids.includes(a.id)}
                                        onChange={() => toggleArea(a.id)}
                                    />
                                    {a.name}
                                </label>
                            ))}

                        </div>
                    </div>

                </div>

                {/* HIERARCHY */}
                {roleAbove && (
                    <div className="bg-white rounded-3xl p-6 shadow-lg space-y-4">

                        <h2 className="font-bold text-slate-900">
                            👥 Hierarchy Assignment
                        </h2>

                        <div>
                            <label className="text-sm text-slate-500">
                                {roleAbove}
                            </label>

                            <select
                                name="supervisor_id"
                                value={form.supervisor_id}
                                onChange={handleChange}
                                className="w-full mt-2 border rounded-xl p-3"
                            >
                                <option value="">Select {roleAbove}</option>
                                {hierarchyCandidates.map((u: any) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                    </div>
                )}

                {/* ACTION */}
                <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold shadow"
                >
                    Update User
                </button>

            </form>

        </div>
    )

}