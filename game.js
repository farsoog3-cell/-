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

let scene, camera, renderer, dirLight;
let playerFlagType = 'green'; let enemyFlagType = 'red';
let cameraRadius = 280, targetCameraRadius = 280;
let cameraTheta = Math.PI / 4; let cameraPhi = Math.PI / 3.5;
let targetLookAt = new THREE.Vector3(0, 0, 0);

let playerTanks = [], enemyTanks = [], obstacles = [], rotatingRadars = [], activeFlagMeshes = [];
let enemyFlagDataRef, playerFlagDataRef;
const CORNER_OFFSET = 380;
let playerMoney = 500, enemyMoney = 500;

function init() {
    const container = document.getElementById('canvas-container');
    
    // 1. إنشاء المشهد (Scene)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7dd3fc); // لون سماوي فاتح للخلفية
    scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0018);

    // 2. إنشاء الكاميرا (Camera)
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1500);
    updateCameraPosition();

    // 3. إنشاء الرندر (Renderer)
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 4. الإضاءة (Lights)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
    dirLight.position.set(300, 450, 300);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 5. بناء التضاريس والأرض
    if (typeof createHillyBrownSoilTerrain === 'function') {
        createHillyBrownSoilTerrain();
    }

    // 6. القواعد العسكرية
    const playerBaseGroup = new THREE.Group();
    playerBaseGroup.position.set(CORNER_OFFSET, getTerrainHeight(CORNER_OFFSET, CORNER_OFFSET), CORNER_OFFSET);
    playerBaseGroup.rotation.y = -(3 * Math.PI) / 4; 

    const enemyBaseGroup = new THREE.Group();
    enemyBaseGroup.position.set(-CORNER_OFFSET, getTerrainHeight(-CORNER_OFFSET, -CORNER_OFFSET), -CORNER_OFFSET);
    enemyBaseGroup.rotation.y = -(3 * Math.PI) / 4;

    if (typeof createBaseStructure === 'function') {
        createBaseStructure(playerBaseGroup, false);
        createBaseStructure(enemyBaseGroup, true);
    }
    scene.add(playerBaseGroup); 
    scene.add(enemyBaseGroup);

    // ربط الأحداث لتغيير حجم الشاشة
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // بدء حلقة الرسوم المتحركة فوراً
    animate();
}

function startGame() {
    menuBgmAudio.pause(); 
    battleBgmAudio.play().catch(e => {});
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('ui-overlay').style.display = 'block';
    targetLookAt.set(CORNER_OFFSET, getTerrainHeight(CORNER_OFFSET, CORNER_OFFSET), CORNER_OFFSET);
    targetCameraRadius = 110;
}

function camMove(dir, state) { 
    // أزرار التحكم بالكاميرا البسيطة
    const speed = 15;
    if (dir === 'up') targetLookAt.z -= speed;
    if (dir === 'down') targetLookAt.z += speed;
    if (dir === 'left') targetLookAt.x -= speed;
    if (dir === 'right') targetLookAt.x += speed;
    if (dir === 'zi') targetCameraRadius = Math.max(40, targetCameraRadius - 20);
    if (dir === 'zo') targetCameraRadius = Math.min(500, targetCameraRadius + 20);
    updateCameraPosition();
}

function selectFlag(role, color) {
    if (role === 'player') playerFlagType = color; 
    else enemyFlagType = color;
}

function setSelectionMode(mode) {
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

// حلقة الرسم الأساسية (Game Loop) لضمان ظهور العرض على الشاشة
function animate() {
    requestAnimationFrame(animate);

    // دوران الرادار للتأكد من أن المشهد حي ويتحرك
    rotatingRadars.forEach(radar => {
        radar.rotation.z += 0.02;
    });

    updateCameraPosition();
    renderer.render(scene, camera);
}

// تشغيل اللعبة تلقائياً عند تحميل الصفحة
window.onload = init;
