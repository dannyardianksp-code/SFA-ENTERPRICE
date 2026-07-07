const router = require('express').Router()
const controller = require('../controllers/visitActivity.controller')
const auth = require('../middleware/auth.middleware')
const upload = require('../middleware/upload.middleware')

router.post('/', auth, upload.single('photo'), controller.create)
router.get('/', auth, controller.getAll)
router.get('/visit/:id', auth, controller.getByVisit)


module.exports = router