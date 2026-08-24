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
        // Untuk activity photos, hanya terima gambar
        if (file.fieldname === 'photo') {
            if (!file.mimetype.startsWith('image/')) {
                return cb(new Error('Hanya berkas gambar yang diterima.'))
            }
        }
        // Untuk visit-plans, terima segala tipe (excel, dll)
        cb(null, true)
    },
})


module.exports = upload