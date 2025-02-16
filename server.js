const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// MongoDB bağlantı URI'sini kontrol edelim
if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not defined in .env file');
    process.exit(1);
}

const connectDB = require('./utils/database.js');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const { saveMessage, getMessagesByRoom } = require('./utils/messages.js');
const { formatMessage } = require("./utils/messages.js");
const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require('./utils/users.js');
const { deleteOldRooms, getRooms, createRoom } = require('./utils/rooms.js');
const multer = require('multer');
const moment = require('moment');
const Room = require('./utils/models/room.js');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const cron = require('node-cron');

const waitingUsers = new Map(); // Bekleyen kullanıcıları tutacak Map
const activeRandomRooms = new Map(); // Aktif random odaları tutacak Map
const activeRandomPairs = new Map();

// Odaları her 2 saatte bir kontrol et ve sil
cron.schedule('*/2 * * * *', async () => {  // Her 2 saatte bir çalışacak
  try {
    // 2 saatten eski olan ve hala aktif olmayan odaları sil
    await deleteOldRooms();
    console.log('Eski odalar başarıyla silindi.');
  } catch (error) {
    console.error('Odalar silinirken bir hata oluştu:', error);
  }
});


connectDB(); // Veritabanına bağlantıyı başlat

// JSON verileri için middleware ekleyin
app.use(express.json());

const cors = require('cors');
app.use(cors());


// Statik dosyalar için 'public' klasörünü kullan
app.use(express.static(path.join(__dirname, 'public')));



const botName = 'NightChat Bot';

// Oda oluşturma endpoint'i
app.post('/create-room', async (req, res) => {
    try {
        const { name, password } = req.body;
        const result = await createRoom(name, password);
        res.json(result);
    } catch (error) {
        console.error('Oda oluşturma hatası:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Oda oluşturulurken bir hata oluştu' 
        });
    }
});

// Mevcut odaları istemciye gönder
app.get('/get-rooms', async (req, res) => {
  try {
    const rooms = await getRooms();
    console.log(req.ip)
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: "Odalar yüklenirken hata oluştu." });
  }
});

// oda bulunamadı yadad parolo hatası
app.post('/join-room', async (req, res) => {
  const { roomName, password } = req.body;
  const rooms = await getRooms();
  const room = rooms.find(r => r.name === roomName);

  if (!room) {
      return res.status(404).json({ success: false, message: "Oda bulunamadı!" });
  }

  if (room.password && room.password !== password) {
    // return res.status(401).json({ message: 'pasword hatalı' });
    res.json({ success: false,message: 'pasword hatalı' });
  }
  else{
    res.json({ success: true });
  }


});

// Dosya yükleme için multer konfigürasyonu
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Dosya yükleme endpoint'i
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Dosya yüklenemedi' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'document';

    res.json({
        success: true,
        fileUrl,
        fileType
    });
});

// WebSocket bağlantılarını yönetiyoruz
io.on('connection', async (socket) => {
  socket.on('joinRoom', async ({ username, room }) => {
    const user = userJoin(socket.id, username, room);
    socket.join(user.room);

    // IP adresini al
    const ip = socket.handshake.headers['x-forwarded-for'] || 
               socket.handshake.address.replace('::ffff:', '') || 
               '8.8.8.8';

    // Hoş geldin mesajları
    socket.emit('message', formatMessage(botName, `${username}, NightChat'e hoş geldiniz! 😊`, ip));
    socket.broadcast.to(user.room).emit('message', formatMessage(botName, `${username} sohbete katıldı 👋`, ip));

    // Oda kullanıcılarını güncelle
    io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room),
        activeUserCount: getRoomUsers(user.room).length
    });

    // Daha önceki mesajları al ve kullanıcıya gönder
    const messages = await getMessagesByRoom(user.room);
    messages.forEach((message) => {
        socket.emit('message', formatMessage(message.username, message.text, message.time));
    });
  });

  socket.on('chatMessage', async (message) => {
    const user = getCurrentUser(socket.id);
    if (user) {
      // Gerçek IP adresini almaya çalış
      const ip = socket.handshake.headers['x-forwarded-for'] || 
                 socket.handshake.headers['x-real-ip'] ||
                 socket.handshake.address.replace('::ffff:', '') || 
                 '8.8.8.8';
      
      if (typeof message === 'object') {
        // Dosya veya karmaşık mesaj
        const formattedMessage = formatMessage(user.username, message.text, ip);
        const messageData = {
          ...formattedMessage,
          fileUrl: message.fileUrl,
          fileType: message.fileType,
          fileName: message.fileName
        };
        
        io.to(user.room).emit('message', messageData);
        await saveMessage(user.username, message.text, user.room, ip, message.fileUrl, message.fileType, message.fileName);
      } else {
        // Basit metin mesajı
        const formattedMessage = formatMessage(user.username, message, ip);
        io.to(user.room).emit('message', formattedMessage);
        await saveMessage(user.username, message, user.room, ip);
      }
    }
  });

  socket.on('disconnect', () => {
    const user = userLeave(socket.id);
    if (user) {
      const ip = socket.handshake.headers['x-forwarded-for'] || 
                 socket.handshake.address.replace('::ffff:', '') || 
                 '8.8.8.8';

      io.to(user.room).emit('message', formatMessage(botName, `${user.username} adlı kullanıcı sohbetten ayrıldı`, ip));
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room),
        activeUserCount: getRoomUsers(user.room).length,
      });
    }
  });

  // Random eşleşme olayını güncelleyelim
  socket.on('findRandomPartner', async ({ username }) => {
    // Kullanıcı zaten bir odadaysa veya bekleme listesindeyse işlemi iptal et
    if (waitingUsers.has(socket.id) || activeRandomRooms.has(socket.id)) {
      return;
    }

    // Kullanıcıyı bekleme listesine ekle
    waitingUsers.set(socket.id, {
      username,
      socket
    });

    // Eşleşebilecek kullanıcı var mı kontrol et
    if (waitingUsers.size >= 2) {
      // İlk iki kullanıcıyı al
      const users = Array.from(waitingUsers.entries());
      const user1 = users[0];
      const user2 = users[1];

      // Kullanıcıları bekleme listesinden çıkar
      waitingUsers.delete(user1[0]);
      waitingUsers.delete(user2[0]);

      // Rastgele oda adı oluştur
      const roomName = 'random_' + Math.random().toString(36).substr(2, 9);

      // Kullanıcıları aktif random odalar listesine ekle
      activeRandomRooms.set(user1[0], { partner: user2[0], room: roomName });
      activeRandomRooms.set(user2[0], { partner: user1[0], room: roomName });

      // Her iki kullanıcıya da oda bilgisini gönder
      user1[1].socket.emit('matchFound', { room: roomName, partnerName: user2[1].username });
      user2[1].socket.emit('matchFound', { room: roomName, partnerName: user1[1].username });
    } else {
      socket.emit('waiting');
    }
  });

  // Random chat'ten çıkış yapma olayını ekleyelim
  socket.on('userLeft', () => {
    const randomRoom = activeRandomRooms.get(socket.id);
    if (randomRoom) {
      // Karşı kullanıcıya bildir
      const partnerSocket = io.sockets.sockets.get(randomRoom.partner);
      if (partnerSocket) {
        partnerSocket.emit('partnerLeft');
      }

      // Her iki kullanıcıyı da odadan çıkar
      activeRandomRooms.delete(randomRoom.partner);
      activeRandomRooms.delete(socket.id);
    }
    // Bekleme listesinden de çıkar
    waitingUsers.delete(socket.id);
  });

  // Beklemeden çıkış yapma
  socket.on('cancelWaiting', () => {
    waitingUsers.delete(socket.id);
    // Tüm kullanıcılara güncel bekleyen sayısını gönder
    io.emit('updateWaitingCount', waitingUsers.size);
  });

  // Bağlantı koptuğunda
  socket.on('disconnect', () => {
    // Bekleyen kullanıcılardan çıkar
    waitingUsers.delete(socket.id);
    
    // Random chat temizliği
    const randomRoom = activeRandomRooms.get(socket.id);
    if (randomRoom) {
      const partnerSocket = io.sockets.sockets.get(randomRoom.partner);
      if (partnerSocket) {
        partnerSocket.emit('partnerLeft');
      }
      activeRandomRooms.delete(randomRoom.partner);
      activeRandomRooms.delete(socket.id);
    }
    
    // Tüm kullanıcılara güncel bekleyen sayısını gönder
    io.emit('updateWaitingCount', waitingUsers.size);
  });

  socket.on('joinWaitingList', ({ username }) => {
    waitingUsers.set(socket.id, { username, timestamp: Date.now() });
    io.emit('updateWaitingCount', waitingUsers.size);
  });

  socket.on('readyToMatch', ({ username }) => {
    const waitingArray = Array.from(waitingUsers.entries());
    if (waitingArray.length >= 2) {
        const user1 = waitingArray[0];
        const user2 = waitingArray[1];
        
        // Kullanıcıları bekleme listesinden çıkar
        waitingUsers.delete(user1[0]);
        waitingUsers.delete(user2[0]);
        
        // Rastgele oda adı oluştur
        const room = 'random_' + Math.random().toString(36).substr(2, 9);
        
        // Eşleşmeyi kaydet
        activeRandomPairs.set(room, {
            user1: user1[1].username,
            user2: user2[1].username
        });
        
        // Kullanıcılara eşleşme bilgisini gönder
        io.to(user1[0]).emit('matchFound', {
            room,
            partnerUsername: user2[1].username
        });
        
        io.to(user2[0]).emit('matchFound', {
            room,
            partnerUsername: user1[1].username
        });
        
        // İstatistikleri güncelle
        io.emit('updateStats', {
            activeCount: activeRandomPairs.size,
            waitingCount: waitingUsers.size
        });
    }
  });

  socket.on('randomChatMessage', async ({ room, msg, fileUrl, fileType, fileName }) => {
    const user = getCurrentUser(socket.id);
    if (user) {
        const messageData = {
            username: user.username,
            text: msg,
            time: moment().format('h:mm a'),
            fileUrl,
            fileType,
            fileName
        };

        io.to(room).emit('message', messageData);
        
        try {
            await saveMessage(user.username, msg, room, fileUrl, fileType, fileName);
        } catch (error) {
            console.error('Mesaj kaydedilirken hata:', error);
        }
    }
  });

  socket.on('findNewMatch', ({ username }) => {
    // Mevcut eşleşmeyi sonlandır
    for (const [room, pair] of activeRandomPairs.entries()) {
        if (pair.user1 === username || pair.user2 === username) {
            activeRandomPairs.delete(room);
            io.to(room).emit('partnerLeft');
            break;
        }
    }
  });

  // Kullanıcı random chat odasına katıldığında
  socket.on('joinRandomChat', async ({ username, room }) => {
    const user = userJoin(socket.id, username, room);
    socket.join(room);

    // Hoş geldin mesajı - Kişiselleştirilmiş
    socket.emit('message', formatMessage(botName, `${username}, Random Chat'e hoş geldiniz! İyi sohbetler 😊`));
    
    // Diğer kullanıcıya bildirim
    socket.broadcast.to(room).emit('message', formatMessage(botName, `${username} sohbete katıldı 👋`));

    // Önceki mesajları getir
    try {
        const messages = await getMessagesByRoom(room);
        messages.forEach(message => {
            socket.emit('message', formatMessage(message.username, message.text, message.time));
        });
    } catch (error) {
        console.error('Mesajlar yüklenirken hata:', error);
    }

    // Aktif kullanıcı sayısını güncelle
    const activeUsers = Array.from(io.sockets.sockets).length;
    io.emit('updateStats', {
        activeUsers,
        waitingCount: waitingUsers.size
    });
  });

  // Her yeni bağlantıda ve durum değişikliğinde bekleyen kullanıcı sayısını güncelle
  function updateWaitingCount() {
    io.emit('updateWaitingCount', waitingUsers.size);
  }

  // Belirli aralıklarla bekleyen kullanıcı sayısını güncelle
  setInterval(updateWaitingCount, 5000);

  // Kullanıcı yeni eşleşmeye geçtiğinde
  socket.on('userLeftForNewMatch', ({ room }) => {
    // Odadaki diğer kullanıcıya bildir
    socket.broadcast.to(room).emit('partnerWentToNewMatch');
  });
});

// Oda durumunu kontrol et
app.get('/check-room-status/:roomName', async (req, res) => {
    try {
        const room = await Room.findOne({ name: req.params.roomName });
        if (!room) {
            return res.json({ error: 'Oda bulunamadı' });
        }
        
        res.json({ 
            free: room.free,
            requiresPassword: !room.free 
        });
    } catch (error) {
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server ${PORT} portunda çalışıyor...`));
