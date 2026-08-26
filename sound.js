// نظام إدارة الأصوات في اللعبة (sound.js)
const soundFiles = {
    menuBgm: 'sounds/menu_bgm.mp3',
    battleBgm: 'sounds/battle_bgm.mp3',
    click: 'sounds/click.mp3',
    attack: 'sounds/attack.mp3',
    danger: 'sounds/danger.mp3',
    victory: 'sounds/victory_sound.mp3',
    defeat: 'sounds/defeat_sound.mp3',
    shoot: 'sounds/shoot.mp3',
    rocket: 'sounds/rocket.mp3',
    explosion: 'sounds/explosion.mp3',
    buy: 'sounds/buy.mp3',
    idle: 'sounds/tank_idle.mp3',
    move: 'sounds/tank_move.mp3'
};

let menuBgmAudio = new Audio(soundFiles.menuBgm);
menuBgmAudio.loop = true; 
menuBgmAudio.volume = 0.4;

let battleBgmAudio = new Audio(soundFiles.battleBgm);
battleBgmAudio.loop = true; 
battleBgmAudio.volume = 0.5;

// دالة عامة لتشغيل أي صوت
function playSound(type, volume = 1.0) {
    if (soundFiles[type]) {
        const audio = new Audio(soundFiles[type]);
        audio.volume = volume;
        audio.play().catch(e => {
            // يتجاوز قيود المتصفح الحارسة للأصوات قبل التفاعل
        });
    }
}

// تفاعل المستخدم الأول لبدء تشغيل الموسيقى الخلفية
window.addEventListener('pointerdown', () => {
    if (menuBgmAudio.paused && document.getElementById('start-menu') && document.getElementById('start-menu').style.display !== 'none') {
        menuBgmAudio.play().catch(e => {});
    }
}, { once: true });
