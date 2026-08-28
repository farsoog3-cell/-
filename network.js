const SERVER_URL = 'https://tank-game-server-o650.onrender.com/';
const socket = io(SERVER_URL);

let currentRoomId = null;
let isHost = false;
let selectedMoney = 500;
let selectedFlag = 'green';
let myReadyState = false;

// التحكم بالحوارات المنبثقة Modals
function openModal(id) {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// اختيار أزرار الخيارات (المال والمنشورات)
document.querySelectorAll('.money-opt').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.money-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMoney = parseInt(btn.dataset.money);
    };
});

document.querySelectorAll('.flag-opt').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.flag-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedFlag = btn.dataset.flag;
    };
});

// الاتصال بالسيرفر
socket.on('connect', () => fetchRoomsList());

function fetchRoomsList() {
    socket.emit('getRooms');
}

// استقبال قائمة الغرف وتحديث العرض
socket.on('roomsList', (rooms) => {
    const container = document.getElementById('rooms-list-container');
    if (!container) return;
    container.innerHTML = '';

    if (!rooms || rooms.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#64748b; padding:10px;">لا توجد غرف متاحة حالياً.</div>';
        return;
    }

    rooms.forEach(room => {
        const item = document.createElement('div');
        item.className = 'room-item';
        
        if (room.status === 'playing') {
            item.innerHTML = `
                <span>${room.name} (${room.startMoney}$)</span>
                <span class="room-badge-playing">جاري اللعب 🔴</span>
            `;
        } else {
            item.innerHTML = `
                <span>${room.name} (${room.startMoney}$) - ${room.playersCount}/2</span>
                <button class="room-badge-ready" onclick="joinRoom('${room.id}')">انضمام ⚔️</button>
            `;
        }
        container.appendChild(item);
    });
});

// إنشاء غرفة جديدة
function submitCreateRoom() {
    const nameInput = document.getElementById('create-room-name').value.trim();
    const roomName = nameInput || `غرفة ${Math.floor(Math.random() * 8999 + 1000)}`;
    
    socket.emit('createRoom', { name: roomName, startMoney: selectedMoney, flag: selectedFlag });
}

socket.on('roomCreated', (data) => {
    currentRoomId = data.roomId;
    isHost = true;
    closeModal('create-modal');
    openModal('lobby-modal');
    updateLobbyUI(data.room);
});

// انضمام لغرفة
function joinRoom(roomId) {
    currentRoomId = roomId;
    isHost = false;
    socket.emit('joinRoom', { roomId: roomId, flag: selectedFlag });
    closeModal('rooms-modal');
    openModal('lobby-modal');
}

// تحديث اللوبي عند أي تغيير (انضمام / استعداد / تغيير علم)
socket.on('roomUpdated', (room) => {
    updateLobbyUI(room);
});

function updateLobbyUI(room) {
    document.getElementById('lobby-room-title').innerText = room.name;
    document.getElementById('lobby-room-info').innerText = `مال الحرب: ${room.startMoney} $`;

    const host = room.players.find(p => p.role === 'host');
    const guest = room.players.find(p => p.role === 'guest');

    // تحديث خانه المضيف
    const slotHost = document.getElementById('slot-host');
    if (host) {
        slotHost.innerHTML = `
            <span class="p-name">👑 المضيف (${host.flag === 'green' ? '🟢' : '🔴'})</span>
            <span class="p-status" style="color:${host.isReady ? '#22c55e' : '#ef4444'}">
                ${host.isReady ? 'مستعد ✅' : 'غير مستعد ❌'}
            </span>
        `;
    }

    // تحديث خانه الضيف (الصديق)
    const slotGuest = document.getElementById('slot-guest');
    if (guest) {
        slotGuest.innerHTML = `
            <span class="p-name">⚔️ الصديق (${guest.flag === 'green' ? '🟢' : '🔴'})</span>
            <span class="p-status" style="color:${guest.isReady ? '#22c55e' : '#ef4444'}">
                ${guest.isReady ? 'مستعد ✅' : 'غير مستعد ❌'}
            </span>
        `;
    } else {
        slotGuest.innerHTML = `<span class="p-name" style="color:#64748b">بانتظار انضمام الصديق...</span>`;
    }

    // تفعيل زر بدء اللعبة فقط للمضيف إذا كان الاثنان مستعدين
    const startBtn = document.getElementById('start-game-btn');
    const bothReady = room.players.length === 2 && room.players.every(p => p.isReady);
    
    if (isHost) {
        startBtn.style.display = 'block';
        startBtn.disabled = !bothReady;
    } else {
        startBtn.style.display = 'none'; // إخفاء زر البدء للخصم
    }
}

// ضغطة زر مستعد
function toggleReady() {
    myReadyState = !myReadyState;
    const btn = document.getElementById('ready-toggle-btn');
    btn.innerText = myReadyState ? 'إلغاء الاستعداد ❌' : 'أنا مستعد ✋';
    btn.style.background = myReadyState ? '#ef4444' : '#eab308';

    socket.emit('toggleReady', { roomId: currentRoomId, flag: selectedFlag });
}

function selectMyFlag(flag) {
    selectedFlag = flag;
    socket.emit('toggleReady', { roomId: currentRoomId, flag: selectedFlag });
}

// طلب بدء المعركة من المضيف
function requestStartGame() {
    if (isHost && currentRoomId) {
        socket.emit('startGame', { roomId: currentRoomId });
    }
}

// استقبال بداية اللعبة
socket.on('gameStart', (room) => {
    closeModal('lobby-modal');
    document.getElementById('start-menu').style.display = 'none';
    
    // ضبط رأس المال الابتدائي المحدد من السيرفر
    if (typeof playerMoney !== 'undefined') {
        playerMoney = room.startMoney;
        enemyMoney = room.startMoney;
    }
    
    if (typeof startGameOnline === 'function') startGameOnline();
});

// اللعب ضد البوت
function playWithBot() {
    document.getElementById('start-menu').style.display = 'none';
    if (typeof startGameWithBot === 'function') startGameWithBot();
}
