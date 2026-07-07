const Customer = require('./customer.model')
const CustomerGroup = require('./customerGroup.model')
const Product = require('./product.model')
const GroupProduct = require('./groupProduct.model')
const Visit = require('./visit.model')
const User = require('./user.model')
const CustomerProduct = require('./customerProduct.model')
const VisitPlan = require('./visitPlan.model')
const Area = require('./area.model')
const Channel = require('./channel.model')
const VisitActivity = require('./visitActivity.model')
const Activity = require('./activity.model')
const UserArea = require('./userArea.model')



// CUSTOMER → GROUP
Customer.belongsTo(CustomerGroup, {
    foreignKey: 'customer_group_id'
})

CustomerGroup.hasMany(Customer, {
    foreignKey: 'customer_group_id'
})

// GROUP → PRODUCT
CustomerGroup.belongsToMany(Product, {
    through: GroupProduct,
    foreignKey: 'customer_group_id'
})

Product.belongsToMany(CustomerGroup, {
    through: GroupProduct,
    foreignKey: 'product_id'
})

Visit.belongsTo(Customer, {
    foreignKey: 'customer_id'
})

Visit.belongsTo(User, {
    foreignKey: 'user_id'
})

Customer.belongsToMany(Product, {

    through: CustomerProduct,

    foreignKey: 'customer_id'

})

Product.belongsToMany(Customer, {

    through: CustomerProduct,

    foreignKey: 'product_id'

})
VisitPlan.belongsTo(User, {
    foreignKey: 'user_id'
})

VisitPlan.belongsTo(Customer, {
    foreignKey: 'customer_id'
})
VisitPlan.hasOne(Visit, {
    foreignKey: 'visit_plan_id'
})

Visit.belongsTo(VisitPlan, {
    foreignKey: 'visit_plan_id'
})

Area.hasMany(User, {
    foreignKey: 'area_id'
})

User.belongsTo(Area, {
    foreignKey: 'area_id'
})
Area.hasMany(Customer, {

    foreignKey: 'area_id'

})


// User.belongsToMany(

//     Area,

//     {

//         through: UserArea,

//         foreignKey: 'user_id'

//     }

// )

// Area.belongsToMany(

//     User,

//     {

//         through: UserArea,

//         foreignKey: 'area_id'

//     }

// )



Customer.belongsTo(Area, {

    foreignKey: 'area_id'

})

Channel.hasMany(User, {

    foreignKey: 'channel_id'

})

User.belongsTo(Channel, {

    foreignKey: 'channel_id'

})

Channel.hasMany(Customer, {

    foreignKey: 'channel_id'

})

Customer.belongsTo(Channel, {

    foreignKey: 'channel_id'

})

User.hasMany(User, {

    foreignKey: 'supervisor_id',

    as: 'Team'

})

User.belongsTo(User, {

    foreignKey: 'supervisor_id',

    as: 'Supervisor'

})

VisitActivity.belongsTo(Visit, {
    foreignKey: 'visit_id'
})

Visit.hasMany(

    VisitActivity,

    {

        foreignKey: 'visit_id'

    }

)
Visit.belongsTo(

    Customer,

    {

        foreignKey: 'customer_id'

    }

)

Visit.belongsTo(

    User,

    {

        foreignKey: 'user_id'

    }

)

VisitActivity.belongsTo(Activity, { foreignKey: 'activity_id', as: 'Activity' })



Activity.hasMany(VisitActivity, {
    foreignKey: 'activity_id'
})


User.belongsToMany(

    Area,

    {

        through: UserArea,

        foreignKey: 'user_id'

    }

)

Area.belongsToMany(

    User,

    {

        through: UserArea,

        foreignKey: 'area_id'

    }

)



