const User = require("../models/user.model");
const Area = require("../models/area.model");

const {
    sendError,
    sendServerError,
} = require("../utils/response.util");


exports.getUserAreas = async (req, res) => {

    try {

        const { id } = req.params;


        const user = await User.findByPk(
            id,
            {
                include:[
                    {
                        model: Area,
                        as: "AssignedAreas",
                        attributes:[
                            "id",
                            "code",
                            "name"
                        ],

                        through:{
                            attributes:[]
                        }
                    }
                ]
            }
        );


        if(!user){

            return sendError(
                res,
                404,
                "User tidak ditemukan."
            );

        }


        res.json(
            user.AssignedAreas
        );


    } catch(error){

        return sendServerError(
            res,
            error,
            'GET USER AREA'
        );

    }

};