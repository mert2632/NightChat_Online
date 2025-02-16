//public/js/main.js
const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
const activeUsers = document.getElementById('active-users');
const typingMessage = document.querySelector('.typing-message');

// Dosya işlemleri için gerekli elementler
const fileInput = document.getElementById('file-input');
const filePreview = document.getElementById('file-preview');
const fileName = document.getElementById('file-name');
const removeFile = document.getElementById('remove-file');
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');
let selectedFile = null;

// Get username and room from URL
const { username, room } = Qs.parse(location.search, {
    ignoreQueryPrefix: true,
});

const socket = io();

// Mevcut socket bağlantısından sonra
const isRandom = new URLSearchParams(window.location.search).get('isRandom');

// Join chatroom
socket.emit('joinRoom', { username, room });

// Get room and users
socket.on('roomUsers', ({ room, users, activeUserCount }) => {
  outputRoomName(room);
  outputUsers(users);
    outputActiveUserCount(activeUserCount);
});

// Dosya seçme işlemi
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        selectedFile = file;
        fileName.textContent = file.name;
        filePreview.style.display = 'block';
    }
});

// Seçilen dosyayı kaldırma
removeFile.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    filePreview.style.display = 'none';
});

// Message submit
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = e.target.elements.msg.value.trim();
    
    // Hem mesaj hem de dosya boşsa gönderme
    if (!msg && !selectedFile) {
        return;
    }

    if (selectedFile) {
        // Dosyayı FormData ile gönder
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('room', room);
        formData.append('username', username);
        
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            if (data.success) {
                socket.emit('chatMessage', {
                    text: msg || '', // Mesaj boş olabilir
                    fileUrl: data.fileUrl,
                    fileType: data.fileType,
                    fileName: selectedFile.name
                });
            }
        } catch (error) {
            console.error('Dosya yükleme hatası:', error);
        }
        
        // Dosya seçimini temizle
        selectedFile = null;
        fileInput.value = '';
        filePreview.style.display = 'none';
    } else {
        // Sadece mesaj gönder
        socket.emit('chatMessage', { text: msg });
    }

    // Input'u temizle
  e.target.elements.msg.value = '';
  e.target.elements.msg.focus();
});

// Message from server
socket.on('message', (message) => {
    outputMessage(message);
    // Scroll down
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Output message to DOM
function outputMessage(message) {
  const div = document.createElement('div');
  div.classList.add('message');
    
    // Sistem mesajları için özel stil
    if (message.username === 'NightChat Bot') {
        div.style.background = '#f0f7ff';
        div.style.borderLeft = '4px solid #4ECDC4';
    }
    
    let messageContent = `
        <p class="meta">
            ${message.username} 
            <span>${message.time}</span>
        </p>
    `;
    
    // Dosya içeriğini kontrol et
    if (message.fileUrl) {
        if (message.fileType === 'image') {
            messageContent += `
                <img src="${message.fileUrl}" alt="Gönderilen resim" />
            `;
        } else {
            messageContent += `
                <a href="${message.fileUrl}" class="file-link" target="_blank">
                    <i class="fas fa-file"></i> ${message.fileName}
                </a>
            `;
        }
    }
    
    if (message.text) {
        messageContent += `<p class="text">${message.text}</p>`;
    }
    
    div.innerHTML = messageContent;
  document.querySelector('.chat-messages').appendChild(div);
}

// Add room name to DOM
function outputRoomName(room) {
  roomName.innerText = room;
}

// Add users to DOM
function outputUsers(users) {
    userList.innerHTML = '';
    users.forEach((user) => {
        const li = document.createElement('li');
        li.innerText = user.username;
        userList.appendChild(li);
    });
}

function outputActiveUserCount(count) {
    activeUsers.innerHTML = `Aktif Kullanıcı Sayısı: ${count}`;
}

// Typing message
const messageInput = document.getElementById('msg');
let typingTimeout = null;

messageInput.addEventListener('input', () => {
    if (!typingTimeout) {
        socket.emit('typing', { username, room });
    }
    
    clearTimeout(typingTimeout);
    
    typingTimeout = setTimeout(() => {
        socket.emit('stopTyping', { username, room });
        typingTimeout = null;
    }, 1000);
});

socket.on('typing', (username) => {
    typingMessage.textContent = `${username} yazıyor...`;
});

socket.on('stopTyping', () => {
    typingMessage.textContent = '';
});

// Karşı kullanıcı çıktığında
socket.on('partnerLeft', () => {
    const div = document.createElement('div');
    div.classList.add('message');
    const time = new Date().toLocaleTimeString();
    div.innerHTML = `
        <p class="meta">Sistem <span>${time}</span></p>
        <p class="text">Karşı kullanıcı sohbetten ayrıldı. Ana sayfaya yönlendiriliyorsunuz...</p>
    `;
    document.querySelector('.chat-messages').appendChild(div);
    
    // 3 saniye sonra ana sayfaya yönlendir
    setTimeout(() => {
        window.location.href = '/index.html';
    }, 3000);
});

// Eşleşme bulunduğunda
socket.on('matchFound', ({ room, partnerName }) => {
    // Eşleşme bulundu mesajı göster
    const waitingMessage = document.getElementById('waiting-message');
    if (waitingMessage) {
        waitingMessage.textContent = `${partnerName} ile eşleştin! Sohbet odasına yönlendiriliyorsun...`;
        waitingMessage.style.color = '#5cb85c';
    }
    
    // Kısa bir gecikme ile chat sayfasına yönlendir
    setTimeout(() => {
        window.location.href = `/chat.html?username=${username}&room=${room}&isRandom=true`;
    }, 1500);
});
