// utils/messages.js
const moment = require('moment');
const Message = require('./models/message.js');

async function getLocation() {
  // Basitleştirilmiş fonksiyon
  return 'TR';
}

function formatMessage(username, text, country = 'TR', time = null) {
  const messageTime = time || moment().add(3, 'hours').format('HH:mm');
  const timeWithLocation = `${messageTime} (${country})`;
  
  return {
    username,
    text,
    time: timeWithLocation
  };
}

async function saveMessage(username, text, room, country = 'TR', fileUrl = null, fileType = null, fileName = null) {
  try {
    const currentTime = moment().add(3, 'hours');
    const timeWithLocation = `${currentTime.format('HH:mm')} (${country})`;

    const message = new Message({
      username,
      text,
      time: timeWithLocation,
      room,
      fileUrl,
      fileType,
      fileName
    });
    await message.save();
    return message;
  } catch (error) {
    console.error('Mesaj kaydedilirken hata:', error);
    throw error;
  }
}

async function getMessagesByRoom(room) {
  try {
    return await Message.find({ room }).sort({ createdAt: 1 });
  } catch (error) {
    console.error('Mesajlar getirilirken hata:', error);
    throw error;
  }
}

module.exports = {
  formatMessage,
  saveMessage,
  getMessagesByRoom
};
