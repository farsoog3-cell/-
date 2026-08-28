/* ===================================================
 * network.js - إدارة اتصالات الغرف والأنلاين
 * =================================================== */

const SERVER_URL = 'https://tank-game-server-o650.onrender.com/';
const socket = io(SERVER_URL);

let currentRoom = null;
let myPlayerId = null;
let myFlag = 'green';
let isHost = false;
let isReady = false;

function openModal(modalId) {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

function showFloatingMsg(msg) {
    const msgEl = document.getElementById('floating-msg');
    if (!msgEl) return;
    msgEl.innerText = msg;
    msgEl.style.opacity = '1';
    setTimeout(() => { msgEl.style.opacity = '0'; }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.money-opt').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.money-opt').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    document.querySelectorAll('.flag-opt').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.flag-opt').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
});

function submitCreateRoom() {
    const roomNameInput = document.getElementById('create-room-name');
    const roomName = roomNameInput ? roomNameInput.value.trim() : '';
    if (!roomName) {
        showFloatingMsg("الرجاء إدخال اسم الغرفة!");
        return;
    }
    const activeMoneyBtn = document.querySelector('.money-opt.active');
    const initialMoney = activeMoneyBtn ? parseInt(activeMoneyBtn.dataset.money) : 500;
    const activeFlagBtn = document.querySelector('.flag-opt.active');
    myFlag = activeFlagBtn ? activeFlagBtn.dataset.flag : 'green';

    socket.emit('createRoom', { roomName, initialMoney, flag: myFlag });
}

function fetchRoomsList() {
    socket.emit('getRoomsList');
}

function joinRoom(roomId) {
    socket.emit('joinRoom', { roomId });
}

function selectMyFlag(flagColor) {
    myFlag = flagColor;
    document.querySelectorAll('.my-flag-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.flag === flagColor);
    });
    if (currentRoom) {
        socket.emit('updatePlayerFlag', { roomId: currentRoom.id, flag: flagColor });
    }
}

function toggleReady() {
    isReady = !isReady;
    const readyBtn = document.getElementById('ready-toggle-btn');
    if (readyBtn) {
        readyBtn.innerText = isReady ? "مستعد ✅" : "أنا مستعد ✋";
        readyBtn.style.background = isReady ? "#22c55e" : "#eab308";
    }
    if (currentRoom) {
        socket.emit('playerReadyState', { roomId: currentRoom.id, ready: isReady });
    }
}

function requestStartGame() {
    if (currentRoom && isHost) {
        socket.emit('startGameRequest', { roomId: currentRoom.id });
    }
}

socket.on('connect', () => {
    myPlayerId = socket.id;
    console.log("متصل بالسيرفر:", myPlayerId);
});

socket.on('updateRoomsList', (rooms) => {
    const listContainer = document.getElementById('rooms-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    if (!rooms || Object.keys(rooms).length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:12px;">لا توجد غرف متاحة</p>';
        return;
    }

    for (let id in rooms) {
        const room = rooms[id];
        const item = document.createElement('div');
        item.className = 'room-item';

        let badge = room.isPlaying ? '<span class="room-badge-playing">جاري اللعب 🔴</span>' :
                    (room.playersCount >= 2 ? '<span class="room-badge-playing">مكتملة 🔒</span>' :
                    `<button class="room-badge-ready" onclick="joinRoom('${id}')">انضمام ⚔️</button>`);

        item.innerHTML = `<div><strong>${room.name}</strong> (${room.initialMoney}$)</div>${badge}`;
        listContainer.appendChild(item);
    }
});

socket.on('roomJoined', (roomData) => {
    currentRoom = roomData;
    isHost = (roomData.hostId === myPlayerId);
    closeModal('create-modal');
    closeModal('rooms-modal');
    openModal('lobby-modal');
    updateLobbyUI(roomData);
});

socket.on('lobbyUpdated', (roomData) => {
    currentRoom = roomData;
    updateLobbyUI(roomData);
});

function updateLobbyUI(room) {
    document.getElementById('lobby-room-title').innerText = `غرفة: ${room.name}`;
    document.getElementById('lobby-room-info').innerText = `مال الحرب: ${room.initialMoney} $`;

    const hostSlot = document.getElementById('slot-host');
    const guestSlot = document.getElementById('slot-guest');
    const startBtn = document.getElementById('start-game-btn');

    if (room.host) {
        hostSlot.innerHTML = `<span class="p-name">👑 المضيف (${room.host.flag === 'green' ? '🟢' : '🔴'})</span>
                              <span class="p-status" style="color:${room.host.ready ? '#22c55e' : '#ef4444'}">${room.host.ready ? 'مستعد ✅' : 'غير مستعد ❌'}</span>`;
    }
    if (room.guest) {
        guestSlot.innerHTML = `<span class="p-name">⚔️ الصديق (${room.guest.flag === 'green' ? '🟢' : '🔴'})</span>
                               <span class="p-status" style="color:${room.guest.ready ? '#22c55e' : '#ef4444'}">${room.guest.ready ? 'مستعد ✅' : 'غير مستعد ❌'}</span>`;
    } else {
        guestSlot.innerHTML = `<span class="p-name" style="color:#64748b">بانتظار انضمام الصديق...</span>`;
    }

    if (startBtn) {
        if (isHost) {
            startBtn.style.display = 'block';
            startBtn.disabled = !(room.host && room.guest && room.host.ready && room.guest.ready);
        } else {
            startBtn.style.display = 'none';
        }
    }
}

socket.on('gameStarted', (gameState) => {
    closeModal('lobby-modal');
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('ui-overlay').style.display = 'block';
    showFloatingMsg("بدأت المعركة! 🚀");
    if (typeof startGameEngine === 'function') {
        startGameEngine(gameState);
    }
});

socket.on('errorMessage', (msg) => showFloatingMsg(msg));
