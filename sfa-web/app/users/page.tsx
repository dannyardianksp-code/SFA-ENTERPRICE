'use client'

import {
    useEffect,
    useState
} from 'react'

import {
    useRouter
} from 'next/navigation'

export default function UsersPage() {

    const router =
        useRouter()
    const [search, setSearch] = useState('')

    const [users, setUsers] =
        useState<any[]>([])

    const fetchUsers =
        async () => {

            const token =
                localStorage.getItem(
                    'token'
                )

            const res =
                await fetch(

                    'http://localhost:1000/api/users',

                    {

                        headers: {

                            Authorization:
                                `Bearer ${token}`

                        }

                    }

                )

            const data =
                await res.json()

            setUsers(data)

        }

    useEffect(() => {

        fetchUsers()

    }, [])

    //activate deactivate user
    const handleStatus =
        async (
            id: number
        ) => {

            const token =
                localStorage.getItem(
                    'token'
                )

            await fetch(

                `http://localhost:1000/api/users/${id}/status`,

                {

                    method: 'PUT',

                    headers: {

                        Authorization:
                            `Bearer ${token}`

                    }

                }

            )

            fetchUsers()

        }

    //user reset password
    const handleResetPassword =
        async (
            id: number
        ) => {

            const confirmReset =
                confirm(
                    'Reset password user?'
                )

            if (!confirmReset) {

                return

            }

            const token =
                localStorage.getItem(
                    'token'
                )

            const res =
                await fetch(

                    `http://localhost:1000/api/users/${id}/reset-password`,

                    {

                        method: 'PUT',

                        headers: {

                            Authorization:
                                `Bearer ${token}`

                        }

                    }

                )

            const data =
                await res.json()

            alert(

                `Password baru: ${data.password}`

            )

        }

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">

            {/* HEADER */}
            <div className="bg-white rounded-3xl p-6 shadow-lg flex justify-between items-center">

                <div>
                    <h1 className="text-3xl font-bold text-slate-900">
                        👤 User Management
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Manage users, roles, and access control
                    </p>
                </div>

                <button
                    onClick={() => router.push('/users/create')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-semibold shadow"
                >
                    + Add User
                </button>

            </div>


            <div className="bg-white rounded-3xl p-4 shadow flex gap-3 items-center">

                <input
                    type="text"
                    placeholder="🔍 Search name, email, role..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 border rounded-2xl p-3"
                />

            </div>

            {/* GRID */}
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">

                {users
                    .filter((u: any) => {

                        const keyword = search.toLowerCase()

                        return (
                            u.name?.toLowerCase().includes(keyword) ||
                            u.email?.toLowerCase().includes(keyword) ||
                            u.role?.toLowerCase().includes(keyword) ||
                            u.Area?.code?.toLowerCase().includes(keyword) ||
                            u.Channel?.code?.toLowerCase().includes(keyword)
                        )
                    }).map((u: any, i: number) => (

                        <div
                            key={u.id}
                            className="bg-white rounded-3xl shadow-lg p-5 hover:shadow-xl transition"
                        >

                            {/* TOP INFO */}
                            <div className="flex justify-between items-start">

                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">
                                        {u.name}
                                    </h2>

                                    <p className="text-slate-500 text-sm">
                                        {u.email}
                                    </p>
                                </div>

                                {/* STATUS BADGE */}
                                <span
                                    className={`px-3 py-1 rounded-full text-xs font-semibold ${u.status === 'ACTIVE'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                        }`}
                                >
                                    {u.status}
                                </span>

                            </div>

                            {/* META INFO */}
                            <div className="mt-4 space-y-2 text-sm text-slate-600">

                                <p>
                                    🎭 Role: <b>{u.role}</b>
                                </p>

                                <p>
                                    📍 Area: <b>{u.Area?.code || '-'}</b>
                                </p>

                                <p>
                                    🏢 Channel: <b>{u.Channel?.code || '-'}</b>
                                </p>

                                <p>
                                    👨‍💼 Supervisor: <b>{u.Supervisor?.name || '-'}</b>
                                </p>

                            </div>

                            {/* ACTIONS */}
                            <div className="flex gap-2 mt-5">

                                <button
                                    onClick={() => handleStatus(u.id)}
                                    className={`flex-1 py-2 rounded-xl font-semibold text-sm ${u.status === 'ACTIVE'
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-green-600 text-white'
                                        }`}
                                >
                                    {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                </button>

                                <button
                                    onClick={() =>
                                        router.push(`/users/edit/${u.id}`)
                                    }
                                    className="flex-1 bg-blue-600 text-white py-2 rounded-xl font-semibold text-sm"
                                >
                                    Edit
                                </button>

                            </div>

                            <button
                                onClick={() => handleResetPassword(u.id)}
                                className="w-full mt-2 border border-slate-300 py-2 rounded-xl text-sm hover:bg-slate-100"
                            >
                                Reset Password
                            </button>

                        </div>

                    ))}

            </div>

        </div>
    )

}