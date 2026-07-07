'use client'

import {
    useEffect,
    useState
} from 'react'

import {
    useParams,
    useRouter
} from 'next/navigation'

export default function EditUserPage() {

    const params =
        useParams()


    const router =
        useRouter()

    const [areas, setAreas] =
        useState<any[]>([])

    const [channels, setChannels] =
        useState<any[]>([])

    const [supervisors, setSupervisors] =
        useState<any[]>([])

    const [managers, setManagers] =
        useState<any[]>([])



    const [form, setForm] =
        useState({

            name: '',
            email: '',
            role: '',

            area_ids: [] as string[],

            channel_id: '',

            supervisor_id: ''

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

                    `http://localhost:1000/api/users/${params.id}`,

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

                    data.Areas

                        ? data.Areas.map(
                            (a: any) => String(a.id)
                        )

                        : []

                ,

                channel_id:
                    data.channel_id || '',

                supervisor_id:
                    data.supervisor_id || ''

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

                    'http://localhost:1000/api/areas',

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

                    'http://localhost:1000/api/channels',

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

                    'http://localhost:1000/api/users',

                    {

                        headers: {

                            Authorization:
                                `Bearer ${token}`

                        }

                    }

                )

            const spvData =
                await spvRes.json()

            setSupervisors(

                Array.isArray(spvData)

                    ?

                    spvData.filter(

                        (u: any) =>

                            u.role ===
                            'SUPERVISOR'

                    )

                    :

                    []

            )

            setManagers(

                Array.isArray(spvData)

                    ?

                    spvData.filter(

                        (u: any) =>

                            u.role ===
                            'MANAGER'

                    )

                    :

                    []

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


    const handleAreaChange =
        (e: any) => {

            const selected =

                Array.from(

                    e.target.selectedOptions

                ).map(

                    (option: any) => option.value

                )

            setForm({

                ...form,

                area_ids:
                    selected

            })

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

                    `http://localhost:1000/api/users/${params.id}`,

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
                            <option value="MANAGER">MANAGER</option>
                            <option value="SUPERVISOR">SUPERVISOR</option>
                            <option value="SPG">SPG</option>
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

                    {/* AREA MULTI */}
                    <div>
                        <label className="text-sm text-slate-500">Area</label>
                        <select
                            multiple
                            name="area_ids"
                            value={form.area_ids}
                            onChange={handleAreaChange}
                            className="w-full mt-2 border rounded-xl p-3 min-h-[120px]"
                        >
                            {areas.map((a: any) => (
                                <option key={a.id} value={a.id}>
                                    {a.name}
                                </option>
                            ))}
                        </select>
                    </div>

                </div>

                {/* HIERARCHY */}
                {(form.role === 'SPG' || form.role === 'SUPERVISOR') && (
                    <div className="bg-white rounded-3xl p-6 shadow-lg space-y-4">

                        <h2 className="font-bold text-slate-900">
                            👥 Hierarchy Assignment
                        </h2>

                        {form.role === 'SPG' && (
                            <div>
                                <label className="text-sm text-slate-500">
                                    Supervisor
                                </label>

                                <select
                                    name="supervisor_id"
                                    value={form.supervisor_id}
                                    onChange={handleChange}
                                    className="w-full mt-2 border rounded-xl p-3"
                                >
                                    <option value="">Select Supervisor</option>
                                    {supervisors.map((s: any) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {form.role === 'SUPERVISOR' && (
                            <div>
                                <label className="text-sm text-slate-500">
                                    Manager
                                </label>

                                <select
                                    name="supervisor_id"
                                    value={form.supervisor_id}
                                    onChange={handleChange}
                                    className="w-full mt-2 border rounded-xl p-3"
                                >
                                    <option value="">Select Manager</option>
                                    {managers.map((m: any) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

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