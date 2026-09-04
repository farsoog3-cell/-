// الاتصال بسيرفر Render
const socket = io("https://tank-game-server-o650.onrender.com/");
let currentRoom = null;
let myRole = null; // 'player1' أو 'player2'

function createRoom() {
    let roomCode = document.getElementById('room-input').value.trim();
    if (!roomCode) { alert("الرجاء إدخال كود الغرفة"); return; }
    socket.emit('create-room', roomCode);
}

function joinRoom() {
    let roomCode = document.getElementById('room-input').value.trim();
    if (!roomCode) { alert("الرجاء إدخال كود الغرفة"); return; }
    socket.emit('join-room', roomCode);
}

socket.on('room-created', (code) => {
    currentRoom = code;
    myRole = 'player1';
    document.getElementById('room-status').innerText = `تم إنشاء الغرفة (${code}). بانتظار الخصم...`;
    document.getElementById('start-btn').disabled = false;
    document.getElementById('start-btn').style.opacity = '1';
});

socket.on('room-joined', (code) => {
    currentRoom = code;
    myRole = 'player2';
    document.getElementById('room-status').innerText = `انضممت للغرفة (${code}) بنجاح!`;
    document.getElementById('start-btn').disabled = false;
    document.getElementById('start-btn').style.opacity = '1';
});

socket.on('error-msg', (msg) => {
    alert(msg);
});

// استقبال بيانات حركة الأجهزة الأخرى من السيرفر
socket.on('sync-tanks', (data) => {
    // تحديث دبابات الخصم بناءً على إرساله
    if (data.role !== myRole) {
        // تحديث أو إنشاء دبابات الخصم على شاشتك
        updateRemoteEnemyTanks(data.tanks);
    }
});

// --- بقية ملف اللعبة الأساسي مع دمج الأكواد السابقة ---
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

function playClickSound() { const audio = new Audio(soundFiles.click); audio.volume = 0.6; audio.play().catch(e => {}); }
function playSound(type, volume = 1.0) {
    if (soundFiles[type]) { const audio = new Audio(soundFiles[type]); audio.volume = volume; audio.play().catch(e => {}); }
}

let scene, camera, renderer, dirLight;
let playerFlagType = 'green';
let enemyFlagType = 'red';
let cameraRadius = 280, targetCameraRadius = 280;
let cameraTheta = Math.PI / 4, cameraPhi = Math.PI / 3.5;
let targetLookAt = new THREE.Vector3(0, 0, 0);
let shakeTimer = 0, shakeIntensity = 0, camInputs = { up: false, down: false, left: false, right: false, zi: false, zo: false };
let isDragging = false, previousTouchX = 0, previousTouchY = 0, touchStartX = 0, touchStartY = 0, hasMoved = false;

let playerTanks = [];
let enemyTanks = [];
let bullets = [], tacticalMissiles = [], shockwaves = [], smokeParticles = [], obstacles = [], rotatingRadars = [], tankTracks = [], animatedRigs = [];
let selectionMode = 'all', selectedTank = null, playerTargetPos = null;
let targetMarkerMesh, raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2(), terrainMesh;
let enemyPoleFlagMesh, playerPoleFlagMesh, enemyFlagDataRef, playerFlagDataRef;
let enemyFlagHeight = 38.5, playerFlagHeight = 38.5;
let captureProgress = 0, enemyCaptureProgress = 0, gameOver = false, isCinematicEnding = false, cinematicTargetLook = null;

const CORNER_OFFSET = 380, MAP_LIMIT = 460, CAPTURE_RADIUS = 38, TANK_RADIUS = 4.5;
let playerMoney = 500, enemyMoney = 500, totalMoneySpent = 0, totalTanksLost = 0, enemyTanksLost = 0, oilRigs = [];
let gameTick = 0, flagWaveTime = 0, activeFlagMeshes = [];
let playerBuildCooldown = 0, enemyBuildCooldown = 0;

function getTerrainHeight(x, z) {
    let h = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 5 + Math.sin(x * 0.008) * 8;
    let distFromCenter = Math.sqrt(x * x + z * z);
    if (distFromCenter < 140) h *= 0.2;
    return h;
}

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
    container.appendChild(renderer.domElement);

    setupLighting();
    createHillyBrownSoilTerrain();
    createBases();
    createOilRigs();
    createTargetMarker();
    setupInteraction();
    setupMinimapInteraction();

    updateEconomyUI();
    window.addEventListener('resize', onWindowResize);
    animate();
}

function camMove(dir, state) { camInputs[dir] = state; }
function processCameraInputs() {
    if (isCinematicEnding) return;
    const moveSpeed = 5.0; let dx = 0, dz = 0;
    if (camInputs.up) { dx -= Math.sin(cameraTheta) * moveSpeed; dz -= Math.cos(cameraTheta) * moveSpeed; }
    if (camInputs.down) { dx += Math.sin(cameraTheta) * moveSpeed; dz += Math.cos(cameraTheta) * moveSpeed; }
    if (camInputs.left) { dx -= Math.cos(cameraTheta) * moveSpeed; dz += Math.sin(cameraTheta) * moveSpeed; }
    if (camInputs.right) { dx += Math.cos(cameraTheta) * moveSpeed; dz -= Math.sin(cameraTheta) * moveSpeed; }
    targetLookAt.x = Math.max(-420, Math.min(420, targetLookAt.x + dx));
    targetLookAt.z = Math.max(-420, Math.min(420, targetLookAt.z + dz));
    if (camInputs.zi) targetCameraRadius = Math.max(60, targetCameraRadius - 5);
    if (camInputs.zo) targetCameraRadius = Math.min(550, targetCameraRadius + 5);
}

function selectFlag(color) {
    playerFlagType = color;
    enemyFlagType = color === 'green' ? 'red' : 'green';
    document.querySelectorAll('#player-flags .flag-btn').forEach(btn => {
        btn.classList.toggle('active-player', btn.innerText.includes(color === 'green' ? 'الأخضر' : 'الأحمر'));
    });
}

function setSelectionMode(mode) {
    selectionMode = mode;
    document.getElementById('sel-all-btn').classList.toggle('active', mode === 'all');
    document.getElementById('sel-single-btn').classList.toggle('active', mode === 'single');
    if (mode === 'all') selectedTank = null;
    showFloatingMsg(mode === 'all' ? 'تم تحديد جميع الدبابات' : 'اضغط على الدبابة لتحديدها');
}

function startGame() {
    menuBgmAudio.pause(); menuBgmAudio.currentTime = 0;
    battleBgmAudio.play().catch(e => {});
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('ui-overlay').style.display = 'block';
    playSound('buy');

    // إذا كان اللاعب الثاني، اعكس مكان ظهوره في المعسكر المقابل
    let startX = (myRole === 'player2') ? -CORNER_OFFSET : CORNER_OFFSET;
    let startZ = (myRole === 'player2') ? -CORNER_OFFSET : CORNER_OFFSET;
    let terrainH = getTerrainHeight(startX, startZ);

    targetLookAt.set(startX, terrainH, startZ);
    targetCameraRadius = 110; cameraPhi = Math.PI / 3.8; cameraRadius = targetCameraRadius;
    updateCameraPosition();
    showFloatingMsg('بدأت المعركة الجماعية!');
}

function setupLighting() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    dirLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
    dirLight.position.set(300, 450, 300);
    dirLight.castShadow = true;
    scene.add(dirLight);
}

function createHillyBrownSoilTerrain() {
    const geometry = new THREE.PlaneGeometry(1100, 1100, 50, 50);
    geometry.rotateX(-Math.PI / 2);
    const positionAttr = geometry.attributes.position;
    for (let i = 0; i < positionAttr.count; i++) {
        let px = positionAttr.getX(i), pz = positionAttr.getZ(i);
        positionAttr.setY(i, getTerrainHeight(px, pz));
    }
    geometry.computeVertexNormals();
    terrainMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.9 }));
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);
}

function createBaseStructure(parentGroup, isEnemy) {
    const wallMat = new THREE.MeshStandardMaterial({ color: isEnemy ? 0x1e1b18 : 0x334155 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: isEnemy ? 0x27272a : 0x64748b });
    [-18, 18].forEach(x => {
        const sideWall = new THREE.Mesh(new THREE.BoxGeometry(2.5, 7, 32), wallMat);
        sideWall.position.set(x, 3.5, 0); parentGroup.add(sideWall);
    });
    const hqBase = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 14), concreteMat);
    hqBase.position.set(0, 4, -4); parentGroup.add(hqBase);
}

function createBases() {
    const playerBaseGroup = new THREE.Group();
    playerBaseGroup.position.set(CORNER_OFFSET, getTerrainHeight(CORNER_OFFSET, CORNER_OFFSET), CORNER_OFFSET);
    const enemyBaseGroup = new THREE.Group();
    enemyBaseGroup.position.set(-CORNER_OFFSET, getTerrainHeight(-CORNER_OFFSET, -CORNER_OFFSET), -CORNER_OFFSET);

    createBaseStructure(playerBaseGroup, false);
    createBaseStructure(enemyBaseGroup, true);
    scene.add(playerBaseGroup); scene.add(enemyBaseGroup);

    obstacles.push({ x: CORNER_OFFSET, z: CORNER_OFFSET, radius: 22 });
    obstacles.push({ x: -CORNER_OFFSET, z: -CORNER_OFFSET, radius: 22 });

    let pColor = 0x2e3b23;
    let pTankX = (myRole === 'player2') ? -CORNER_OFFSET + 45 : CORNER_OFFSET - 45;
    let pTankZ = (myRole === 'player2') ? -CORNER_OFFSET + 45 : CORNER_OFFSET - 45;

    let playerTank = createTank(pTankX, pTankZ, pColor, 'player', 'normal');
    playerTanks.push(playerTank);

    playerPoleFlagMesh = createFlagPole(new THREE.Group(), CORNER_OFFSET, CORNER_OFFSET, 'green', 'player');
    enemyPoleFlagMesh = createFlagPole(new THREE.Group(), -CORNER_OFFSET, -CORNER_OFFSET, 'red', 'enemy');
}

function createOilRigs() {
    // تبسيط الآبار للاختصار
}

function createTank(x, z, colorHex, team, type = 'normal') {
    const tankGroup = new THREE.Group();
    const armorMat = new THREE.MeshStandardMaterial({ color: colorHex });
    const body = new THREE.Mesh(new THREE.BoxGeometry(6, 2.2, 9), armorMat);
    body.position.y = 1.2; tankGroup.add(body);
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 1.5, 10), armorMat);
    turret.position.y = 2.8; tankGroup.add(turret);

    tankGroup.position.set(x, getTerrainHeight(x, z), z);
    scene.add(tankGroup);

    const hpLabel = document.createElement('div');
    hpLabel.className = `tank-hp-label hp-player`;
    hpLabel.innerText = '100';
    document.getElementById('hp-labels-container').appendChild(hpLabel);

    return { mesh: tankGroup, hpLabel, target: null, team, type, hp: 100, maxHp: 100, isDestroyed: false, idleAudio: new Audio(soundFiles.idle), moveAudio: new Audio(soundFiles.move), isMovePlaying: false };
}

function buyPlayerTank(type) {
    if (playerMoney >= 150) {
        playerMoney -= 150;
        updateEconomyUI();
        playSound('buy');
        let spawnX = (myRole === 'player2') ? -CORNER_OFFSET + 50 : CORNER_OFFSET - 50;
        let spawnZ = (myRole === 'player2') ? -CORNER_OFFSET + 50 : CORNER_OFFSET - 50;
        let newTank = createTank(spawnX, spawnZ, 0x2e3b23, 'player', type);
        playerTanks.push(newTank);
    }
}

function createFlagPole(group, x, z, flagType, role) {
    group.position.set(x, getTerrainHeight(x, z), z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 35, 8), new THREE.MeshStandardMaterial({ color: 0xd1d5db }));
    pole.position.set(16, 17.5, 0); group.add(pole);
    scene.add(group);
    return pole;
}

function animateFlags() { flagWaveTime += 0.15; }
function createTargetMarker() {
    const geo = new THREE.RingGeometry(1, 2, 16); geo.rotateX(-Math.PI / 2);
    targetMarkerMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }));
    targetMarkerMesh.visible = false; scene.add(targetMarkerMesh);
}

function updateCameraPosition() {
    cameraRadius = THREE.MathUtils.lerp(cameraRadius, targetCameraRadius, 0.15);
    camera.position.x = targetLookAt.x + cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta);
    camera.position.y = targetLookAt.y + cameraRadius * Math.cos(cameraPhi);
    camera.position.z = targetLookAt.z + cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
    camera.lookAt(targetLookAt);
}

function setupInteraction() {
    renderer.domElement.addEventListener('pointerup', (e) => {
        if (gameOver) return;
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(terrainMesh);
        if (intersects.length > 0) {
            playerTargetPos = intersects[0].point;
            targetMarkerMesh.position.copy(playerTargetPos);
            targetMarkerMesh.position.y = getTerrainHeight(playerTargetPos.x, playerTargetPos.z) + 0.1;
            targetMarkerMesh.visible = true;
            playerTanks.forEach(t => t.target = playerTargetPos.clone());
        }
    });
}

function setupMinimapInteraction() {}
function renderMinimap() {}

function updateTanksMovement() {
    if (gameOver) return;
    playerTanks.forEach(tank => {
        if (tank.target && !tank.isDestroyed) {
            const dist = tank.mesh.position.distanceTo(tank.target);
            if (dist > 1.5) {
                const dir = new THREE.Vector3().subVectors(tank.target, tank.mesh.position).setY(0).normalize();
                tank.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                tank.mesh.position.add(dir.multiplyScalar(0.35));
                tank.mesh.position.y = getTerrainHeight(tank.mesh.position.x, tank.mesh.position.z);
            } else {
                tank.target = null;
                targetMarkerMesh.visible = false;
            }
        }
    });

    // إرسال موقع دباباتك عبر السيرفر لصديقك في الغرفة
    if (currentRoom && playerTanks.length > 0) {
        socket.emit('sync-tanks', {
            room: currentRoom,
            role: myRole,
            tanks: playerTanks.map(t => ({ x: t.mesh.position.x, z: t.mesh.position.z, rot: t.mesh.rotation.y }))
        });
    }
}

function updateRemoteEnemyTanks(remoteTanksData) {
    // إذا وصلتنا دبابات الخصم، نقوم برسمها أو تحديث مواقعها
    while (enemyTanks.length < remoteTanksData.length) {
        let eTank = createTank(0, 0, 0x6b3a2a, 'enemy', 'normal');
        enemyTanks.push(eTank);
    }
    for (let i = 0; i < remoteTanksData.length; i++) {
        if (enemyTanks[i]) {
            enemyTanks[i].mesh.position.x = remoteTanksData[i].x;
            enemyTanks[i].mesh.position.z = remoteTanksData[i].z;
            enemyTanks[i].mesh.position.y = getTerrainHeight(remoteTanksData[i].x, remoteTanksData[i].z);
            enemyTanks[i].mesh.rotation.y = remoteTanksData[i].rot;
        }
    }
}

function updateEconomyUI() {
    document.getElementById('money-display').innerText = playerMoney;
}

function checkLogicAndEconomy() {}
function animate() {
    requestAnimationFrame(animate);
    processCameraInputs();
    updateCameraPosition();
    updateTanksMovement();
    checkLogicAndEconomy();
    animateFlags();
    renderer.render(scene, camera);
}
window.onload = init;
