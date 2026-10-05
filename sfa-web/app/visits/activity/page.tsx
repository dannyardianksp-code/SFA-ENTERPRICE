'use client'

import {
    Suspense,
    useEffect,
    useRef,
    useState
} from 'react'

import {
    useRouter,
    useSearchParams
} from 'next/navigation'

import { API_BASE_URL } from '@/app/utils/api-config'

type FieldDef = {
    id: number
    label: string
    field_type: 'TEXT' | 'NUMBER' | 'DATE' | 'DROPDOWN' | 'PHOTO'
    options: string[] | null
    required: boolean
    display_order: number
}

export default function VisitActivityPage() {
    return (
        <Suspense fallback={null}>
            <VisitActivityContent />
        </Suspense>
    )
}

function VisitActivityContent() {

    const router = useRouter()
    const params = useSearchParams()
    const visit_id = params.get('visit_id')

    const [activities, setActivities] = useState<any[]>([])
    const [activityId, setActivityId] = useState('')
    const [fields, setFields] = useState<FieldDef[]>([])
    const [loadingFields, setLoadingFields] = useState(false)

    // Field dinamis: {[field_definition_id]: string} buat TEXT/NUMBER/
    // DATE/DROPDOWN, dan {[field_definition_id]: File} terpisah buat PHOTO.
    const [values, setValues] = useState<Record<number, string>>({})
    const [photos, setPhotos] = useState<Record<number, File>>({})
    const [saving, setSaving] = useState(false)

    const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

    const fetchActivities = async () => {

        try {

            const token = localStorage.getItem('token')

            const res = await fetch(`${API_BASE_URL}/activities`, {
                headers: { Authorization: `Bearer ${token}` }
            })

            const data = await res.json()

            setActivities(Array.isArray(data) ? data : [])

        } catch (err) {
            console.log(err)
        }

    }

    useEffect(() => {
        fetchActivities()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {

        setValues({})
        setPhotos({})

        if (!activityId) {
            setFields([])
            return
        }

        const fetchFields = async () => {

            setLoadingFields(true)

            const token = localStorage.getItem('token')

            const res = await fetch(`${API_BASE_URL}/activities/${activityId}/fields`, {
                headers: { Authorization: `Bearer ${token}` }
            })

            const data = await res.json()

            setFields(Array.isArray(data) ? data : [])
            setLoadingFields(false)

        }

        fetchFields()

    }, [activityId])

    const setValue = (fieldId: number, value: string) => {
        setValues(prev => ({ ...prev, [fieldId]: value }))
    }

    const handleSubmit = async (e: any) => {

        e.preventDefault()

        if (!activityId) {
            alert('Pilih Activity dulu')
            return
        }

        for (const f of fields) {
            if (!f.required) continue
            if (f.field_type === 'PHOTO') {
                if (!photos[f.id]) {
                    alert(`Foto "${f.label}" wajib diisi`)
                    return
                }
            } else if (!values[f.id] || !String(values[f.id]).trim()) {
                alert(`Field "${f.label}" wajib diisi`)
                return
            }
        }

        setSaving(true)

        try {

            const token = localStorage.getItem('token')

            const formData = new FormData()
            formData.append('visit_id', visit_id || '')
            formData.append('activity_id', activityId)
            formData.append('values', JSON.stringify(values))

            Object.entries(photos).forEach(([fieldId, file]) => {
                formData.append(`photo_${fieldId}`, file)
            })

            const res = await fetch(`${API_BASE_URL}/visit-activities`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            })

            const data = await res.json()

            if (!res.ok) {
                alert(data.message || 'Gagal save activity')
                return
            }

            alert('Activity berhasil disimpan')
            router.replace(`/visit-detail/${visit_id}`)

        } catch (err) {

            console.log(err)
            alert('Terjadi kesalahan')

        } finally {
            setSaving(false)
        }

    }

    const sortedFields = [...fields].sort((a, b) => a.display_order - b.display_order)

    return (
        <div className="space-y-6 max-w-3xl mx-auto p-6">

            <div className="bg-white rounded-3xl p-6 shadow-lg">
                <h1 className="text-3xl font-bold text-slate-900">
                    📸 Visit Activity
                </h1>
                <p className="text-slate-500 mt-2">
                    Capture activity selama kunjungan
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                <div className="bg-white rounded-3xl p-5 shadow-lg">
                    <p className="text-slate-500 text-sm">Visit ID</p>
                    <p className="font-bold text-slate-900">{visit_id}</p>
                </div>

                <div className="bg-white rounded-3xl p-5 shadow-lg">
                    <label className="text-slate-500 text-sm">Activity</label>
                    <select
                        value={activityId}
                        onChange={(e) => setActivityId(e.target.value)}
                        className="w-full mt-2 border rounded-xl p-3"
                    >
                        <option value="">Pilih Activity</option>
                        {activities.map((a: any) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                </div>

                {loadingFields && (
                    <p className="text-slate-400 text-sm text-center">Memuat field...</p>
                )}

                {!loadingFields && activityId && sortedFields.length === 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 text-sm text-amber-700">
                        Activity ini belum punya field yang diatur. Atur dulu di halaman Activity Master.
                    </div>
                )}

                {sortedFields.map((f) => (

                    <div key={f.id} className="bg-white rounded-3xl p-5 shadow-lg">

                        <label className="text-slate-500 text-sm">
                            {f.label}{f.required && <span className="text-red-500"> *</span>}
                        </label>

                        {f.field_type === 'PHOTO' && (
                            <div className="mt-3 text-center">
                                <input
                                    ref={(el) => { fileInputRefs.current[f.id] = el }}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={(e: any) => {
                                        const file = e.target.files?.[0]
                                        if (file) setPhotos(prev => ({ ...prev, [f.id]: file }))
                                    }}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRefs.current[f.id]?.click()}
                                    className="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold"
                                >
                                    Ambil Foto
                                </button>

                                {photos[f.id] && (
                                    <img
                                        src={URL.createObjectURL(photos[f.id])}
                                        className="mt-4 rounded-2xl w-full object-cover"
                                        alt={f.label}
                                    />
                                )}
                            </div>
                        )}

                        {f.field_type === 'TEXT' && (
                            <input
                                value={values[f.id] || ''}
                                onChange={(e) => setValue(f.id, e.target.value)}
                                className="w-full mt-2 border rounded-xl p-3"
                            />
                        )}

                        {f.field_type === 'NUMBER' && (
                            <input
                                type="number"
                                value={values[f.id] || ''}
                                onChange={(e) => setValue(f.id, e.target.value)}
                                className="w-full mt-2 border rounded-xl p-3"
                            />
                        )}

                        {f.field_type === 'DATE' && (
                            <input
                                type="date"
                                value={values[f.id] || ''}
                                onChange={(e) => setValue(f.id, e.target.value)}
                                className="w-full mt-2 border rounded-xl p-3"
                            />
                        )}

                        {f.field_type === 'DROPDOWN' && (
                            <select
                                value={values[f.id] || ''}
                                onChange={(e) => setValue(f.id, e.target.value)}
                                className="w-full mt-2 border rounded-xl p-3"
                            >
                                <option value="">Pilih {f.label}</option>
                                {(f.options || []).map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        )}

                    </div>

                ))}

                <button
                    type="submit"
                    disabled={saving || !activityId}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white py-4 rounded-2xl font-bold"
                >
                    {saving ? 'Menyimpan...' : 'Save Activity'}
                </button>

            </form>

        </div>
    )
}
