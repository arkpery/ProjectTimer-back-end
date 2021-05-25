const mongoose = require('mongoose');

/**
 * Define project model
 */
const projectSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    name: {
        type: String,
        required: "Le nom du projet est requis",
        match: /[a-z]/,
        minlength: [3, 'Project name too short !'],
        maxlength: [20, 'Project too long !'],
    },

    admin: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        require: "Admin is required"
    },

    // timers: [{
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Timer',
    //     require: "Timer is required"
    // }],


    groups: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    }],

    close: {
        type: Boolean,
        default: false,
    },

    public: {
        type: Boolean,
        default: false,
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});



module.exports = mongoose.model('Project', projectSchema);


