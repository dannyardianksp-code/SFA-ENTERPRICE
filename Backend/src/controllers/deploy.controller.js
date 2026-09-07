const crypto = require('crypto')
const { execFile } = require('child_process')
const path = require('path')

// Root repo (satu tingkat di atas Backend/) -- git pull jalan dari sini,
// npm install + pm2 restart dari dalam Backend/.
const REPO_ROOT = path.join(__dirname, '..', '..', '..')
const BACKEND_DIR = path.join(__dirname, '..', '..')

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

    res.json({ ok: true, deploying: true })

    const cmd = [
        'set -e',
        `cd "${REPO_ROOT}"`,
        'git pull origin main',
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
    })
}

module.exports = { deployWebhook }
