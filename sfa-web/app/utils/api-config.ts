// Satu sumber kebenaran buat URL backend -- sebelumnya "http://localhost:1000/api"
// ditulis literal di puluhan file, cuma jalan kalau browser dan backend
// sama-sama di localhost. NEXT_PUBLIC_API_URL di-inline saat build
// (`next build`), jadi build produksi (di server) dan build development
// (lokal) bisa nunjuk ke backend yang beda tanpa ubah kode.
export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:1000/api'

// photo_url disimpan sebagai path relatif ("/uploads/...") -- disajikan
// dari root server, bukan di bawah "/api". Sama konvensi dengan mobile
// (UPLOADS_ORIGIN di AttendanceScreen dst): strip akhiran "/api".
export const UPLOADS_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '')
