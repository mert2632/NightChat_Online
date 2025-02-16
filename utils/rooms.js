const Room = require('./models/room');

// Yeni oda oluşturma fonksiyonu
async function createRoom(name, password) {
    try {
        const existingRoom = await Room.findOne({ name });
        if (existingRoom) {
            return { success: false, message: "Bu oda zaten var!" };
        }

        const free = !password; // Parolası yoksa serbest girişli
        const room = new Room({ name, password, free });
        await room.save();
        
        return { success: true, room };
    } catch (error) {
        console.error("Oda oluşturulurken hata oluştu:", error);
        return { success: false, message: "Oda oluşturulamadı!" };
    }
}

// Mevcut odaları getir
async function getRooms() {
    try {
        return await Room.find();
    } catch (error) {
        console.error("Odalar getirilemedi:", error);
        return [];
    }
}

// 2 saatten eski olan odaları silen fonksiyon
async function deleteOldRooms() {
  const twoHoursAgo = new Date(Date.now() - 1 *60 * 60 * 1000); // 2 saat öncesi
  try {
    const deletedRooms = await Room.deleteMany({ createdAt: { $lt: twoHoursAgo } });
    console.log(`${deletedRooms.deletedCount} eski oda silindi.`);
  } catch (error) {
    console.error('Eski odalar silinirken bir hata oluştu:', error);
  }
}

module.exports = { deleteOldRooms,createRoom, getRooms };
