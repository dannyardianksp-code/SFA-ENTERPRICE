const fs = require('fs')

const Product =
    require('../models/product.model')

const path = require('path')

const { sendServerError } = require('../utils/response.util')

// Hapus berkas foto lama dari disk kalau memang milik server ini
// (path lokal "/uploads/..."), bukan URL eksternal atau kosong.
// Dipanggil setelah baris database sudah aman ter-update/terhapus --
// kalau berkasnya sudah tidak ada (mis. dihapus manual), diam saja.
const hapusFotoLama = (photoUrl) => {

    if (!photoUrl || !photoUrl.startsWith('/uploads/')) return

    const filePath = path.join(
        __dirname, '..', '..', 'uploads', photoUrl.replace('/uploads/', '')
    )

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

}

// GET ALL
exports.getAll = async (req, res) => {

    try {

        const data =
            await Product.findAll({
                order: [['id', 'DESC']]
            })

        res.json(data)

    } catch (err) {

        return sendServerError(res, err, 'GET ALL PRODUCT')

    }

}

// CREATE
exports.create = async (req, res) => {

    try {

        // Field eksplisit, bukan Product.create(req.body) -- spread
        // body langsung ke model membiarkan klien menulis kolom mana
        // pun yang ada di tabel (termasuk id), bukan cuma yang memang
        // dimaksudkan endpoint ini.
        const data =
            await Product.create({
                code: req.body.code,
                name: req.body.name,
                price: req.body.price,
                uom: req.body.uom,
                is_active: req.body.is_active,
                category: req.body.category,
                // Foto ter-upload menang atas photo_url string (form
                // lama/legacy) -- sama pola dengan visitActivity/
                // attendance: req.file duluan, baru fallback ke body.
                photo_url: req.file
                    ? `/uploads/${req.file.filename}`
                    : (req.body.photo_url || null),
            })

        res.json(data)

    } catch (err) {

        // Multer sudah menulis berkasnya ke disk sebelum handler ini
        // sempat jalan -- kalau create gagal (mis. code duplikat),
        // berkasnya harus ikut dihapus, bukan jadi yatim di /uploads
        // yang disajikan tanpa autentikasi.
        if (req.file) fs.unlinkSync(req.file.path)

        return sendServerError(res, err, 'CREATE PRODUCT')

    }

}

// UPDATE
exports.update = async (req, res) => {

    try {

        // Diambil DULU (sebelum update) supaya tahu foto lama mana yang
        // jadi yatim kalau ada upload baru menggantikannya.
        const sebelum = req.file
            ? await Product.findByPk(req.params.id, { attributes: ['photo_url'] })
            : null

        await Product.update(
            {
                code: req.body.code,
                name: req.body.name,
                price: req.body.price,
                uom: req.body.uom,
                is_active: req.body.is_active,
                category: req.body.category,
                // Tidak upload foto baru -> photo_url tetap dari body
                // (undefined kalau field ini memang tidak dikirim, dan
                // Sequelize membuang key undefined -- kolom lama tidak
                // tersentuh, bukan diam-diam dikosongkan).
                photo_url: req.file
                    ? `/uploads/${req.file.filename}`
                    : req.body.photo_url,
            },
            {
                where: {
                    id: req.params.id
                }
            }
        )

        // Foto lama diganti foto baru -- berkas lamanya sudah tidak
        // direferensikan baris mana pun, jadi hapus supaya tidak
        // menumpuk yatim di /uploads (disajikan tanpa autentikasi).
        if (sebelum?.photo_url) hapusFotoLama(sebelum.photo_url)

        res.json({
            message: 'Produk berhasil diperbarui.'
        })

    } catch (err) {

        if (req.file) fs.unlinkSync(req.file.path)

        return sendServerError(res, err, 'UPDATE PRODUCT')

    }

}

// DELETE
exports.remove = async (req, res) => {

    try {

        const produk = await Product.findByPk(req.params.id, {
            attributes: ['photo_url'],
        })

        await Product.destroy({
            where: {
                id: req.params.id
            }
        })

        if (produk?.photo_url) hapusFotoLama(produk.photo_url)

        res.json({
            message: 'Produk berhasil dihapus.'
        })

    } catch (err) {

        return sendServerError(res, err, 'DELETE PRODUCT')

    }

}
