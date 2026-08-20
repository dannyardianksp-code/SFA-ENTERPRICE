const { test, describe } = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const BACKEND = path.join(__dirname, '..', '..')
const REPO = path.join(BACKEND, '..')


/**
 * Filesystem Windows tidak peka huruf besar-kecil, jadi require dengan
 * ejaan salah tetap berhasil di sini dan gagal MODULE_NOT_FOUND di
 * Linux — server tidak menyala sama sekali.
 *
 * Ejaan yang benar diambil dari `git ls-files`, BUKAN dari fs.readdir:
 * readdir di Windows akan melaporkan ejaan yang salah pun sebagai
 * "ada", sehingga tes berbasis readdir tetap hijau pada bug ini.
 */
describe('ejaan require peka huruf besar-kecil', () => {

    test('app.js tidak me-require ejaan yang tidak dilacak git', () => {
        const isi = fs.readFileSync(
            path.join(BACKEND, 'src', 'app.js'),
            'utf8'
        )

        const dilacak = execFileSync(
            'git',
            ['ls-files', 'Backend/src'],
            { cwd: REPO, encoding: 'utf8' }
        )
            .split('\n')
            .filter(Boolean)

        const cocok = [...isi.matchAll(
            /require\('\.\/(routes\/[A-Za-z0-9._-]+)'\)/g
        )]

        assert.ok(
            cocok.length > 0,
            'tidak ada require route yang terdeteksi — regexnya perlu diperiksa'
        )

        for (const [, jalur] of cocok) {
            const diharapkan = `Backend/src/${jalur}.js`

            assert.ok(
                dilacak.includes(diharapkan),
                `app.js me-require '${jalur}' tapi git melacak ejaan lain. ` +
                `Ini boot di Windows dan gagal MODULE_NOT_FOUND di Linux.`
            )
        }
    })

})
