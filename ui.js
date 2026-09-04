import { 
    playerMoney, enemyMoney, playerBuildCooldown, CORNER_OFFSET,
    MAP_LIMIT, targetLookAt, playerTanks, enemyTanks 
} from './config.js';

export function showFloatingMsg(text) {
    const msg = document.getElementById('floating-msg');
    msg.innerText = text;
    msg.style.opacity = '1';
    setTimeout(() => { msg.style.opacity = '0'; }, 2000);
}
window.showFloatingMsg = showFloatingMsg;

export function updateEconomyUI() {
    document.getElementById('money-display').innerText = playerMoney;
    let buyBtn = document.getElementById('buy-tank-btn');
    let rocketBtn = document.getElementById('buy-rocket-tank-btn');

    if (playerBuildCooldown > 0) {
        let secs = Math.ceil(playerBuildCooldown / 60);
        buyBtn.innerText = `انتظار (${secs}ث)`;
        rocketBtn.innerText = `انتظار (${secs}ث)`;
        buyBtn.disabled = true;
        rocketBtn.disabled = true;
    } else {
        buyBtn.innerText = `عادية (150$)`;
        rocketBtn.innerText = `صاروخية (300$)`;
        buyBtn.disabled = (playerMoney < 150);
        rocketBtn.disabled = (playerMoney < 300);
    }
}

export function renderMinimap() {
    const canvas = document.getElementById('minimap-canvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2);
    ctx.fill();
    
    const scale = (w / 2) / MAP_LIMIT;

    ctx.fillStyle = '#22c55e';
    ctx.fillRect(w/2 + CORNER_OFFSET * scale - 3, h/2 + CORNER_OFFSET * scale - 3, 6, 6);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(w/2 + (-CORNER_OFFSET) * scale - 3, h/2 + (-CORNER_OFFSET) * scale - 3, 6, 6);

    playerTanks.forEach(t => {
        if (t.isDestroyed) return;
        let mx = w/2 + t.mesh.position.x * scale;
        let mz = h/2 + t.mesh.position.z * scale;
        ctx.fillStyle = '#22c55e';
        ctx.beginPath(); ctx.arc(mx, mz, 2.5, 0, Math.PI*2); ctx.fill();
    });

    enemyTanks.forEach(t => {
        if (t.isDestroyed) return;
        let mx = w/2 + t.mesh.position.x * scale;
        let mz = h/2 + t.mesh.position.z * scale;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath(); ctx.arc(mx, mz, 2.5, 0, Math.PI*2); ctx.fill();
    });

    let camMx = w/2 + targetLookAt.x * scale;
    let camMz = h/2 + targetLookAt.z * scale;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(camMx, camMz, 6, 0, Math.PI*2); ctx.stroke();
}