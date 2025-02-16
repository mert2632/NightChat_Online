// utils/models/message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: false // Artık text zorunlu değil çünkü dosya da olabilir
    },
    time: {
        type: String,
        required: true
    },
    room: {
        type: String,
        required: true
    },
    fileUrl: {
        type: String,
        required: false
    },
    fileType: {
        type: String,
        required: false // 'image', 'document' gibi
    },
    fileName: {
        type: String,
        required: false
    },
    password: {
        type: String,
        required: false, // Opsiyonel alan
    },
    free: {
        type: Boolean,
        required: true,
        default:true
    },
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
