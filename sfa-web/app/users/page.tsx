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

            // Tanpa pemeriksaan ini, penolakan server (misalnya 403
            // untuk non-administrator) tampil sebagai "Password baru:
            // undefined" alih-alih alasan penolakannya.
            if (!res.ok) {

                alert(
                    data.message || 'Gagal mereset password'
                )

                return

            }

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

            {/* LIST */}
            <div className="bg-white rounded-3xl shadow-lg overflow-hidden">

                <table className="w-full text-left">

                    <thead className="bg-slate-50 border-b border-slate-200">

                        <tr>

                            <th className="p-4 text-sm font-semibold text-slate-500">Name / Email</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Role</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Area</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Channel</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Supervisor</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Status</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Aksi</th>

                        </tr>

                    </thead>

                    <tbody>

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
                            }).map((u: any) => (

                                <tr
                                    key={u.id}
                                    className="border-b border-slate-100 hover:bg-slate-50"
                                >

                                    <td className="p-4">
                                        <div className="font-semibold text-slate-900">{u.name}</div>
                                        <div className="text-slate-500 text-sm">{u.email}</div>
                                    </td>

                                    <td className="p-4 text-slate-600">
                                        {u.role}
                                    </td>

                                    <td className="p-4 text-slate-600">
                                        {u.Area?.code || '-'}
                                    </td>

                                    <td className="p-4 text-slate-600">
                                        {u.Channel?.code || '-'}
                                    </td>

                                    <td className="p-4 text-slate-600">
                                        {u.Supervisor?.name || '-'}
                                    </td>

                                    <td className="p-4">
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-semibold ${u.status === 'ACTIVE'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                                }`}
                                        >
                                            {u.status}
                                        </span>
                                    </td>

                                    <td className="p-4">

                                        <div className="flex flex-wrap gap-2">

                                            <button
                                                onClick={() => handleStatus(u.id)}
                                                className={`py-2 px-3 rounded-xl font-semibold text-sm ${u.status === 'ACTIVE'
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
                                                className="bg-blue-600 text-white py-2 px-3 rounded-xl font-semibold text-sm"
                                            >
                                                Edit
                                            </button>

                                            <button
                                                onClick={() => handleResetPassword(u.id)}
                                                className="border border-slate-300 py-2 px-3 rounded-xl text-sm hover:bg-slate-100"
                                            >
                                                Reset Password
                                            </button>

                                        </div>

                                    </td>

                                </tr>

                            ))}

                    </tbody>

                </table>

            </div>

        </div>
    )

}