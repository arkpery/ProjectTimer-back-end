const Group = require("../models/group_model").Model;
const User = require("../models/user_model").Model;
const Project = require("../models/project-model");
const groupJwt = require('../middleware/jwtMiddleware')
const groupServices = require('../services/groups-services')
const translator = require("../services/translate");
const projectServices = require("../services/projects-service");
const {
    errorHandler
} = require('../middleware/errorsHandler');

/**
 * Function to get the list and details of all groups
 * @param {Array} req 
 * @param {Array} res 
 */
exports.getAllGroups = async (req, res) => {
    const decoded = groupJwt.decode_token(req);
    const perPage = req.query.perPage ?? 30;
    const numPage = req.query.numPage ?? 1;
    const firstIndex = perPage * (numPage - 1);

    try {
        const list = await Group.find({
                "$or": [{
                        "members": decoded.user.id
                    },
                    {
                        "admin": decoded.user.id
                    }
                ]
            }, null, {
                skip: firstIndex,
                limit: perPage
            })
            .populate("admin", ['email', 'firstname', 'lastname', 'groups', 'avatar'])
            .populate("members", ['email', 'firstname', 'lastname', 'groups', 'avatar']);

        res.json(list);
    } catch (e) {
        res.status(400).json({
            err: e.message
        });
    }
};

/**
 * Function to get a group with its information by id
 * @param {Array} req 
 * @param {Array} res 
 * @returns 
 */
exports.getGroupById = async (req, res) => {
    const id = req.params.groupId;
    try {
        const group = await Group.findById(id).populate({
            path: "admin",
            select: 'email firstname lastname groups avatar',
            populate: {
                path: "groups",

            },
        }).populate('members', ['email', 'firstname', 'lastname', 'groups', 'avatar']);

        if (!group) {
            res.status(404).json({
                message: translator.translate("GROUP_NOT_FOUND")
            });
            return;
        }
        res.json(group);
    } catch (e) {
        res.status(400).json({
            err: e.message
        });
    }
};

/**
 * Function to create a new group 
 * @param {Array} req 
 * @param {Array} res 
 */
exports.createGroup = async (req, res) => {
    const decoded = await groupJwt.decode_token(req);
    const body = req.body;

    body.admin = decoded.user.id;
    if (!body.members) {
        body.members = [];
    }
    const data_members = body.members.slice();
    body.members = [];
    const group = new Group(body);
    try {
        const updated = await group.save();
        const id = updated._id;
        updated.members = data_members;
        await updated.save();
        const members = updated.members;
        const users = await User.find({
            groups: [id]
        });


        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            let flag = true;

            for (let member of members) {
                if (user._id.toString() == member.toString()) {
                    flag = false;
                }
            }
            if (user._id.toString() == updated.admin.toString()) {
                console.log("enter");
            } else if (flag) {
                let f2 = true;

                while (f2) {
                    const index = user.groups.findIndex(el => el.toString() == id.toString());

                    if (index > -1) {
                        user.groups.splice(index, 1);
                    } else {
                        f2 = false;
                    }
                }
                await user.save();
            }
        }
        for (let member of members) {
            const user = await User.findById(member);
            let flag = true;

            for (let group of user.groups) {
                if (group.toString() == id.toString()) {
                    flag = false;
                }
            }
            if (flag) {
                user.groups.push(id);
                await user.save();
            }
        }
        res.status(201).json({
            data:{
                id: id,
            },
            message: translator.translate("GROUP_UPDATED", updated.name),
            group
        });
    } catch (e) {
        res.status(400).json({
            err: e.message
        });
    }
};

/**
 * Function to delete group by id
 * @param {Array} req 
 * @param {Array} res 
 * @returns 
 */
exports.deleteGroupById = async (req, res) => {
    try {

        const groupId = req.params.groupId
        const decoded = await groupJwt.decode_token(req)
        await groupServices.checkIfAdmin(groupId, decoded.user.id)

        const group = await Group.findById(groupId).populate("admin").populate("members");
        if (!group) {
            res.status(404).json({
                err: translator.translate("GROUP_NOT_FOUND")
            });
            return;
        }
        if (group.members.length) {
            throw new Error(translator.translate("GROUP_HAS_MEMBERS"));
        }
        const user = await User.findById(group.admin._id).populate("groups");
        user.groups = user.groups.filter(group => group._id != groupId);
        await user.save();
        const status = await group.delete();
        res.json({
            message: translator.translate("GROUP_DELETED", group.name)
        });
    } catch (e) {
        res.status(400).json({
            err: e.message
        });
    }
};

/**
 * Function to update group by id
 * @param {Array} req 
 * @param {Array} res 
 */
exports.updateGroupById = async (req, res) => {
    const id = req.params.groupId;
    const decoded = await groupJwt.decode_token(req)
    await groupServices.checkIfAdmin(id, decoded.user.id)

    const body = req.body;
    body._id = id;
    if (!body.members) {
        body.members = [];
    }
  // const data_members = body.members.slice();
    //body.members = [];
    const group = new Group(body);

  //  console.log(data_members);
    try {
        const updated = await Group.findByIdAndUpdate(id, group);
//        updated.members = data_members;
        await updated.save();
        const members = updated.members;
        const users = await User.find({
            groups: [id]
        });


        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            let flag = true;

            for (let member of members) {
                if (user._id.toString() == member.toString()) {
                    flag = false;
                }
            }
            if (user._id.toString() == updated.admin.toString()) {
                console.log("enter");
            } else if (flag) {
                let f2 = true;

                while (f2) {
                    const index = user.groups.findIndex(el => el.toString() == id.toString());

                    if (index > -1) {
                        user.groups.splice(index, 1);
                    } else {
                        f2 = false;
                    }
                }
                await user.save();
            }
        }
        for (let member of members) {
            const user = await User.findById(member);
            let flag = true;

            for (let group of user.groups) {
                if (group.toString() == id.toString()) {
                    flag = false;
                }
            }
            if (flag) {
                user.groups.push(id);
                await user.save();
            }
        }
        res.json({
            message: translator.translate("GROUP_UPDATED", updated.name),
            group
        });
    } catch (e) {
        res.status(400).json({
            err: e.message
        });
    }
};

exports.listGroupByProject = async (req, res) => {
    try {
        const projectId = req.params.projectId;
        await projectServices.checkValidProjectId(projectId);
        const projet = await Project.findById(projectId).populate({
            path: "groups",
            populate: {
                path: "admin"
            }
        }).populate({
            path: "groups",
            populate: {
                path: "members"
            }
        });
        const groups = projet.groups;

        res.json({
            message: "list groups",
            data: groups
        });
    } catch (err) {
        errorHandler(err, res);
    }
};

exports.deleteProjectOnGroup = async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const groupId = req.params.groupId;
        await projectServices.checkValidProjectId(projectId);
        await groupServices.checkValidGroupId(groupId);
        const group = await Group.findById(groupId);
        const project = await Project.findById(projectId);

        if (!group) {
            throw new AppError(translator.translate("GROUP_NOT_FOUND"), 404);
        }
        if (!project) {
            throw new AppError(translator.translate("PROJECT_NOT_FOUND"), 404);
        }
        console.log(project.groups)
        project.groups = project.groups.filter(group => group._id != groupId);
        await Project.findByIdAndUpdate(projectId, project);
        const updated = await Project
            .findById(projectId)
            .populate({
                path: "groups",
                populate: {
                    path: "admin"
                }
            }).populate({
                path: "groups",
                populate: {
                    path: "members"
                }
            });

        res.json(updated)
    } catch (err) {
        errorHandler(err, res);
    }
};


exports.insertProject = async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const groupId = req.params.groupId;
        await projectServices.checkValidProjectId(projectId);
        await groupServices.checkValidGroupId(groupId);
        const group = await Group.findById(groupId);
        const project = await Project.findById(projectId);

        if (!group) {
            throw new AppError(translator.translate("GROUP_NOT_FOUND"), 404);
        }
        if (!project) {
            throw new AppError(translator.translate("PROJECT_NOT_FOUND"), 404);
        }
        if (project.groups.indexOf(groupId) === -1) {
            project.groups.push(groupId);
        }
        await Project.findByIdAndUpdate(projectId, project);
        const updated = await Project
            .findById(projectId)
            .populate({
                path: "groups",
                populate: {
                    path: "admin"
                }
            }).populate({
                path: "groups",
                populate: {
                    path: "members"
                }
            });

        res.json(updated)
    } catch (err) {
        errorHandler(err, res);
    }
};