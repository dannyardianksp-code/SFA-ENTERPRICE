const Product =
    require('../models/product.model')

const { sendServerError } = require('../utils/response.util')

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
                photo_url: req.body.photo_url,
            })

        res.json(data)

    } catch (err) {

        return sendServerError(res, err, 'CREATE PRODUCT')

    }

}

// UPDATE
exports.update = async (req, res) => {

    try {

        await Product.update(
            {
                code: req.body.code,
                name: req.body.name,
                price: req.body.price,
                uom: req.body.uom,
                is_active: req.body.is_active,
                category: req.body.category,
                photo_url: req.body.photo_url,
            },
            {
                where: {
                    id: req.params.id
                }
            }
        )

        res.json({
            message: 'Produk berhasil diperbarui.'
        })

    } catch (err) {

        return sendServerError(res, err, 'UPDATE PRODUCT')

    }

}

// DELETE
exports.remove = async (req, res) => {

    try {

        await Product.destroy({
            where: {
                id: req.params.id
            }
        })

        res.json({
            message: 'Produk berhasil dihapus.'
        })

    } catch (err) {

        return sendServerError(res, err, 'DELETE PRODUCT')

    }

}
