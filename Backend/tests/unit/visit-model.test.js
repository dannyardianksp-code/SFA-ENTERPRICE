const { test, describe } = require('node:test')
const assert = require('node:assert')

const Visit = require('../../src/models/visit.model')


describe('model Visit', () => {

    // Sequelize hanya meng-SELECT dan menulis atribut yang
    // dideklarasikan. Tanpa baris ini, checkIn tidak bisa menyimpan
    // akurasi GPS walau kolomnya sudah ada di database.
    test('location_accuracy dideklarasikan sebagai atribut', () => {
        assert.ok(
            Visit.rawAttributes.location_accuracy,
            'kolom location_accuracy harus dideklarasikan di model'
        )
    })

})
