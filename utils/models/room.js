const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true, // Oda ismi benzersiz olmalı
    },
    password: {
        type: String,
        required: false, // Parolalı oda seçeneği için opsiyonel
    },
    free: {
        type: Boolean,
        required: true,
        default: true, // Varsayılan olarak serbest girişli oda
    },
    createdAt: { type: Date, default: Date.now } 
});

const Room = mongoose.model('Room', roomSchema);
module.exports = Room;
