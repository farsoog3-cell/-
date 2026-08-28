const SERVER_URL = 'https://tank-game-server-o650.onrender.com/';
const socket = io(SERVER_URL);

let currentRoomId = null;
let isHost = false;
let isBotMode = false;
let mySide = 'player'; // 'player' للمضيف (أسفل اليمين) و 'enemy' للمُنضم (أعلى اليسار)

// الاتصال بالسيرفر وجلب الغرف
socket.on('connect', () => {
    console.log('Connected to server!');
    fetchRoomsList();
});

function fetchRoomsList() {
    socket.emit('getRooms');
}

// التحديث المباشر لقائمة الغرف
socket.on('roomsList', (rooms) => {
    const container = document.getElementById('rooms-list-container');
    if (!container) return;
    
    container.innerHTML = '';
    if (!rooms || rooms.length === 0) {
        container.innerHTML = '<div class="no-rooms">لا توجد غرف متاحة حالياً. أنشئ واحدة!</div>';
        return;
    }
    
    rooms.forEach(room => {
        const item = document.createElement('div');
        item.className = 'room-item';
        
        // تعطيل زر الانضمام إذا كانت الغرفة ممتلئة أو بدأت اللعبة
        const isFull = room.playersCount >= 2 || room.isStarted;
        const btnText = room.isStarted ? 'بدأت اللعبة 🔒' : (isFull ? 'مكتملة 🚫' : 'إنضمام ⚔️');
        
        item.innerHTML = `
            <span class="room-name">${room.name} (${room.playersCount}/2)</span>
            <button class="join-btn" ${isFull ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} 
                onclick="if(typeof playClickSound==='function') playClickSound(); joinRoom('${room.id}')">
                ${btnText}
            </button>
        `;
        container.appendChild(item);
    });
});

// 1. إنشاء غرفة أونلاين
function createRoom() {
    isBotMode = false;
    const input = document.getElementById('room-name-input');
    const roomName = (input && input.value.trim()) ? input.value.trim() : `غرفة ${Math.floor(Math.random() * 8999 + 1000)}`;
    
    const flag = typeof playerFlagType !== 'undefined' ? playerFlagType : 'default';
    socket.emit('createRoom', { name: roomName, flag: flag });
}

// 2. الانضمام لغرفة أونلاين
function joinRoom(roomId) {
    isBotMode = false;
    const flag = typeof playerFlagType !== 'undefined' ? playerFlagType : 'default';
    socket.emit('joinRoom', { roomId: roomId, flag: flag });
}

// 3. وضع اللعب مع البوت (أوفلاين/سيرفر محلي)
function playWithBot() {
    isBotMode = true;
    isHost = true;
    mySide = 'player';
    currentRoomId = null;
    
    if (typeof showFloatingMsg === 'function') {
        showFloatingMsg('بدء المعركة ضد البوت 🤖');
    }
    
    // إخفاء القائمة وبدء اللعبة محلياً مع البوت
    const startMenu = document.getElementById('start-menu');
    if (startMenu) startMenu.style.display = 'none';
    
    if (typeof startGameWithBot === 'function') {
        startGameWithBot();
    } else if (typeof startGameOnline === 'function') {
        startGameOnline();
    }
}

// أحداث السيرفر (Socket Listeners)
socket.on('roomCreated', (data) => {
    currentRoomId = data.roomId;
    isHost = true;
    mySide = 'player';
    
    if (typeof showFloatingMsg === 'function') {
        showFloatingMsg('تم إنشاء الغرفة، بانتظار انضمام المنافس...');
    }
    
    // إظهار زر "بدء اللعبة" للمضيف بعد انضمام المنافس أو تجهيز القائمة
    updateHostWaitingUI();
});

socket.on('playerJoined', (data) => {
    if (isHost && typeof showFloatingMsg === 'function') {
        showFloatingMsg('انضم الخصم! يمكنك بدء المعركة الآن 🔥');
        showStartGameButton(); // إظهار زر البدء للمضيف
    }
});

// استقبال أمر بدء اللعبة من السيرفر
socket.on('gameStart', (data) => {
    currentRoomId = data.roomId;
    
    if (!isHost) {
        mySide = 'enemy';
        // ضبط علم الخصم للاعب الثاني
        if (data.players) {
            const hostPlayer = data.players.find(p => p.role === 'host' || p.id !== socket.id);
            if (hostPlayer && typeof enemyFlagType !== 'undefined') {
                enemyFlagType = hostPlayer.flag;
            }
        }
    }
    
    if (typeof showFloatingMsg === 'function') {
        showFloatingMsg('بدأت المعركة! ⚔️');
    }
    
    const startMenu = document.getElementById('start-menu');
    if (startMenu) startMenu.style.display = 'none';
    
    setTimeout(() => { 
        if (typeof startGameOnline === 'function') startGameOnline(); 
    }, 500);
});

// بدء اللعبة بطلب من صاحب الغرفة (Host)
function hostStartGame() {
    if (isHost && currentRoomId) {
        socket.emit('startGame', { roomId: currentRoomId });
    }
}

// انسحاب الخصم
socket.on('playerDisconnected', () => {
    if (typeof showFloatingMsg === 'function') {
        showFloatingMsg('انسحب الخصم من اللعبة!');
    }
    alert('انسحب الخصم من المعركة!');
    location.reload();
});

/* --- إرسال واستقبال الأوامر أثناء اللعب --- */

// 1. حركة الدبابات
function sendMoveOrder(tankIndex, targetPos) {
    if (isBotMode) return; // لا حاجة لإرسال البيانات أونلاين إذا كان اللعب مع بوت
    if (currentRoomId) {
        socket.emit('tankMove', { 
            roomId: currentRoomId, 
            tankIndex: tankIndex, 
            target: { x: targetPos.x, z: targetPos.z } 
        });
    }
}

// 2. شراء الدبابات
function sendBuyOrder(type) {
    if (isBotMode) return;
    if (currentRoomId) {
        socket.emit('buyTank', { 
            roomId: currentRoomId, 
            type: type 
        });
    }
}

// 3. استقبال أوامر الحركة والشراء من المنافس
socket.on('enemyMove', (data) => {
    if (typeof handleEnemyMove === 'function') {
        handleEnemyMove(data);
    }
});

socket.on('enemyBoughtTank', (data) => {
    if (typeof handleEnemyBuy === 'function') {
        handleEnemyBuy(data);
    }
});

/* --- أدوات مساعدة للواجهة --- */
function updateHostWaitingUI() {
    const actionsDiv = document.querySelector('.online-actions');
    if (actionsDiv && !document.getElementById('start-game-btn')) {
        const startBtn = document.createElement('button');
        startBtn.id = 'start-game-btn';
        startBtn.className = 'join-btn';
        startBtn.style.cssText = 'background:#22c55e; padding:10px; margin-top:8px; display:none; width:100%;';
        startBtn.innerText = 'بدء المعركة الآن 🚀';
        startBtn.onclick = hostStartGame;
        actionsDiv.appendChild(startBtn);
    }
}

function showStartGameButton() {
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) startBtn.style.display = 'block';
}
