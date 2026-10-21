'use client'

import {
    useEffect,
    useState
} from 'react'

import {
    useRouter
} from 'next/navigation'

import { API_BASE_URL } from '@/app/utils/api-config'

export default function UsersPage() {

    const router =
        useRouter()
    const [search, setSearch] = useState('')

    const [users, setUsers] =
        useState<any[]>([])

    // Cuma buat tahu TOTAL jumlah area yang ada -- perbandingan
    // "user ini ke-assign semua area" di kolom tabel butuh angka ini.
    const [areas, setAreas] =
        useState<any[]>([])

    const fetchUsers =
        async () => {

            const token =
                localStorage.getItem(
                    'token'
                )

            const res =
                await fetch(

                    `${API_BASE_URL}/users`,

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

    const fetchAreas =
        async () => {

            const token =
                localStorage.getItem(
                    'token'
                )

            const res =
                await fetch(

                    `${API_BASE_URL}/areas`,

                    {

                        headers: {

                            Authorization:
                                `Bearer ${token}`

                        }

                    }

                )

            const data =
                await res.json()

            setAreas(
                Array.isArray(data.data)
                    ? data.data
                    : Array.isArray(data)
                        ? data
                        : []
            )

        }

    useEffect(() => {

        fetchUsers()
        fetchAreas()

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

                `${API_BASE_URL}/users/${id}/status`,

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

            const passwordBaru =
                prompt(
                    'Masukkan password baru untuk user ini:'
                )

            // null = admin menekan Cancel. String kosong/spasi ditolak
            // di server, tapi dicegat di sini dulu supaya tidak ada
            // request kosong yang terkirim percuma.
            if (!passwordBaru || !passwordBaru.trim()) {

                return

            }

            const token =
                localStorage.getItem(
                    'token'
                )

            const res =
                await fetch(

                    `${API_BASE_URL}/users/${id}/reset-password`,

                    {

                        method: 'PUT',

                        headers: {

                            'Content-Type':
                                'application/json',

                            Authorization:
                                `Bearer ${token}`

                        },

                        body:
                            JSON.stringify({
                                password: passwordBaru
                            })

                    }

                )

            const data =
                await res.json()

            // Tanpa pemeriksaan ini, penolakan server (misalnya 403
            // untuk non-administrator) tampil sebagai "Password berhasil
            // direset" alih-alih alasan penolakannya.
            if (!res.ok) {

                alert(
                    data.message || 'Gagal mereset password'
                )

                return

            }

            alert(
                'Password berhasil direset.'
            )

        }

    // ======================
    // BULK UPLOAD (Excel) -- sama pola dengan Visit Plan: download
    // template berisi dropdown Role/Channel + panduan nama Area, isi,
    // upload, laporan per baris (sukses/gagal) ditampilkan lewat alert.
    // ======================
    const [showUpload, setShowUpload] = useState(false)
    const [uploadFile, setUploadFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)

    const downloadTemplate = async () => {

        try {

            const token = localStorage.getItem('token')

            const response = await fetch(`${API_BASE_URL}/users/template`, {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (!response.ok) {
                alert('Gagal download template')
                return
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'user-template.xlsx'
            a.click()
            window.URL.revokeObjectURL(url)

        } catch {
            alert('Gagal download template')
        }

    }

    const handleUpload = async () => {

        if (!uploadFile) {
            alert('Pilih file dulu')
            return
        }

        const token = localStorage.getItem('token')

        const formData = new FormData()
        formData.append('file', uploadFile)

        setUploading(true)

        try {

            const response = await fetch(`${API_BASE_URL}/users/upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            })

            const result = await response.json()

            if (!response.ok) {
                alert(result.message || 'Upload gagal')
                return
            }

            // Baris gagal (kalau ada) ditunjukkan ringkas -- Code +
            // alasannya, maksimal 10 biar alert tidak sepanjang gulungan.
            const ringkasanGagal = result.errors
                ?.slice(0, 10)
                .map((e: any) => `- ${e.row?.Code || '(tanpa code)'}: ${e.reason}`)
                .join('\n')

            alert(
                `Import selesai\n\nTotal baris : ${result.total}\nBerhasil : ${result.inserted}\nGagal : ${result.failed}` +
                (ringkasanGagal ? `\n\nBaris gagal:\n${ringkasanGagal}` : '') +
                (result.failed > 10 ? `\n... dan ${result.failed - 10} lainnya` : '')
            )

            setUploadFile(null)
            fetchUsers()

        } catch {
            alert('Upload gagal')
        } finally {
            setUploading(false)
        }

    }

    const PAGE_SIZE = 10
    const [page, setPage] = useState(1)

    const filteredUsers = users.filter((u: any) => {

        const keyword = search.toLowerCase()

        return (
            u.name?.toLowerCase().includes(keyword) ||
            u.email?.toLowerCase().includes(keyword) ||
            u.role?.toLowerCase().includes(keyword) ||
            u.Area?.code?.toLowerCase().includes(keyword) ||
            u.AssignedAreas?.some((a: any) =>
                a.code?.toLowerCase().includes(keyword)
            ) ||
            u.Channel?.code?.toLowerCase().includes(keyword)
        )
    })

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
    const halamanAman = Math.min(page, totalPages)
    const usersHalamanIni = filteredUsers.slice(
        (halamanAman - 1) * PAGE_SIZE,
        halamanAman * PAGE_SIZE
    )

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

                <div className="flex gap-3">

                    <button
                        onClick={() => setShowUpload(!showUpload)}
                        className="border border-slate-300 hover:bg-slate-100 px-5 py-3 rounded-2xl font-semibold"
                    >
                        📤 Upload Excel
                    </button>

                    <button
                        onClick={() => router.push('/users/create')}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-semibold shadow"
                    >
                        + Add User
                    </button>

                </div>

            </div>

            {showUpload && (
                <div className="bg-white rounded-3xl p-6 shadow-lg space-y-4">

                    <h2 className="font-bold text-slate-900">
                        📤 Bulk Upload User
                    </h2>

                    <p className="text-slate-500 text-sm">
                        Download template, isi data user (Role &amp; Channel lewat dropdown,
                        Nama Area dipisah koma kalau lebih dari satu), lalu upload lagi di sini.
                    </p>

                    <button
                        onClick={downloadTemplate}
                        className="border border-blue-600 text-blue-600 hover:bg-blue-50 px-4 py-2.5 rounded-xl font-semibold text-sm w-fit"
                    >
                        📥 Download Template
                    </button>

                    <div className="flex flex-wrap gap-3 items-center">

                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                            className="flex-1 border rounded-xl p-2.5 text-sm"
                        />

                        <button
                            onClick={handleUpload}
                            disabled={uploading || !uploadFile}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-5 py-2.5 rounded-xl font-semibold text-sm"
                        >
                            {uploading ? 'Mengunggah...' : 'Upload'}
                        </button>

                        <button
                            onClick={() => { setShowUpload(false); setUploadFile(null) }}
                            className="border border-slate-300 px-4 py-2.5 rounded-xl text-sm hover:bg-slate-100"
                        >
                            Batal
                        </button>

                    </div>

                </div>
            )}

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
                            <th className="p-4 text-sm font-semibold text-slate-500">Web Access</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Aksi</th>

                        </tr>

                    </thead>

                    <tbody>

                        {usersHalamanIni
                            .map((u: any) => (

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

                                    <td className="p-4">
                                        {u.AssignedAreas && u.AssignedAreas.length > 0 ? (
                                            areas.length > 0 && u.AssignedAreas.length === areas.length ? (
                                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                                                    All Area
                                                </span>
                                            ) : (
                                                <div className="flex flex-wrap gap-1">
                                                    {u.AssignedAreas.map((a: any) => (
                                                        <span
                                                            key={a.id}
                                                            className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700"
                                                        >
                                                            {a.code}
                                                        </span>
                                                    ))}
                                                </div>
                                            )
                                        ) : (
                                            <span className="text-slate-600">{u.Area?.code || '-'}</span>
                                        )}
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
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-semibold ${u.can_access_web
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-slate-100 text-slate-500'
                                                }`}
                                        >
                                            {u.can_access_web ? 'Aktif' : 'Nonaktif'}
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

                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-slate-200">

                        <span className="text-sm text-slate-500">
                            Halaman {halamanAman} dari {totalPages} ({filteredUsers.length} user)
                        </span>

                        <div className="flex gap-2">

                            <button
                                onClick={() => setPage(halamanAman - 1)}
                                disabled={halamanAman <= 1}
                                className="border border-slate-300 disabled:opacity-40 px-4 py-2 rounded-xl text-sm"
                            >
                                ‹ Sebelumnya
                            </button>

                            <button
                                onClick={() => setPage(halamanAman + 1)}
                                disabled={halamanAman >= totalPages}
                                className="border border-slate-300 disabled:opacity-40 px-4 py-2 rounded-xl text-sm"
                            >
                                Berikutnya ›
                            </button>

                        </div>

                    </div>
                )}

            </div>

        </div>
    )

}