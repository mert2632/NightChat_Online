const socket = io();
const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const partnerName = document.getElementById('partner-name');
const nextButton = document.getElementById('next-button');
const activePairs = document.getElementById('active-pairs');
const waitingUsers = document.getElementById('waiting-users');
const fileInput = document.getElementById('file-input');
const filePreview = document.getElementById('file-preview');
const fileName = document.getElementById('file-name');
const removeFile = document.getElementById('remove-file');
let selectedFile = null;

// URL'den parametreleri al
const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username');
const room = urlParams.get('room');
const partner = urlParams.get('partner');

// Partner ismini göster
partnerName.innerText = partner;

// Odaya katıl
socket.emit('joinRandomChat', { username, room });

// İstatistikleri güncelle
socket.on('updateStats', ({ activeUsers, waitingCount }) => {
    activePairs.textContent = `Aktif Kullanıcılar: ${activeUsers}`;
    waitingUsers.textContent = `Bekleyen Kullanıcılar: ${waitingCount}`;
});

// Dosya seçme işlemi
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


// Partner ayrıldığında
socket.on('partnerLeft', () => {
    // Partner ismini güncelle
    partnerName.innerText = "Partner Ayrıldı 😔";
    partnerName.style.color = "#FF6B6B";
    
    outputMessage({
        username: 'Sistem',
        text: '👋 Partner ayrıldı. Yeni bir eşleşme bulmak için "Yeni Eşleşme" butonuna tıklayabilirsiniz.',
        time: new Date().toLocaleTimeString()
    });
});

// Yeni eşleşme butonuna tıklama
nextButton.addEventListener('click', () => {
    // Karşı tarafa partner ayrıldı bildirimi gönder
    socket.emit('userLeftForNewMatch', { room });
    
    // Doğrudan waiting.html'e yönlendir
    window.location.href = `/waiting.html?username=${username}`;
});

// Partner yeni eşleşmeye geçtiğinde
socket.on('partnerWentToNewMatch', () => {
    // Partner ismini güncelle
    partnerName.innerText = "Partner Ayrıldı 😔";
    partnerName.style.color = "#FF6B6B";
    
    outputMessage({
        username: 'Sistem',
        text: '👋 Partner yeni bir eşleşme aramaya başladı.',
        time: new Date().toLocaleTimeString()
    });
});

// Butonun hover efekti
nextButton.addEventListener('mouseenter', () => {
    nextButton.style.transform = 'translateY(-3px) scale(1.05)';
    nextButton.style.boxShadow = '0 5px 15px rgba(78, 205, 196, 0.4)';
});

nextButton.addEventListener('mouseleave', () => {
    nextButton.style.transform = 'translateY(0) scale(1)';
    nextButton.style.boxShadow = 'none';
});

// Bekleyen kullanıcı sayısını sürekli güncelle
socket.on('updateWaitingCount', (count) => {
    waitingUsers.textContent = `Bekleyen Kullanıcılar: ${count}`;
});

// Mesajları DOM'a ekle fonksiyonunu güncelleyelim
function outputMessage(message) {
    const div = document.createElement('div');
    div.classList.add('message');
    
    // Sistem mesajları için özel stil
    if (message.username === 'NightChat Bot') {
        div.style.background = '#f0f7ff';
        div.style.borderLeft = '4px solid #4ECDC4';
    }
    
    let messageContent = `
        <p class="meta" style="color: #667aff;">
            ${message.username} 
            <span style="color: #999; font-size: 0.8em;">${message.time}</span>
        </p>
    `;
    
    // Dosya içeriğini kontrol et
    if (message.fileUrl) {
        if (message.fileType === 'image') {
            messageContent += `
                <img src="${message.fileUrl}" alt="Gönderilen resim" style="max-width: 200px; border-radius: 10px;"/>
            `;
        } else {
            messageContent += `
                <a href="${message.fileUrl}" class="file-link" target="_blank">
                    <i class="fas fa-file"></i> ${message.fileName}
                </a>
            `;
        }
    }
    
    // Text yerine message.text kullanıyoruz
    if (message.text) {
        messageContent += `
            <p class="text" style="color: #333; line-height: 1.4;">${message.text}</p>
        `;
    }
    
    div.innerHTML = messageContent;
    chatMessages.appendChild(div);
} 