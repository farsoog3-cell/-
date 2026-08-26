let scene, camera, renderer, dirLight;
let cameraRadius = 280, targetCameraRadius = 280;
let cameraTheta = Math.PI / 4;
let cameraPhi = Math.PI / 3.5;
let targetLookAt = new THREE.Vector3(0, 0, 0);

let shakeTimer = 0, shakeIntensity = 0;
let camInputs = { up: false, down: false, left: false, right: false, zi: false, zo: false };

let isDragging = false, previousTouchX = 0, previousTouchY = 0, touchStartX = 0, touchStartY = 0, hasMoved = false;
let selectionMode = 'all';
let selectedTank = null;
let playerTargetPos = null;
let targetMarkerMesh;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

let playerBuildCooldown = 0;
let enemyBuildCooldown = 0;
let gameTick = 0;
let flagWaveTime = 0;
let isCinematicEnding = false;
let cinematicTargetLook = null;

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
        if (color === enemyFlagType) enemyFlagType = color === 'green' ? 'red' : 'green';
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
    document.querySelectorAll('#enemy-flags .flag-btn').forEach(btn => {
        btn.classList.toggle('active-enemy', btn.innerText.includes(enemyFlagType === 'green' ? 'الأخضر' : 'الأحمر'));
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

    let playerCampX = CORNER_OFFSET, playerCampZ = CORNER_OFFSET;
    targetLookAt.set(playerCampX, getTerrainHeight(playerCampX, playerCampZ), playerCampZ);
    targetCameraRadius = 110; cameraPhi = Math.PI / 3.8; cameraRadius = targetCameraRadius;
    updateCameraPosition();
    showFloatingMsg('بدأت المعركة! الكاميرا الآن فوق معسكرك.');
}

function setupLighting() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    dirLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
    dirLight.position.set(300, 450, 300);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);
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

    scene.add(playerBaseGroup); scene.add(enemyBaseGroup);
    obstacles.push({ x: CORNER_OFFSET, z: CORNER_OFFSET, radius: 22 });
    obstacles.push({ x: -CORNER_OFFSET, z: -CORNER_OFFSET, radius: 22 });

    let pColor = playerFlagType === 'green' ? 0x2e3b23 : 0x6b3a2a;
    let eColor = playerFlagType === 'green' ? 0x6b3a2a : 0x2e3b23;
    
    let playerTank = createTank(CORNER_OFFSET - 45, CORNER_OFFSET - 45, pColor, 'player', 'normal');
    let enemyTank = createTank(-CORNER_OFFSET + 45, -CORNER_OFFSET + 45, eColor, 'enemy', 'normal');
    playerTank.mesh.rotation.y = -Math.PI / 4;
    enemyTank.mesh.rotation.y = -Math.PI / 4;

    playerTanks.push(playerTank);
    enemyTanks.push(enemyTank);
        
    enemyPoleFlagMesh = createFlagPole(new THREE.Group(), -CORNER_OFFSET, -CORNER_OFFSET, enemyFlagType, 'enemy');
    playerPoleFlagMesh = createFlagPole(new THREE.Group(), CORNER_OFFSET, CORNER_OFFSET, playerFlagType, 'player');
}

function createTargetMarker() {
    const geo = new THREE.RingGeometry(1, 2, 16); geo.rotateX(-Math.PI / 2);
    targetMarkerMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }));
    targetMarkerMesh.visible = false;
    scene.add(targetMarkerMesh);
}

function updateCameraPosition() {
    cameraRadius = THREE.MathUtils.lerp(cameraRadius, targetCameraRadius, 0.15);
    let shakeX = 0, shakeY = 0;
    if (shakeTimer > 0) {
        shakeTimer--;
        shakeX = (Math.random() - 0.5) * shakeIntensity;
        shakeY = (Math.random() - 0.5) * shakeIntensity;
    }
    if (isCinematicEnding && cinematicTargetLook) {
        targetLookAt.lerp(cinematicTargetLook, 0.05);
        cameraRadius = THREE.MathUtils.lerp(cameraRadius, 70, 0.05);
        cameraTheta += 0.01;
    }
    camera.position.x = targetLookAt.x + cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta) + shakeX;
    camera.position.y = targetLookAt.y + cameraRadius * Math.cos(cameraPhi) + shakeY;
    camera.position.z = targetLookAt.z + cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
    camera.lookAt(targetLookAt);
}

function showFloatingMsg(text) {
    const msg = document.getElementById('floating-msg');
    msg.innerText = text;
    msg.style.opacity = '1';
    setTimeout(() => { msg.style.opacity = '0'; }, 2000);
}

function setupInteraction() {
    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', (e) => {
        if (gameOver || isCinematicEnding) return;
        isDragging = true; hasMoved = false;
        previousTouchX = e.clientX; previousTouchY = e.clientY;
        touchStartX = e.clientX; touchStartY = e.clientY;
    });

    dom.addEventListener('pointermove', (e) => {
        if (!isDragging || gameOver || isCinematicEnding) return;
        const deltaX = e.clientX - previousTouchX;
        const deltaY = e.clientY - previousTouchY;
        if (Math.abs(e.clientX - touchStartX) > 5 || Math.abs(e.clientY - touchStartY) > 5) hasMoved = true;
        if (hasMoved) {
            cameraTheta -= deltaX * 0.008;
            cameraPhi = Math.max(0.2, Math.min(Math.PI / 2 - 0.05, cameraPhi - deltaY * 0.008));
        }
        previousTouchX = e.clientX; previousTouchY = e.clientY;
    });

    dom.addEventListener('pointerup', (e) => {
        if (gameOver || isCinematicEnding) return;
        isDragging = false;
        if (!hasMoved) {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            if (selectionMode === 'single') {
                let intersects = raycaster.intersectObjects(playerTanks.map(t => t.mesh), true);
                if (intersects.length > 0) {
                    let found = playerTanks.find(t => t.mesh === intersects[0].object || t.mesh.children.includes(intersects[0].object));
                    if (found && !found.isDestroyed) { selectedTank = found; showFloatingMsg('تم تحديد الدبابة'); return; }
                }
            }

            const intersects = raycaster.intersectObject(terrainMesh);
            if (intersects.length > 0) {
                playerTargetPos = intersects[0].point;
                targetMarkerMesh.position.copy(playerTargetPos);
                targetMarkerMesh.position.y = getTerrainHeight(playerTargetPos.x, playerTargetPos.z) + 0.1;
                targetMarkerMesh.visible = true;

                if (selectionMode === 'all') {
                    playerTanks.forEach((t, index) => {
                        if (!t.isDestroyed) t.target = playerTargetPos.clone().add(new THREE.Vector3((index%3)*8 - 8, 0, Math.floor(index/3)*8));
                    });
                } else if (selectedTank && !selectedTank.isDestroyed) {
                    selectedTank.target = playerTargetPos.clone();
                }
            }
        }
    });
}

function setupMinimapInteraction() {
    const minimap = document.getElementById('minimap-container');
    minimap.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const rect = minimap.getBoundingClientRect();
        targetLookAt.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2 * MAP_LIMIT;
        targetLookAt.z = ((e.clientY - rect.top) / rect.height - 0.5) * 2 * MAP_LIMIT;
        showFloatingMsg('تم نقل الكاميرا عبر الخريطة المصغرة');
    });
}

function renderMinimap() {
    const canvas = document.getElementById('minimap-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.arc(55, 55, 55, 0, Math.PI * 2); ctx.fill();
    
    const scale = 55 / MAP_LIMIT;
    ctx.fillStyle = '#22c55e'; ctx.fillRect(55 + CORNER_OFFSET * scale - 3, 55 + CORNER_OFFSET * scale - 3, 6, 6);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(55 + (-CORNER_OFFSET) * scale - 3, 55 + (-CORNER_OFFSET) * scale - 3, 6, 6);

    playerTanks.forEach(t => {
        if (!t.isDestroyed) {
            ctx.fillStyle = '#22c55e';
            ctx.beginPath(); ctx.arc(55 + t.mesh.position.x * scale, 55 + t.mesh.position.z * scale, 2.5, 0, Math.PI*2); ctx.fill();
        }
    });
    enemyTanks.forEach(t => {
        if (!t.isDestroyed) {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath(); ctx.arc(55 + t.mesh.position.x * scale, 55 + t.mesh.position.z * scale, 2.5, 0, Math.PI*2); ctx.fill();
        }
    });
}

function buyPlayerTank(type) {
    if (playerBuildCooldown > 0) return;
    let cost = (type === 'rocket') ? 300 : 150;
    if (playerMoney >= cost) {
        playerMoney -= cost; totalMoneySpent += cost; playerBuildCooldown = 1200;
        updateEconomyUI(); playSound('buy');
        let newTank = createTank(CORNER_OFFSET - 50, CORNER_OFFSET - 50, playerFlagType === 'green' ? 0x2e3b23 : 0x6b3a2a, 'player', type);
        if (playerTargetPos) newTank.target = playerTargetPos.clone();
        playerTanks.push(newTank);
        showFloatingMsg(type === 'rocket' ? 'تم طلب دبابة صواريخ' : 'تم طلب دبابة عادية');
    }
}

function updateEconomyUI() {
    document.getElementById('money-display').innerText = playerMoney;
    let buyBtn = document.getElementById('buy-tank-btn');
    let rocketBtn = document.getElementById('buy-rocket-tank-btn');
    if (playerBuildCooldown > 0) {
        let secs = Math.ceil(playerBuildCooldown / 60);
        buyBtn.innerText = `انتظار (${secs}ث)`; rocketBtn.innerText = `انتظار (${secs}ث)`;
        buyBtn.disabled = true; rocketBtn.disabled = true;
    } else {
        buyBtn.innerText = `عادية (150$)`; rocketBtn.innerText = `صاروخية (300$)`;
        buyBtn.disabled = (playerMoney < 150); rocketBtn.disabled = (playerMoney < 300);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    processCameraInputs();
    updateCameraPosition();
    renderMinimap();

    if (!gameOver) {
        gameTick++;
        if (playerBuildCooldown > 0) { playerBuildCooldown--; if (playerBuildCooldown % 60 === 0) updateEconomyUI(); }
        if (enemyBuildCooldown > 0) enemyBuildCooldown--;
        else if (enemyTanks.filter(t=>!t.isDestroyed).length < 6) {
            enemyBuildCooldown = 1400;
            let eColor = playerFlagType === 'green' ? 0x6b3a2a : 0x2e3b23;
            let eTank = createTank(-CORNER_OFFSET + 50, -CORNER_OFFSET + 50, eColor, 'enemy', Math.random()>0.5?'rocket':'normal');
            enemyTanks.push(eTank);
        }

        // تحديث حالة دبابات اللاعب والعدو
        [...playerTanks, ...enemyTanks].forEach(tank => {
            if (tank.isDestroyed) return;
            let isMoving = false;
            if (tank.target) {
                let dir = new THREE.Vector3().subVectors(tank.target, tank.mesh.position);
                let dist = dir.length();
                if (dist > 3) {
                    dir.normalize();
                    tank.mesh.position.addScaledVector(dir, 0.9);
                    tank.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                    isMoving = true;
                } else {
                    tank.target = null;
                }
            }
            tank.mesh.position.y = getTerrainHeight(tank.mesh.position.x, tank.mesh.position.z);
            updateTankAudio(tank, isMoving);

            // تحديث مكان ملصق الصحة فوق الدبابة
            let vector = tank.mesh.position.clone();
            vector.y += 4;
            vector.project(camera);
            let x = (vector.x * .5 + .5) * window.innerWidth;
            let y = (-(vector.y * .5) + .5) * window.innerHeight;
            tank.hpLabel.style.transform = `translate(-50%, -100%) translate(${x}px,${y}px)`;
            tank.hpLabel.style.display = (vector.z < 1) ? 'block' : 'none';
        });

        // التقاط معسكر العدو لإنهاء اللعبة
        let activePlayerTanks = playerTanks.filter(t => !t.isDestroyed);
        let distToEnemyBase = activePlayerTanks.some(t => t.mesh.position.distanceTo(new THREE.Vector3(-CORNER_OFFSET, getTerrainHeight(-CORNER_OFFSET,-CORNER_OFFSET), -CORNER_OFFSET)) < CAPTURE_RADIUS);
        let barFill = document.getElementById('capture-bar-fill');
        let currentWidth = parseFloat(barFill.style.width) || 0;
        if (distToEnemyBase) {
            currentWidth = Math.min(100, currentWidth + 0.35);
            barFill.style.width = currentWidth + '%';
            if (currentWidth >= 100 && !gameOver) {
                gameOver = true;
                battleBgmAudio.pause(); playSound('victory');
                document.getElementById('victory-title').innerText = 'لقد انتصرت وسيطرت على المعسكر! 🏆';
                document.getElementById('victory-screen').style.display = 'flex';
            }
        }
    }
    
    let time = Date.now() * 0.003;
    animatedRigs.forEach((beam, index) => { beam.rotation.x = Math.sin(time + index) * 0.35; });

    renderer.render(scene, camera);
}

window.onload = init;
