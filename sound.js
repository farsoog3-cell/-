// ملف إدارة وتشغيل الأصوات - sound.js

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

// إنشاء مشغلات الموسيقى الخلفية
let menuBgmAudio = new Audio(soundFiles.menuBgm);
menuBgmAudio.loop = true; 
menuBgmAudio.volume = 0.4;

let battleBgmAudio = new Audio(soundFiles.battleBgm);
battleBgmAudio.loop = true; 
battleBgmAudio.volume = 0.5;

// تفعيل موسيقى القائمة عند أول تفاعل للمستخدم مع الصفحة (لتجاوز قيود المتصفحات)
window.addEventListener('pointerdown', () => {
    const menuEl = document.getElementById('start-menu');
    if (menuBgmAudio.paused && menuEl && menuEl.style.display !== 'none') {
        menuBgmAudio.play().catch(e => {});
    }
}, { once: true });

// دالة تشغيل صوت النقر البسيط
function playClickSound() {
    const audio = new Audio(soundFiles.click); 
    audio.volume = 0.6; 
    audio.play().catch(e => {});
}

// دالة عامة لتشغيل أي مؤثر صوتي حسب النوع والمستوى المطلق للصوت
function playSound(type, volume = 1.0) {
    if (soundFiles[type]) {
        const audio = new Audio(soundFiles[type]); 
        audio.volume = volume; 
        audio.play().catch(e => {});
    }
}

// دالة الانتقال من موسيقى القائمة إلى موسيقى المعركة عند بدء اللعب
function startBattleMusic() {
    if (menuBgmAudio) {
        menuBgmAudio.pause();
        menuBgmAudio.currentTime = 0;
    }
    if (battleBgmAudio) {
        battleBgmAudio.play().catch(e => {});
    }
}
