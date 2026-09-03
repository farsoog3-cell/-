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

window.addEventListener('pointerdown', () => {
    if (menuBgmAudio.paused && document.getElementById('start-menu').style.display !== 'none') {
        menuBgmAudio.play().catch(e => {});
    }
}, { once: true });

function playClickSound() {
    const audio = new Audio(soundFiles.click);
    audio.volume = 0.6;
    audio.play().catch(e => {});
}

function playSound(type, volume = 1.0) {
    if (soundFiles[type]) {
        const audio = new Audio(soundFiles[type]);
        audio.volume = volume;
        audio.play().catch(e => {});
    }
}

// --- متغيرات النظام ومنظومة الأونلاين (Socket.io) ---
const SERVER_URL = 'https://tank-game-server-o650.onrender.com';
let socket = null;
let currentGameMode = 'single'; // 'single' أو 'multi'
let currentRoomId = null;
let isHost = false;
let myPlayerIndex = 1; // 1 أو 2

let scene, camera, renderer, dirLight;
let playerFlagType = 'green';
let enemyFlagType = 'red';

let cameraRadius = 280, targetCameraRadius = 280;
let cameraTheta = Math.PI / 4;
let cameraPhi = Math.PI / 3.5;
let targetLookAt = new THREE.Vector3(0, 0, 0);

let camInputs = { up: false, down: false, left: false, right: false, zi: false, zo: false };

let isDragging = false;
let previousTouchX = 0;
let previousTouchY = 0;
let touchStartX = 0;
let touchStartY = 0;
let hasMoved = false;

let playerTanks = [];
let enemyTanks = [];
let bullets = [];
let tacticalMissiles = [];
let shockwaves = [];
let smokeParticles = [];
let obstacles = []; 
let rotatingRadars = [];
let tankTracks = [];
let treadTextureCache = null;
let animatedRigs = [];

let selectionMode = 'all';
let selectedTank = null;
let playerTargetPos = null;

let targetMarkerMesh;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let terrainMesh;

let enemyPoleFlagMesh, playerPoleFlagMesh;
let enemyFlagDataRef, playerFlagDataRef;

let captureProgress = 0;
let enemyCaptureProgress = 0;
let gameOver = false;
let isCinematicEnding = false;
let cinematicTargetLook = null;

const CORNER_OFFSET = 380; 
const MAP_LIMIT = 460;
const CAPTURE_RADIUS = 38;
const TANK_RADIUS = 4.5; 

let playerMoney = 500;
let enemyMoney = 500;
let totalMoneySpent = 0;
let totalTanksLost = 0;
let enemyTanksLost = 0;
let oilRigs = [];
let gameTick = 0;
let flagWaveTime = 0;
let activeFlagMeshes = [];

let playerBuildCooldown = 0;
let enemyBuildCooldown = 0;

// --- إدارة نمط اللعب (فردي / أونلاين) ---
function switchGameMode(mode) {
    currentGameMode = mode;
    document.getElementById('mode-single-btn').classList.toggle('active', mode === 'single');
    document.getElementById('mode-multi-btn').classList.toggle('active', mode === 'multi');
    
    const onlineSection = document.getElementById('online-rooms-section');
    const enemyFlagBox = document.getElementById('enemy-flags');
    const enemyFlagTitle = document.getElementById('enemy-flag-title');
    const startBtn = document.getElementById('start-btn');

    if (mode === 'multi') {
        onlineSection.style.display = 'block';
        enemyFlagBox.style.display = 'none';
        enemyFlagTitle.style.display = 'none';
        startBtn.style.display = 'none';
        initSocketConnection();
    } else {
        onlineSection.style.display = 'none';
        enemyFlagBox.style.display = 'flex';
        enemyFlagTitle.style.display = 'block';
        startBtn.style.display = 'block';
        if (socket) socket.disconnect();
    }
}

// --- إعدادات Socket.io وغرف الأونلاين ---
function initSocketConnection() {
    if (socket) return;
    socket = io(SERVER_URL);

    socket.on('connect', () => {
        showFloatingMsg('تم الاتصال بخادم الأونلاين بنجاح!');
        socket.emit('get-rooms');
    });

    socket.on('rooms-list', (rooms) => {
        renderRoomsList(rooms);
    });

    socket.on('room-created', (data) => {
        currentRoomId = data.roomId;
        isHost = true;
        myPlayerIndex = 1;
        document.getElementById('create-room-modal').style.display = 'none';
        showWaitingLobby(data.roomName, data.hostName);
    });

    socket.on('room-joined', (data) => {
        currentRoomId = data.roomId;
        isHost = false;
        myPlayerIndex = 2;
        showWaitingLobby(data.roomName, data.hostName);
        updateLobbyPlayers(data.hostName, data.guestName);
    });

    socket.on('player-joined-lobby', (data) => {
        updateLobbyPlayers(data.hostName, data.guestName);
        if (isHost) {
            document.getElementById('lobby-start-match-btn').style.display = 'block';
        }
    });

    socket.on('match-started', (data) => {
        document.getElementById('waiting-lobby').style.display = 'none';
        startOnlineGameSession(data);
    });

    socket.on('opponent-tank-spawned', (data) => {
        spawnRemoteTank(data);
    });

    socket.on('opponent-move', (data) => {
        handleRemoteMove(data);
    });
}

function renderRoomsList(rooms) {
    const container = document.getElementById('rooms-list-container');
    container.innerHTML = '';
    if (!rooms || rooms.length === 0) {
        container.innerHTML = '<div class="no-rooms-msg">لا توجد غرف متاحة حالياً. أنشئ غرفة جديدة!</div>';
        return;
    }
    rooms.forEach(room => {
        const item = document.createElement('div');
        item.className = 'room-item';
        item.innerHTML = `
            <div class="room-item-info">
                <span class="room-item-name">${room.roomName}</span>
                <span class="room-item-host">المضيف: ${room.hostName}</span>
            </div>
            <button class="join-room-btn" onclick="joinRoom('${room.roomId}')">انضمام 🎮</button>
        `;
        container.appendChild(item);
    });
}

function openCreateRoomModal() {
    const nickname = document.getElementById('player-nickname').value.trim();
    if (!nickname) {
        alert('الرجاء إدخال اسمك المستعار أولاً!');
        return;
    }
    document.getElementById('create-room-modal').style.display = 'flex';
}

function closeCreateRoomModal() {
    document.getElementById('create-room-modal').style.display = 'none';
}

function confirmCreateRoom() {
    const roomName = document.getElementById('room-name-input').value.trim() || 'غرفة معركة';
    const nickname = document.getElementById('player-nickname').value.trim();
    socket.emit('create-room', { roomName, hostName: nickname, flag: playerFlagType });
}

function joinRoom(roomId) {
    const nickname = document.getElementById('player-nickname').value.trim();
    if (!nickname) {
        alert('الرجاء إدخال اسمك المستعار قبل الانضمام للغرفة!');
        return;
    }
    socket.emit('join-room', { roomId, guestName: nickname });
}

function showWaitingLobby(roomName, hostName) {
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('waiting-lobby').style.display = 'flex';
    document.getElementById('lobby-room-title').innerText = `غرفة: ${roomName}`;
    document.getElementById('slot-player-1').innerText = `👤 اللاعب 1 (المضيف): ${hostName}`;
    if (isHost) {
        document.getElementById('lobby-status-text').innerText = 'أنت مضيف الغرفة. انتظر انصمام صديقك أو ابدأ المعركة.';
    } else {
        document.getElementById('lobby-status-text').innerText = 'انضممت للغرفة بنجاح! في انتظار المضيف لبدء المعركة...';
    }
}

function updateLobbyPlayers(hostName, guestName) {
    document.getElementById('slot-player-1').innerText = `👤 اللاعب 1: ${hostName}`;
    if (guestName) {
        document.getElementById('slot-player-2').innerText = `👤 اللاعب 2 (الضيف): ${guestName}`;
        document.getElementById('lobby-status-text').innerText = 'اللاعبون جاهزون تماماً!';
    }
}

function startOnlineMatch() {
    socket.emit('start-match', { roomId: currentRoomId });
}

function leaveLobby() {
    document.getElementById('waiting-lobby').style.display = 'none';
    document.getElementById('start-menu').style.display = 'flex';
    if (socket) socket.emit('leave-room', { roomId: currentRoomId });
    currentRoomId = null;
}

function startOnlineGameSession(data) {
    if (myPlayerIndex === 2) {
        playerFlagType = data.hostFlag === 'green' ? 'red' : 'green';
        enemyFlagType = data.hostFlag;
    }
    startGameSessionCommon();
    showFloatingMsg('بدأت المعركة الجماعية أونلاين!');
}

// --- نظام اللعبة المشترك ---
function getTerrainHeight(x, z) {
    let h = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 5 + Math.sin(x * 0.008) * 8;
    let distFromCenter = Math.sqrt(x * x + z * z);
    if (distFromCenter < 140) h *= 0.2;
    return h;
}

function showFloatingMsg(text) {
    const msg = document.getElementById('floating-msg');
    msg.innerText = text;
    msg.style.opacity = '1';
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
    const moveSpeed = 5.0;
    let dx = 0, dz = 0;

    if (camInputs.up) { dx -= Math.sin(cameraTheta) * moveSpeed; dz -= Math.cos(cameraTheta) * moveSpeed; }
    if (camInputs.down) { dx += Math.sin(cameraTheta) * moveSpeed; dz += Math.cos(cameraTheta) * moveSpeed; }
    if (camInputs.left) { dx -= Math.cos(cameraTheta) * moveSpeed; dz += Math.sin(cameraTheta) * moveSpeed; }
    if (camInputs.right) { dx += Math.cos(cameraTheta) * moveSpeed; dz -= Math.sin(cameraTheta) * moveSpeed; }

    targetLookAt.x = Math.max(-420, Math.min(420, targetLookAt.x + dx));
    targetLookAt.z = Math.max(-420, Math.min(420, targetLookAt.z + dz));

    if (camInputs.zi) targetCameraRadius = Math.max(60, targetCameraRadius - 5);
    if (camInputs.zo) targetCameraRadius = Math.min(550, targetCameraRadius + 5);
}

function selectFlag(role, color) {
    if (role === 'player') {
        if (color === enemyFlagType && currentGameMode === 'single') enemyFlagType = color === 'green' ? 'red' : 'green';
        playerFlagType = color;
    } else {
        if (color === playerFlagType) playerFlagType = color === 'green' ? 'red' : 'green';
        enemyFlagType = color;
    }
    updateFlagButtonsUI();
}

function updateFlagButtonsUI() {
    document.querySelectorAll('#player-flags .flag-btn').forEach(btn => {
        btn.classList.toggle('active-player', btn.innerText.includes(playerFlagType === 'green' ? 'الأخضر' : 'الأحمر'));
    });
    if (currentGameMode === 'single') {
        document.querySelectorAll('#enemy-flags .flag-btn').forEach(btn => {
            btn.classList.toggle('active-enemy', btn.innerText.includes(enemyFlagType === 'green' ? 'الأخضر' : 'الأحمر'));
        });
    }
}

function setSelectionMode(mode) {
    selectionMode = mode;
    document.getElementById('sel-all-btn').classList.toggle('active', mode === 'all');
    document.getElementById('sel-single-btn').classList.toggle('active', mode === 'single');
    if (mode === 'all') selectedTank = null;
    showFloatingMsg(mode === 'all' ? 'تم تحديد جميع الدبابات' : 'اضغط على الدبابة لتحديدها');
}

function startGame() {
    if (currentGameMode === 'multi') return;
    startGameSessionCommon();
    showFloatingMsg('بدأت المعركة ضد البوت!');
}

function startGameSessionCommon() {
    menuBgmAudio.pause();
    menuBgmAudio.currentTime = 0;
    battleBgmAudio.play().catch(e => {});

    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('ui-overlay').style.display = 'block';
    playSound('buy');

    let playerCampX = (myPlayerIndex === 1) ? CORNER_OFFSET : -CORNER_OFFSET;
    let playerCampZ = (myPlayerIndex === 1) ? CORNER_OFFSET : -CORNER_OFFSET;
    let terrainH = getTerrainHeight(playerCampX, playerCampZ);

    targetLookAt.set(playerCampX, terrainH, playerCampZ);
    targetCameraRadius = 110; 
    cameraPhi = Math.PI / 3.8;
    cameraRadius = targetCameraRadius;
    updateCameraPosition();
}

function setupLighting() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    
    dirLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
    dirLight.position.set(300, 450, 300);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 1200;
    let d = 450;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);
}

function createHillyBrownSoilTerrain() {
    const geometry = new THREE.PlaneGeometry(1100, 1100, 50, 50);
    geometry.rotateX(-Math.PI / 2);

    const positionAttr = geometry.attributes.position;
    for (let i = 0; i < positionAttr.count; i++) {
        let px = positionAttr.getX(i);
        let pz = positionAttr.getZ(i);
        let h = getTerrainHeight(px, pz);
        positionAttr.setY(i, h);
    }
    geometry.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.9 });
    terrainMesh = new THREE.Mesh(geometry, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);
}

function createBaseStructure(parentGroup, isEnemy) {
    const wallMat = new THREE.MeshStandardMaterial({ color: isEnemy ? 0x1e1b18 : 0x334155, roughness: 0.5 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: isEnemy ? 0x27272a : 0x64748b, roughness: 0.7 });
    const darkRoofMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const glowMat = new THREE.MeshStandardMaterial({ 
        color: isEnemy ? 0xef4444 : 0x22c55e, 
        emissive: isEnemy ? 0x991b1b : 0x15803d, 
        roughness: 0.2 
    });
    const metalPlateMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.3, roughness: 0.4 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const windowMat = new THREE.MeshStandardMaterial({ 
        color: isEnemy ? 0xef4444 : 0x38bdf8, 
        emissive: isEnemy ? 0x991b1b : 0x0284c7, 
        roughness: 0.1 
    });

    [-18, 18].forEach(x => {
        const sideWall = new THREE.Mesh(new THREE.BoxGeometry(2.5, 7, 32), wallMat);
        sideWall.position.set(x, 3.5, 0); sideWall.castShadow = true; sideWall.receiveShadow = true; parentGroup.add(sideWall);
    });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(38.5, 7, 2.5), wallMat);
    backWall.position.set(0, 3.5, 16); backWall.castShadow = true; backWall.receiveShadow = true; parentGroup.add(backWall);

    const hqBase = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 14), concreteMat);
    hqBase.position.set(0, 4, -4); hqBase.castShadow = true; hqBase.receiveShadow = true; parentGroup.add(hqBase);

    const mainDoor = new THREE.Mesh(new THREE.BoxGeometry(3, 4.5, 0.5), doorMat);
    mainDoor.position.set(0, 2.25, 3.1); parentGroup.add(mainDoor);

    [-5, 5].forEach(wx => {
        const windowObj = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 0.4), windowMat);
        windowObj.position.set(wx, 5.5, 3.1); parentGroup.add(windowObj);
    });

    const hqTop = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 10), metalPlateMat);
    hqTop.position.set(0, 10.5, -4); hqTop.castShadow = true; parentGroup.add(hqTop);

    const hqRoof = new THREE.Mesh(new THREE.BoxGeometry(14, 1.5, 12), darkRoofMat);
    hqRoof.position.set(0, 13.5, -4); hqRoof.castShadow = true; parentGroup.add(hqRoof);

    const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.4, 10.2), glowMat);
    neonStrip.position.set(0, 12.6, -4); parentGroup.add(neonStrip);

    const radarSupport = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 3, 8), metalPlateMat);
    radarSupport.position.set(0, 15.7, -4); radarSupport.castShadow = true; parentGroup.add(radarSupport);

    const mainRadarDish = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.8, 12), metalPlateMat);
    mainRadarDish.rotation.x = Math.PI / 2;
    mainRadarDish.position.set(0, 17.5, -4);
    mainRadarDish.castShadow = true;
    parentGroup.add(mainRadarDish);
    rotatingRadars.push(mainRadarDish);
}

function createBases() {
    const playerBaseGroup = new THREE.Group();
    playerBaseGroup.position.set(CORNER_OFFSET, getTerrainHeight(CORNER_OFFSET, CORNER_OFFSET), CORNER_OFFSET);
    playerBaseGroup.rotation.y = -(3 * Math.PI) / 4; 

    const enemyBaseGroup = new THREE.Group();
    enemyBaseGroup.position.set(-CORNER_OFFSET, getTerrainHeight(-CORNER_OFFSET, -CORNER_OFFSET), -CORNER_OFFSET);
    enemyBaseGroup.rotation.y = -(3 * Math.PI) / 4;

    if (playerFlagType === 'green') {
        createBaseStructure(playerBaseGroup, false);
        createBaseStructure(enemyBaseGroup, true);
    } else {
        createBaseStructure(playerBaseGroup, true);
        createBaseStructure(enemyBaseGroup, false);
    }

    scene.add(playerBaseGroup);
    scene.add(enemyBaseGroup);

    obstacles.push({ x: CORNER_OFFSET, z: CORNER_OFFSET, radius: 22 });
    obstacles.push({ x: -CORNER_OFFSET, z: -CORNER_OFFSET, radius: 22 });

    let pColor = playerFlagType === 'green' ? 0x2e3b23 : 0x6b3a2a;
    let eColor = playerFlagType === 'green' ? 0x6b3a2a : 0x2e3b23;
    
    let pTankX = CORNER_OFFSET - 45;
    let pTankZ = CORNER_OFFSET - 45;
    let eTankX = -CORNER_OFFSET + 45;
    let eTankZ = -CORNER_OFFSET + 45;

    let playerTank = createTank(pTankX, pTankZ, pColor, 'player', 'normal');
    let enemyTank = createTank(eTankX, eTankZ, eColor, 'enemy', 'normal');

    playerTank.mesh.rotation.y = -Math.PI / 4;
    enemyTank.mesh.rotation.y = -Math.PI / 4;

    playerTanks.push(playerTank);
    enemyTanks.push(enemyTank);
        
    enemyPoleFlagMesh = createFlagPole(new THREE.Group(), -CORNER_OFFSET, -CORNER_OFFSET, enemyFlagType, 'enemy');
    playerPoleFlagMesh = createFlagPole(new THREE.Group(), CORNER_OFFSET, CORNER_OFFSET, playerFlagType, 'player');
}

function createOilRigs() {
    const positions = [
        { x: 50, z: -50 }, 
        { x: -50, z: 50 },
        { x: -70, z: -70 },
        { x: 70, z: 70 }
    ];

    positions.forEach(pos => {
        const rigGroup = new THREE.Group();
        let terrainH = getTerrainHeight(pos.x, pos.z);
        rigGroup.position.set(pos.x, terrainH, pos.z);

        const baseMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
        const base = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 12), baseMat);
        base.position.y = 1; base.castShadow = true; base.receiveShadow = true;
        rigGroup.add(base);

        const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.5 });
        const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), frameMat);
        leftPillar.position.set(-2.5, 5, 0); leftPillar.rotation.z = 0.15; leftPillar.castShadow = true;
        rigGroup.add(leftPillar);

        const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), frameMat);
        rightPillar.position.set(2.5, 5, 0); rightPillar.rotation.z = -0.15; rightPillar.castShadow = true;
        rigGroup.add(rightPillar);

        const topBar = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, 1.2), frameMat);
        topBar.position.set(0, 9, 0); topBar.castShadow = true;
        rigGroup.add(topBar);

        const beamGroup = new THREE.Group();
        beamGroup.position.set(0, 9.4, 0);

        const walkingBeam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 14), new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.3 }));
        walkingBeam.position.set(0, 0, 1); walkingBeam.castShadow = true;
        beamGroup.add(walkingBeam);

        const horseheadMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
        const horsehead = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3, 2), horseheadMat);
        horsehead.position.set(0, -1.2, 7.5); horsehead.castShadow = true;
        beamGroup.add(horsehead);

        const weightMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
        const counterweight = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 3), weightMat);
        counterweight.position.set(0, -1, -5.5); counterweight.castShadow = true;
        beamGroup.add(counterweight);

        rigGroup.add(beamGroup);

        const motorBox = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshStandardMaterial({ color: 0x334155 }));
        motorBox.position.set(0, 2.5, -5.5); motorBox.castShadow = true;
        rigGroup.add(motorBox);

        const flagGroup = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 18, 6), new THREE.MeshStandardMaterial({color: 0x999999}));
        pole.position.set(6, 9, -4); flagGroup.add(pole);

        const flagGeo = new THREE.PlaneGeometry(7, 4, 12, 4);
        const flagMat = new THREE.MeshBasicMaterial({ map: createFlagTexture('none'), side: THREE.DoubleSide });
        const flagMesh = new THREE.Mesh(flagGeo, flagMat);
        flagMesh.position.set(9.5, 16, -4); flagGroup.add(flagMesh);
        activeFlagMeshes.push({ mesh: flagMesh, baseHeight: 16, type: 'none' });

        rigGroup.add(flagGroup);
        scene.add(rigGroup);
        
        obstacles.push({ x: pos.x, z: pos.z, radius: 10 });
        
        oilRigs.push({
            x: pos.x, z: pos.z, group: rigGroup,
            beam: beamGroup,
            flagData: activeFlagMeshes[activeFlagMeshes.length - 1],
            owner: 'none', captureProgress: 0
        });
        
        animatedRigs.push(beamGroup);
    });
}

function createTank(x, z, colorHex, team, type = 'normal') {
    const tankGroup = new THREE.Group();
    let isRocketTank = (type === 'rocket');
    
    let baseColor = isRocketTank ? (team === 'player' ? 0x1e3a8a : 0x7f1d1d) : colorHex;
    const armorMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.5 });
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

    const bodySizeX = isRocketTank ? 7 : 6;
    const bodySizeZ = isRocketTank ? 10 : 9;
    const body = new THREE.Mesh(new THREE.BoxGeometry(bodySizeX, 2.2, bodySizeZ), armorMat);
    body.position.y = 1.2; body.name = "body"; body.castShadow = true; body.receiveShadow = true; tankGroup.add(body);
    
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.7, bodySizeZ + 0.2), trackMat);
    leftTrack.position.set(-(bodySizeX/2 + 0.5), 0.8, 0); leftTrack.castShadow = true; tankGroup.add(leftTrack);
    
    const rightTrack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.7, bodySizeZ + 0.2), trackMat);
    rightTrack.position.set((bodySizeX/2 + 0.5), 0.8, 0); rightTrack.castShadow = true; tankGroup.add(rightTrack);
    
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 1.5, 10), armorMat);
    turret.position.y = 2.8; turret.name = "turret"; turret.castShadow = true; tankGroup.add(turret);
    
    if (isRocketTank) {
        const launcherPod = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 4), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
        launcherPod.position.set(0, 3.8, 0); launcherPod.name = "launcherPod"; launcherPod.castShadow = true; tankGroup.add(launcherPod);
    } else {
        const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 6), armorMat);
        cannon.rotation.x = Math.PI / 2; cannon.position.set(0, 2.8, 4); cannon.name = "cannon"; cannon.castShadow = true; tankGroup.add(cannon);
    }

    let terrainY = getTerrainHeight(x, z);
    tankGroup.position.set(x, terrainY, z);
    scene.add(tankGroup);

    const hpLabel = document.createElement('div');
    hpLabel.className = `tank-hp-label ${team === 'player' ? 'hp-player' : 'hp-enemy'}`;
    let initialHp = isRocketTank ? 200 : 100;
    hpLabel.innerText = `${initialHp}`;
    document.getElementById('hp-labels-container').appendChild(hpLabel);

    let idleAudio = new Audio(soundFiles.idle);
    idleAudio.loop = true;
    idleAudio.volume = 0.25;

    let moveAudio = new Audio(soundFiles.move);
    moveAudio.loop = true;
    moveAudio.volume = 0.45;

    return { 
        mesh: tankGroup, 
        hpLabel: hpLabel, 
        target: null, 
        team: team, 
        type: type, 
        hp: initialHp, 
        maxHp: initialHp, 
        lastShot: 0, 
        isDestroyed: false,
        destructionTimer: 0,
        idleAudio: idleAudio,
        moveAudio: moveAudio,
        isIdlePlaying: false,
        isMovePlaying: false,
        lastTrackPos: new THREE.Vector3(x, terrainY, z)
    };
}

function spawnRemoteTank(data) {
    let rColor = 0x6b3a2a;
    let newTank = createTank(data.x, data.z, rColor, 'enemy', data.type);
    enemyTanks.push(newTank);
}

function handleRemoteMove(data) {
    // تحديث حركة دبابات الخصم في وضع الأونلاين
}

function buyPlayerTank(type) {
    if (playerBuildCooldown > 0) return;
    let cost = (type === 'rocket') ? 300 : 150;
    if (playerMoney >= cost) {
        playerMoney -= cost;
        totalMoneySpent += cost;
        playerBuildCooldown = 1200;
        updateEconomyUI();
        playSound('buy');

        let pColor = playerFlagType === 'green' ? 0x2e3b23 : 0x6b3a2a;
        let pX = CORNER_OFFSET - 50 + (Math.random() - 0.5) * 20;
        let pZ = CORNER_OFFSET - 50 + (Math.random() - 0.5) * 20;
        let newTank = createTank(pX, pZ, pColor, 'player', type);
        newTank.mesh.rotation.y = -Math.PI / 4;
        if (playerTargetPos) {
            newTank.target = playerTargetPos.clone();
        }
        playerTanks.push(newTank);

        if (currentGameMode === 'multi' && socket) {
            socket.emit('spawn-tank', { roomId: currentRoomId, x: pX, z: pZ, type: type });
        }

        showFloatingMsg(type === 'rocket' ? 'تم طلب دبابة صواريخ' : 'تم طلب دبابة عادية');
    }
}

function createFlagPole(group, x, z, flagType, role) {
    let terrainH = getTerrainHeight(x, z);
    group.position.set(x, terrainH, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 35, 8), new THREE.MeshStandardMaterial({ color: 0xd1d5db }));
    pole.position.set(16, 17.5, 0); pole.castShadow = true; group.add(pole);

    const flagGeo = new THREE.PlaneGeometry(10, 6, 14, 4);
    const flagMat = new THREE.MeshBasicMaterial({ map: createFlagTexture(flagType), side: THREE.DoubleSide });
    const flagMesh = new THREE.Mesh(flagGeo, flagMat);
    flagMesh.position.set(21, 38.5, 0); group.add(flagMesh);

    let flagDataObj = { mesh: flagMesh, baseHeight: 38.5, type: flagType };
    activeFlagMeshes.push(flagDataObj);
    if (role === 'enemy') enemyFlagDataRef = flagDataObj;
    else playerFlagDataRef = flagDataObj;

    scene.add(group);
    return flagMesh;
}

function createFlagTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (type === 'green') {
        ctx.fillStyle = '#007a3d'; ctx.fillRect(0, 0, 128, 21);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 21, 128, 22);
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 43, 128, 21);
        drawStar(ctx, 42, 32, '#cc0000'); drawStar(ctx, 64, 32, '#cc0000'); drawStar(ctx, 85, 32, '#cc0000');
    } else if(type === 'red') {
        ctx.fillStyle = '#cc0000'; ctx.fillRect(0, 0, 128, 21);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 21, 128, 22);
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 43, 128, 21);
        drawStar(ctx, 53, 32, '#007a3d'); drawStar(ctx, 75, 32, '#007a3d');
    } else {
        ctx.fillStyle = '#475569'; ctx.fillRect(0, 0, 128, 64);
    }
    return new THREE.CanvasTexture(canvas);
}

function drawStar(ctx, cx, cy, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    let spikes = 5, outerRadius = 6, innerRadius = 3;
    let rot = Math.PI / 2 * 3, x = cx, y = cy, step = Math.PI / spikes;
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius; y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y); rot += step;
        x = cx + Math.cos(rot) * innerRadius; y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y); rot += step;
    }
    ctx.lineTo(cx + Math.cos(Math.PI / 2 * 3) * outerRadius, cy + Math.sin(Math.PI / 2 * 3) * outerRadius);
    ctx.closePath(); ctx.fill();
}

function createTargetMarker() {
    const ringGeo = new THREE.RingGeometry(3, 4, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    targetMarkerMesh = new THREE.Mesh(ringGeo, ringMat);
    targetMarkerMesh.visible = false;
    scene.add(targetMarkerMesh);
}

function setupInteraction() {
    const container = document.getElementById('canvas-container');

    container.addEventListener('pointerdown', (e) => {
        if (gameOver || document.getElementById('start-menu').style.display !== 'none') return;
        isDragging = true;
        hasMoved = false;
        touchStartX = e.clientX;
        touchStartY = e.clientY;
        previousTouchX = e.clientX;
        previousTouchY = e.clientY;
    });

    container.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        let dx = e.clientX - previousTouchX;
        let dy = e.clientY - previousTouchY;
        if (Math.abs(e.clientX - touchStartX) > 6 || Math.abs(e.clientY - touchStartY) > 6) {
            hasMoved = true;
        }

        let rotSpeed = 0.005;
        cameraTheta -= dx * rotSpeed;
        cameraPhi = Math.max(0.3, Math.min(Math.PI / 2 - 0.05, cameraPhi - dy * rotSpeed));

        previousTouchX = e.clientX;
        previousTouchY = e.clientY;
        updateCameraPosition();
    });

    container.addEventListener('pointerup', (e) => {
        isDragging = false;
        if (!hasMoved) {
            handleTapSelectionOrCommand(e.clientX, e.clientY);
        }
    });

    container.addEventListener('wheel', (e) => {
        targetCameraRadius = Math.max(60, Math.min(550, targetCameraRadius + e.deltaY * 0.25));
    }, { passive: true });
}

function handleTapSelectionOrCommand(clientX, clientY) {
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    let intersects = raycaster.intersectObject(terrainMesh);
    if (intersects.length > 0) {
        let hitPoint = intersects[0].point;

        if (selectionMode === 'single') {
            let clickedTank = null;
            playerTanks.forEach(tank => {
                if (!tank.isDestroyed && tank.mesh.position.distanceTo(hitPoint) < 8) {
                    clickedTank = tank;
                }
            });
            if (clickedTank) {
                selectedTank = clickedTank;
                showFloatingMsg('تم تحديد الدبابة بنجاح');
                return;
            }
        }

        playerTargetPos = hitPoint.clone();
        targetMarkerMesh.position.copy(hitPoint);
        targetMarkerMesh.position.y = getTerrainHeight(hitPoint.x, hitPoint.z) + 0.1;
        targetMarkerMesh.visible = true;

        playerTanks.forEach(tank => {
            if (!tank.isDestroyed) {
                if (selectionMode === 'all' || selectedTank === tank) {
                    tank.target = hitPoint.clone();
                }
            }
        });
    }
}

function setupMinimapInteraction() {
    const minimapCanvas = document.getElementById('minimap-canvas');
    minimapCanvas.addEventListener('pointerdown', (e) => {
        const rect = minimapCanvas.getBoundingClientRect();
        let xRatio = (e.clientX - rect.left) / rect.width;
        let zRatio = (e.clientY - rect.top) / rect.height;
        let worldX = (xRatio - 0.5) * (MAP_LIMIT * 2);
        let worldZ = (zRatio - 0.5) * (MAP_LIMIT * 2);

        targetLookAt.set(worldX, getTerrainHeight(worldX, worldZ), worldZ);
        updateCameraPosition();
    });
}

function updateCameraPosition() {
    cameraRadius += (targetCameraRadius - cameraRadius) * 0.1;
    let x = targetLookAt.x + cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta);
    let y = targetLookAt.y + cameraRadius * Math.cos(cameraPhi);
    let z = targetLookAt.z + cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);

    camera.position.set(x, y, z);
    camera.lookAt(targetLookAt);
}

function updateEconomyUI() {
    document.getElementById('money-display').innerText = playerMoney;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- الحلقة الرئيسية للمعركة (Animation & Physics Loop) ---
function animate() {
    requestAnimationFrame(animate);
    if (gameOver) return;

    gameTick++;
    processCameraInputs();
    updateCameraPosition();

    if (playerBuildCooldown > 0) playerBuildCooldown--;
    if (currentGameMode === 'single' && enemyBuildCooldown > 0) enemyBuildCooldown--;

    // تحريك رادارات القواعد
    rotatingRadars.forEach(radar => { radar.rotation.z += 0.03; });

    // تحريك منصات استخراج النفط
    animatedRigs.forEach(beam => {
        beam.rotation.x = Math.sin(gameTick * 0.05) * 0.25;
    });

    // إنتاج الأموال من آبار النفط المجاورة
    oilRigs.forEach(rig => {
        let distToPlayer = new THREE.Vector3(rig.x, 0, rig.z).distanceTo(new THREE.Vector3(CORNER_OFFSET, 0, CORNER_OFFSET));
        if (distToPlayer < CAPTURE_RADIUS) {
            rig.owner = 'player';
            rig.flagData.type = playerFlagType;
            rig.flagData.mesh.material.map = createFlagTexture(playerFlagType);
            if (gameTick % 180 === 0) { playerMoney += 25; updateEconomyUI(); }
        }
    });

    // تحريك وتحديث دبابات اللاعب
    playerTanks.forEach(tank => {
        if (tank.isDestroyed) {
            tank.destructionTimer--;
            updateTankAudio(tank, false);
            return;
        }

        let isMoving = false;
        if (tank.target) {
            let pos = tank.mesh.position;
            let dir = new THREE.Vector3().subVectors(tank.target, pos);
            dir.y = 0;
            let dist = dir.length();

            if (dist > 3) {
                dir.normalize();
                let moveStep = 0.9;
                pos.addScaledVector(dir, moveStep);
                pos.y = getTerrainHeight(pos.x, pos.z);

                let targetAngle = Math.atan2(dir.x, dir.z);
                tank.mesh.rotation.y = targetAngle;
                isMoving = true;

                if (pos.distanceTo(tank.lastTrackPos) > 4) {
                    spawnRealisticTankTracks(pos, tank.mesh.rotation.y, tank.type === 'rocket' ? 7 : 6);
                    tank.lastTrackPos.copy(pos);
                }
            } else {
                tank.target = null;
            }
        }
        updateTankAudio(tank, isMoving);

        // تحديث إحداثيات شريط الصحة فوق الدبابة
        let vector = tank.mesh.position.clone();
        vector.y += 3.5;
        vector.project(camera);
        let xCoord = (vector.x * 0.5 + 0.5) * window.innerWidth;
        let yCoord = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
        tank.hpLabel.style.transform = `translate(-50%, -100%) translate(${xCoord}px, ${yCoord}px)`;
    });

    // تحريك وتحديث دبابات العدو (البوت الذكي)
    enemyTanks.forEach(tank => {
        if (tank.isDestroyed) {
            tank.destructionTimer--;
            updateTankAudio(tank, false);
            return;
        }

        let isMoving = false;
        if (currentGameMode === 'single') {
            // منطق البوت الذكي لمهاجمة معسكر اللاعب أو دباباته
            let targetPos = new THREE.Vector3(CORNER_OFFSET, getTerrainHeight(CORNER_OFFSET, CORNER_OFFSET), CORNER_OFFSET);
            let pos = tank.mesh.position;
            let dir = new THREE.Vector3().subVectors(targetPos, pos);
            dir.y = 0;
            let dist = dir.length();

            if (dist > 15) {
                dir.normalize();
                pos.addScaledVector(dir, 0.75);
                pos.y = getTerrainHeight(pos.x, pos.z);
                tank.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                isMoving = true;
            }
        }
        updateTankAudio(tank, isMoving);

        let vector = tank.mesh.position.clone();
        vector.y += 3.5;
        vector.project(camera);
        let xCoord = (vector.x * 0.5 + 0.5) * window.innerWidth;
        let yCoord = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
        tank.hpLabel.style.transform = `translate(-50%, -100%) translate(${xCoord}px, ${yCoord}px)`;
    });

    // تحديث الخريطة المصغرة Minimap
    renderMinimap();

    renderer.render(scene, camera);
}

function renderMinimap() {
    const canvas = document.getElementById('minimap-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = canvas.width / (MAP_LIMIT * 2);

    function worldToMinimap(x, z) {
        return {
            x: (x + MAP_LIMIT) * scale,
            y: (z + MAP_LIMIT) * scale
        };
    }

    // رسم قواعد المعسكرات على الخريطة المصغرة
    let pPos = worldToMinimap(CORNER_OFFSET, CORNER_OFFSET);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(pPos.x - 6, pPos.y - 6, 12, 12);

    let ePos = worldToMinimap(-CORNER_OFFSET, -CORNER_OFFSET);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(ePos.x - 6, ePos.y - 6, 12, 12);

    // رسم دبابات اللاعب
    playerTanks.forEach(t => {
        if (!t.isDestroyed) {
            let pos = worldToMinimap(t.mesh.position.x, t.mesh.position.z);
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath(); ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2); ctx.fill();
        }
    });

    // رسم دبابات العدو
    enemyTanks.forEach(t => {
        if (!t.isDestroyed) {
            let pos = worldToMinimap(t.mesh.position.x, t.mesh.position.z);
            ctx.fillStyle = '#f87171';
            ctx.beginPath(); ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2); ctx.fill();
        }
    });
}

window.onload = init;
