const { test, describe } = require('node:test')
const assert = require('node:assert')

const {
    assertAreaChannelAccess,
    collectSubtreeIds,
    resolveSubordinateUserIds,
    MAX_HIERARCHY_DEPTH,
} = require('../../src/utils/access.util')


describe('assertAreaChannelAccess', () => {

    const spg = {
        role: 'SPG',
        channel_id: 2,
        area_id: null,
        AssignedAreas: [{ id: 1 }, { id: 5 }],
    }

    test('SPG boleh di salah satu area yang di-assign', () => {
        assert.strictEqual(assertAreaChannelAccess(spg, 5, 2), null)
    })

    test('SPG ditolak 403 di luar area', () => {
        const hasil = assertAreaChannelAccess(spg, 9, 2)

        assert.strictEqual(hasil.status, 403)
        assert.match(hasil.message, /wilayah Anda/)
    })

    test('SPG ditolak 403 di channel lain', () => {
        const hasil = assertAreaChannelAccess(spg, 1, 7)

        assert.strictEqual(hasil.status, 403)
        assert.match(hasil.message, /jangkauan Anda/)
    })

    test('SUPERVISOR juga dibatasi', () => {
        const spv = { ...spg, role: 'SUPERVISOR' }

        assert.strictEqual(assertAreaChannelAccess(spv, 1, 2), null)
        assert.strictEqual(assertAreaChannelAccess(spv, 9, 2).status, 403)
    })

    // Nilai role yang sah di kolom users.role adalah versi panjang.
    // Model User masih menulis ADMIN/SPV dan itu usang.
    test('ADMINISTRATOR dan MANAGER tidak dibatasi', () => {
        for (const role of ['ADMINISTRATOR', 'MANAGER']) {
            const user = { role, channel_id: 99, AssignedAreas: [] }

            assert.strictEqual(
                assertAreaChannelAccess(user, 12345, 54321),
                null,
                `${role} seharusnya tidak dibatasi`
            )
        }
    })

    // JSON tidak menjamin tipe. Tanpa koersi, "5" !== 5 dan sales
    // ditolak tanpa sebab.
    test('id berupa string tetap cocok dengan id berupa angka', () => {
        assert.strictEqual(assertAreaChannelAccess(spg, '5', '2'), null)
    })

    test('fallback area_id dipakai kalau AssignedAreas kosong', () => {
        const lama = {
            role: 'SPG',
            channel_id: 2,
            area_id: 3,
            AssignedAreas: [],
        }

        assert.strictEqual(assertAreaChannelAccess(lama, 3, 2), null)
        assert.strictEqual(assertAreaChannelAccess(lama, 4, 2).status, 403)
    })

    // Gagal tertutup. User kosong TIDAK boleh diperlakukan sebagai
    // role tak terbatas.
    test('user kosong ditolak, bukan diloloskan', () => {
        for (const kosong of [null, undefined]) {
            const hasil = assertAreaChannelAccess(kosong, 1, 2)

            assert.ok(hasil, 'user kosong seharusnya ditolak')
            assert.strictEqual(hasil.status, 403)
        }
    })

})


describe('collectSubtreeIds', () => {

    /**
     * Pengambil palsu dari peta parent -> anak.
     * Dipakai supaya kasus melingkar dan batas kedalaman bisa dibuat —
     * keduanya tidak mungkin dibuat dari data sungguhan.
     */
    const pengambilDari = (peta) => async (ids) => {
        const hasil = []

        for (const id of ids) {
            hasil.push(...(peta[id] || []))
        }

        return hasil
    }

    test('tanpa bawahan menghasilkan dirinya sendiri', async () => {
        const hasil = await collectSubtreeIds(1, pengambilDari({}))

        assert.deepStrictEqual(hasil, [1])
    })

    test('satu tingkat', async () => {
        const hasil = await collectSubtreeIds(
            3,
            pengambilDari({ 3: [1, 37, 38] })
        )

        assert.deepStrictEqual(hasil, [3, 1, 37, 38])
    })

    // Anak langsung MANAGER semuanya SUPERVISOR — nol SPG. Penurunan
    // satu tingkat tidak akan pernah mencapai SPG mana pun.
    test('dua tingkat: manager -> supervisor -> SPG', async () => {
        const hasil = await collectSubtreeIds(
            30,
            pengambilDari({
                30: [3, 31, 33],
                3: [1, 37, 38],
                31: [32],
                33: [34],
            })
        )

        assert.deepStrictEqual(
            hasil.sort((a, b) => a - b),
            [1, 3, 30, 31, 32, 33, 34, 37, 38]
        )
    })

    test('dirinya sendiri selalu jadi elemen pertama', async () => {
        const hasil = await collectSubtreeIds(
            30,
            pengambilDari({ 30: [3], 3: [1] })
        )

        assert.strictEqual(hasil[0], 30)
    })

    // Tanpa penyaring id yang sudah terkumpul, ini menggantung selamanya.
    test('data melingkar berhenti, tidak menggantung', async () => {
        const hasil = await collectSubtreeIds(
            1,
            pengambilDari({ 1: [2], 2: [1] })
        )

        assert.deepStrictEqual(
            hasil.sort((a, b) => a - b),
            [1, 2]
        )
    })

    test('melingkar tiga simpul juga berhenti', async () => {
        const hasil = await collectSubtreeIds(
            1,
            pengambilDari({ 1: [2], 2: [3], 3: [1] })
        )

        assert.deepStrictEqual(
            hasil.sort((a, b) => a - b),
            [1, 2, 3]
        )
    })

    test('id yang sama tidak dobel', async () => {
        // Dua atasan berbeda melaporkan anak yang sama.
        const hasil = await collectSubtreeIds(
            1,
            pengambilDari({ 1: [2, 3], 2: [4], 3: [4] })
        )

        assert.deepStrictEqual(
            hasil.sort((a, b) => a - b),
            [1, 2, 3, 4]
        )
    })

    // Rantai lurus lebih panjang dari batas: pengaman terakhir kalau
    // data melingkar lolos dari penyaring.
    test('batas kedalaman dihormati', async () => {
        const peta = {}

        for (let i = 1; i <= MAX_HIERARCHY_DEPTH + 5; i++) {
            peta[i] = [i + 1]
        }

        const hasil = await collectSubtreeIds(1, pengambilDari(peta))

        assert.ok(
            hasil.length <= MAX_HIERARCHY_DEPTH + 1,
            `terkumpul ${hasil.length}, melebihi batas kedalaman`
        )
    })

    test('tidak memanggil pengambil lagi setelah tidak ada anak baru', async () => {
        let panggilan = 0

        const pengambil = async (ids) => {
            panggilan++
            return ids.includes(1) ? [2] : []
        }

        await collectSubtreeIds(1, pengambil)

        // Sekali untuk [1] -> [2], sekali untuk [2] -> [], lalu berhenti.
        assert.strictEqual(panggilan, 2)
    })

})


describe('resolveSubordinateUserIds', () => {

    // null, BUKAN array kosong. Array kosong berarti "tidak ada siapa
    // pun" — kebalikan dari "semua orang".
    test('ADMINISTRATOR menghasilkan null, bukan array kosong', async () => {
        const hasil = await resolveSubordinateUserIds({
            id: 2,
            role: 'ADMINISTRATOR',
        })

        assert.strictEqual(hasil, null)
    })

    test('user kosong menghasilkan array kosong, bukan null', async () => {
        for (const kosong of [null, undefined]) {
            const hasil = await resolveSubordinateUserIds(kosong)

            assert.deepStrictEqual(
                hasil,
                [],
                'user kosong harus melihat nol, bukan segalanya'
            )
        }
    })

})
