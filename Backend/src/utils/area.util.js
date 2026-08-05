/**
 * Menentukan area mana saja yang boleh diakses seorang user.
 *
 * Sumber utamanya multi-area lewat tabel user_areas (relasi
 * AssignedAreas). Kolom lama `user.area_id` dipakai sebagai FALLBACK
 * supaya user yang belum dipindahkan ke user_areas tidak kehilangan
 * akses selama masa transisi.
 *
 * Dipakai bersama oleh getAll dan getNearbyCustomers — jangan
 * duplikasi logikanya, karena dua endpoint yang menghitung hak akses
 * dengan cara berbeda adalah sumber bug yang sulit dilacak.
 *
 * HAPUS fallback-nya setelah semua user selesai di-assign ke
 * user_areas, supaya `area_id` tidak lagi jadi jalur diam-diam.
 *
 * @param {object} user instance User dengan include AssignedAreas
 * @returns {number[]} daftar area id, [] kalau tidak punya akses
 */
const resolveAccessibleAreaIds = (user) => {

    if (!user) {
        return []
    }

    if (user.AssignedAreas?.length > 0) {

        return user.AssignedAreas.map(
            area => area.id
        )

    }

    return user.area_id
        ? [user.area_id]
        : []

}


module.exports = {
    resolveAccessibleAreaIds,
}
