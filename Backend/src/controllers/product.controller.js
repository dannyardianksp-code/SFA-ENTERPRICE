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

        const data =
            await Product.create(req.body)

        res.json(data)

    } catch (err) {

        return sendServerError(res, err, 'CREATE PRODUCT')

    }

}

// UPDATE
exports.update = async (req, res) => {

    try {

        await Product.update(
            req.body,
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
