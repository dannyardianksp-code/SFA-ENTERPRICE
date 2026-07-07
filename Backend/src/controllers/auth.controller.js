const User = require('../models/user.model')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

// REGISTER
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body

        const hashPassword = await bcrypt.hash(password, 10)

        const user = await User.create({
            name,
            email,
            password: hashPassword
        })

        res.json(user)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}

// LOGIN
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body

        const user = await User.findOne({ where: { email } })
        if (!user) return res.status(404).json({ message: 'User not found' })
        if (
            user.status ===
            'INACTIVE'
        ) {

            return res.status(403)
                .json({

                    message:
                        'User nonaktif'

                })

        }

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) return res.status(400).json({ message: 'Wrong password' })

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        )

        res.json({

            token,

            user: {

                id: user.id,

                name: user.name,

                role: user.role

            }

        })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
}