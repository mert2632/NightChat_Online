const socket = io();
let countdown = 10;
const countdownElement = document.getElementById('countdown');
const waitingCountElement = document.getElementById('waiting-count');
const statusMessage = document.getElementById('status-message');
const cancelBtn = document.getElementById('cancel-btn');

// Kullanıcı adını URL'den al
const username = new URLSearchParams(window.location.search).get('username');

if (!username) {
    window.location.href = 'index.html';
}

// Sunucuya bekleme listesine katılma isteği gönder
socket.emit('joinWaitingList', { username });

// Geri sayım
const timer = setInterval(() => {
    countdown--;
    countdownElement.textContent = countdown;
    
    if (countdown <= 0) {
        clearInterval(timer);
        // Partner ayrıldı mesajını göster
        statusMessage.innerHTML = `<span style="color: #FF6B6B; font-size: 1.2em;">Partner Bekleniyor..</span>`;
        
        setTimeout(() => {
            socket.emit('readyToMatch', { username });
        }, 1000);
    }
}, 1000);

// Çıkış butonu işlevi
cancelBtn.addEventListener('click', () => {
    socket.emit('cancelWaiting');
    window.location.href = 'index.html';
});

// Bekleyen kullanıcı sayısını sürekli güncelle
socket.on('updateWaitingCount', (count) => {
    waitingCountElement.textContent = count;
});

// Eşleşme bulunduğunda
socket.on('matchFound', ({ room, partnerUsername }) => {
    statusMessage.textContent = `${partnerUsername} ile eşleştin! Yönlendiriliyorsun...`;
    setTimeout(() => {
        window.location.href = `/randomChat.html?username=${username}&room=${room}&partner=${partnerUsername}`;
    }, 1500);
});

// Sayfadan ayrılırken temizlik yap
window.addEventListener('beforeunload', () => {
    socket.emit('cancelWaiting');
}); 