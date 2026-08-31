const router = require('express').Router()
const controller = require('../controllers/product.controller')
const auth = require('../middleware/auth.middleware')
const upload = require('../middleware/upload.middleware')
const { sendError } = require('../utils/response.util')
const { USER_MANAGER_ROLES } = require('../utils/access.util')

// Product ada di menu ADMIN (Sidebar) -- gerbangnya belum pernah ada di
// route ini sama sekali sebelumnya, cuma `auth` (siapa pun yang login
// bisa create/update). Disamakan dengan Class/Area/Activity Master.
const hanyaAdmin = (req, res, next) => {
    if (!req.user || !USER_MANAGER_ROLES.includes(req.user.role)) {
        return sendError(res, 403, 'Hanya administrator yang boleh mengelola product.')
    }
    next()
}

router.get('/', auth, controller.getAll)
router.post('/', auth, hanyaAdmin, upload.single('photo'), controller.create)
router.put('/:id', auth, hanyaAdmin, upload.single('photo'), controller.update)
router.delete('/:id', auth, hanyaAdmin, controller.remove)

module.exports = router
