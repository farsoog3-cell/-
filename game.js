// ملف منطق اللعبة الشامل - النسخة الكاملة والمصححة نهائياً
const soundFiles = {
    menuBgm: 'sounds/menu_bgm.mp3',
    battleBgm: 'sounds/battle_bgm.mp3',
    click: 'sounds/shoot.mp3',
    attack: 'sounds/shoot.mp3',
    danger: 'sounds/battle_bgm.mp3',
    victory: 'sounds/victory_sound.mp3',
    defeat: 'sounds/defeat_sound.mp3',
    shoot: 'sounds/shoot.mp3',
    rocket: 'sounds/rocket.mp3',
    explosion: 'sounds/explosion.mp3',
    buy: 'sounds/shoot.mp3',
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

function playSound(type, volume = 1.0) {
    if (soundFiles[type]) {
        const audio = new Audio(soundFiles[type]);
        audio.volume = volume;
        audio.play().catch(e => {});
    }
}

let scene, camera, renderer, dirLight;
let playerFlagType = 'green'; let enemyFlagType = 'red';
let cameraRadius = 280, targetCameraRadius = 280;
let cameraTheta = Math.PI / 4; let cameraPhi = Math.PI / 3.5;
let targetLookAt = new THREE.Vector3(0, 0, 0);

let camInputs = { up: false, down: false, left: false, right: false, zi: false, zo: false };
let isDragging = false, previousTouchX = 0, previousTouchY = 0, touchStartX = 0, touchStartY = 0, hasMoved = false;

let playerTanks = [], enemyTanks = [], obstacles = [], rotatingRadars = [], activeFlagMeshes = [];
let enemyPoleFlagMesh, playerPoleFlagMesh;
let selectionMode = 'all', selectedTank = null, playerTargetPos = null;
let targetMarkerMesh, raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();

const CORNER_OFFSET = 380;
let playerMoney = 500, enemyMoney = 500;
let flagWaveTime = 0;

function init() {
    const container = document.getElementById('canvas-container');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7dd3fc);
    scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0018);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1500);
    updateCameraPosition();

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    dirLight = new THREE.DirectionalLight(0xfffbeb, 1.3);
    dirLight.position.set(300, 500, 300);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 1200;
    let d = 500;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    if (typeof createHillyBrownSoilTerrain === 'function') {
        createHillyBrownSoilTerrain();
    }

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

    obstacles.push({ x: CORNER_OFFSET, z: CORNER_OFFSET, radius: 25 });
    obstacles.push({ x: -CORNER_OFFSET, z: -CORNER_OFFSET, radius: 25 });

    if (typeof createFlagPole === 'function') {
        enemyPoleFlagMesh = createFlagPole(new THREE.Group(), -CORNER_OFFSET, -CORNER_OFFSET, enemyFlagType, 'enemy');
        playerPoleFlagMesh = createFlagPole(new THREE.Group(), CORNER_OFFSET, CORNER_OFFSET, playerFlagType, 'player');
    }

    const markerGeo = new THREE.RingGeometry(2, 3.5, 32);
    markerGeo.rotateX(-Math.PI / 2);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    targetMarkerMesh = new THREE.Mesh(markerGeo, markerMat);
    targetMarkerMesh.visible = false;
    scene.add(targetMarkerMesh);

    if (typeof createTank === 'function') {
        playerTanks.push(createTank(CORNER_OFFSET - 55, CORNER_OFFSET - 55, 0x2e3b23, 'player', 'normal'));
        enemyTanks.push(createTank(-CORNER_OFFSET + 55, -CORNER_OFFSET + 55, 0x6b3a2a, 'enemy', 'normal'));
    }

    setupAccurateTouchControls(container);
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
    
    // إخفاء قائمة البداية بالكامل وإظهار واجهة اللعبة
    const menuEl = document.getElementById('start-menu');
    if (menuEl) menuEl.style.display = 'none';
    
    const uiEl = document.getElementById('ui-overlay');
    if (uiEl) uiEl.style.display = 'block';

    targetLookAt.set(CORNER_OFFSET, getTerrainHeight(CORNER_OFFSET, CORNER_OFFSET), CORNER_OFFSET);
    targetCameraRadius = 110;
}

function camMove(dir, state) { camInputs[dir] = state; }

function selectFlag(role, color) {
    if (role === 'player') playerFlagType = color; 
    else enemyFlagType = color;
    
    document.querySelectorAll(`#${role}-flags .flag-btn`).forEach(btn => {
        btn.classList.remove(role === 'player' ? 'active-player' : 'active-enemy');
    });
    
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add(role === 'player' ? 'active-player' : 'active-enemy');
    }
}

function setSelectionMode(mode) {
    selectionMode = mode;
    document.getElementById('sel-all-btn').classList.toggle('active', mode === 'all');
    document.getElementById('sel-single-btn').classList.toggle('active', mode === 'single');
}

function buyPlayerTank(type) {
    let cost = (type === 'rocket') ? 300 : 150;
    if (playerMoney >= cost) {
        playerMoney -= cost;
        updateEconomyUI();
        playSound('buy', 0.8);

        let spawnX = CORNER_OFFSET - 55 + (Math.random() * 20 - 10);
        let spawnZ = CORNER_OFFSET - 55 + (Math.random() * 20 - 10);
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

function setupAccurateTouchControls(container) {
    container.addEventListener('pointerdown', (e) => {
        if (e.target.closest('#ui-overlay') && e.target.id !== 'canvas-container') return;
        isDragging = true;
        hasMoved = false;
        previousTouchX = e.clientX;
        previousTouchY = e.clientY;
        touchStartX = e.clientX;
        touchStartY = e.clientY;
    });

    container.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        let deltaX = e.clientX - previousTouchX;
        let deltaY = e.clientY - previousTouchY;
        
        if (Math.abs(e.clientX - touchStartX) > 5 || Math.abs(e.clientY - touchStartY) > 5) {
            hasMoved = true;
        }

        previousTouchX = e.clientX;
        previousTouchY = e.clientY;

        let panSpeed = 0.8;
        let cos = Math.cos(cameraTheta);
        let sin = Math.sin(cameraTheta);
        targetLookAt.x -= (deltaX * cos - deltaY * sin) * panSpeed;
        targetLookAt.z -= (deltaX * sin + deltaY * cos) * panSpeed;
    });

    container.addEventListener('pointerup', (e) => {
        if (!isDragging) return;
        isDragging = false;

        if (!hasMoved && terrainMesh) {
            let rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            
            if (selectionMode === 'single') {
                let intersects = raycaster.intersectObjects(playerTanks.map(t => t.mesh), true);
                if (intersects.length > 0) {
                    let clickedTankGroup = intersects[0].object.parent;
                    selectedTank = playerTanks.find(t => t.mesh === clickedTankGroup || t.mesh.children.includes(intersects[0].object));
                    showFloatingMsg("تم تحديد الدبابة!");
                    return;
                }
            }

            let terrainIntersect = raycaster.intersectObject(terrainMesh);
            if (terrainIntersect.length > 0) {
                playerTargetPos = terrainIntersect[0].point;
                targetMarkerMesh.position.copy(playerTargetPos);
                targetMarkerMesh.position.y = getTerrainHeight(playerTargetPos.x, playerTargetPos.z) + 0.2;
                targetMarkerMesh.visible = true;

                playSound('move', 0.5);
                playerTanks.forEach(tank => {
                    if (!tank.isDestroyed && (selectionMode === 'all' || tank === selectedTank)) {
                        tank.targetPos = playerTargetPos.clone();
                    }
                });
            }
        }
    });
}

function updateCameraPosition() {
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

function drawMinimap() {
    const canvas = document.getElementById('minimap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let scale = canvas.width / 900;
    let centerX = canvas.width / 2;
    let centerZ = canvas.height / 2;

    ctx.fillStyle = '#22c55e';
    playerTanks.forEach(t => {
        if (!t.isDestroyed) {
            let mx = centerX + t.mesh.position.x * scale;
            let mz = centerZ + t.mesh.position.z * scale;
            ctx.beginPath(); ctx.arc(mx, mz, 2.5, 0, Math.PI * 2); ctx.fill();
        }
    });

    ctx.fillStyle = '#ef4444';
    enemyTanks.forEach(t => {
        if (!t.isDestroyed) {
            let mx = centerX + t.mesh.position.x * scale;
            let mz = centerZ + t.mesh.position.z * scale;
            ctx.beginPath(); ctx.arc(mx, mz, 2.5, 0, Math.PI * 2); ctx.fill();
        }
    });
}

function animate() {
    requestAnimationFrame(animate);

    flagWaveTime += 0.05;
    activeFlagMeshes.forEach((flagObj) => {
        const posAttr = flagObj.mesh.geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
            let u = posAttr.getX(i);
            let wave = (u > -4) ? Math.sin(flagWaveTime + u * 0.4) * 0.8 : 0;
            posAttr.setZ(i, wave);
        }
        posAttr.needsUpdate = true;
    });

    [...playerTanks, ...enemyTanks].forEach(tank => {
        if (!tank.isDestroyed && tank.targetPos) {
            let dx = tank.targetPos.x - tank.mesh.position.x;
            let dz = tank.targetPos.z - tank.mesh.position.z;
            let dist = Math.sqrt(dx * dx + dz * dz);
            
            if (dist > 3) {
                let speed = 0.75;
                let nextX = tank.mesh.position.x + (dx / dist) * speed;
                let nextZ = tank.mesh.position.z + (dz / dist) * speed;

                let collision = false;
                obstacles.forEach(obs => {
                    let odx = nextX - obs.x;
                    let odz = nextZ - obs.z;
                    if (Math.sqrt(odx * odx + odz * odz) < obs.radius + 4) {
                        collision = true;
                    }
                });

                if (!collision) {
                    tank.mesh.position.x = nextX;
                    tank.mesh.position.z = nextZ;
                    tank.mesh.position.y = getTerrainHeight(tank.mesh.position.x, tank.mesh.position.z);
                    tank.mesh.rotation.y = Math.atan2(dx, dz);
                    
                    if (Math.random() < 0.04) {
                        playSound('move', 0.2);
                    }
                } else {
                    tank.targetPos.x += (Math.random() - 0.5) * 30;
                    tank.targetPos.z += (Math.random() - 0.5) * 30;
                }
            }
        }
    });

    rotatingRadars.forEach(radar => { radar.rotation.z += 0.02; });

    updateCameraPosition();
    drawMinimap();
    renderer.render(scene, camera);
}

window.onload = init;
