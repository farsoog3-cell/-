const SERVER_URL = 'https://tank-game-server-o650.onrender.com/';
const socket = io(SERVER_URL);

let currentRoomId = null;
let isHost = false;
let mySide = 'player'; // 'player' للمضيف (أسفل اليمين) و 'enemy' للمُنضم (أعلى اليسار)

socket.on('connect', () => {
    fetchRoomsList();
});

function fetchRoomsList() {
    socket.emit('getRooms');
}

socket.on('roomsList', (rooms) => {
    const container = document.getElementById('rooms-list-container');
    container.innerHTML = '';
    if (!rooms || rooms.length === 0) {
        container.innerHTML = '<div class="no-rooms">لا توجد غرف متاحة حالياً. أنشئ واحدة!</div>';
        return;
    }
    rooms.forEach(room => {
        const item = document.createElement('div');
        item.className = 'room-item';
        item.innerHTML = `
            <span class="room-name">${room.name} (${room.playersCount}/2)</span>
            <button class="join-btn" onclick="playClickSound(); joinRoom('${room.id}')">إنضمام ⚔️</button>
        `;
        container.appendChild(item);
    });
});

function createRoom() {
    const input = document.getElementById('room-name-input');
    const roomName = input.value.trim() || `غرفة ${Math.floor(Math.random() * 8999 + 1000)}`;
    socket.emit('createRoom', { name: roomName, flag: playerFlagType });
}

function joinRoom(roomId) {
    socket.emit('joinRoom', { roomId: roomId, flag: playerFlagType });
}

socket.on('roomCreated', (data) => {
    currentRoomId = data.roomId;
    isHost = true;
    mySide = 'player';
    showFloatingMsg('تم إنشاء الغرفة، بانتظار الخصم...');
});

socket.on('gameStart', (data) => {
    currentRoomId = data.roomId;
    if (!isHost) {
        mySide = 'enemy';
        // عكس الأعلام للاعب الثاني
        const hostFlag = data.players.find(p => p.role === 'host').flag;
        enemyFlagType = hostFlag;
    }
    showFloatingMsg('انضم الخصم! جاري إعداد المعركة...');
    setTimeout(() => { startGameOnline(); }, 1000);
});

socket.on('playerDisconnected', () => {
    showFloatingMsg('انسحب الخصم من اللعبة!');
    alert('انسحب الخصم من المعركة!');
    location.reload();
});

// إرسال الأوامر للسيرفر
function sendMoveOrder(tankIndex, targetPos) {
    if (currentRoomId) {
        socket.emit('tankMove', { roomId: currentRoomId, tankIndex, target: { x: targetPos.x, z: targetPos.z } });
    }
}

function sendBuyOrder(type) {
    if (currentRoomId) {
        socket.emit('buyTank', { roomId: currentRoomId, type });
    }
}

// استقبال الأوامر من الخصم
socket.on('enemyMove', (data) => {
    if (typeof handleEnemyMove === 'function') handleEnemyMove(data);
});

socket.on('enemyBoughtTank', (data) => {
    if (typeof handleEnemyBuy === 'function') handleEnemyBuy(data);
});