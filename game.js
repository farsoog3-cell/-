const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// شبكة اللاعبين والدبابات
let players = {};

// رسم أرضية اللعبة (الخريطة)
function drawMap() {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const size = 60;

    for (let x = 0; x < canvas.width; x += size) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += size) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

// رسم الدبابات
function drawTanks() {
    Object.values(players).forEach(player => {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle || 0);

        // جسم الدبابة
        ctx.fillStyle = player.isBot ? '#a855f7' : '#22c55e';
        ctx.fillRect(-20, -15, 40, 30);

        // المدفع
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, -4, 25, 8);

        ctx.restore();
    });
}

// حلقة الرسم المستمرة
function gameLoop() {
    drawMap();
    drawTanks();
    requestAnimationFrame(gameLoop);
}

gameLoop();
