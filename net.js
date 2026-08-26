// رابط السيرفر الخاص بك مع تحويل البروتوكول ليدعم الاتصال الآمن WSS
const SERVER_URL = "wss://tank-game-server-o650.onrender.com";
let socket = null;
let currentRoomId = null;

// دالة الاتصال بالسيرفر
function connectToServer() {
    // إذا كان السيرفر يدعم Socket.io (وهو الشائع في سيرفرات Node.js على Render):
    // تأكد إذا كنت تستخدم مكتبة socket.io أو WebSocket العادي. 
    // هذا الكود يستخدم WebSocket القياسي:
    
    socket = new WebSocket(SERVER_URL);

    socket.onopen = () => {
        console.log("تم الاتصال بسيرفر الدبابات بنجاح!");
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
    };

    socket.onclose = () => {
        console.log("انقطع الاتصال بالسيرفر، جاري إعادة المحاولة...");
        setTimeout(connectToServer, 3000); // إعادة المحاولة بعد 3 ثواني
    };
}

// دالة إنشاء غرفة جديدة
function createGameRoom() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            action: "create_room",
            playerName: "صاحب الغرفة" // يمكنك جلب اسم اللاعب من حقل ادخال إذا أردت
        }));
    } else {
        alert("غير متصل بالسيرفر حالياً!");
    }
}

// دالة الانضمام لغرفة صديق عبر كود الغرفة
function joinGameRoom(roomId) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            action: "join_room",
            roomId: roomId,
            playerName: "اللاعب المنضم"
        }));
    }
}

// معالجة الرسائل القادمة من السيرفر
function handleServerMessage(data) {
    switch (data.action) {
        case "room_created":
            currentRoomId = data.roomId;
            document.getElementById("multiplayer-status").innerText = "تم إنشاء الغرفة! الكود: " + currentRoomId + " - بانتظار الصديق...";
            break;

        case "update_rooms":
            // تحديث قائمة الأصدقاء أو الغرف المتاحة في الواجهة
            renderRoomsList(data.rooms);
            break;

        case "start_game":
            // بدء اللعبة عندما ينضم الصديق وتكتمل الغرفة
            console.log("بدء اللعبة الجماعية!");
            if (typeof startGameMultiplayer === 'function') {
                startGameMultiplayer(data);
            }
            break;
    }
}

// دالة لتحديث واجهة HTML لعرض الغرف المتاحة للأصدقاء
function renderRoomsList(rooms) {
    const listContainer = document.getElementById("rooms-list-container");
    if (!listContainer) return;
    
    listContainer.innerHTML = "";
    if (rooms.length === 0) {
        listContainer.innerHTML = "<li>لا توجد غرف متاحة حالياً</li>";
        return;
    }

    rooms.forEach(room => {
        let li = document.createElement("li");
        li.innerHTML = `غرفة: ${room.hostName} 
                        <button onclick="joinGameRoom('${room.roomId}')">دخول للعب</button>`;
        listContainer.appendChild(li);
    });
}

// تشغيل الاتصال عند تحميل الصفحة
window.addEventListener("load", () => {
    connectToServer();
});
