const mongoose = require('mongoose');

/**
 * Define project model
 */
const ProjectSchema = mongoose.Schema({
    // id_project: {
    //     type: String
    // },
    name: {
        type: String,
        required: "Le nom du projet est requis"
    },

    // timers: {

    // },

    // groups: {

    // },

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
}
);

module.exports = mongoose.model('Project', ProjectSchema);