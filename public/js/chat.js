// Mevcut değişkenlerin altına ekleyelim
const fileInput = document.getElementById('file-input');
const filePreview = document.getElementById('file-preview');
const fileName = document.getElementById('file-name');
const removeFile = document.getElementById('remove-file');
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');
let selectedFile = null;

// Emoji picker'ı oluştur
const picker = new EmojiPicker({
    onEmojiSelect: emoji => {
        const msgInput = document.getElementById('msg');
        const cursorPos = msgInput.selectionStart;
        const text = msgInput.value;
        msgInput.value = text.slice(0, cursorPos) + emoji.unicode + text.slice(cursorPos);
        msgInput.focus();
        msgInput.selectionStart = cursorPos + emoji.unicode.length;
        msgInput.selectionEnd = cursorPos + emoji.unicode.length;
    }
});
document.getElementById('emoji-picker').appendChild(picker);

// Emoji butonu tıklama
emojiBtn.addEventListener('click', () => {
    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
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

// Mesaj gönderme fonksiyonunu güncelleyelim
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = e.target.elements.msg.value.trim();
    
    if (!msg && !selectedFile) return;

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
                    text: msg || '',
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
        // Normal mesaj gönder
        socket.emit('chatMessage', msg);
    }
    
    // Input'u temizle
    e.target.elements.msg.value = '';
    e.target.elements.msg.focus();
});

// Emoji picker'ı dışarı tıklandığında kapat
document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && !emojiBtn.contains(e.target)) {
        emojiPicker.style.display = 'none';
    }
}); 