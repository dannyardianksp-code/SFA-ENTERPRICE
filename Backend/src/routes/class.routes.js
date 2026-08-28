const router =
    require('express').Router()

const Class =
    require('../models/class.model')

const auth =
    require('../middleware/auth.middleware')

const { sendError, sendServerError } =
    require('../utils/response.util')

const { USER_MANAGER_ROLES } =
    require('../utils/access.util')

router.get(

    '/',

    auth,

    async (req, res) => {

        const data =
            await Class.findAll()

        res.json(data)

    }

)

// CREATE -- ADMINISTRATOR saja.
router.post(

    '/',

    auth,

    async (req, res) => {

        try {

            if (!req.user || !USER_MANAGER_ROLES.includes(req.user.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya administrator yang boleh mengelola class.'
                )
            }

            const { code, name } = req.body

            if (typeof code !== 'string' || code.trim() === '') {
                return sendError(res, 400, 'Code wajib diisi.')
            }

            if (typeof name !== 'string' || name.trim() === '') {
                return sendError(res, 400, 'Name wajib diisi.')
            }

            const kelas = await Class.create({
                code: code.trim(),
                name: name.trim(),
            })

            res.json(kelas)

        } catch (err) {
            return sendServerError(res, err, 'CREATE CLASS')
        }

    }

)

// UPDATE -- ADMINISTRATOR saja.
router.put(

    '/:id',

    auth,

    async (req, res) => {

        try {

            if (!req.user || !USER_MANAGER_ROLES.includes(req.user.role)) {
                return sendError(
                    res,
                    403,
                    'Hanya administrator yang boleh mengelola class.'
                )
            }

            const kelas = await Class.findByPk(req.params.id)

            if (!kelas) {
                return sendError(res, 404, 'Class tidak ditemukan.')
            }

            const { code, name } = req.body

            const perubahan = {}

            if (code !== undefined) perubahan.code = code
            if (name !== undefined) perubahan.name = name

            await kelas.update(perubahan)

            res.json(kelas)

        } catch (err) {
            return sendServerError(res, err, 'UPDATE CLASS')
        }

    }

)

module.exports =
    router
