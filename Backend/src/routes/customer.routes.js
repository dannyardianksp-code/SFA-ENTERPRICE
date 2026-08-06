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

// Form options — WAJIB di atas "/:id", kalau tidak "form-options"
// akan tertangkap sebagai id.
router.get(
    "/form-options",
    auth,
    controller.getFormOptions
);

router.get("/:id", auth, controller.getById);

// CREATE customer (protected)
router.post('/', auth, controller.create)

// UPDATE field teks (protected). Kode, customer group, area, dan channel
// tidak bisa diubah — lihat LOCKED_FIELDS di controller.
router.put('/:id', auth, controller.update)



module.exports = router