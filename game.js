// ملف منطق اللعبة الرئيسي وتشغيل المحرك
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

window.addEventListener('pointerdown', () => {
    if (menuBgmAudio.paused && document.getElementById('start-menu').style.display !== 'none') {
        menuBgmAudio.play().catch(e => {});
    }
}, { once: true });

function playClickSound() {
    const audio = new Audio(soundFiles.click); audio.volume = 0.6; audio.play().catch(e => {});
}

function playSound(type, volume = 1.0) {
    if (soundFiles[type]) {
        const audio = new Audio(soundFiles[type]); audio.volume = volume; audio.play().catch(e => {});
    }
}

let scene, camera, renderer, dirLight;
let playerFlagType = 'green'; let enemyFlagType = 'red';
let cameraRadius = 280, targetCameraRadius = 280;
let cameraTheta = Math.PI / 4; let cameraPhi = Math.PI / 3.5;
let targetLookAt = new THREE.Vector3(0, 0, 0);

let shakeTimer = 0; let shakeIntensity = 0;
let camInputs = { up: false, down: false, left: false, right: false, zi: false, zo: false };
let isDragging = false, previousTouchX = 0, previousTouchY = 0, touchStartX = 0, touchStartY = 0, hasMoved = false;

let playerTanks = [], enemyTanks = [], bullets = [], tacticalMissiles = [], shockwaves = [], smokeParticles = [], obstacles = [], rotatingRadars = [], tankTracks = [], animatedRigs = [];
let selectionMode = 'all', selectedTank = null, playerTargetPos = null;
let targetMarkerMesh, raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2(), terrainMesh;
let enemyPoleFlagMesh, playerPoleFlagMesh, enemyFlagDataRef, playerFlagDataRef;
let enemyFlagHeight = 38.5, playerFlagHeight = 38.5;

let captureProgress = 0, enemyCaptureProgress = 0, gameOver = false, isCinematicEnding = false, cinematicTargetLook = null;
const CORNER_OFFSET = 380, MAP_LIMIT = 460, CAPTURE_RADIUS = 38, TANK_RADIUS = 4.5;

let playerMoney = 500, enemyMoney = 500, totalMoneySpent = 0, totalTanksLost = 0, enemyTanksLost = 0;
let oilRigs = [], gameTick = 0, flagWaveTime = 0, activeFlagMeshes = [];
let playerBuildCooldown = 0, enemyBuildCooldown = 0, treadTextureCache = null;

function showFloatingMsg(text) {
    const msg = document.getElementById('floating-msg');
    msg.innerText = text; msg.style.opacity = '1';
    setTimeout(() => { msg.style.opacity = '0'; }, 2000);
}

function init() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7dd3fc);
    scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0018);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1500);
    updateCameraPosition();

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    dirLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
    dirLight.position.set(300, 450, 300);
    dirLight.castShadow = true;
    scene.add(dirLight);

    createHillyBrownSoilTerrain();
    
    // إنشاء القواعد وأبراج النفط
    const playerBaseGroup = new THREE.Group();
    playerBaseGroup.position.set(CORNER_OFFSET, getTerrainHeight(CORNER_OFFSET, CORNER_OFFSET), CORNER_OFFSET);
    playerBaseGroup.rotation.y = -(3 * Math.PI) / 4; 

    const enemyBaseGroup = new THREE.Group();
    enemyBaseGroup.position.set(-CORNER_OFFSET, getTerrainHeight(-CORNER_OFFSET, -CORNER_OFFSET), -CORNER_OFFSET);
    enemyBaseGroup.rotation.y = -(3 * Math.PI) / 4;

    createBaseStructure(playerBaseGroup, playerFlagType !== 'green');
    createBaseStructure(enemyBaseGroup, enemyFlagType === 'green');
    scene.add(playerBaseGroup); scene.add(enemyBaseGroup);

    obstacles.push({ x: CORNER_OFFSET, z: CORNER_OFFSET, radius: 22 });
    obstacles.push({ x: -CORNER_OFFSET, z: -CORNER_OFFSET, radius: 22 });

    playerTanks.push(createTank(CORNER_OFFSET - 45, CORNER_OFFSET - 45, 0x2e3b23, 'player', 'normal'));
    enemyTanks.push(createTank(-CORNER_OFFSET + 45, -CORNER_OFFSET + 45, 0x6b3a2a, 'enemy', 'normal'));

    enemyPoleFlagMesh = createFlagPole(new THREE.Group(), -CORNER_OFFSET, -CORNER_OFFSET, enemyFlagType, 'enemy');
    playerPoleFlagMesh = createFlagPole(new THREE.Group(), CORNER_OFFSET, CORNER_OFFSET, playerFlagType, 'player');

    updateEconomyUI();
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

function startGame() {
    menuBgmAudio.pause(); battleBgmAudio.play().catch(e => {});
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('ui-overlay').style.display = 'block';
    targetLookAt.set(CORNER_OFFSET, getTerrainHeight(CORNER_OFFSET, CORNER_OFFSET), CORNER_OFFSET);
    targetCameraRadius = 110;
}

function camMove(dir, state) { camInputs[dir] = state; }
function selectFlag(role, color) {
    if (role === 'player') playerFlagType = color; else enemyFlagType = color;
}
function setSelectionMode(mode) {
    selectionMode = mode;
    document.getElementById('sel-all-btn').classList.toggle('active', mode === 'all');
    document.getElementById('sel-single-btn').classList.toggle('active', mode === 'single');
}

function updateCameraPosition() {
    cameraRadius = THREE.MathUtils.lerp(cameraRadius, targetCameraRadius, 0.15);
    camera.position.set(
        targetLookAt.x + cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta),
        targetLookAt.y + cameraRadius * Math.cos(cameraPhi),
        targetLookAt.z + cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta)
    );
    camera.lookAt(targetLookAt);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

window.onload = init;
