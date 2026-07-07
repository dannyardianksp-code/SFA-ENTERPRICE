const Product =
    require('../models/product.model')

// GET ALL
exports.getAll = async (req, res) => {

    const data =
        await Product.findAll({
            order: [['id', 'DESC']]
        })

    res.json(data)

}

// CREATE
exports.create = async (req, res) => {

    try {

        const data =
            await Product.create(req.body)

        res.json(data)

    } catch (err) {

        res.status(500).json({
            error: err.message
        })

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
            message: 'Updated'
        })

    } catch (err) {

        res.status(500).json({
            error: err.message
        })

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
            message: 'Deleted'
        })

    } catch (err) {

        res.status(500).json({
            error: err.message
        })

    }

}