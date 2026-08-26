// الإعدادات الثابتة والمسارات والمتغيرات العامة المشتركة
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

const CORNER_OFFSET = 380; 
const MAP_LIMIT = 460;
const CAPTURE_RADIUS = 38;
const TANK_RADIUS = 4.5; 

let playerFlagType = 'green';
let enemyFlagType = 'red';
let playerMoney = 500;
let enemyMoney = 500;
let totalMoneySpent = 0;
let totalTanksLost = 0;
let enemyTanksLost = 0;
let gameOver = false;
let isCinematicEnding = false;
