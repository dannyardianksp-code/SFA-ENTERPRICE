'use client'

import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '@/app/utils/api-config'

// Sama dengan backend (excelUpload.util.js) -- dicek ulang di server,
// di sini cuma supaya user langsung tahu sebelum menunggu upload.
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.csv']
const MAX_FILE_MB = 20
const MAX_FILES = 10

const REGION_OPTIONS = [
    'ap-southeast-3',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-east-1',
    'us-east-1',
]

type UploadRow = {
    id: number
    original_name: string
    s3_bucket: string
    s3_key: string
    size_bytes: number
    created_at: string
    uploaded_by: number
    Uploader?: { id: number; name: string } | null
}

type Settings = {
    bucket: string
    region: string
    endpoint: string
    prefix: string
    subfolder_mode: 'YEAR_MONTH' | 'NONE'
}

const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

const formatTanggal = (iso: string) =>
    new Date(iso).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })

const bulanKey = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }).slice(0, 7)
}

const bulanLabel = (key: string) => {
    const [y, m] = key.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

const normalizePrefix = (raw: string) => {
    let p = raw.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\/+/, '')
    if (p && !p.endsWith('/')) p += '/'
    return p
}

const extOk = (name: string) =>
    ALLOWED_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))

export default function ExcelUploaderPage() {

    const [role, setRole] = useState('')
    const [userId, setUserId] = useState<number | null>(null)
    const [tab, setTab] = useState<'files' | 'setting'>('files')

    const [rows, setRows] = useState<UploadRow[]>([])
    const [loadError, setLoadError] = useState('')
    const [search, setSearch] = useState('')
    const [bulan, setBulan] = useState('ALL')

    const [settings, setSettings] = useState<Settings | null>(null)
    const [credInfo, setCredInfo] = useState<{ credentials_configured: boolean; access_key_hint: string | null } | null>(null)

    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [uploadNames, setUploadNames] = useState('')
    const [dragOver, setDragOver] = useState(false)
    const fileInput = useRef<HTMLInputElement>(null)

    const isAdmin = role === 'ADMINISTRATOR'

    const token = () => localStorage.getItem('token')

    const fetchFiles = async () => {

        const res = await fetch(`${API_BASE_URL}/excel-uploads`, {
            headers: { Authorization: `Bearer ${token()}` },
        })

        const data = await res.json()

        if (!res.ok) {
            setLoadError(data.message || 'Gagal memuat daftar file')
            setRows([])
            return
        }

        setLoadError('')
        setRows(Array.isArray(data) ? data : [])

    }

    const fetchSettings = async () => {

        const res = await fetch(`${API_BASE_URL}/excel-uploads/settings`, {
            headers: { Authorization: `Bearer ${token()}` },
        })

        if (!res.ok) return

        const data = await res.json()

        setSettings({
            bucket: data.bucket || '',
            region: data.region || 'ap-southeast-3',
            endpoint: data.endpoint || '',
            prefix: data.prefix || '',
            subfolder_mode: data.subfolder_mode === 'NONE' ? 'NONE' : 'YEAR_MONTH',
        })

        setCredInfo({
            credentials_configured: !!data.credentials_configured,
            access_key_hint: data.access_key_hint || null,
        })

    }

    useEffect(() => {

        const r = localStorage.getItem('role') || ''
        setRole(r)

        // Id user dari payload JWT (login tidak menyimpan id terpisah).
        // Cuma dipakai menyembunyikan tombol Hapus di file orang lain --
        // backend tetap yang memutuskan boleh/tidaknya.
        try {
            const payload = JSON.parse(atob((localStorage.getItem('token') || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
            if (payload?.id) setUserId(Number(payload.id))
        } catch {
            // Token rusak/kosong -- tombol Hapus tersembunyi, aman.
        }

        fetchFiles()

        if (r === 'ADMINISTRATOR') fetchSettings()

    }, [])

    // ======================
    // UPLOAD
    // ======================
    const handleFiles = (list: FileList | null) => {

        if (!list || list.length === 0 || uploading) return

        const files = Array.from(list)

        if (files.length > MAX_FILES) {
            alert(`Maksimal ${MAX_FILES} file sekali upload.`)
            return
        }

        const salahFormat = files.filter((f) => !extOk(f.name))

        if (salahFormat.length > 0) {
            alert(`File harus ${ALLOWED_EXTENSIONS.join(', ')}:\n${salahFormat.map((f) => f.name).join('\n')}`)
            return
        }

        const kebesaran = files.filter((f) => f.size > MAX_FILE_MB * 1024 * 1024)

        if (kebesaran.length > 0) {
            alert(`Ukuran file maksimal ${MAX_FILE_MB} MB:\n${kebesaran.map((f) => f.name).join('\n')}`)
            return
        }

        const form = new FormData()
        files.forEach((f) => form.append('files', f))

        // XMLHttpRequest, bukan fetch -- fetch tidak punya progress upload.
        const xhr = new XMLHttpRequest()

        xhr.open('POST', `${API_BASE_URL}/excel-uploads`)
        xhr.setRequestHeader('Authorization', `Bearer ${token()}`)

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }

        xhr.onload = () => {

            setUploading(false)

            let data: { message?: string } = {}
            try { data = JSON.parse(xhr.responseText) } catch { /* bukan JSON */ }

            if (xhr.status < 200 || xhr.status >= 300) {
                alert(data.message || 'Upload gagal')
                return
            }

            fetchFiles()

        }

        xhr.onerror = () => {
            setUploading(false)
            alert('Upload gagal -- koneksi ke server terputus.')
        }

        setUploadNames(files.map((f) => f.name).join(', '))
        setProgress(0)
        setUploading(true)

        xhr.send(form)

        if (fileInput.current) fileInput.current.value = ''

    }

    const handleDownload = async (row: UploadRow) => {

        const res = await fetch(`${API_BASE_URL}/excel-uploads/${row.id}/download`, {
            headers: { Authorization: `Bearer ${token()}` },
        })

        const data = await res.json()

        if (!res.ok) {
            alert(data.message || 'Gagal membuat link download')
            return
        }

        // Link S3 sementara dengan Content-Disposition attachment --
        // browser langsung mengunduh tanpa meninggalkan halaman.
        window.location.assign(data.url)

    }

    const handleDelete = async (row: UploadRow) => {

        if (!confirm(`Hapus file "${row.original_name}"? File dihapus permanen dari S3 dan tidak bisa dikembalikan.`)) {
            return
        }

        const res = await fetch(`${API_BASE_URL}/excel-uploads/${row.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token()}` },
        })

        const data = await res.json()

        if (!res.ok) {
            alert(data.message || 'Gagal menghapus file')
            return
        }

        fetchFiles()

    }

    // ======================
    // SETTING
    // ======================
    const [savingSetting, setSavingSetting] = useState(false)
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

    const updateSetting = (patch: Partial<Settings>) => {
        setSettings((s) => (s ? { ...s, ...patch } : s))
        setTestResult(null)
    }

    const handleTest = async () => {

        if (!settings) return

        setTesting(true)
        setTestResult(null)

        const res = await fetch(`${API_BASE_URL}/excel-uploads/settings/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
            body: JSON.stringify(settings),
        })

        const data = await res.json()

        setTesting(false)
        setTestResult({ ok: res.ok, message: data.message || (res.ok ? 'Berhasil' : 'Gagal') })

    }

    const handleSaveSetting = async () => {

        if (!settings) return

        setSavingSetting(true)

        const res = await fetch(`${API_BASE_URL}/excel-uploads/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
            body: JSON.stringify(settings),
        })

        const data = await res.json()

        setSavingSetting(false)

        if (!res.ok) {
            alert(data.message || 'Gagal menyimpan setting')
            return
        }

        alert('Setting S3 berhasil disimpan')
        fetchSettings()

    }

    // ======================
    // DAFTAR
    // ======================
    const bulanOptions = Array.from(new Set(rows.map((r) => bulanKey(r.created_at))))

    const filtered = rows.filter((r) => {
        const cocokNama = r.original_name.toLowerCase().includes(search.toLowerCase())
        const cocokBulan = bulan === 'ALL' || bulanKey(r.created_at) === bulan
        return cocokNama && cocokBulan
    })

    const PAGE_SIZE = 20
    const [page, setPage] = useState(1)
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const halamanAman = Math.min(page, totalPages)
    const rowsHalamanIni = filtered.slice((halamanAman - 1) * PAGE_SIZE, halamanAman * PAGE_SIZE)

    const now = new Date()
    const contohSub = settings?.subfolder_mode === 'YEAR_MONTH'
        ? `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/`
        : ''
    const tujuan = settings
        ? `s3://${settings.bucket || '<bucket>'}/${normalizePrefix(settings.prefix)}${contohSub}`
        : ''

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">

            {/* HEADER */}
            <div className="bg-white rounded-3xl p-6 shadow-lg flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">📁 Excel Uploader</h1>
                    <p className="text-slate-500 mt-1">Simpan file Excel ke penyimpanan S3 perusahaan.</p>
                </div>

                {isAdmin && (
                    <div className="flex gap-1 bg-slate-100 rounded-full p-1">
                        <button
                            onClick={() => setTab('files')}
                            className={`px-4 py-2 rounded-full text-sm font-semibold ${tab === 'files' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
                        >
                            Daftar File
                        </button>
                        <button
                            onClick={() => setTab('setting')}
                            className={`px-4 py-2 rounded-full text-sm font-semibold ${tab === 'setting' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
                        >
                            ⚙️ Setting S3
                        </button>
                    </div>
                )}
            </div>

            {tab === 'files' && (
                <>
                    {/* UPLOAD */}
                    <div className="bg-white rounded-3xl p-6 shadow-lg">

                        <div
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
                            onClick={() => !uploading && fileInput.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400'}`}
                        >
                            <div className="text-slate-600">
                                📤 Tarik file {ALLOWED_EXTENSIONS.join(' / ')} ke sini atau{' '}
                                <span className="text-blue-600 font-semibold">pilih file</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                                Maks. {MAX_FILE_MB} MB per file &middot; maks. {MAX_FILES} file sekaligus
                            </div>
                            <input
                                ref={fileInput}
                                type="file"
                                multiple
                                accept={ALLOWED_EXTENSIONS.join(',')}
                                className="hidden"
                                onChange={(e) => handleFiles(e.target.files)}
                            />
                        </div>

                        {uploading && (
                            <div className="mt-4 text-sm">
                                <div className="flex justify-between gap-3">
                                    <span className="font-semibold truncate">{uploadNames}</span>
                                    <span className="text-slate-500 tabular-nums">{progress}%</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
                                    <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
                                </div>
                                {progress === 100 && (
                                    <div className="text-xs text-slate-400 mt-1">Menyimpan ke S3...</div>
                                )}
                            </div>
                        )}

                    </div>

                    {/* LIST */}
                    <div className="bg-white rounded-3xl shadow-lg overflow-hidden">

                        <div className="p-4 flex flex-wrap gap-3">
                            <input
                                type="text"
                                placeholder="🔍 Cari nama file..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                                className="flex-1 min-w-[200px] border rounded-2xl p-3"
                            />
                            <select
                                value={bulan}
                                onChange={(e) => { setBulan(e.target.value); setPage(1) }}
                                className="border rounded-2xl p-3"
                            >
                                <option value="ALL">Semua bulan</option>
                                {bulanOptions.map((b) => (
                                    <option key={b} value={b}>{bulanLabel(b)}</option>
                                ))}
                            </select>
                        </div>

                        {loadError && (
                            <div className="mx-4 mb-4 bg-red-50 text-red-700 rounded-xl p-3 text-sm">{loadError}</div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[760px]">
                                <thead className="bg-slate-50 border-y border-slate-200">
                                    <tr>
                                        <th className="p-4 text-sm font-semibold text-slate-500">Nama File</th>
                                        <th className="p-4 text-sm font-semibold text-slate-500">Ukuran</th>
                                        <th className="p-4 text-sm font-semibold text-slate-500">Di-upload oleh</th>
                                        <th className="p-4 text-sm font-semibold text-slate-500">Tanggal</th>
                                        <th className="p-4 text-sm font-semibold text-slate-500">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rowsHalamanIni.map((r) => (
                                        <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                                            <td className="p-4">
                                                <div className="font-semibold text-slate-900">{r.original_name}</div>
                                                <div className="text-xs text-slate-400 font-mono break-all">{r.s3_key}</div>
                                            </td>
                                            <td className="p-4 text-slate-600 tabular-nums whitespace-nowrap">{formatSize(Number(r.size_bytes))}</td>
                                            <td className="p-4 text-slate-600">{r.Uploader?.name || '-'}</td>
                                            <td className="p-4 text-slate-600 tabular-nums whitespace-nowrap">{formatTanggal(r.created_at)}</td>
                                            <td className="p-4">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleDownload(r)}
                                                        className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl text-sm font-semibold"
                                                    >
                                                        ⬇ Download
                                                    </button>
                                                    {(isAdmin || r.uploaded_by === userId) && (
                                                        <button
                                                            onClick={() => handleDelete(r)}
                                                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-semibold"
                                                        >
                                                            🗑 Hapus
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {rowsHalamanIni.length === 0 && !loadError && (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-slate-400">Belum ada file.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-slate-200">
                            <span className="text-xs text-slate-400">
                                Download memakai link sementara (5 menit). Nama file yang sama otomatis diberi akhiran _(2), tidak menimpa.
                            </span>
                            {totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-500">Halaman {halamanAman} dari {totalPages}</span>
                                    <button
                                        onClick={() => setPage(halamanAman - 1)}
                                        disabled={halamanAman <= 1}
                                        className="border border-slate-300 disabled:opacity-40 px-4 py-2 rounded-xl text-sm"
                                    >
                                        ‹
                                    </button>
                                    <button
                                        onClick={() => setPage(halamanAman + 1)}
                                        disabled={halamanAman >= totalPages}
                                        className="border border-slate-300 disabled:opacity-40 px-4 py-2 rounded-xl text-sm"
                                    >
                                        ›
                                    </button>
                                </div>
                            )}
                        </div>

                    </div>
                </>
            )}

            {tab === 'setting' && isAdmin && settings && (
                <div className="space-y-6">

                    <div className="bg-white rounded-3xl p-6 shadow-lg space-y-4">

                        <div>
                            <h2 className="font-bold text-slate-900">Lokasi</h2>
                            <p className="text-sm text-slate-500">Perubahan berlaku untuk upload berikutnya; file lama tetap di lokasi lamanya.</p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">

                            <div>
                                <label className="text-sm text-slate-500">Bucket</label>
                                <input
                                    value={settings.bucket}
                                    onChange={(e) => updateSetting({ bucket: e.target.value.trim() })}
                                    placeholder="nama-bucket"
                                    className="w-full mt-2 border rounded-xl p-3"
                                />
                            </div>

                            <div>
                                <label className="text-sm text-slate-500">Region</label>
                                <input
                                    list="s3-regions"
                                    value={settings.region}
                                    onChange={(e) => updateSetting({ region: e.target.value.trim() })}
                                    className="w-full mt-2 border rounded-xl p-3"
                                />
                                <datalist id="s3-regions">
                                    {REGION_OPTIONS.map((r) => <option key={r} value={r} />)}
                                </datalist>
                                <p className="text-xs text-slate-400 mt-1">ap-southeast-3 = Jakarta, ap-southeast-1 = Singapore</p>
                            </div>

                            <div>
                                <label className="text-sm text-slate-500">Folder / Path (prefix)</label>
                                <input
                                    value={settings.prefix}
                                    onChange={(e) => updateSetting({ prefix: e.target.value })}
                                    placeholder="excel-upload/"
                                    className="w-full mt-2 border rounded-xl p-3 font-mono text-sm"
                                />
                                <p className="text-xs text-slate-400 mt-1">Diisi manual, contoh: excel-upload/ atau data/sales/excel/. Kosong = root bucket.</p>
                            </div>

                            <div>
                                <label className="text-sm text-slate-500">Sub-folder otomatis</label>
                                <select
                                    value={settings.subfolder_mode}
                                    onChange={(e) => updateSetting({ subfolder_mode: e.target.value as Settings['subfolder_mode'] })}
                                    className="w-full mt-2 border rounded-xl p-3"
                                >
                                    <option value="YEAR_MONTH">Per tahun/bulan ({contohSub || 'YYYY/MM/'})</option>
                                    <option value="NONE">Tidak ada</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="text-sm text-slate-500">Endpoint (opsional)</label>
                                <input
                                    value={settings.endpoint}
                                    onChange={(e) => updateSetting({ endpoint: e.target.value.trim() })}
                                    placeholder="Kosongkan untuk AWS S3. Isi hanya untuk layanan kompatibel S3, mis. https://s3.provider.co.id"
                                    className="w-full mt-2 border rounded-xl p-3"
                                />
                            </div>

                        </div>

                        <div className="bg-blue-50 rounded-2xl p-4 text-sm">
                            Contoh lokasi file:<br />
                            <span className="font-mono text-xs break-all">{tujuan}Target_Sales.xlsx</span>
                        </div>

                    </div>

                    <div className="bg-white rounded-3xl p-6 shadow-lg space-y-3">
                        <h2 className="font-bold text-slate-900">Kredensial</h2>
                        {credInfo?.credentials_configured ? (
                            <p className="text-sm text-slate-600">
                                Access Key: <span className="font-mono">{credInfo.access_key_hint}</span> &middot; Secret: <span className="font-mono">••••••••</span>
                            </p>
                        ) : (
                            <p className="text-sm text-red-600 font-semibold">Belum dipasang di server.</p>
                        )}
                        <div className="bg-amber-50 text-amber-800 rounded-2xl p-4 text-sm">
                            🔒 Access key &amp; secret disimpan di file <span className="font-mono">.env</span> server backend
                            (<span className="font-mono">S3_ACCESS_KEY_ID</span>, <span className="font-mono">S3_SECRET_ACCESS_KEY</span>),
                            tidak di database dan tidak bisa diubah dari web. Ganti kredensial = ubah .env lalu restart backend.
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 items-center">
                        <button
                            onClick={handleTest}
                            disabled={testing}
                            className="border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50 px-6 py-3 rounded-xl font-semibold"
                        >
                            {testing ? 'Mengetes...' : '🔌 Tes Koneksi'}
                        </button>
                        <button
                            onClick={handleSaveSetting}
                            disabled={savingSetting}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-6 py-3 rounded-xl font-semibold"
                        >
                            {savingSetting ? 'Menyimpan...' : 'Simpan Setting'}
                        </button>
                    </div>

                    {testResult && (
                        <div className={`rounded-2xl p-4 text-sm font-semibold ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {testResult.ok ? '✓ ' : '✕ '}{testResult.message}
                        </div>
                    )}

                </div>
            )}

        </div>
    )

}
