require('dotenv').config()

const express = require('express')
const cors = require('cors')

const db = require('./config/database')
require('./models/relations')
const authRoutes = require('./routes/auth.routes')
const customerRoutes = require('./routes/customer.routes')
const productRoutes = require('./routes/product.routes')
const orderRoutes = require('./routes/order.routes')
const visitRoutes = require('./routes/visit.routes')
const visiActivityRoutes = require('./routes/visitactivity.routes')
const customerGroupRoutes = require('./routes/customerGroup.routes')
const customerProductRoutes = require('./routes/customerProduct.routes')
const visitPlanRoutes = require('./routes/visitPlan.routes')
const attendanceRoutes = require('./routes/attendance.routes')
const userRoutes = require('./routes/user.routes')
const activityRoutes = require('./routes/activity.routes')
const dashboardRoutes = require('./routes/dashboard.routes')
const userAreaRoutes = require('./routes/userArea.routes')



const app = express()

// middleware
app.use(cors())

app.use(express.json())

// routes
app.use('/api/auth', authRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/visits', visitRoutes)
app.use('/api/visit-activities', visiActivityRoutes)
app.use('/uploads', express.static('uploads'))
app.use('/api/customer-groups', customerGroupRoutes)
app.use('/api/customer-products', customerProductRoutes)
app.use('/api/visit-plans', visitPlanRoutes)
app.use('/api/attendances', attendanceRoutes)
app.use('/api/users', userRoutes)
app.use('/api/areas', require('./routes/area.routes'))
app.use('/api/channels', require('./routes/channel.routes'))
app.use('/api/activities', require('./routes/activity.routes'))
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/users',userAreaRoutes)



// test endpoint
app.get('/', (req, res) => {
    res.send('SFA API RUNNING 🚀')
})

// start server setelah DB connect
const PORT = process.env.PORT || 1000

db.authenticate()
    .then(() => {
        console.log('Database connected ✅')

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`)
        })
    })
    .catch(err => {
        console.error('DB error:', err)
    })