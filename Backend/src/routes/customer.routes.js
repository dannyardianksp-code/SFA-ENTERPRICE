const router = require('express').Router()

const controller = require('../controllers/customer.controller')
const Area = require('../models/area.model')
const auth = require('../middleware/auth.middleware')

// GET semua customer (protected)
router.get('/', auth, controller.getAll)

//Nearby Customer//
router.get(
    "/nearby",
    auth,
    controller.getNearbyCustomers
);

router.get("/:id", auth, controller.getById);

// CREATE customer (protected)
router.post('/', auth, controller.create)



module.exports = router