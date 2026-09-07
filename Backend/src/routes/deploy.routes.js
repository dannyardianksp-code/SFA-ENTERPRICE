const express = require('express')
const router = express.Router()

const { deployWebhook } = require('../controllers/deploy.controller')

router.post('/', deployWebhook)

module.exports = router
