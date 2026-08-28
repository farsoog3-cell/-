const socket = io('https://tank-game-server-o650.onrender.com');

const lobbyContainer = document.getElementById('lobby-container');
const roomNameInput = document.getElementById('room-name-input');
const createRoomBtn = document.getElementById('create-room-btn');
const playBotBtn = document.getElementById('play-bot-btn');
const roomsList = document.getElementById('rooms-list');
const waitingRoom = document.getElementById('waiting-room');
const startGameBtn = document.getElementById('start-game-btn');

// 1. إنشاء غرفة
createRoomBtn.onclick = () => {
    const name = roomNameInput.value.trim() || 'غرفة جديدة';
    socket.emit('create-room', { roomName: name });
};

// 2. لعب ضد البوت
playBotBtn.onclick = () => {
    socket.emit('play-with-bot');
    lobbyContainer.style.display = 'none';
};

// 3. تحديث القائمة فوراً
socket.on('update-room-list', (rooms) => {
    roomsList.innerHTML = '';
    rooms.forEach(room => {
        const li = document.createElement('li');
        li.style.cssText = "display:flex; justify-between; align-center; margin-bottom:5px;";
        li.innerHTML = `<span>${room.name} (${room.playersCount}/4)</span>`;
        
        const joinBtn = document.createElement('button');
        joinBtn.textContent = 'انضمام';
        joinBtn.style.cssText = "background:#3b82f6; color:white; border:none; padding:3px 8px; border-radius:4px;";
        joinBtn.onclick = () => socket.emit('join-room', room.id);
        
        li.appendChild(joinBtn);
        roomsList.appendChild(li);
    });
});

socket.on('room-joined', (data) => {
    waitingRoom.style.display = 'block';
    if (data.isHost) startGameBtn.style.display = 'block';
});

startGameBtn.onclick = () => socket.emit('start-game-signal');

socket.on('game-started', () => {
    lobbyContainer.style.display = 'none';
});

// تحديث مواقع اللاعبين من السيرفر
socket.on('state-update', (serverPlayers) => {
    players = serverPlayers;
});
