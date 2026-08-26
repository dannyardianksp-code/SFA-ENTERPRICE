const router = require('express').Router()
const controller = require('../controllers/attendance.controller')
const auth = require('../middleware/auth.middleware')
const upload = require('../middleware/upload.middleware')

router.post('/checkin', auth, upload.single('photo'), controller.checkIn)
router.post('/checkout', auth, upload.single('photo'), controller.checkOut)
router.get('/today', auth, controller.getToday)

module.exports = router
