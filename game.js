// ملف منطق اللعبة الرئيسي وتشغيل المحرك والتحكم
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

let camInputs = { up: false, down: false, left: false, right: false, zi: false, zo: false };
let isDragging = false, previousTouchX = 0, previousTouchY = 0;

let playerTanks = [], enemyTanks = [], rotatingRadars = [], activeFlagMeshes = [];
let enemyPoleFlagMesh, playerPoleFlagMesh, enemyFlagDataRef, playerFlagDataRef;
const CORNER_OFFSET = 380;

let playerMoney = 500, enemyMoney = 500;
let flagWaveTime = 0;

function init() {
    const container = document.getElementById('canvas-container');
    
    // 1. المشهد والخلفية
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7dd3fc);
    scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0018);

    // 2. الكاميرا
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1500);
    updateCameraPosition();

    // 3. الرندر
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 4. الإضاءة
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
    dirLight.position.set(300, 450, 300);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 5. التضاريس
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

    // 7. الأعلام (تم تفعيلها هنا)
    if (typeof createFlagPole === 'function') {
        enemyPoleFlagMesh = createFlagPole(new THREE.Group(), -CORNER_OFFSET, -CORNER_OFFSET, enemyFlagType, 'enemy');
        playerPoleFlagMesh = createFlagPole(new THREE.Group(), CORNER_OFFSET, CORNER_OFFSET, playerFlagType, 'player');
    }

    // 8. تفعيل اللمس والسحب (Touch & Mouse Dragging) للشاشة
    setupTouchControls(container);

    updateEconomyUI();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

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

// التحكم بالأزرار (يمين، يسار، فوق، تحت، تقريب، إبعاد)
function camMove(dir, state) { 
    camInputs[dir] = state; 
}

function selectFlag(role, color) {
    if (role === 'player') playerFlagType = color; 
    else enemyFlagType = color;
    
    // تحديث الأزرار النشطة في القائمة
    document.querySelectorAll(`#${role}-flags .flag-btn`).forEach(btn => {
        btn.classList.remove(role === 'player' ? 'active-player' : 'active-enemy');
    });
    event.target.classList.add(role === 'player' ? 'active-player' : 'active-enemy');
}

function setSelectionMode(mode) {
    document.getElementById('sel-all-btn').classList.toggle('active', mode === 'all');
    document.getElementById('sel-single-btn').classList.toggle('active', mode === 'single');
}

// دالة شراء الدبابات (تم تفعيلها)
function buyPlayerTank(type) {
    let cost = (type === 'rocket') ? 300 : 150;
    if (playerMoney >= cost) {
        playerMoney -= cost;
        updateEconomyUI();
        playSound('buy', 0.7);

        // إنشاء دبابة جديدة بالقرب من قاعدة اللاعب
        let spawnX = CORNER_OFFSET - 45 + (Math.random() * 20 - 10);
        let spawnZ = CORNER_OFFSET - 45 + (Math.random() * 20 - 10);
        if (typeof createTank === 'function') {
            playerTanks.push(createTank(spawnX, spawnZ, 0x2e3b23, 'player', type));
        }
    } else {
        showFloatingMsg("رصيدك غير كافٍ!");
    }
}

function updateEconomyUI() {
    const moneyEl = document.getElementById('money-display');
    if (moneyEl) moneyEl.innerText = playerMoney;
    
    const normalBtn = document.getElementById('buy-tank-btn');
    const rocketBtn = document.getElementById('buy-rocket-tank-btn');
    if (normalBtn) normalBtn.disabled = playerMoney < 150;
    if (rocketBtn) rocketBtn.disabled = playerMoney < 300;
}

function showFloatingMsg(text) {
    const msg = document.getElementById('floating-msg');
    if (!msg) return;
    msg.innerText = text; msg.style.opacity = '1';
    setTimeout(() => { msg.style.opacity = '0'; }, 2000);
}

// إعداد حركة السحب باللمس أو الماوس لتحريك الكاميرا
function setupTouchControls(container) {
    container.addEventListener('pointerdown', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('#ui-overlay') && e.target.id !== 'canvas-container') return;
        isDragging = true;
        previousTouchX = e.clientX;
        previousTouchY = e.clientY;
    });

    window.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        let deltaX = e.clientX - previousTouchX;
        let deltaY = e.clientY - previousTouchY;
        previousTouchX = e.clientX;
        previousTouchY = e.clientY;

        let panSpeed = 0.8;
        let cos = Math.cos(cameraTheta);
        let sin = Math.sin(cameraTheta);
        targetLookAt.x -= (deltaX * cos - deltaY * sin) * panSpeed;
        targetLookAt.z -= (deltaX * sin + deltaY * cos) * panSpeed;
    });

    window.addEventListener('pointerup', () => { isDragging = false; });
}

function updateCameraPosition() {
    // معالجة حركة الأزرار المستمرة
    let moveSpeed = 6;
    if (camInputs.up) { targetLookAt.x -= moveSpeed * Math.sin(cameraTheta); targetLookAt.z -= moveSpeed * Math.cos(cameraTheta); }
    if (camInputs.down) { targetLookAt.x += moveSpeed * Math.sin(cameraTheta); targetLookAt.z += moveSpeed * Math.cos(cameraTheta); }
    if (camInputs.left) { targetLookAt.x -= moveSpeed * Math.cos(cameraTheta); targetLookAt.z += moveSpeed * Math.sin(cameraTheta); }
    if (camInputs.right) { targetLookAt.x += moveSpeed * Math.cos(cameraTheta); targetLookAt.z -= moveSpeed * Math.sin(cameraTheta); }
    if (camInputs.zi) targetCameraRadius = Math.max(40, targetCameraRadius - 5);
    if (camInputs.zo) targetCameraRadius = Math.min(500, targetCameraRadius + 5);

    cameraRadius = THREE.MathUtils.lerp(cameraRadius, targetCameraRadius, 0.15);
    camera.position.set(
        targetLookAt.x + cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta),
        targetLookAt.y + cameraRadius * Math.cos(cameraPhi),
        targetLookAt.z + cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta)
    );
    camera.lookAt(targetLookAt);
}

// حلقة اللعبة الأساسية
function animate() {
    requestAnimationFrame(animate);

    // تموج الأعلام
    flagWaveTime += 0.05;
    activeFlagMeshes.forEach((flagObj, idx) => {
        const posAttr = flagObj.mesh.geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
            let u = posAttr.getX(i);
            let wave = Math.sin(flagWaveTime + u * 0.4) * 0.8;
            posAttr.setZ(i, wave);
        }
        posAttr.needsUpdate = true;
    });

    // دوران الرادار
    rotatingRadars.forEach(radar => {
        radar.rotation.z += 0.02;
    });

    updateCameraPosition();
    renderer.render(scene, camera);
}

window.onload = init;
