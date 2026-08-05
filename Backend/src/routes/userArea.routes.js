const router = require('express').Router()

const controller = require('../controllers/userArea.controller')
const Area = require('../models/area.model')
const auth = require('../middleware/auth.middleware')

const {
    getUserAreas
} = require("../controllers/userArea.controller");



router.get(
    "/:id/areas",
    getUserAreas
);



module.exports = router;