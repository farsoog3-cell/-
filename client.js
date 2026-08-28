// client.js - إدارة مدخلات اللاعب والتحكم

// كائن لحفظ حالة الأزرار المضغوطة
const keys = {
    up: false,
    down: false,
    left: false,
    right: false
};

// الاستجابة لأزرار الشاشة (D-Pad الظاهرة في الصورة)
document.addEventListener('DOMContentLoaded', () => {
    const btnUp = document.querySelector('.dbtn.up');
    const btnDown = document.querySelector('.dbtn.down');
    const btnLeft = document.querySelector('.dbtn.left');
    const btnRight = document.querySelector('.dbtn.right');

    if (btnUp) {
        btnUp.addEventListener('touchstart', () => keys.up = true);
        btnUp.addEventListener('touchend', () => keys.up = false);
    }
    if (btnDown) {
        btnDown.addEventListener('touchstart', () => keys.down = true);
        btnDown.addEventListener('touchend', () => keys.down = false);
    }
    if (btnLeft) {
        btnLeft.addEventListener('touchstart', () => keys.left = true);
        btnLeft.addEventListener('touchend', () => keys.left = false);
    }
    if (btnRight) {
        btnRight.addEventListener('touchstart', () => keys.right = true);
        btnRight.addEventListener('touchend', () => keys.right = false);
    }
});

// إرسال مدخلات الحركة إلى السيرفر دورياً
setInterval(() => {
    if (typeof socket !== 'undefined' && socket.connected) {
        if (keys.up || keys.down || keys.left || keys.right) {
            socket.emit('player-move', keys);
        }
    }
}, 1000 / 30); // 30 مرة في الثانية
