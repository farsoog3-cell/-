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
menuBgmAudio.loop = true; menuBgmAudio.volume = 0.4;
let battleBgmAudio = new Audio(soundFiles.battleBgm);
battleBgmAudio.loop = true; battleBgmAudio.volume = 0.5;

function playClickSound() { new Audio(soundFiles.click).play().catch(e => {}); }
function playSound(type, volume = 1.0) {
    if (soundFiles[type]) {
        const audio = new Audio(soundFiles[type]);
        audio.volume = volume;
        audio.play().catch(e => {});
    }
}

let scene, camera, renderer, dirLight;
let playerFlagType = 'green';
let enemyFlagType = 'red';

let cameraRadius = 280, targetCameraRadius = 280;
let cameraTheta = Math.PI / 4, cameraPhi = Math.PI / 3.5;
let targetLookAt = new THREE.Vector3(0, 0, 0);
let camInputs = { up: false, down: false, left: false, right: false, zi: false, zo: false };

let playerTanks = [], enemyTanks = [], bullets = [], oilRigs = [];
let selectionMode = 'all', selectedTank = null;
let raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();

const CORNER_OFFSET = 380;
let playerMoney = 500;

function selectFlag(color) {
    playerFlagType = color;
    enemyFlagType = color === 'green' ? 'red' : 'green';
    document.querySelectorAll('#player-flags .flag-btn').forEach(btn => {
        btn.classList.toggle('active-player', btn.innerText.includes(color === 'green' ? 'الأخضر' : 'الأحمر'));
    });
}

function showFloatingMsg(text) {
    const msg = document.getElementById('floating-msg');
    msg.innerText = text; msg.style.opacity = '1';
    setTimeout(() => { msg.style.opacity = '0'; }, 2500);
}

function startGameOnline(roomData) {
    menuBgmAudio.pause();
    battleBgmAudio.play().catch(e => {});

    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('ui-overlay').style.display = 'block';

    initEngine();
}

function initEngine() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7dd3fc);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1500);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    setupLighting();
    createTerrain();
    
    // إعداد الكاميرا فوق المعسكر
    targetLookAt.set(CORNER_OFFSET, 0, CORNER_OFFSET);
    updateCamera();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

function setupLighting() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    dirLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
    dirLight.position.set(300, 450, 300);
    scene.add(dirLight);
}

function createTerrain() {
    const geometry = new THREE.PlaneGeometry(1100, 1100);
    geometry.rotateX(-Math.PI / 2);
    const terrainMat = new THREE.MeshStandardMaterial({ color: 0x5c3d2e });
    const terrain = new THREE.Mesh(geometry, terrainMat);
    scene.add(terrain);
}

function camMove(dir, state) { camInputs[dir] = state; }

function updateCamera() {
    let x = targetLookAt.x + cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta);
    let y = targetLookAt.y + cameraRadius * Math.cos(cameraPhi);
    let z = targetLookAt.z + cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
    camera.position.set(x, y, z);
    camera.lookAt(targetLookAt);
}

function setSelectionMode(mode) {
    selectionMode = mode;
    document.getElementById('sel-all-btn').classList.toggle('active', mode === 'all');
    document.getElementById('sel-single-btn').classList.toggle('active', mode === 'single');
}

function buyPlayerTank(type) {
    let cost = type === 'rocket' ? 300 : 150;
    if (playerMoney >= cost) {
        playerMoney -= cost;
        document.getElementById('money-display').innerText = playerMoney;
        sendBuyTank(type);
        playSound('buy');
    } else {
        showFloatingMsg('الرصيد غير كافٍ!');
    }
}

function onEnemyMoveReceived(data) {
    // استقبال حركة خصمك عبر الشبكة وتحديث موقعه
}

function onEnemyBuyReceived(data) {
    // إضافة دبابة جديدة لخصمك عند شرائه
}

function animate() {
    requestAnimationFrame(animate);

    if (camInputs.up) targetLookAt.z -= 3;
    if (camInputs.down) targetLookAt.z += 3;
    if (camInputs.left) targetLookAt.x -= 3;
    if (camInputs.right) targetLookAt.x += 3;
    if (camInputs.zi) cameraRadius = Math.max(60, cameraRadius - 4);
    if (camInputs.zo) cameraRadius = Math.min(550, cameraRadius + 4);

    updateCamera();
    renderer.render(scene, camera);
}