'use client'

import {
    useEffect,
    useState
} from 'react'

import { useRouter } from 'next/navigation'

export default function CreateCustomerPage() {

    const router = useRouter()

    const [customerGroups, setCustomerGroups] =
        useState<any[]>([])

    const [areas, setAreas] = useState<any[]>([])

    const [channels, setChannels] = useState<any[]>([])

    const [classes, setClasses] = useState<any[]>([])

    const [groups, setGroups] =
        useState<any[]>([])

    const [form, setForm] = useState({

        code: '',
        name: '',
        address: '',
        phone: '',
        customer_group_id: '',
        latitude: '',
        longitude: '',
        area_id: '',
        channel_id: '',
        class_id: ''

    })

    // LOAD CUSTOMER GROUP
    const fetchGroups = async () => {

        const token =
            localStorage.getItem('token')

        const res = await fetch(
            'http://localhost:1000/api/customer-groups',
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        )

        const data = await res.json()

        setGroups(data)

    }

    useEffect(() => {

        const fetchMasters = async () => {

            const token = localStorage.getItem('token')

            // AREA
            const areaRes = await fetch(
                'http://localhost:1000/api/areas',
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            )

            const areaData = await areaRes.json()

            setAreas(
                Array.isArray(areaData)
                    ? areaData
                    : []
            )

            // CHANNEL
            const channelRes = await fetch(
                'http://localhost:1000/api/channels',
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            )

            const channelData = await channelRes.json()

            setChannels(
                Array.isArray(channelData)
                    ? channelData
                    : []
            )

            const groupRes = await fetch(
                'http://localhost:1000/api/customer-groups',
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            )

            const groupData = await groupRes.json()

            setCustomerGroups(
                Array.isArray(groupData)
                    ? groupData
                    : []
            )

            // CLASS
            const classRes = await fetch(
                'http://localhost:1000/api/classes',
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            )

            const classData = await classRes.json()

            setClasses(
                Array.isArray(classData)
                    ? classData
                    : []
            )

        }

        fetchMasters()

    }, [])

    // HANDLE CHANGE
    const handleChange = (e: any) => {

        setForm({
            ...form,
            [e.target.name]: e.target.value
        })

    }

    // GET GPS
    const getLocation = () => {

        navigator.geolocation.getCurrentPosition((pos) => {

            setForm(prev => ({
                ...prev,
                latitude: pos.coords.latitude.toString(),
                longitude: pos.coords.longitude.toString()
            }))

        })

    }

    // SAVE CUSTOMER
    const handleSubmit = async (e: any) => {

        e.preventDefault()

        const token = localStorage.getItem('token')

        const res = await fetch(
            'http://localhost:1000/api/customers',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(form)
            }
        )

        const data = await res.json()

        // 🚨 WAJIB CEK INI
        if (!res.ok) {

            console.log('ERROR BACKEND:', data)

            alert(data.message || data.error)

            return
        }

        alert('Customer berhasil dibuat')
        router.replace('/customers')
    }


    return (

        <div className="max-w-5xl mx-auto p-6">

            {/* HEADER */}

            <div className="mb-8">

                <h1 className="text-4xl font-bold text-black">

                    🏪 Create Customer

                </h1>

                <p className="text-black-400 mt-2">

                    Tambahkan customer baru ke sistem

                </p>

            </div>

            <form
                onSubmit={handleSubmit}
            >

                <div

                    className="
        bg-white
        rounded-3xl
        shadow-xl
        p-8
      "

                >

                    {/* BASIC INFO */}

                    <h2 className="text-xl font-bold mb-5">

                        Customer Information

                    </h2>

                    <div className="grid md:grid-cols-2 gap-5">

                        <div>

                            <label className="font-medium">

                                Code

                            </label>

                            <input

                                name="code"

                                value={form.code}

                                onChange={handleChange}

                                className="
              w-full
              border
              rounded-2xl
              px-4
              py-3
              mt-2
            "

                            />

                        </div>

                        <div>

                            <label className="font-medium">

                                Phone

                            </label>

                            <input

                                name="phone"

                                value={form.phone}

                                onChange={handleChange}

                                className="
              w-full
              border
              rounded-2xl
              px-4
              py-3
              mt-2
            "

                            />

                        </div>

                    </div>

                    <div className="mt-5">

                        <label className="font-medium">

                            Nama Toko

                        </label>

                        <input

                            name="name"

                            value={form.name}

                            onChange={handleChange}

                            className="
            w-full
            border
            rounded-2xl
            px-4
            py-3
            mt-2
          "

                        />

                    </div>

                    <div className="mt-5">

                        <label className="font-medium">

                            Alamat

                        </label>

                        <textarea

                            name="address"

                            value={form.address}

                            onChange={handleChange}

                            rows={4}

                            className="
            w-full
            border
            rounded-2xl
            px-4
            py-3
            mt-2
          "

                        />

                    </div>

                    {/* BUSINESS */}

                    <h2 className="text-xl font-bold mt-10 mb-5">

                        Business Information

                    </h2>

                    <div className="grid md:grid-cols-4 gap-5">

                        <div>

                            <label>

                                Customer Group

                            </label>

                            <select

                                name="customer_group_id"

                                value={form.customer_group_id}

                                onChange={handleChange}

                                className="
              w-full
              border
              rounded-2xl
              px-4
              py-3
              mt-2
            "

                            >

                                <option value="">

                                    Select Group

                                </option>

                                {

                                    customerGroups.map(

                                        (g: any) => (

                                            <option

                                                key={g.id}

                                                value={g.id}

                                            >

                                                {g.name}

                                            </option>

                                        )

                                    )

                                }

                            </select>

                        </div>

                        <div>

                            <label>

                                Area

                            </label>

                            <select

                                name="area_id"

                                value={form.area_id}

                                onChange={handleChange}

                                className="
              w-full
              border
              rounded-2xl
              px-4
              py-3
              mt-2
            "

                            >

                                <option value="">

                                    Select Area

                                </option>

                                {

                                    areas.map(

                                        (a: any) => (

                                            <option

                                                key={a.id}

                                                value={a.id}

                                            >

                                                {a.name}

                                            </option>

                                        )

                                    )

                                }

                            </select>

                        </div>

                        <div>

                            <label>

                                Channel

                            </label>

                            <select

                                name="channel_id"

                                value={form.channel_id}

                                onChange={handleChange}

                                className="
              w-full
              border
              rounded-2xl
              px-4
              py-3
              mt-2
            "

                            >

                                <option value="">

                                    Select Channel

                                </option>

                                {

                                    channels.map(

                                        (c: any) => (

                                            <option

                                                key={c.id}

                                                value={c.id}

                                            >

                                                {c.name}

                                            </option>

                                        )

                                    )

                                }

                            </select>

                        </div>

                        <div>

                            <label>
                                Class
                            </label>

                            <select

                                name="class_id"

                                value={form.class_id}

                                onChange={handleChange}

                                className="
              w-full
              border
              rounded-2xl
              px-4
              py-3
              mt-2
            "

                            >

                                <option value="">
                                    Select Class
                                </option>

                                {
                                    classes.map((c: any) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))
                                }

                            </select>

                        </div>

                    </div>

                    {/* GPS */}

                    <h2 className="text-xl font-bold mt-10 mb-5">

                        Location

                    </h2>

                    <div className="grid md:grid-cols-2 gap-5">

                        <div>

                            <label>

                                Latitude

                            </label>

                            <input

                                name="latitude"

                                value={form.latitude}

                                readOnly

                                className="
              w-full
              border
              rounded-2xl
              px-4
              py-3
              mt-2
              bg-gray-100
            "

                            />

                        </div>

                        <div>

                            <label>

                                Longitude

                            </label>

                            <input

                                name="longitude"

                                value={form.longitude}

                                readOnly

                                className="
              w-full
              border
              rounded-2xl
              px-4
              py-3
              mt-2
              bg-gray-100
            "

                            />

                        </div>

                    </div>

                    <button

                        type="button"

                        onClick={getLocation}

                        className="
          mt-5
          bg-green-600
          text-white
          px-5
          py-3
          rounded-2xl
        "

                    >

                        📍 Ambil GPS

                    </button>

                    {/* SAVE */}

                    <div className="mt-10 flex justify-end">

                        <button

                            type="submit"

                            className="
            bg-blue-600
            hover:bg-blue-700
            text-white
            px-8
            py-4
            rounded-2xl
            font-semibold
          "

                        >

                            Save Customer

                        </button>

                    </div>

                </div>

            </form>

        </div>

    )
}
