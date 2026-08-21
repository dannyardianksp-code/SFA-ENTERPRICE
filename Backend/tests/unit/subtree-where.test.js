const { test, describe } = require('node:test')
const assert = require('node:assert')
const { Op } = require('sequelize')

const {
    ownerWhere,
    assertWithinSubtree,
} = require('../../src/utils/access.util')


describe('ownerWhere', () => {

    // null berarti "tidak dibatasi". Mengubahnya menjadi
    // { [Op.in]: null } menghasilkan SQL yang tidak sah, dan
    // mengubahnya menjadi array kosong membuat administrator melihat
    // NOL — kebalikan dari yang dimaksud.
    test('null menghasilkan objek kosong', () => {
        assert.deepStrictEqual(ownerWhere(null), {})
    })

    // Array kosong berarti "tidak ada siapa pun". Op.in dengan array
    // kosong benar untuk itu.
    test('array kosong tetap memakai Op.in', () => {
        const hasil = ownerWhere([])

        assert.deepStrictEqual(hasil.user_id[Op.in], [])
    })

    test('kolom bawaan adalah user_id', () => {
        const hasil = ownerWhere([1, 2])

        assert.deepStrictEqual(hasil.user_id[Op.in], [1, 2])
    })

    // GET /api/users memfilter kolom id, bukan user_id.
    test('kolom bisa diganti', () => {
        const hasil = ownerWhere([3, 4], 'id')

        assert.deepStrictEqual(hasil.id[Op.in], [3, 4])
        assert.strictEqual(hasil.user_id, undefined)
    })

    test('tidak mengubah array yang diberikan', () => {
        const asli = [1, 2]

        ownerWhere(asli)

        assert.deepStrictEqual(asli, [1, 2])
    })

})


describe('assertWithinSubtree', () => {

    test('null meloloskan siapa pun — administrator', () => {
        assert.strictEqual(assertWithinSubtree(null, 12345), null)
    })

    test('pemilik di dalam subtree diloloskan', () => {
        assert.strictEqual(assertWithinSubtree([3, 1, 37], 37), null)
    })

    test('pemilik di luar subtree ditolak 403', () => {
        const hasil = assertWithinSubtree([3, 1, 37], 34)

        assert.ok(hasil)
        assert.strictEqual(hasil.status, 403)
    })

    // JSON tidak menjamin tipe, dan id dari parameter URL selalu string.
    // Tanpa koersi, '37' !== 37 dan supervisor ditolak atas datanya
    // sendiri. Pelajaran yang sama sudah dipasang di
    // assertAreaChannelAccess.
    test('id berupa string tetap cocok dengan id berupa angka', () => {
        assert.strictEqual(assertWithinSubtree([3, 1, 37], '37'), null)
    })

    // Gagal tertutup. Array kosong berarti tidak ada siapa pun, jadi
    // tidak ada pemilik yang boleh lolos.
    test('array kosong menolak semuanya', () => {
        const hasil = assertWithinSubtree([], 1)

        assert.ok(hasil)
        assert.strictEqual(hasil.status, 403)
    })

    // Pemilik yang tidak diketahui tidak boleh diloloskan hanya karena
    // nilainya kosong.
    test('pemilik kosong ditolak, bukan diloloskan', () => {
        for (const kosong of [null, undefined, '']) {
            const hasil = assertWithinSubtree([1, 2], kosong)

            assert.ok(
                hasil,
                `pemilik ${JSON.stringify(kosong)} seharusnya ditolak`
            )
            assert.strictEqual(hasil.status, 403)
        }
    })

})
