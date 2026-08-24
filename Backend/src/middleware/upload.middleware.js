const multer = require('multer')

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, 'uploads/')
    },

    filename: (req, file, cb) => {
        cb(
            null,
            Date.now() + '-' + file.originalname
        )
    }

})

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
        // cb(null, false) membuat multer diam-diam tidak melampirkan
        // req.file dan tetap lanjut ke handler normal -- tidak melempar
        // exception, jadi tidak ada stack trace/path server yang bocor ke
        // klien lewat error handler default Express. Handler yang butuh
        // foto (lihat validateActivityFields) sudah menolak 400 yang
        // bersih kalau req.file kosong.
        if (file.fieldname === 'photo' && !file.mimetype.startsWith('image/')) {
            return cb(null, false)
        }
        // Untuk visit-plans, terima segala tipe (excel, dll)
        cb(null, true)
    },
})


module.exports = upload