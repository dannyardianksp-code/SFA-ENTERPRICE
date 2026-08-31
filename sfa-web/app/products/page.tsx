'use client'

import {
    useEffect,
    useState
} from 'react'

// Sama persis dengan CategoryKey di mobile
// (mobile/src/modules/product/utils/group-by-category.ts).
const KATEGORI = ['JUAL', 'PROMOSI', 'COMPETITOR']

// photo_url disimpan sebagai path relatif "/uploads/..." (disajikan di
// root server, bukan di bawah "/api") -- sama konvensi dengan mobile
// (UPLOADS_ORIGIN di AttendanceScreen/CustomerVisitHistoryScreen dst).
const UPLOADS_ORIGIN = 'http://localhost:1000'

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

    // Foto terpisah dari `form` -- file, bukan teks, jadi tidak lewat
    // handleChange biasa. photoPreview nampilin foto yang SUDAH
    // tersimpan (mode edit) atau preview lokal foto baru yang baru
    // dipilih, belum ke-upload.
    const [photo, setPhoto] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    // Dipakai buat me-remount <input type="file"> setelah submit --
    // input file itu uncontrolled, tidak bisa dikosongkan lewat value.
    const [photoInputKey, setPhotoInputKey] = useState(0)

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

    const resetForm = () => {
        setForm({
            code: '',
            name: '',
            price: '',
            uom: '',
            category: 'JUAL'
        })
        setPhoto(null)
        setPhotoPreview(null)
        setPhotoInputKey((k) => k + 1)
        setEditId(null)
    }

    const handlePhotoChange = (e: any) => {
        const file = e.target.files?.[0] || null
        setPhoto(file)
        setPhotoPreview(file ? URL.createObjectURL(file) : null)
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

        // FormData, bukan JSON -- endpoint ini sekarang terima upload
        // foto (multer.single('photo')). Field teks tetap lewat sebagai
        // bagian multipart yang sama, backend membacanya dari req.body
        // seperti biasa.
        const body = new FormData()
        body.append('code', form.code)
        body.append('name', form.name)
        body.append('price', form.price)
        body.append('uom', form.uom)
        body.append('category', form.category)
        if (photo) body.append('photo', photo)

        await fetch(url, {

            method,

            headers: {
                Authorization: `Bearer ${token}`
            },

            body

        })

        resetForm()

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

        setPhoto(null)
        setPhotoPreview(p.photo_url ? `${UPLOADS_ORIGIN}${p.photo_url}` : null)
        setPhotoInputKey((k) => k + 1)

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

    const filteredProducts = products.filter((p: any) =>
        p.name.toLowerCase().includes(search.toLowerCase()) &&
        (categoryFilter === 'ALL' || (p.category || 'JUAL') === categoryFilter)
    )

    const PAGE_SIZE = 10
    const [page, setPage] = useState(1)

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
    const halamanAman = Math.min(page, totalPages)
    const productsHalamanIni = filteredProducts.slice(
        (halamanAman - 1) * PAGE_SIZE,
        halamanAman * PAGE_SIZE
    )

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

                        <label className="font-medium">
                            Foto Product
                        </label>

                        <div className="mt-2 flex items-center gap-4">

                            {photoPreview ? (
                                <img
                                    src={photoPreview}
                                    alt="Preview"
                                    className="w-16 h-16 rounded-xl object-cover border"
                                />
                            ) : (
                                <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">
                                    📦
                                </div>
                            )}

                            <input
                                key={photoInputKey}
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoChange}
                                className="flex-1"
                            />

                        </div>

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

                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}

                    className="w-full border rounded-xl p-3"

                />

                {/* KATEGORI TABS -- sama kategori dengan Product
                Knowledge di mobile */}
                <div className="flex gap-2 flex-wrap">

                    {['ALL', ...KATEGORI].map((k) => (

                        <button

                            key={k}

                            onClick={() => { setCategoryFilter(k); setPage(1) }}

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

            <div className="bg-white rounded-3xl shadow-lg overflow-hidden">

                <table className="w-full text-left">

                    <thead className="bg-slate-50 border-b border-slate-200">

                        <tr>

                            <th className="p-4 text-sm font-semibold text-slate-500">Foto</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Code</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Name</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Category</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Price</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">UOM</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Aksi</th>

                        </tr>

                    </thead>

                    <tbody>

                        {

                            productsHalamanIni

                                .map((p: any) => (

                                    <tr

                                        key={p.id}

                                        className="border-b border-slate-100 hover:bg-slate-50"

                                    >

                                        <td className="p-4">
                                            {p.photo_url ? (
                                                <img
                                                    src={`${UPLOADS_ORIGIN}${p.photo_url}`}
                                                    alt={p.name}
                                                    className="w-12 h-12 rounded-lg object-cover border"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-lg">
                                                    📦
                                                </div>
                                            )}
                                        </td>

                                        <td className="p-4 text-slate-600">
                                            {p.code}
                                        </td>

                                        <td className="p-4 font-semibold text-slate-900">
                                            {p.name}
                                        </td>

                                        <td className="p-4">
                                            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                                                {p.category || 'JUAL'}
                                            </span>
                                        </td>

                                        <td className="p-4 text-blue-600 font-bold">
                                            Rp {Number(p.price).toLocaleString('id-ID')}
                                        </td>

                                        <td className="p-4 text-slate-600">
                                            {p.uom}
                                        </td>

                                        <td className="p-4">

                                            <div className="flex gap-2">

                                                <button

                                                    onClick={() => handleEdit(p)}

                                                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-xl text-sm"

                                                >

                                                    ✏️ Edit

                                                </button>

                                                <button

                                                    onClick={() => handleDelete(p.id)}

                                                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-xl text-sm"

                                                >

                                                    🗑 Delete

                                                </button>

                                            </div>

                                        </td>

                                    </tr>

                                ))

                        }

                    </tbody>

                </table>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-slate-200">

                        <span className="text-sm text-slate-500">
                            Halaman {halamanAman} dari {totalPages} ({filteredProducts.length} product)
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