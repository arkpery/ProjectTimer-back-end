const User = require("../models/user_model").Model;
const Group = require("../models/group_model").Model;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const translator = require("../services/translate");
const fs = require("fs");
const uuid = require("uuid");
const BASE_DIR = `${__dirname}/../assets/images`;
const userService = require("../services/users-services");
const AppError = require("../errors/app-errors");
const passwordResetToken = require('../models/resetToken.js');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const userJwt = require('../middleware/jwtMiddleware')

const host = process.env.EMAIL_HOST;
const username = process.env.EMAIL_USERNAME;
const password = process.env.EMAIL_PASSWORD;

/**
 * 
 * @param {*} req 
 * @param {*} res 
 */
exports.userRegister = async (req, res) => {
    const views = req.body;
    views.groups = [];
    const data_user = views;

    try {
        data_user.password = bcrypt.hashSync(data_user.password, parseInt(process.env.SALT_ROUNDS, 10));
        const user = new User(data_user);
        if (user.avatar){
            userService.uploadAvatar(user);
        }
        await user.save();
        jwt.sign({
            user: {
                id: user._id,
                email: user.email
            }
        }, process.env.JWT_KEY, {
            expiresIn: "30 days"
        }, (error, token) => {
            if (error) {
                res.status(400);
                console.log(error);
                res.json({
                    message: translator.translate(`SERVER_ERROR`)
                });
            } else {
                res.status(200);
                res.json({
                    "token": token,
                    user: {
                        id: user._id,
                        email: user.email
                    },
                    message: translator.translate(`USER_CREATED`, user.email)
                });
            }
        });
    } catch (e) {
        res.status(400).json({
            err: e.message,
            message: `test`
        });
    }
};

/**
 * 
 * @param {*} req 
 * @param {*} res 
 */
exports.userLogin = async (req, res) => {
    const views = req.body;

    try {
        const user = await User.findOne({
            email: views.email
        });

        const flag = bcrypt.compareSync(views.password, user.password);
        if (flag) {
            jwt.sign({
                user: {
                    id: user._id,
                    email: user.email
                }
            }, process.env.JWT_KEY, {
                expiresIn: "30 days"
            }, (error, token) => {
                if (error) {
                    res.status(400);
                    console.log(error);
                    res.json({
                        message: translator.translate(`SERVER_ERROR`)
                    });
                } else {
                    user.accessToken = token;
                    user.save();
                    res.status(200);
                    res.send({
                        user: {
                            id: user._id,
                            email: user.email,
                            accessToken: token
                        }
                    });
                }
            })
        } else {
            res.status(403);
            console.log(error);
            res.json({
                message: translator.translate("AUTHENTICATION_NO_CORRECT")
            });
        }
    } catch (e) {
        res.status(400).json({
            message: translator.translate("USER_NOT_FOUND")
        });
    }
};


/**
 * function to reset password
 *  function to generates a token which consists of random bytes and attaches it into the URL which will be included in the email.
 * @param {Array} req 
 * @param {*} res 
 * @param {*} next 
 * @returns 
 */
exports.resetPassword = async (req, res, next) => {
    if (!req.body.email) {
        return res
            .status(500)
            .json({ message: 'Email is required' });
    }
    const user = await User.findOne({
        email: req.body.email
    });
    if (!user) {
        return res
            .status(409)
            .json({ message: 'Email does not exist' });
    }
    var resettoken = new passwordResetToken({ _userId: user._id, resettoken: crypto.randomBytes(32).toString('hex') });

    resettoken.save(function (err) {
        if (err) { return res.status(500).send({ msg: err.message }); }
        passwordResetToken.find({ _userId: user._id, resettoken: { $ne: resettoken.resettoken } }).deleteOne().exec();
        res.status(200).json({ message: `Reset Password successfully. An email sent you on ${user.email}` });

        var transporter = nodemailer.createTransport({
            host: host,
            port: process.env.EMAIL_PORT,
            auth: {
                user: username, //generated by Mailtrap
                pass: password //generated by Mailtrap
            }
        });
        // verify connection configuration
        transporter.verify(function (error, success) {
            if (error) {
                console.log(error);
            } else {
                console.log("Server is ready to take our messages");
                transporter.sendMail(mailOptions, (err, info) => {
                    if (err) {
                        console.log(err);
                    }
                })
            }
        });
        var mailOptions = {
            to: user.email,
            from: '"Project Timer" <projecttimer@gmail.com>',
            subject: 'Project Timer Password Reset',
            text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                'http://localhost:4200/response-reset-password/' + resettoken.resettoken + '\n\n' +
                'If you did not request this, please ignore this email and your password will remain unchanged.\n\n' +
                'NB: this link expires in 10 minutes!'
        }

    })
};

/**
 *  function used to verifies the token with user id
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 * @returns 
 */
exports.ValidPasswordToken = async (req, res, next) => {
    if (!req.body.resettoken) {
        return res
            .status(500)
            .json({ message: 'Token is required' });
    }

    const user = await passwordResetToken.findOne({
        resettoken: req.body.resettoken
    });

    if (!user) {
        return res
            .status(409)
            .json({ message: 'Invalid URL' });
    }
    User.findOneAndUpdate({ _id: user._userId }).then(() => {
        res.status(200).json({ message: 'Token verified successfully.' });
    }).catch((err) => {
        return res.status(500).send({ msg: err.message });
    });

}

/**
 * function used for submitting new password
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
exports.NewPassword = async (req, res, next) => {
    passwordResetToken.findOne({ resettoken: req.body.resettoken }, function (err, userToken, next) {
        if (!userToken) {
            return res
                .status(409)
                .json({ message: 'Token has expired' });
        }

        User.findOne({
            _id: userToken._userId
        }, function (err, userEmail, next) {
            if (!userEmail) {
                return res
                    .status(409)
                    .json({ message: 'User does not exist' });
            }
            return bcrypt.hash(req.body.newPassword, 10, (err, hash) => {
                if (err) {
                    return res
                        .status(400)
                        .json({ message: 'Error hashing password' });
                }
                userEmail.password = hash;
                userEmail.save(function (err) {
                    if (err) {
                        return res
                            .status(400)
                            .json({ message: 'Password can not reset.' });
                    } else {
                        userToken.deleteOne();
                        return res
                            .status(201)
                            .json({ message: 'Password reset successfully' });
                    }

                });
            });
        });

    })
}


/**
 * Function used to list all user
 * @param {*} req 
 * @param {*} res 
 */
exports.listAllUsers = async (req, res) => {
    const perPage = req.query.perPage ?? 10;
    const numPage = req.query.numPage ?? 1;
    const firstIndex = perPage * (numPage - 1);

    try {
        const list = await User.find({}, {
            password: 0
        }, {
            skip: firstIndex,
            limit: perPage
        }).populate([{
            path: "groups",
            populate: {
                path: "admin"
            }
        }]);

        res.json(list);
    } catch (e) {
        res.status(400).json({
            err: e.message
        });
    }
};

/**
 * Function used to get user by id
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
exports.getUserById = async (req, res) => {
    const id = req.params.id;

    try {
        const user = await User.findById(id, {
            password: 0
        }).populate([{
            path: "groups",
            populate: {
                path: "admin"
            },
        }, {
            path: "groups",
            populate: {
                path: "members"
            }
        }]);

        if (!user) {
            res.status(404).json({
                err: translator.translate(`USER_NOT_FOUND`)
            });
            return;
        }
        res.json(user);
    } catch (e) {
        res.status(400).json({
            err: e.message
        });
    }
};

/**
 * Function used for updating user by id
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
exports.updateUserById = async (req, res) => {
    const views = req.body;
    const id = req.params.id;
    if (!views.groups) {
        views.groups = [];
    }
    const groups = views.groups.slice();
    views.groups = [];
    const data_user = views;
    data_user._id = id;
    const user = new User(data_user);

    try {
        const userdb = await User.findById(id);
        if (!userdb) {
            res.status(404).json({
                message: translator.translate("USER_NOT_FOUND")
            });
            return;
        }
        if (user.avatar){
            userService.uploadAvatar(user);
        }
        const updated = await User.findByIdAndUpdate(id, user);
        updated.groups = groups;
        await updated.save();
        const list = await Group.find({
            members: id
        });
        for (let i = 0; i < list.length; i++) {
            const group = list[i];
            let flag = false;

            for (let grp of updated.groups) {
                if (grp.toString() == group._id.toString()) {
                    flag = true;
                }
            }
            if (group.admin.toString() == id.toString()) {
                console.log("enter");
            } else if (!flag) {
                let f2 = true;

                while (f2) {
                    const index = group.members.findIndex(el => el.toString() == id.toString());

                    if (index > -1) {
                        group.members.splice(index, 1);
                    } else {
                        f2 = false;
                    }
                }
                await group.save();
            }
        }
        for (let grpId of groups) {
            const grp = await Group.findById(grpId);
            const members = grp.members;
            let flag = false;

            for (let member of members) {
                if (member.toString() == id.toString()) {
                    flag = true;
                }
            }
            if (!flag) {
                grp.members.push(id);
            }
            await grp.save();
        }
        res.json({
            message: translator.translate(`USER_UPDATED`, user.id),
            user
        });
    } catch (e) {
        res.status(400).json({
            err: e.message
        });
    }
};




/**
 * function used for deleting user by id
 * @param {*} req 
 * @param {*} res 
 * @returns 
 */
exports.deleteUserById = async (req, res) => {
    const id = req.params.id;

    try {
        const user = await User.findById(id).populate({
            path: "groups",
            populate: {
                path: "admin",
            }
        });
        if (!user) {
            res.status(404).json({
                err: translator.translate(`USER_NOT_FOUND`)
            });
            return;
        }
        if (!user.groups) {
            user.groups = [];
        }
        const groups = user.groups;
        for (let group of groups) {
            if (group.members.length) {
                group.members = group.members.filter(member => member._id.toString() != id.toString());
                await group.save();
            }
        }
        let flag = true;
        for (let group of groups) {
            if (group.admin._id.toString() === id.toString()) {
                flag = false;
            }
        }
        if (flag) {
            await user.delete();
            res.json({
                message: translator.translate("USER_DELETED", user.id)
            });
        } else {
            throw new Error(translator.translate("USER_CAN_T_BE_DELETED", user.id));
        }
    } catch (e) {
        res.status(400).json({
            err: e.message
        });
    }
};

/**
 * function used for logout user
 * @param {Array} req 
 * @param {*} res 
 * @returns 
 */
exports.Logout = async (req, res) => {
    try {
        const decoded = await userJwt.decode_token(req);
        const user = await User.findById(decoded.user.id);

        if (!user.accessToken) {
            throw new AppError('This user is already Logged out')
        } else {
            user.accessToken = "";
            await user.save();
            return res.send({ success: true, message: "User Logged out" });
        }
    } catch (error) {
        console.error("user-logout-error", error);
        return res.status(500).json({
            error: true,
            message: error.message,
        });
    }
};

exports.serve = (req, res) => {
    const code = req.params.code;
    const pathname = `${BASE_DIR}/${code}/24x24.png`;

    fs.readFile(pathname, {
        encoding: "binary"
    }, (err, data) => {
        if (err){
            res.status(400).json({
                message: "Error"
            });
        }
        else {
            res.set({
                "Content-Type": "image/png"
            }).end(data);
        }
    });
};

