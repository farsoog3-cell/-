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

let playerTanks = [], enemyTanks = [], bullets = [], tacticalMissiles = [], shockwaves = [], smokeParticles = [];
let obstacles = [], rotatingRadars = [], tankTracks = [], oilRigs = [], activeFlagMeshes = [], animatedRigs = [];
let selectionMode = 'all', selectedTank = null, playerTargetPos = null;

let raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
let terrainMesh, enemyPoleFlagMesh, playerPoleFlagMesh, enemyFlagDataRef, playerFlagDataRef;
let gameOver = false, isCinematicEnding = false, cinematicTargetLook = null;

const CORNER_OFFSET = 380;
const MAP_LIMIT = 460;
const TANK_RADIUS = 4.5;

let playerMoney = 500;
let totalMoneySpent = 0, totalTanksLost = 0, enemyTanksLost = 0;
let gameTick = 0, flagWaveTime = 0;
let playerBuildCooldown = 0;
let clock = new THREE.Clock();

function getTerrainHeight(x, z) {
    let h = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 5 + Math.sin(x * 0.008) * 8;
    let distFromCenter = Math.sqrt(x * x + z * z);
    if (distFromCenter < 140) h *= 0.2;
    return h;
}

function showFloatingMsg(text) {
    const msg = document.getElementById('floating-msg');
    if (msg) {
        msg.innerText = text; msg.style.opacity = '1';
        setTimeout(() => { msg.style.opacity = '0'; }, 2000);
    }
}

function selectFlag(role, color) {
    if (role === 'player') {
        if (color === enemyFlagType) enemyFlagType = color === 'green' ? 'red' : 'green';
        playerFlagType = color;
    } else {
        if (color === playerFlagType) playerFlagType = color === 'green' ? 'red' : 'green';
        enemyFlagType = color;
    }
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
    scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0018);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1500);
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
    setupInteraction();

    let mySide = (typeof window.mySide !== 'undefined') ? window.mySide : 'player';
    let startX = (mySide === 'player') ? CORNER_OFFSET : -CORNER_OFFSET;
    let startZ = (mySide === 'player') ? CORNER_OFFSET : -CORNER_OFFSET;
    targetLookAt.set(startX, getTerrainHeight(startX, startZ), startZ);
    updateCameraPosition();

    window.addEventListener('resize', onWindowResize);
    animate();
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

    const terrainMat = new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.9 });
    terrainMesh = new THREE.Mesh(geometry, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);
}

function createBases() {
    const playerBaseGroup = new THREE.Group();
    playerBaseGroup.position.set(CORNER_OFFSET, getTerrainHeight(CORNER_OFFSET, CORNER_OFFSET), CORNER_OFFSET);
    playerBaseGroup.rotation.y = -(3 * Math.PI) / 4; 

    const enemyBaseGroup = new THREE.Group();
    enemyBaseGroup.position.set(-CORNER_OFFSET, getTerrainHeight(-CORNER_OFFSET, -CORNER_OFFSET), -CORNER_OFFSET);
    enemyBaseGroup.rotation.y = -(3 * Math.PI) / 4;

    createBaseStructure(playerBaseGroup, false);
    createBaseStructure(enemyBaseGroup, true);

    scene.add(playerBaseGroup);
    scene.add(enemyBaseGroup);

    obstacles.push({ x: CORNER_OFFSET, z: CORNER_OFFSET, radius: 22 });
    obstacles.push({ x: -CORNER_OFFSET, z: -CORNER_OFFSET, radius: 22 });

    let pTankX = CORNER_OFFSET - 45, pTankZ = CORNER_OFFSET - 45;
    let eTankX = -CORNER_OFFSET + 45, eTankZ = -CORNER_OFFSET + 45;

    let pColor = playerFlagType === 'green' ? 0x2e3b23 : 0x6b3a2a;
    let eColor = playerFlagType === 'green' ? 0x6b3a2a : 0x2e3b23;

    spawnTank('player', 'normal', pTankX, pTankZ, pColor);
    spawnTank('enemy', 'normal', eTankX, eTankZ, eColor);
        
    enemyPoleFlagMesh = createFlagPole(new THREE.Group(), -CORNER_OFFSET, -CORNER_OFFSET, enemyFlagType, 'enemy');
    playerPoleFlagMesh = createFlagPole(new THREE.Group(), CORNER_OFFSET, CORNER_OFFSET, playerFlagType, 'player');
}

function createBaseStructure(parentGroup, isEnemy) {
    const wallMat = new THREE.MeshStandardMaterial({ color: isEnemy ? 0x1e1b18 : 0x334155, roughness: 0.5 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: isEnemy ? 0x27272a : 0x64748b, roughness: 0.7 });
    
    const hqBase = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 14), concreteMat);
    hqBase.position.set(0, 4, -4); hqBase.castShadow = true; hqBase.receiveShadow = true; parentGroup.add(hqBase);

    const radarSupport = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 3, 8), wallMat);
    radarSupport.position.set(0, 10.5, -4); radarSupport.castShadow = true; parentGroup.add(radarSupport);

    const mainRadarDish = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.8, 12), wallMat);
    mainRadarDish.rotation.x = Math.PI / 2; mainRadarDish.position.set(0, 12.5, -4);
    parentGroup.add(mainRadarDish);
    rotatingRadars.push(mainRadarDish);
}

function createOilRigs() {
    const positions = [{ x: 50, z: -50 }, { x: -50, z: 50 }, { x: -70, z: -70 }, { x: 70, z: 70 }];
    positions.forEach(pos => {
        const rigGroup = new THREE.Group();
        let terrainH = getTerrainHeight(pos.x, pos.z);
        rigGroup.position.set(pos.x, terrainH, pos.z);

        const baseMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
        const base = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 12), baseMat);
        base.position.y = 1; base.castShadow = true; rigGroup.add(base);

        const beamGroup = new THREE.Group();
        beamGroup.position.set(0, 9.4, 0);
        const walkingBeam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 14), new THREE.MeshStandardMaterial({ color: 0xb91c1c }));
        walkingBeam.position.set(0, 0, 1); beamGroup.add(walkingBeam);
        rigGroup.add(beamGroup);

        scene.add(rigGroup);
        obstacles.push({ x: pos.x, z: pos.z, radius: 10 });
        animatedRigs.push(beamGroup);
    });
}

function spawnTank(team, type, x, z, colorHex) {
    const tankGroup = new THREE.Group();
    let isRocketTank = (type === 'rocket');
    let baseColor = colorHex || (isRocketTank ? (team === 'player' ? 0x1e3a8a : 0x7f1d1d) : 0x15803d);
    
    const armorMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(6, 2.2, 9), armorMat);
    body.position.y = 1.2; body.castShadow = true; tankGroup.add(body);

    const turret = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 1.5, 10), armorMat);
    turret.position.y = 2.8; turret.castShadow = true; tankGroup.add(turret);

    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 6), armorMat);
    cannon.rotation.x = Math.PI / 2; cannon.position.set(0, 2.8, 4); tankGroup.add(cannon);

    let terrainY = getTerrainHeight(x, z);
    tankGroup.position.set(x, terrainY, z);
    scene.add(tankGroup);

    let tankData = {
        mesh: tankGroup, team: team, type: type,
        hp: isRocketTank ? 200 : 100, maxHp: isRocketTank ? 200 : 100,
        targetPos: new THREE.Vector3(x, terrainY, z), isDestroyed: false
    };

    if (team === 'player') playerTanks.push(tankData);
    else enemyTanks.push(tankData);

    return tankData;
}

function createFlagPole(group, x, z, flagType, role) {
    let terrainH = getTerrainHeight(x, z);
    group.position.set(x, terrainH, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 35, 8), new THREE.MeshStandardMaterial({ color: 0xd1d5db }));
    pole.position.set(16, 17.5, 0); group.add(pole);

    const flagGeo = new THREE.PlaneGeometry(10, 6, 14, 4);
    const flagMat = new THREE.MeshBasicMaterial({ map: createFlagTexture(flagType), side: THREE.DoubleSide });
    const flagMesh = new THREE.Mesh(flagGeo, flagMat);
    flagMesh.position.set(21, 38.5, 0); group.add(flagMesh);

    activeFlagMeshes.push({ mesh: flagMesh, baseHeight: 38.5, type: flagType });
    scene.add(group);
    return flagMesh;
}

function createFlagTexture(type) {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (type === 'green') {
        ctx.fillStyle = '#007a3d'; ctx.fillRect(0, 0, 128, 21);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 21, 128, 22);
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 43, 128, 21);
    } else {
        ctx.fillStyle = '#cc0000'; ctx.fillRect(0, 0, 128, 21);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 21, 128, 22);
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 43, 128, 21);
    }
    return new THREE.CanvasTexture(canvas);
}

function setupInteraction() {
    renderer.domElement.addEventListener('pointerdown', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObject(terrainMesh);
        if (intersects.length > 0) {
            let pt = intersects[0].point;
            let mySide = (typeof window.mySide !== 'undefined') ? window.mySide : 'player';
            let myTanks = (mySide === 'player') ? playerTanks : enemyTanks;

            myTanks.forEach((t, idx) => {
                t.targetPos.copy(pt);
                if (typeof sendMoveOrder === 'function') sendMoveOrder(idx, pt);
            });
        }
    });
}

function buyPlayerTank(type) {
    let cost = (type === 'rocket') ? 300 : 150;
    if (playerMoney >= cost) {
        playerMoney -= cost;
        let mySide = (typeof window.mySide !== 'undefined') ? window.mySide : 'player';
        let basePos = (mySide === 'player') ? new THREE.Vector3(CORNER_OFFSET, 0, CORNER_OFFSET) : new THREE.Vector3(-CORNER_OFFSET, 0, -CORNER_OFFSET);
        
        spawnTank(mySide, type, basePos.x + (Math.random() - 0.5) * 20, basePos.z + (Math.random() - 0.5) * 20);
        if (typeof sendBuyTank === 'function') sendBuyTank(type);
        playSound('buy');
    }
}

function onEnemyMoveReceived(data) {
    let mySide = (typeof window.mySide !== 'undefined') ? window.mySide : 'player';
    let oppTanks = (mySide === 'player') ? enemyTanks : playerTanks;
    if (oppTanks[data.tankIndex]) {
        oppTanks[data.tankIndex].targetPos.set(data.target.x, getTerrainHeight(data.target.x, data.target.z), data.target.z);
    }
}

function onEnemyBuyReceived(data) {
    let mySide = (typeof window.mySide !== 'undefined') ? window.mySide : 'player';
    let oppSide = (mySide === 'player') ? 'enemy' : 'player';
    let basePos = (oppSide === 'player') ? new THREE.Vector3(CORNER_OFFSET, 0, CORNER_OFFSET) : new THREE.Vector3(-CORNER_OFFSET, 0, -CORNER_OFFSET);
    spawnTank(oppSide, data.type, basePos.x + (Math.random() - 0.5) * 20, basePos.z + (Math.random() - 0.5) * 20);
}

function updateCameraPosition() {
    let x = targetLookAt.x + cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta);
    let y = targetLookAt.y + cameraRadius * Math.cos(cameraPhi);
    let z = targetLookAt.z + cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
    camera.position.set(x, y, z);
    camera.lookAt(targetLookAt);
}

function camMove(dir, state) { camInputs[dir] = state; }

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    if (camInputs.up) targetLookAt.z -= 3;
    if (camInputs.down) targetLookAt.z += 3;
    if (camInputs.left) targetLookAt.x -= 3;
    if (camInputs.right) targetLookAt.x += 3;

    updateCameraPosition();

    let allTanks = [...playerTanks, ...enemyTanks];
    allTanks.forEach(tank => {
        if (tank.mesh.position.distanceTo(tank.targetPos) > 2) {
            let dir = new THREE.Vector3().subVectors(tank.targetPos, tank.mesh.position).normalize();
            tank.mesh.position.addScaledVector(dir, 0.8);
            tank.mesh.position.y = getTerrainHeight(tank.mesh.position.x, tank.mesh.position.z);
            tank.mesh.lookAt(tank.targetPos.x, tank.mesh.position.y, tank.targetPos.z);
        }
    });

    let time = Date.now() * 0.003;
    animatedRigs.forEach((beam, index) => {
        beam.rotation.x = Math.sin(time + index) * 0.35;
    });

    renderer.render(scene, camera);
}
