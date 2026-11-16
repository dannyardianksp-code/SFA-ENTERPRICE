const router =
    require('express').Router()

const auth =
    require('../middleware/auth.middleware')

const CustomerProduct =
    require('../models/customerProduct.model')

const { sendServerError } =
    require('../utils/response.util')

// SAVE MAPPING
router.post(
    '/',
    auth,
    async (req, res) => {

        try {

            const {
                customer_id,
                product_ids
            } = req.body

            // DELETE OLD
            await CustomerProduct.destroy({
                where: {
                    customer_id
                }
            })

            // INSERT NEW
            for (const product_id of product_ids) {

                await CustomerProduct.create({

                    customer_id,

                    product_id

                })

            }

            res.json({
                message: 'Mapping saved'
            })

        } catch (err) {

            return sendServerError(res, err, 'SAVE CUSTOMER PRODUCT MAPPING')

        }

    }
)

module.exports = router