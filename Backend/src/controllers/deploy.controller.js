const crypto = require('crypto')
const { execFile } = require('child_process')
const path = require('path')

// Root repo (satu tingkat di atas Backend/) -- git pull jalan dari sini,
// npm install + pm2 restart masing-masing dari dalam Backend/ dan
// sfa-web/.
const REPO_ROOT = path.join(__dirname, '..', '..', '..')
const BACKEND_DIR = path.join(__dirname, '..', '..')
const SFA_WEB_DIR = path.join(REPO_ROOT, 'sfa-web')

const verifySignature = (req) => {
    const secret = process.env.DEPLOY_WEBHOOK_SECRET

    // Belum diisi di .env -> webhook nonaktif, tolak semua request
    // (bukan diam-diam jalan tanpa verifikasi).
    if (!secret) return false

    const signature = req.get('x-hub-signature-256')
    if (!signature || !req.rawBody) return false

    const expected =
        'sha256=' +
        crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex')

    const a = Buffer.from(signature)
    const b = Buffer.from(expected)

    return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// Push beruntun (beberapa commit dalam hitungan menit) bikin GitHub kirim
// webhook beberapa kali sebelum deploy sebelumnya selesai -- dua "npm run
// build" nimpa folder .next/ yang sama secara bersamaan, hasilnya build
// korup (error "client reference manifest does not exist" dkk, baru
// kejadian 2026-11-17). isDeploying mencegah dua rantai deploy jalan
// bersamaan; pendingRerun memastikan push yang masuk SELAGI sibuk tidak
// hilang begitu saja -- begitu rantai yang jalan selesai, langsung jalan
// SEKALI LAGI (git pull otomatis ambil HEAD origin/main yang terbaru, jadi
// satu rerun itu sudah mencakup semua push yang numpuk selama sibuk).
let isDeploying = false
let pendingRerun = false

const jalankanDeploy = () => {

    isDeploying = true

    // sfa-web dibangun ulang & di-restart DULUAN -- proses itu independen
    // dari proses yang lagi jalanin script ini. sfa-backend restart
    // PALING TERAKHIR dengan sengaja: itu me-restart proses Node yang
    // sedang mengeksekusi handler ini sendiri, jadi apa pun yang masih
    // perlu jalan setelahnya berisiko keputus.
    const cmd = [
        'set -e',
        `cd "${REPO_ROOT}"`,
        'git pull origin main',
        `cd "${SFA_WEB_DIR}"`,
        'npm install',
        'npm run build',
        'pm2 restart sfa-web',
        `cd "${BACKEND_DIR}"`,
        'npm install --omit=dev',
        'pm2 restart sfa-backend',
    ].join(' && ')

    execFile('bash', ['-c', cmd], (err, stdout, stderr) => {
        const fs = require('fs')
        const log =
            `[${new Date().toISOString()}]\n${stdout}\n${stderr}\n` +
            (err ? `ERROR: ${err.message}\n` : 'OK\n')
        fs.appendFile('/tmp/deploy.log', log, () => {})

        isDeploying = false

        if (pendingRerun) {
            pendingRerun = false
            jalankanDeploy()
        }
    })
}

// GitHub kirim webhook lalu langsung lanjut proses lain -- respons harus
// dibalas dulu (200), deploy jalan di belakang setelahnya. Kalau deploy
// gagal, tidak ada yang tahu lewat HTTP response (sudah terkirim); log
// ke /tmp/deploy.log jadi satu-satunya jejak buat debug manual.
const deployWebhook = (req, res) => {
    if (!verifySignature(req)) {
        return res.status(401).json({ message: 'Invalid signature' })
    }

    if (req.body.ref !== 'refs/heads/main') {
        return res.json({ ok: true, skipped: 'not main branch' })
    }

    if (isDeploying) {
        pendingRerun = true
        return res.json({ ok: true, queued: true })
    }

    res.json({ ok: true, deploying: true })

    jalankanDeploy()
}

module.exports = { deployWebhook }
