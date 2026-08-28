/* ===================================================
 * network.js - إدارة الاتصال بالغرفة وشبكة اللعبة
 * =================================================== */

// إنشاء الاتصال بالسيرفر
const socket = io();

// متغيرات حالة الاتصال والغرفة الحالية
let currentRoom = null;
let myPlayerId = null;
let myFlag = 'green';
let isHost = false;
let isReady = false;

/* ---------------------------------------------------
 * 1. إدارة النوافذ المنبثقة (Modals Helpers)
 * --------------------------------------------------- */
function openModal(modalId) {
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
    setTimeout(() => {
        msgEl.style.opacity = '0';
    }, 3000);
}

/* ---------------------------------------------------
 * 2. التفاعل مع عناصر القائمة والخيارات
 * --------------------------------------------------- */

// تحديد خيارات إنشاء الغرفة (المال والعلم)
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

// إرسال طلب إنشاء غرفة للسيرفر
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

    socket.emit('createRoom', {
        roomName: roomName,
        initialMoney: initialMoney,
        flag: myFlag
    });
}

// طلب قائمة الغرف المتاحة من السيرفر
function fetchRoomsList() {
    socket.emit('getRoomsList');
}

// الانضمام لغرفة موجودة
function joinRoom(roomId) {
    socket.emit('joinRoom', { roomId: roomId });
}

// اختيار العلم داخل اللوبي
function selectMyFlag(flagColor) {
    myFlag = flagColor;
    document.querySelectorAll('.my-flag-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.flag === flagColor);
    });
    if (currentRoom) {
        socket.emit('updatePlayerFlag', { roomId: currentRoom.id, flag: flagColor });
    }
}

// تغيير حالة الاستعداد
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

// طلب بدء المعركة من قبل المضيف
function requestStartGame() {
    if (currentRoom && isHost) {
        socket.emit('startGameRequest', { roomId: currentRoom.id });
    }
}

/* ---------------------------------------------------
 * 3. أحداث Socket.IO القادمة من السيرفر
 * --------------------------------------------------- */

// استقبال المكونات المعرفة للاعب عند الاتصال الأول
socket.on('connect', () => {
    myPlayerId = socket.id;
    console.log("تم الاتصال بالسيرفر، المعرف الخاص بك:", myPlayerId);
});

// عند تحديث أو استقبال قائمة الغرف
socket.on('updateRoomsList', (rooms) => {
    const listContainer = document.getElementById('rooms-list-container');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (Object.keys(rooms).length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:12px;">لا توجد غرف متاحة حالياً</p>';
        return;
    }

    for (let id in rooms) {
        const room = rooms[id];
        const item = document.createElement('div');
        item.className = 'room-item';

        let actionBadge = '';
        if (room.isPlaying) {
            actionBadge = '<span class="room-badge-playing">قيد اللعب ⚔️</span>';
        } else if (room.playersCount >= 2) {
            actionBadge = '<span class="room-badge-playing">ممتلئة 🔒</span>';
        } else {
            actionBadge = `<button class="room-badge-ready" onclick="joinRoom('${id}')">انضمام 📥</button>`;
        }

        item.innerHTML = `
            <div>
                <strong>${room.name}</strong> 
                <span style="font-size:11px; color:#94a3b8;">(${room.playersCount}/2)</span>
            </div>
            ${actionBadge}
        `;
        listContainer.appendChild(item);
    }
});

// نجاح الانضمام أو إنشاء الغرفة والدخول للوبي
socket.on('roomJoined', (roomData) => {
    currentRoom = roomData;
    isHost = (roomData.hostId === myPlayerId);

    closeModal('create-modal');
    closeModal('rooms-modal');
    openModal('lobby-modal');

    updateLobbyUI(roomData);
});

// تحديث تفاصيل اللوبي (عند دخول لاعب، تغيير العلم، أو الاستعداد)
socket.on('lobbyUpdated', (roomData) => {
    currentRoom = roomData;
    updateLobbyUI(roomData);
});

function updateLobbyUI(room) {
    const title = document.getElementById('lobby-room-title');
    const info = document.getElementById('lobby-room-info');
    const hostSlot = document.getElementById('slot-host');
    const guestSlot = document.getElementById('slot-guest');
    const startBtn = document.getElementById('start-game-btn');

    if (title) title.innerText = `غرفة: ${room.name}`;
    if (info) info.innerText = `المال الابتدائي: ${room.initialMoney} $`;

    // تحديث فتحة المضيف
    if (room.host) {
        hostSlot.querySelector('.p-name').innerText = `👑 المضيف (${room.host.flag === 'green' ? '🟢 أخضر' : '🔴 أحمر'})`;
        hostSlot.querySelector('.p-status').innerText = room.host.ready ? "مستعد ✅" : "غير مستعد ❌";
    }

    // تحديث فتحة الضيف
    if (room.guest) {
        guestSlot.querySelector('.p-name').innerText = `⚔️ الصديق (${room.guest.flag === 'green' ? '🟢 أخضر' : '🔴 أحمر'})`;
        guestSlot.querySelector('.p-status').innerText = room.guest.ready ? "مستعد ✅" : "غير مستعد ❌";
    } else {
        guestSlot.querySelector('.p-name').innerText = "⚔️ الصديق (في انتظار الانضمام...)";
        guestSlot.querySelector('.p-status').innerText = "---";
    }

    // تفعيل زر البدء فقط للمضيف وإذا كان الطرفان مستعدين
    if (startBtn) {
        if (isHost && room.host && room.guest && room.host.ready && room.guest.ready) {
            startBtn.disabled = false;
        } else {
            startBtn.disabled = true;
        }
    }
}

// استقبال أمر إشارة إشارة بدء المعركة الحية
socket.on('gameStarted', (gameState) => {
    closeModal('lobby-modal');
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('ui-overlay').style.display = 'block';

    showFloatingMsg("بدأت المعركة! بالتوفيق ⚔️");

    // استدعاء دالة تشغيل اللعبة الأساسية في client.js (Three.js Engine)
    if (typeof initGameCanvas === 'function') {
        initGameCanvas(gameState);
    }
});

/* ---------------------------------------------------
 * 4. إرسال وأحداث اللعب في الوقت الفعلي (In-Game Network Events)
 * --------------------------------------------------- */

// إرسال أمر حركة أو هجوم دبابة
function sendTankAction(actionData) {
    if (!currentRoom) return;
    socket.emit('playerAction', {
        roomId: currentRoom.id,
        action: actionData
    });
}

// إرسال أمر شراء دبابة جديدة
function sendBuyTankRequest(type) {
    if (!currentRoom) return;
    socket.emit('buyTank', {
        roomId: currentRoom.id,
        tankType: type
    });
}

// استقبال تحديثات اللعبة وتزامن المواقع والدبابات
socket.on('gameStateUpdate', (state) => {
    if (typeof updateGameScene === 'function') {
        updateGameScene(state);
    }
});

// نهاية اللعبة وتحديد الفائز
socket.on('gameOver', (result) => {
    document.getElementById('ui-overlay').style.display = 'none';
    const victoryScreen = document.getElementById('victory-screen');
    const victoryTitle = document.getElementById('victory-title');
    const victoryStats = document.getElementById('victory-stats');

    if (victoryScreen) victoryScreen.style.display = 'flex';

    if (result.winnerId === myPlayerId) {
        if (victoryTitle) {
            victoryTitle.innerText = "🏆 لقد انتصرت ببراعة!";
            victoryTitle.style.color = "#22c55e";
        }
    } else {
        if (victoryTitle) {
            victoryTitle.innerText = "💔 لقد خسر المعركة!";
            victoryTitle.style.color = "#ef4444";
        }
    }

    if (victoryStats) {
        victoryStats.innerHTML = `
            <p>اللاعب الفائز: <strong>${result.winnerName || 'منافسك'}</strong></p>
            <p>سبب انتهاء المعركة: ${result.reason || 'تدمير كامل للقوات'}</p>
        `;
    }
});

// إدارة أخطاء الاتصال
socket.on('errorMessage', (msg) => {
    showFloatingMsg(msg);
});
