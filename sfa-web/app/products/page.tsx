'use client'

import {
    useEffect,
    useState
} from 'react'

// Sama persis dengan CategoryKey di mobile
// (mobile/src/modules/product/utils/group-by-category.ts).
const KATEGORI = ['JUAL', 'PROMOSI', 'COMPETITOR']

export default function ProductsPage() {

    const [products, setProducts] =
        useState<any[]>([])

    const [form, setForm] = useState({

        code: '',
        name: '',
        price: '',
        uom: '',
        category: 'JUAL'

    })

    const [editId, setEditId] =
        useState<number | null>(null)

    // LOAD PRODUCTS
    const fetchProducts = async () => {

        const token =
            localStorage.getItem('token')

        const res = await fetch(
            'http://localhost:1000/api/products',
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        )

        const data = await res.json()

        setProducts(data)

    }

    useEffect(() => {
        fetchProducts()
    }, [])

    // HANDLE CHANGE
    const handleChange = (
        e: any
    ) => {

        setForm({
            ...form,
            [e.target.name]: e.target.value
        })

    }

    // SAVE
    const handleSubmit = async (
        e: any
    ) => {

        e.preventDefault()

        const token =
            localStorage.getItem('token')

        const url = editId
            ? `http://localhost:1000/api/products/${editId}`
            : 'http://localhost:1000/api/products'

        const method =
            editId ? 'PUT' : 'POST'

        await fetch(url, {

            method,

            headers: {

                'Content-Type': 'application/json',

                Authorization: `Bearer ${token}`

            },

            body: JSON.stringify(form)

        })

        setForm({
            code: '',
            name: '',
            price: '',
            uom: '',
            category: 'JUAL'
        })

        setEditId(null)

        fetchProducts()

    }

    // EDIT
    const handleEdit = (
        p: any
    ) => {

        setEditId(p.id)

        setForm({

            code: p.code,
            name: p.name,
            price: p.price,
            uom: p.uom,
            category: p.category || 'JUAL'

        })

    }

    // DELETE
    const handleDelete = async (
        id: number
    ) => {

        const token =
            localStorage.getItem('token')

        await fetch(
            `http://localhost:1000/api/products/${id}`,
            {

                method: 'DELETE',

                headers: {
                    Authorization: `Bearer ${token}`
                }

            }
        )

        fetchProducts()

    }

    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('ALL')

    return (

        <div className="space-y-6">

            {/* HEADER */}

            <div className="flex justify-between items-center">

                <div>

                    <h1 className="text-4xl font-bold text-slate-900">

                        📦 Master Product

                    </h1>

                    <p className="text-slate-500">



                    </p>

                </div>

            </div>

            {/* FORM */}

            <div className="bg-white rounded-3xl shadow-lg p-6">

                <h2 className="text-xl font-semibold mb-5">

                    {editId ? '✏️ Edit Product' : '➕ Tambah Product'}

                </h2>

                <form
                    onSubmit={handleSubmit}
                    className="grid md:grid-cols-2 gap-5"
                >

                    <div>

                        <label className="font-medium">
                            Product Code
                        </label>

                        <input

                            name="code"

                            value={form.code}

                            onChange={handleChange}

                            className="w-full mt-2 border rounded-xl p-3"

                        />

                    </div>

                    <div>

                        <label className="font-medium">
                            Product Name
                        </label>

                        <input

                            name="name"

                            value={form.name}

                            onChange={handleChange}

                            className="w-full mt-2 border rounded-xl p-3"

                        />

                    </div>

                    <div>

                        <label className="font-medium">
                            Price
                        </label>

                        <input

                            name="price"

                            value={form.price}

                            onChange={handleChange}

                            className="w-full mt-2 border rounded-xl p-3"

                        />

                    </div>

                    <div>

                        <label className="font-medium">
                            UOM
                        </label>

                        <input

                            name="uom"

                            value={form.uom}

                            onChange={handleChange}

                            className="w-full mt-2 border rounded-xl p-3"

                        />

                    </div>

                    <div>

                        <label className="font-medium">
                            Category
                        </label>

                        <select

                            name="category"

                            value={form.category}

                            onChange={handleChange}

                            className="w-full mt-2 border rounded-xl p-3"

                        >

                            {KATEGORI.map((k) => (
                                <option key={k} value={k}>{k}</option>
                            ))}

                        </select>

                    </div>

                    <div className="md:col-span-2">

                        <button

                            type="submit"

                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 py-3"

                        >

                            {

                                editId

                                    ?

                                    'Update Product'

                                    :

                                    'Save Product'

                            }

                        </button>

                    </div>

                </form>

            </div>

            {/* SEARCH */}

            <div className="bg-white rounded-3xl shadow-lg p-5 space-y-4">

                <input

                    placeholder="🔍 Cari Product..."

                    value={search}

                    onChange={(e) => setSearch(e.target.value)}

                    className="w-full border rounded-xl p-3"

                />

                {/* KATEGORI TABS -- sama kategori dengan Product
                Knowledge di mobile */}
                <div className="flex gap-2 flex-wrap">

                    {['ALL', ...KATEGORI].map((k) => (

                        <button

                            key={k}

                            onClick={() => setCategoryFilter(k)}

                            className={`px-4 py-2 rounded-xl text-sm font-semibold ${categoryFilter === k
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-600'
                                }`}

                        >

                            {k === 'ALL' ? 'Semua Kategori' : k}

                        </button>

                    ))}

                </div>

            </div>

            {/* LIST */}

            <div className="grid lg:grid-cols-2 gap-5">

                {

                    products

                        .filter((p: any) =>

                            p.name

                                .toLowerCase()

                                .includes(

                                    search.toLowerCase()

                                )

                            &&

                            (

                                categoryFilter === 'ALL'

                                ||

                                (p.category || 'JUAL') === categoryFilter

                            )

                        )

                        .map((p: any) => (

                            <div

                                key={p.id}

                                className="bg-white rounded-3xl shadow-lg p-6 hover:shadow-xl transition"

                            >

                                <div className="flex justify-between">

                                    <div>

                                        <h3 className="text-2xl font-bold text-slate-900">

                                            {p.name}

                                        </h3>

                                        <p className="text-slate-500">

                                            {p.code}

                                        </p>

                                        <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">

                                            {p.category || 'JUAL'}

                                        </span>

                                    </div>

                                    <div className="text-right">

                                        <div className="text-blue-600 font-bold text-xl">

                                            Rp {Number(p.price).toLocaleString('id-ID')}

                                        </div>

                                        <div className="text-slate-500">

                                            {p.uom}

                                        </div>

                                    </div>

                                </div>

                                <div className="flex gap-3 mt-6">

                                    <button

                                        onClick={() => handleEdit(p)}

                                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-5 py-2 rounded-xl"

                                    >

                                        ✏️ Edit

                                    </button>

                                    <button

                                        onClick={() => handleDelete(p.id)}

                                        className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl"

                                    >

                                        🗑 Delete

                                    </button>

                                </div>

                            </div>

                        ))

                }

            </div>

        </div>

    )

}