

'use client'
//Jadwal Kunjungan bisa Edit//
import {
    useEffect,
    useState
} from 'react'

import { useRouter }
    from 'next/navigation'
import { getDistanceFromLatLonInKm } from "../utils/distance"


export default function VisitPlansPage() {

    const router =
        useRouter(


        )

    const [role, setRole] =
        useState('')

    const [users, setUsers] =
        useState<any[]>([])

    const [customers, setCustomers] =
        useState<any[]>([])

    const [plans, setPlans] =
        useState<any[]>([])
    const [

        currentPosition,

        setCurrentPosition

    ] = useState<any>(null)

    const [form, setForm] =
        useState({

            user_id: '',
            customer_id: '',
            visit_date: ''

        })

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')


    const [editId, setEditId] =
        useState<number | null>(null)

    const [uploadFile, setUploadFile] =
        useState<File | null>(null)

    const [uploading, setUploading] =
        useState(false)



    // LOAD DATA
    const fetchData = async () => {

        const token =
            localStorage.getItem('token')

        // USERS
        const uRes = await fetch(
            'http://localhost:1000/api/users',
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        )

        const uData = await uRes.json()

        setUsers(uData)

        // CUSTOMERS
        const cRes = await fetch(
            'http://localhost:1000/api/customers',
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        )

        const cData = await cRes.json()

        setCustomers(

            Array.isArray(cData)

                ? cData

                : []

        )

        // PLANS
        const pRes = await fetch(
            'http://localhost:1000/api/visit-plans',
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        )


        const pData = await pRes.json()

        setPlans(Array.isArray(pData.data)

            ? pData.data

            : []
        )




    }


    // GET CURRENT POSITION
    useEffect(() => {

        navigator.geolocation.getCurrentPosition(

            (position) => {

                setCurrentPosition({

                    lat: position.coords.latitude,

                    lng: position.coords.longitude

                })

            }

        )

    }, [])

    // ==================================================
    // USER ROLE & INITIAL DATA
    // ==================================================
    useEffect(() => {

        const userRole =

            localStorage.getItem(
                'role'
            )

        setRole(userRole || '')

        fetchData()

    }, [])




    // CHANGE
    const handleChange = (

        e: any
    ) => {

        setForm({
            ...form,
            [e.target.name]:
                e.target.value
        })

    }

    // SAVE


    const handleSubmit = async (
        e: any
    ) => {

        e.preventDefault()

        const token =
            localStorage.getItem('token')

        // ======================
        // EDIT
        // ======================

        if (editId) {

            await fetch(

                `http://localhost:1000/api/visit-plans/${editId}`,

                {

                    method: 'PUT',

                    headers: {

                        'Content-Type':
                            'application/json',

                        Authorization:
                            `Bearer ${token}`

                    },

                    body: JSON.stringify(form)

                }

            )

            alert(
                'Visit plan updated'
            )

        }

        // ======================
        // CREATE
        // ======================

        else {

            await fetch(
                'http://localhost:1000/api/visit-plans',
                {

                    method: 'POST',

                    headers: {

                        'Content-Type':
                            'application/json',

                        Authorization:
                            `Bearer ${token}`

                    },

                    body: JSON.stringify(form)

                }

            )

            alert(
                'Visit plan saved'
            )

        }

        // RESET

        setForm({

            user_id: '',
            customer_id: '',
            visit_date: ''

        })

        setEditId(null)

        fetchData()

    }



    const handleCheckIn =
        async (
            customerId: number,
            visitPlanId: number
        ) => {

            navigator.geolocation
                .getCurrentPosition(

                    async (pos) => {

                        const token =
                            localStorage.getItem(
                                'token'
                            )

                        const res =
                            await fetch(

                                'http://localhost:1000/api/visits/checkin',

                                {

                                    method: 'POST',

                                    headers: {

                                        'Content-Type':
                                            'application/json',

                                        Authorization:
                                            `Bearer ${token}`

                                    },

                                    body: JSON.stringify({

                                        customer_id:
                                            customerId,

                                        visit_plan_id:
                                            visitPlanId,

                                        latitude:
                                            pos.coords.latitude,

                                        longitude:
                                            pos.coords.longitude

                                    })

                                }

                            )

                        const data =
                            await res.json()


                        if (!res.ok) {
                            alert(data.error || data.message)
                            return
                        }

                        router.push(
                            `/visit-detail/${data.data.id}`
                        )

                    })

        }


    const handleEdit =
        (p: any) => {

            setEditId(p.id)

            setForm({

                user_id:
                    p.user_id,

                customer_id:
                    p.customer_id,

                visit_date:
                    p.visit_date

            })

        }

    const handleDelete =
        async (id: number) => {

            const yes =
                confirm(
                    'Hapus visit plan?'
                )

            if (!yes)
                return

            const token =
                localStorage.getItem(
                    'token'
                )

            await fetch(

                `http://localhost:1000/api/visit-plans/${id}`,

                {

                    method: 'DELETE',

                    headers: {

                        Authorization:
                            `Bearer ${token}`

                    }

                }

            )

            alert(
                'Visit plan deleted'
            )

            fetchData()

        }


    // tambahan untuk styling status
    const getStatusClass = (status: string) => {

        switch (status) {

            case 'PENDING':
                return 'bg-amber-100 text-amber-700'

            case 'ON VISIT':
                return 'bg-blue-100 text-blue-700'

            case 'COMPLETED':
                return 'bg-green-100 text-green-700'

            default:
                return 'bg-slate-100 text-slate-700'
        }

    }


    // ==================================================
    // CALCULATE DISTANCE
    const calculateDistance = (

        lat1: number,

        lon1: number,

        lat2: number,

        lon2: number

    ) => {

        const R = 6371

        const dLat =
            (lat2 - lat1) * Math.PI / 180

        const dLon =
            (lon2 - lon1) * Math.PI / 180

        const a =

            Math.sin(dLat / 2) *
            Math.sin(dLat / 2)

            +

            Math.cos(lat1 * Math.PI / 180)

            *

            Math.cos(lat2 * Math.PI / 180)

            *

            Math.sin(dLon / 2)

            *

            Math.sin(dLon / 2)

        const c =
            2 *
            Math.atan2(

                Math.sqrt(a),

                Math.sqrt(1 - a)

            )

        return R * c

    }

    // ==================================================
    // Function Download Template//
    // ==================================================

    const downloadTemplate = async () => {

        try {

            const token =
                localStorage.getItem("token")

            const response =
                await fetch(

                    "http://localhost:1000/api/visit-plans/template",

                    {

                        headers: {

                            Authorization:
                                `Bearer ${token}`

                        }

                    }

                )

            const blob =
                await response.blob()

            const url =
                window.URL.createObjectURL(blob)

            const a =
                document.createElement("a")

            a.href = url

            a.download =
                "visit-plan-template.xlsx"

            a.click()

            window.URL.revokeObjectURL(url)

        }

        catch {

            alert("Gagal download template")

        }

    }

    // ==================================================
    // Function Upload Excel//
    // ==================================================

    const handleUpload = async () => {

        if (!uploadFile) {

            alert("Pilih file dulu")

            return

        }

        const token =
            localStorage.getItem("token")

        const formData =
            new FormData()

        formData.append(

            "file",

            uploadFile

        )

        setUploading(true)

        try {

            const response =
                await fetch(

                    "http://localhost:1000/api/visit-plans/upload",

                    {

                        method: "POST",

                        headers: {

                            Authorization:
                                `Bearer ${token}`

                        },

                        body: formData

                    }

                )

            const result =
                await response.json()

            alert(

                `Import selesai

Inserted : ${result.inserted}

Duplicate : ${result.duplicate}

Failed : ${result.failed}`

            )

            fetchData()

        }

        catch {

            alert("Upload gagal")

        }

        finally {

            setUploading(false)

        }

    }


    // ==================================================//
    //Remove File Function//
    // ==================================================//
    const removeFile = () => {
        setUploadFile(null)

        const input = document.getElementById(
            "excelUpload"
        ) as HTMLInputElement | null

        if (input) {
            input.value = ""
        }
    }


    return (

        <div className="space-y-6">

            {/* HEADER */}

            <div className="bg-white rounded-3xl p-6 shadow-lg">

                <h1 className="text-3xl font-bold text-slate-900">

                    📅 Daily Visit Plan

                </h1>

                <p className="text-slate-500 mt-2">

                    Manage daily visit schedule

                </p>

            </div>

            {/* FORM */}

            {

                role !== 'SPG'

                &&

                (

                    <div className="bg-white rounded-3xl shadow-lg p-6">

                        <form onSubmit={handleSubmit}>

                            <div className="grid md:grid-cols-3 gap-4">

                                <div>

                                    <label className="font-semibold">

                                        Sales

                                    </label>

                                    <select

                                        className="w-full border rounded-xl p-3 mt-2"

                                        name="user_id"

                                        value={form.user_id}

                                        onChange={handleChange}

                                    >

                                        <option value="">

                                            Pilih Sales

                                        </option>

                                        {

                                            users.map((u: any) => (

                                                <option

                                                    key={u.id}

                                                    value={u.id}

                                                >

                                                    {u.name}

                                                </option>

                                            ))

                                        }

                                    </select>

                                </div>

                                <div>

                                    <label className="font-semibold">

                                        Toko

                                    </label>

                                    <select

                                        className="w-full border rounded-xl p-3 mt-2"

                                        name="customer_id"

                                        value={form.customer_id}

                                        onChange={handleChange}

                                    >

                                        <option value="">

                                            Pilih Toko

                                        </option>

                                        {

                                            customers.map((c: any) => (

                                                <option

                                                    key={c.id}

                                                    value={c.id}

                                                >

                                                    {c.name}

                                                </option>

                                            ))

                                        }

                                    </select>

                                </div>

                                <div>

                                    <label className="font-semibold">

                                        Visit Date

                                    </label>

                                    <input

                                        type="date"

                                        name="visit_date"

                                        value={form.visit_date}

                                        onChange={handleChange}

                                        className="w-full border rounded-xl p-3 mt-2"

                                    />

                                </div>

                            </div>

                            <button

                                type="submit"

                                className="mt-5 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl"

                            >

                                {

                                    editId

                                        ? 'Update Plan'

                                        : 'Save Plan'

                                }

                            </button>

                        </form>

                    </div>

                )

            }


            {/* UPLOAD / DOWNLOAD */}

            {
                role !== "SPG" && (
                    <div className="bg-white rounded-2xl shadow p-5 mb-6">

                        <h3 className="text-lg font-semibold mb-4">
                            📥 Import Visit Excel
                        </h3>

                        <div className="flex flex-col md:flex-row md:items-center gap-4">

                            {/* Download Template */}
                            <button
                                onClick={downloadTemplate}
                                className="
                bg-blue-600
                hover:bg-blue-700
                text-white
                px-5
                py-3
                rounded-xl
                font-semibold
            "
                            >
                                📥 Download Template
                            </button>

                            {/* Hidden Input */}
                            <input
                                id="excelUpload"
                                type="file"
                                accept=".xlsx"
                                className="hidden"
                                onChange={(e) =>
                                    setUploadFile(
                                        e.target.files?.[0] || null
                                    )
                                }
                            />

                            {/* Custom Button */}
                            <label
                                htmlFor="excelUpload"
                                className="
                cursor-pointer
                bg-slate-100
                hover:bg-slate-200
                border
                border-slate-300
                px-5
                py-3
                rounded-xl
                font-medium
                text-slate-700
                transition
            "
                            >
                                📁 Pilih File Excel
                            </label>

                            {/* File Name */}
                            <div className="flex-1">

                                {uploadFile ? (

                                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">

                                        <p className="font-semibold text-green-700">
                                            ✅ File Dipilih
                                        </p>

                                        <p className="text-sm text-slate-600">
                                            {uploadFile.name}
                                        </p>

                                        <p className="text-xs text-slate-400">
                                            {(uploadFile.size / 1024).toFixed(1)} KB
                                        </p>

                                        <div className="flex gap-2 mt-3">

                                            <label
                                                htmlFor="excelUpload"
                                                className="
                    cursor-pointer
                    bg-blue-100
                    hover:bg-blue-200
                    text-blue-700
                    px-3
                    py-1
                    rounded-lg
                    text-sm
                "
                                            >
                                                Ganti File
                                            </label>

                                            <button
                                                type="button"
                                                onClick={removeFile}
                                                className="
                    bg-red-100
                    hover:bg-red-200
                    text-red-700
                    px-3
                    py-1
                    rounded-lg
                    text-sm
                "
                                            >
                                                Hapus
                                            </button>

                                        </div>

                                    </div>

                                ) : (

                                    <div className="bg-slate-50 border rounded-xl px-4 py-3 text-slate-400">

                                        Belum ada file dipilih

                                    </div>

                                )}

                            </div>

                            {/* Upload */}
                            <button
                                onClick={handleUpload}
                                disabled={!uploadFile || uploading}
                                className="
                bg-green-600
                hover:bg-green-700
                disabled:bg-gray-400
                disabled:cursor-not-allowed
                text-white
                px-6
                py-3
                rounded-xl
                font-semibold
            "
                            >
                                {uploading
                                    ? "Uploading..."
                                    : "📤 Import Excel"}
                            </button>

                        </div>

                    </div>
                )
            }

            {/* SUMMARY */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <div className="bg-white rounded-2xl shadow p-5">

                    <h3 className="text-slate-500">

                        Pending

                    </h3>

                    <h1 className="text-3xl font-bold text-amber-600">

                        {

                            plans.filter(

                                (p: any) =>

                                    p.status === 'PENDING'

                            ).length

                        }

                    </h1>

                </div>

                <div className="bg-white rounded-2xl shadow p-5">

                    <h3 className="text-slate-500">

                        On Visit

                    </h3>

                    <h1 className="text-3xl font-bold text-blue-600">

                        {

                            plans.filter(

                                (p: any) =>

                                    p.status === 'ON VISIT'

                            ).length

                        }

                    </h1>

                </div>

                <div className="bg-white rounded-2xl shadow p-5">

                    <h3 className="text-slate-500">

                        Completed

                    </h3>

                    <h1 className="text-3xl font-bold text-green-600">

                        {

                            plans.filter(

                                (p: any) =>

                                    p.status === 'COMPLETED'

                            ).length

                        }

                    </h1>

                </div>

            </div>


            {/* Filter */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">

                <input

                    type="text"

                    placeholder="🔍 Cari toko..."

                    value={search}

                    onChange={(e) => setSearch(e.target.value)}

                    className="
      flex-1
      bg-white
      border
      rounded-2xl
      p-4
      shadow
    "

                />

                <select

                    value={statusFilter}

                    onChange={(e) =>
                        setStatusFilter(
                            e.target.value
                        )
                    }

                    className="
      bg-white
      border
      rounded-2xl
      p-4
      shadow
    "

                >

                    <option value="ALL">
                        Semua Status
                    </option>

                    <option value="PENDING">
                        Pending
                    </option>

                    <option value="ON VISIT">
                        On Visit
                    </option>

                    <option value="COMPLETED">
                        Completed
                    </option>

                </select>

            </div>


            {/* LIST */}

            <div className="grid lg:grid-cols-2 gap-5">

                {

                    plans

                        .filter((p: any) => {

                            const matchName =

                                p.Customer?.name

                                    ?.toLowerCase()

                                    .includes(

                                        search.toLowerCase()

                                    )

                            const matchStatus =

                                statusFilter === 'ALL'

                                ||

                                p.status === statusFilter

                            return matchName && matchStatus

                        }).map((p: any) => {
                            const distance =

                                currentPosition &&
                                    p.Customer?.latitude &&
                                    p.Customer?.longitude

                                    ?

                                    calculateDistance(

                                        currentPosition.lat,

                                        currentPosition.lng,

                                        Number(
                                            p.Customer.latitude
                                        ),

                                        Number(
                                            p.Customer.longitude
                                        )

                                    )

                                    : null

                            return (



                                <div

                                    key={p.id}

                                    className="bg-white rounded-3xl shadow-lg p-5 hover:shadow-xl transition"

                                >

                                    <div className="flex justify-between items-start">

                                        <div>

                                            <h3 className="text-xl font-bold text-slate-900">

                                                🏪 {p.Customer?.name}

                                            </h3>

                                            <p className="text-slate-500">

                                                👤 {p.User?.name}

                                            </p>

                                            {

                                                distance && (

                                                    <div
                                                        className="
                    inline-flex
                    items-center
                    gap-2
                    mt-2
                    px-3
                    py-1
                    bg-blue-50
                    text-blue-700
                    rounded-full
                    text-sm
                    font-medium
                "
                                                    >

                                                        📍 {distance.toFixed(1)} KM

                                                    </div>

                                                )

                                            }

                                        </div>

                                        <span

                                            className={`px-3 py-2 rounded-full text-sm font-semibold ${getStatusClass(p.status)}`}

                                        >

                                            {p.status}

                                        </span>

                                    </div>

                                    <div className="mt-4">

                                        <p>

                                            📅 {p.visit_date}

                                        </p>

                                    </div>
                                    <div className="flex gap-2 mt-3">

                                        <button

                                            onClick={() =>
                                                window.open(
                                                    `https://www.google.com/maps/dir/?api=1&destination=${p.Customer.latitude},${p.Customer.longitude}`,
                                                    '_blank'
                                                )
                                            }

                                            className="
      bg-green-600
      hover:bg-green-700
      text-white
      px-3
      py-2
      rounded-xl
      text-sm
    "

                                        >

                                            🧭 Navigate

                                        </button>

                                    </div>

                                    <div className="flex flex-wrap gap-3 mt-5">

                                        {

                                            p.status === 'PENDING'

                                            &&

                                            (

                                                <button

                                                    onClick={() =>

                                                        handleCheckIn(

                                                            p.customer_id,

                                                            p.id

                                                        )

                                                    }

                                                    className="bg-green-600 text-white px-4 py-2 rounded-xl"

                                                >

                                                    Check In

                                                </button>

                                            )

                                        }

                                        {

                                            p.status === 'ON VISIT'

                                            &&

                                            p.Visit

                                            &&

                                            (

                                                <button

                                                    onClick={() =>

                                                        router.push(

                                                            `/visit-detail/${p.Visit.id}`

                                                        )

                                                    }

                                                    className="bg-blue-600 text-white px-4 py-2 rounded-xl"

                                                >

                                                    Open Visit

                                                </button>

                                            )

                                        }

                                        {

                                            p.status === 'COMPLETED'

                                            &&

                                            p.Visit

                                            &&

                                            (

                                                <button

                                                    onClick={() =>

                                                        router.push(

                                                            `/visit-detail/${p.Visit.id}`

                                                        )

                                                    }

                                                    className="bg-slate-800 text-white px-4 py-2 rounded-xl"

                                                >

                                                    View

                                                </button>

                                            )

                                        }

                                        {

                                            role !== 'SPG'

                                            &&

                                            p.status === 'PENDING'

                                            &&

                                            (

                                                <button

                                                    onClick={() =>

                                                        handleEdit(p)

                                                    }

                                                    className="border border-slate-300 px-4 py-2 rounded-xl"

                                                >

                                                    Edit

                                                </button>

                                            )

                                        }

                                    </div>

                                </div>

                            )
                        })
                }

            </div>

        </div>

    )
}
