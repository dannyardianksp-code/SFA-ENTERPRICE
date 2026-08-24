/**
 * Field wajib/opsional per activity_id. Sebelas tipe ini kategori
 * bisnis tetap -- diletakkan di kode, bukan kolom database, karena
 * mengubahnya tetap butuh deploy di kedua sisi (backend + mobile)
 * kapan pun, sama seperti mengubah kolom plus migrasi.
 *
 * "photo" merujuk pada keberadaan req.file, bukan field di req.body.
 */
const ACTIVITY_FIELD_RULES = {
    1: { required: ['product_name', 'photo'], optional: ['qty', 'notes'] },   // DISPLAY SEWA
    2: { required: ['product_name', 'photo'], optional: ['qty', 'notes'] },   // DISPLAY REGULER
    3: { required: ['notes', 'photo'], optional: ['product_name'] },          // COMPETITOR
    4: {
        required: ['product_name', 'qty', 'expired_date'],
        optional: ['normal_price', 'promo_price', 'photo', 'notes'],
    },                                                                        // STOCK
    5: { required: ['product_name', 'photo'], optional: ['qty', 'notes'] },   // COOKING DEMO
    6: { required: ['product_name', 'photo'], optional: ['qty', 'notes'] },   // SAMPLING
    7: { required: ['photo'], optional: ['notes'] },                          // GRAND OPENING
    8: { required: ['product_name', 'photo'], optional: ['qty', 'notes'] },   // EXTRA DISPLAY
    9: { required: ['product_name', 'photo'], optional: ['qty', 'notes'] },   // MASAK
    10: { required: ['photo'], optional: ['notes'] },                        // FOTO RAK DISPLAY
    11: { required: ['photo'], optional: ['notes'] },                        // FOTO
}


/**
 * Memvalidasi body+file terhadap aturan tipe activity.
 *
 * null = valid. string = pesan error untuk masalah pertama yang
 * ditemukan.
 */
const validateActivityFields = (activityId, body, hasFile) => {

    const aturan = ACTIVITY_FIELD_RULES[activityId]

    if (!aturan) {
        return 'Tipe activity tidak dikenal.'
    }

    for (const field of aturan.required) {

        if (field === 'photo') {
            if (!hasFile) return 'Foto wajib diisi untuk tipe activity ini.'
            continue
        }

        const nilai = body[field]

        if (nilai === undefined || nilai === null || String(nilai).trim() === '') {
            return `Field "${field}" wajib diisi untuk tipe activity ini.`
        }

    }

    // qty diperiksa terpisah dari pengecekan "wajib" di atas, dan
    // berlaku baik saat wajib maupun opsional-tapi-dikirim -- integer
    // yang tidak valid tidak boleh diam-diam tersimpan sebagai NaN atau
    // dibulatkan MySQL jadi 0, yang terbaca seperti stok kosong padahal
    // datanya cuma rusak.
    if (
        body.qty !== undefined &&
        body.qty !== null &&
        String(body.qty).trim() !== '' &&
        (!Number.isInteger(Number(body.qty)) || Number(body.qty) < 0)
    ) {
        return 'Qty harus berupa angka bulat non-negatif.'
    }

    return null

}


module.exports = { ACTIVITY_FIELD_RULES, validateActivityFields }
