const socket = io('https://tank-game-server-o650.onrender.com');

// العناصر
const modalMain = document.getElementById('modal-main');
const modalCreate = document.getElementById('modal-create');
const modalList = document.getElementById('modal-list');
const modalRoom = document.getElementById('modal-room');
const uiOverlay = document.getElementById('ui-overlay');

let selectedMoney = 200;
let selectedFlag = 'green';
let isReady = false;

// التنقل بين النوافذ
document.getElementById('btn-open-create').onclick = () => { modalMain.style.display = 'none'; modalCreate.style.display = 'flex'; };
document.getElementById('btn-cancel-create').onclick = () => { modalCreate.style.display = 'none'; modalMain.style.display = 'flex'; };
document.getElementById('btn-open-list').onclick = () => { modalMain.style.display = 'none'; modalList.style.display = 'flex'; };
document.getElementById('btn-close-list').onclick = () => { modalList.style.display = 'none'; modalMain.style.display = 'flex'; };

// اختيار المال والعلم
document.querySelectorAll('.money-opt').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.money-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMoney = parseInt(btn.dataset.val);
    };
});

document.querySelectorAll('.flag-opt').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.flag-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedFlag = btn.dataset.color;
    };
});

// تأكيد إنشاء الغرفة
document.getElementById('btn-confirm-create').onclick = () => {
    const name = document.getElementById('input-room-name').value.trim() || 'غرفة جديدة';
    socket.emit('create-room', { roomName: name, money: selectedMoney, flag: selectedFlag });
};

// الاستجابة للانضمام للغرفة
socket.on('room-joined', (data) => {
    modalCreate.style.display = 'none';
    modalList.style.display = 'none';
    modalRoom.style.display = 'flex';

    document.getElementById('room-title-display').textContent = `غرفة: ${data.roomName}`;
    document.getElementById('room-money-display').textContent = `مال الحرب: ${data.money} $`;
    document.getElementById('game-money-val').textContent = `$ ${data.money}`;
});

// تحديث قائمة الغرف
socket.on('update-room-list', (rooms) => {
    const container = document.getElementById('rooms-container');
    container.innerHTML = '';
    
    if (rooms.length === 0) {
        container.innerHTML = '<p class="empty-msg">لا توجد غرف متاحة حالياً</p>';
        return;
    }

    rooms.forEach(r => {
        const item = document.createElement('div');
        item.className = 'player-row';
        item.style.cssText = "background:#0b111e; padding:10px; border-radius:8px; margin-bottom:8px;";
        item.innerHTML = `<span>${r.name} ($${r.money})</span>`;
        
        const joinBtn = document.createElement('button');
        joinBtn.className = r.isFull ? 'btn-disabled' : 'btn-green';
        joinBtn.textContent = r.isFull ? 'مكتملة 🔒' : 'انضمام';
        if(!r.isFull) joinBtn.onclick = () => socket.emit('join-room', r.id);
        
        item.appendChild(joinBtn);
        container.appendChild(item);
    });
});

// البدء
document.getElementById('btn-toggle-ready').onclick = () => {
    isReady = !isReady;
    socket.emit('toggle-ready', { isReady });
};

socket.on('game-started', () => {
    modalRoom.style.display = 'none';
    uiOverlay.style.display = 'block';
});
