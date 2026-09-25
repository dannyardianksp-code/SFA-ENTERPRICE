import { UPLOADS_ORIGIN } from '@/app/utils/api-config'

// Halaman SENGAJA publik (tidak ada cek token/redirect ke /login) --
// sales lapangan (MD/SPG/SALES) yang belum tentu punya akun web sama
// sekali justru butuh unduh APK ini SEBELUM bisa login ke mana pun.
// Link stabil ke APK terbaru, disajikan static oleh Backend (lihat
// app.use('/download', ...) di Backend/src/app.js) -- URL-nya sama
// origin dengan UPLOADS_ORIGIN, cuma path-nya beda.
const APK_URL = `${UPLOADS_ORIGIN}/download/sfa-mobile.apk`

export default function DownloadApkPage() {

    return (

        <div style={{
            minHeight: '100vh',
            background: '#f4f6fb',
            fontFamily: 'sans-serif',
            display: 'flex',
            justifyContent: 'center',
            padding: '40px 20px'
        }}>

            <div style={{ width: '100%', maxWidth: 480 }}>

                <div style={{
                    background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
                    color: 'white',
                    padding: 28,
                    borderRadius: 20,
                    textAlign: 'center',
                    boxShadow: '0 15px 30px rgba(37,99,235,.25)'
                }}>
                    <div style={{ fontSize: 32 }}>📱</div>
                    <h1 style={{ margin: '8px 0 0', fontSize: 22 }}>SRA PRO</h1>
                    <p style={{ margin: '4px 0 0', opacity: .85, fontSize: 14 }}>
                        Sales Route Automation -- Aplikasi Mobile
                    </p>
                </div>

                <div style={{
                    background: 'white',
                    borderRadius: 20,
                    padding: 24,
                    marginTop: 16,
                    boxShadow: '0 10px 25px rgba(0,0,0,.06)'
                }}>

                    <a
                        href={APK_URL}
                        style={{
                            display: 'block',
                            textAlign: 'center',
                            background: '#2563eb',
                            color: 'white',
                            fontWeight: 700,
                            fontSize: 16,
                            padding: '16px 20px',
                            borderRadius: 14,
                            textDecoration: 'none'
                        }}
                    >
                        ⬇ Download APK
                    </a>

                    <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 10 }}>
                        File .apk -- buka langsung dari HP Android setelah selesai unduh.
                    </p>

                    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #eee' }}>

                        <h2 style={{ fontSize: 14, color: '#374151', margin: '0 0 12px' }}>
                            Cara install
                        </h2>

                        <ol style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.8, margin: 0, paddingLeft: 20 }}>
                            <li>Tekan tombol Download APK di atas, tunggu sampai selesai.</li>
                            <li>Buka file APK yang sudah terunduh (biasanya di folder Download).</li>
                            <li>
                                Kalau muncul peringatan &quot;Install blocked&quot; atau &quot;Sumber tidak dikenal&quot;,
                                pilih <strong>Settings</strong> lalu izinkan install dari sumber ini, lalu ulangi.
                            </li>
                            <li>Ikuti proses instalasi sampai selesai, lalu buka aplikasinya.</li>
                        </ol>

                    </div>

                </div>

                <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 16 }}>
                    Link ini buat tim internal -- selalu berisi versi terbaru.
                </p>

            </div>

        </div>

    )

}
