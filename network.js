const SERVER_URL = 'https://tank-game-server-o650.onrender.com/';
const socket = io(SERVER_URL);

let currentRoomId = null;
let isHost = false;

socket.on('connect', () => {
    console.log('تم الاتصال بالسيرفر بنجاح:', socket.id);
    fetchRoomsList();
});

function fetchRoomsList() {
    socket.emit('getRooms');
}

socket.on('roomsList', (rooms) => {
    const container = document.getElementById('rooms-list-container');
    container.innerHTML = '';

    if (!rooms || rooms.length === 0) {
        container.innerHTML = '<div class="no-rooms">لا توجد غرف متاحة حالياً، قم بإنشاء واحدة!</div>';
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
    const roomName = input.value.trim() || `غرفة ${Math.floor(Math.random() * 1000)}`;
    socket.emit('createRoom', { name: roomName, flag: playerFlagType });
}

function joinRoom(roomId) {
    socket.emit('joinRoom', { roomId: roomId, flag: playerFlagType });
}

socket.on('roomCreated', (data) => {
    currentRoomId = data.roomId;
    isHost = true;
    showFloatingMsg('تم إنشاء الغرفة، بانتظار الخصم...');
});

socket.on('gameStart', (data) => {
    currentRoomId = data.roomId;
    showFloatingMsg('انضم المنافس! جاري بدء المعركة...');
    setTimeout(() => {
        startGameOnline(data);
    }, 1000);
});

socket.on('playerDisconnected', () => {
    showFloatingMsg('انسحب الخصم من المعركة!');
});

// إرسال الأحداث للخادم
function sendTankMove(tankId, targetPos) {
    if (currentRoomId) {
        socket.emit('tankMove', { roomId: currentRoomId, tankId: tankId, target: targetPos });
    }
}

function sendBuyTank(tankType) {
    if (currentRoomId) {
        socket.emit('buyTank', { roomId: currentRoomId, type: tankType });
    }
}

socket.on('enemyMove', (data) => {
    if (typeof onEnemyMoveReceived === 'function') {
        onEnemyMoveReceived(data);
    }
});

socket.on('enemyBoughtTank', (data) => {
    if (typeof onEnemyBuyReceived === 'function') {
        onEnemyBuyReceived(data);
    }
});