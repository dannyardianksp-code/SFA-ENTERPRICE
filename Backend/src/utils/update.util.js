/**
 * Menerjemahkan satu nilai dari body update.
 *
 * String kosong berarti NULL: itu yang dikirim form web ketika select
 * supervisor atau channel dikosongkan dengan sengaja.
 *
 * Yang TIDAK dilakukan fungsi ini adalah menangani undefined —
 * pemanggilnya yang menyaring field yang tidak dikirim, sebelum
 * memanggil fungsi ini. Pola lama `field || null` menggabungkan kedua
 * hal itu, dan karena itu ia mengubah "tidak dikirim" menjadi NULL:
 * form edit di web tidak pernah mengirim code maupun area_id, sehingga
 * setiap penyuntingan nama mengosongkan keduanya. Untuk SPG itu berarti
 * nol customer terlihat dan tidak bisa check-in.
 *
 * `0` juga korban pola lama: ia falsy, jadi `|| null` membuangnya.
 */
const nullableUpdate = (value) => {

    if (value === null) {
        return null
    }

    if (typeof value === 'string' && value.trim() === '') {
        return null
    }

    return value

}


module.exports = { nullableUpdate }
