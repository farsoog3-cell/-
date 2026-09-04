import { soundFiles } from './config.js';

export let menuBgmAudio = new Audio(soundFiles.menuBgm);
menuBgmAudio.loop = true;
menuBgmAudio.volume = 0.4;

export let battleBgmAudio = new Audio(soundFiles.battleBgm);
battleBgmAudio.loop = true;
battleBgmAudio.volume = 0.5;

window.addEventListener('pointerdown', () => {
    if (menuBgmAudio.paused && document.getElementById('start-menu').style.display !== 'none') {
        menuBgmAudio.play().catch(e => {});
    }
}, { once: true });

window.playClickSound = function() {
    const audio = new Audio(soundFiles.click);
    audio.volume = 0.6;
    audio.play().catch(e => {});
};

export function playSound(type, volume = 1.0) {
    if (soundFiles[type]) {
        const audio = new Audio(soundFiles[type]);
        audio.volume = volume;
        audio.play().catch(e => {});
    }
}