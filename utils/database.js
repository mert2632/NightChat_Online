// utils/database.js
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Atlas Veritabanına Bağlanıldı');
    } catch (error) {
        console.error('MongoDB Veritabanına Bağlanırken Hata Oluştu:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;
