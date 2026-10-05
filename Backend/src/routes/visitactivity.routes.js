const router = require('express').Router()
const controller = require('../controllers/visitActivity.controller')
const auth = require('../middleware/auth.middleware')
const upload = require('../middleware/upload.middleware')

// upload.any() -- jumlah dan nama field foto sekarang bergantung pada
// field_definitions activity yang dipilih (bisa 0, 1, atau beberapa
// field bertipe PHOTO), jadi tidak bisa lagi upload.single('photo')
// dengan satu nama field tetap. Controller mencocokkan tiap file lewat
// nama field "photo_<field_definition_id>".
router.post('/', auth, upload.any(), controller.create)
router.get('/', auth, controller.getAll)
router.get('/visit/:id', auth, controller.getByVisit)


module.exports = router