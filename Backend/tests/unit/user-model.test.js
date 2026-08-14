const { test, describe } = require('node:test')
const assert = require('node:assert')

const User = require('../../src/models/user.model')


describe('model User', () => {

    // Sequelize hanya meng-SELECT dan menulis atribut yang
    // dideklarasikan. Tanpa baris ini, PUT /:id/status memanggil save()
    // yang tidak menulis apa pun dan gerbang login membandingkan
    // undefined.
    test('status dideklarasikan sebagai atribut', () => {
        assert.ok(
            User.rawAttributes.status,
            'kolom status harus dideklarasikan di model'
        )
    })

    // Tanpa defaultValue, user yang dibuat lewat POST /api/users
    // bergantung pada default database, dan objek yang dikembalikan
    // Sequelize dalam respons menyebut status: undefined.
    test('user baru berstatus ACTIVE tanpa disebutkan', () => {
        assert.strictEqual(
            User.build({ name: 'uji' }).status,
            'ACTIVE'
        )
    })

    // ENUM di model sempat tertinggal di ADMIN/SPV, yang tidak pernah
    // ada di kolomnya.
    test('ENUM role memuat empat nilai yang benar-benar ada di database', () => {
        assert.deepStrictEqual(
            [...User.rawAttributes.role.type.values].sort(),
            ['ADMINISTRATOR', 'MANAGER', 'SPG', 'SUPERVISOR']
        )
    })

})
