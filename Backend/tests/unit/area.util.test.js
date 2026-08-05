const { test, describe } = require('node:test')
const assert = require('node:assert')

const {
    resolveAccessibleAreaIds,
} = require('../../src/utils/area.util')


describe('resolveAccessibleAreaIds', () => {

    test('memakai AssignedAreas kalau ada (multi-area)', () => {
        const user = {
            area_id: 1,
            AssignedAreas: [
                { id: 1 },
                { id: 2 },
                { id: 5 },
            ],
        }

        assert.deepStrictEqual(
            resolveAccessibleAreaIds(user),
            [1, 2, 5]
        )
    })

    test('AssignedAreas menang atas kolom area_id', () => {
        const user = {
            area_id: 99,
            AssignedAreas: [{ id: 3 }],
        }

        assert.deepStrictEqual(
            resolveAccessibleAreaIds(user),
            [3]
        )
    })

    // Fallback ini yang menyelamatkan user yang belum dipindahkan
    // ke user_areas. Tanpa ini mereka tidak melihat customer apa pun.
    test('fallback ke area_id kalau AssignedAreas kosong', () => {
        const user = {
            area_id: 2,
            AssignedAreas: [],
        }

        assert.deepStrictEqual(
            resolveAccessibleAreaIds(user),
            [2]
        )
    })

    test('fallback juga jalan kalau AssignedAreas tidak di-include', () => {
        const user = { area_id: 7 }

        assert.deepStrictEqual(
            resolveAccessibleAreaIds(user),
            [7]
        )
    })

    test('tanpa area sama sekali menghasilkan list kosong', () => {
        assert.deepStrictEqual(
            resolveAccessibleAreaIds({
                area_id: null,
                AssignedAreas: [],
            }),
            []
        )
    })

    test('area_id null tanpa AssignedAreas menghasilkan list kosong', () => {
        assert.deepStrictEqual(
            resolveAccessibleAreaIds({ area_id: null }),
            []
        )
    })

    test('user null tidak melempar error', () => {
        assert.deepStrictEqual(
            resolveAccessibleAreaIds(null),
            []
        )
        assert.deepStrictEqual(
            resolveAccessibleAreaIds(undefined),
            []
        )
    })

    // area_id = 0 bukan id yang sah di MySQL auto-increment,
    // dan harus diperlakukan sebagai "tidak ada area".
    test('area_id 0 dianggap tidak ada area', () => {
        assert.deepStrictEqual(
            resolveAccessibleAreaIds({ area_id: 0 }),
            []
        )
    })

})
