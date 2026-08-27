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

let playerTanks = [], enemyTanks = [], bullets = [], oilRigs = [], flagMeshes = [];
let selectionMode = 'all', selectedTank = null;
let raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();

const CORNER_OFFSET = 380;
let playerMoney = 500;
let clock = new THREE.Clock();

// ==========================================
// 1. رسم الأعلام السورية الأصلية بدقة 2D Canvas
// ==========================================
function drawSyrianFlag(canvas, starsCount) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height, h3 = h / 3;
    ctx.fillStyle = (starsCount === 3) ? '#007A3D' : '#CE1126'; ctx.fillRect(0, 0, w, h3);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, h3, w, h3);
    ctx.fillStyle = '#000000'; ctx.fillRect(0, h3 * 2, w, h3);

    ctx.fillStyle = (starsCount === 3) ? '#CE1126' : '#007A3D';
    const drawStar = (cx, cy, r) => {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            ctx.lineTo(cx + r * Math.cos((18 + i * 72) * Math.PI / 180), cy - r * Math.sin((18 + i * 72) * Math.PI / 180));
            ctx.lineTo(cx + (r / 2) * Math.cos((54 + i * 72) * Math.PI / 180), cy - (r / 2) * Math.sin((54 + i * 72) * Math.PI / 180));
        }
        ctx.closePath(); ctx.fill();
    };
    if (starsCount === 3) {
        drawStar(w * 0.25, h / 2, h3 * 0.35); drawStar(w * 0.5, h / 2, h3 * 0.35); drawStar(w * 0.75, h / 2, h3 * 0.35);
    } else {
        drawStar(w * 0.35, h / 2, h3 * 0.35); drawStar(w * 0.65, h / 2, h3 * 0.35);
    }
}

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
    scene.background = new THREE.Color(0x60a5fa); // سماء واقعية
    scene.fog = new THREE.FogExp2(0x60a5fa, 0.0008);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    setupLighting();
    createTerrain();
    createBase(CORNER_OFFSET, CORNER_OFFSET, 'player');
    createBase(-CORNER_OFFSET, -CORNER_OFFSET, 'enemy');
    
    // إعادة آبار النفط
    createOilRig(0, 0);
    createOilRig(200, -200);
    createOilRig(-200, 200);

    // نشر وحدات البداية
    spawnInitialUnits();
    
    // إعداد الكاميرا فوق المعسكر
    let mySide = (typeof window.mySide !== 'undefined') ? window.mySide : 'player';
    let startPos = (mySide === 'player') ? new THREE.Vector3(CORNER_OFFSET, 0, CORNER_OFFSET) : new THREE.Vector3(-CORNER_OFFSET, 0, -CORNER_OFFSET);
    targetLookAt.copy(startPos);
    updateCamera();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // زيادة النقاط تلقائياً
    setInterval(() => {
        playerMoney += 20;
        let el = document.getElementById('money-display');
        if (el) el.innerText = playerMoney;
    }, 2000);

    animate();
}

function setupLighting() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    dirLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    dirLight.position.set(300, 450, 300);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 1500;
    scene.add(dirLight);
}

// ==========================================
// 2. إعادة تضاريس الأرض الحقيقية
// ==========================================
function createTerrain() {
    const geometry = new THREE.PlaneGeometry(1200, 1200, 64, 64);
    geometry.rotateX(-Math.PI / 2);
    
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        let vx = pos.getX(i), vz = pos.getZ(i);
        pos.setY(i, Math.sin(vx * 0.01) * Math.cos(vz * 0.01) * 3);
    }
    geometry.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.9, metalness: 0.1 });
    const terrain = new THREE.Mesh(geometry, terrainMat);
    terrain.receiveShadow = true;
    scene.add(terrain);
}

// ==========================================
// 3. إعادة مجسم المعسكر وحركة قماش العلم
// ==========================================
function createBase(x, z, side) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const bGeo = new THREE.BoxGeometry(70, 40, 70);
    const bMat = new THREE.MeshStandardMaterial({ color: side === 'player' ? 0x1e3a8a : 0x991b1b, roughness: 0.4 });
    const bMesh = new THREE.Mesh(bGeo, bMat);
    bMesh.position.y = 20; bMesh.castShadow = true; bMesh.receiveShadow = true;
    group.add(bMesh);

    const poleGeo = new THREE.CylinderGeometry(1.5, 1.5, 75);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.8 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(0, 37.5, 0);
    group.add(pole);

    const flagCanvas = document.createElement('canvas');
    flagCanvas.width = 256; flagCanvas.height = 128;
    drawSyrianFlag(flagCanvas, (side === 'player' ? playerFlagType : enemyFlagType) === 'green' ? 3 : 2);
    const flagTexture = new THREE.CanvasTexture(flagCanvas);
    
    const flagGeo = new THREE.PlaneGeometry(36, 20, 16, 8);
    const flagMat = new THREE.MeshStandardMaterial({ map: flagTexture, side: THREE.DoubleSide, roughness: 0.5 });
    const flagMesh = new THREE.Mesh(flagGeo, flagMat);
    flagMesh.position.set(18, 62, 0);
    flagMesh.castShadow = true;
    
    group.add(flagMesh);
    scene.add(group);

    flagMeshes.push(flagMesh);
}

// ==========================================
// 4. إعادة مجسم آبار النفط اللامعة
// ==========================================
function createOilRig(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const baseGeo = new THREE.CylinderGeometry(16, 20, 10, 12);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 5; base.castShadow = true;
    group.add(base);

    const dGeo = new THREE.ConeGeometry(10, 36, 4);
    const dMat = new THREE.MeshStandardMaterial({ color: 0xd97706, wireframe: true });
    const derrick = new THREE.Mesh(dGeo, dMat);
    derrick.position.y = 23;
    group.add(derrick);

    const tankGeo = new THREE.SphereGeometry(6, 16, 16);
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.1, metalness: 0.9 });
    const oilTank = new THREE.Mesh(tankGeo, tankMat);
    oilTank.position.y = 12;
    group.add(oilTank);

    scene.add(group);
    oilRigs.push({ mesh: group, position: new THREE.Vector3(x, 0, z) });
}

// ==========================================
// 5. بناء وتوليد مجسمات الدبابات التفصيلية
// ==========================================
function spawnInitialUnits() {
    for (let i = 0; i < 3; i++) {
        spawnTank('player', 'normal', CORNER_OFFSET + (i - 1) * 30, CORNER_OFFSET - 50);
        spawnTank('enemy', 'normal', -CORNER_OFFSET + (i - 1) * 30, -CORNER_OFFSET + 50);
    }
}

function spawnTank(side, type, x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    let mySide = (typeof window.mySide !== 'undefined') ? window.mySide : 'player';
    const isMyUnit = (mySide === side);
    const primaryColor = isMyUnit ? 0x15803d : 0xb91c1c;

    const bodyGeo = new THREE.BoxGeometry(16, 7, 24);
    const bodyMat = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.6, metalness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 4.5; body.castShadow = true; body.receiveShadow = true;
    group.add(body);

    const trackGeo = new THREE.BoxGeometry(3, 6, 26);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const leftTrack = new THREE.Mesh(trackGeo, trackMat); leftTrack.position.set(-9.5, 3.5, 0);
    const rightTrack = new THREE.Mesh(trackGeo, trackMat); rightTrack.position.set(9.5, 3.5, 0);
    group.add(leftTrack); group.add(rightTrack);

    const turretGeo = new THREE.CylinderGeometry(6, 7, 5, 12);
    const turretMat = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.5 });
    const turret = new THREE.Mesh(turretGeo, turretMat);
    turret.position.y = 9.5; turret.castShadow = true;
    group.add(turret);

    const gunGeo = new THREE.CylinderGeometry(1, 1, type === 'rocket' ? 15 : 12, 10);
    gunGeo.rotateX(Math.PI / 2);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.set(0, 9.5, 8);
    group.add(gun);

    scene.add(group);

    const tankData = {
        mesh: group, side: side, type: type,
        hp: type === 'rocket' ? 160 : 220, maxHp: type === 'rocket' ? 160 : 220,
        speed: type === 'rocket' ? 1.0 : 0.85, range: type === 'rocket' ? 170 : 110,
        damage: type === 'rocket' ? 50 : 28, reloadTime: type === 'rocket' ? 1400 : 900,
        lastShot: 0, targetPos: new THREE.Vector3(x, 0, z)
    };

    if (side === 'player') playerTanks.push(tankData);
    else enemyTanks.push(tankData);
}

// ==========================================
// 6. التحكم والتفاعل والشراء
// ==========================================
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
    const btnAll = document.getElementById('sel-all-btn');
    const btnSingle = document.getElementById('sel-single-btn');
    if (btnAll) btnAll.classList.toggle('active', mode === 'all');
    if (btnSingle) btnSingle.classList.toggle('active', mode === 'single');
}

function buyPlayerTank(type) {
    let cost = type === 'rocket' ? 300 : 150;
    if (playerMoney >= cost) {
        playerMoney -= cost;
        let el = document.getElementById('money-display');
        if (el) el.innerText = playerMoney;

        let mySide = (typeof window.mySide !== 'undefined') ? window.mySide : 'player';
        let basePos = (mySide === 'player') ? new THREE.Vector3(CORNER_OFFSET, 0, CORNER_OFFSET) : new THREE.Vector3(-CORNER_OFFSET, 0, -CORNER_OFFSET);
        spawnTank(mySide, type, basePos.x + (Math.random() - 0.5) * 30, basePos.z + (Math.random() - 0.5) * 30);
        
        if (typeof sendBuyTank === 'function') sendBuyTank(type);
        playSound('buy');
    } else {
        showFloatingMsg('الرصيد غير كافٍ!');
    }
}

function onPointerDown(e) {
    if (e.target.tagName !== 'CANVAS') return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length > 0) {
        let pt = intersects[0].point;
        let mySide = (typeof window.mySide !== 'undefined') ? window.mySide : 'player';
        let myTanks = (mySide === 'player') ? playerTanks : enemyTanks;

        if (selectionMode === 'all') {
            myTanks.forEach((t, idx) => {
                t.targetPos.copy(pt);
                if (typeof sendMoveOrder === 'function') sendMoveOrder(idx, pt);
            });
        } else if (selectedTank) {
            let idx = myTanks.indexOf(selectedTank);
            if (idx !== -1) {
                selectedTank.targetPos.copy(pt);
                if (typeof sendMoveOrder === 'function') sendMoveOrder(idx, pt);
            }
        }
    }
}

function onEnemyMoveReceived(data) {
    let mySide = (typeof window.mySide !== 'undefined') ? window.mySide : 'player';
    let oppTanks = (mySide === 'player') ? enemyTanks : playerTanks;
    if (oppTanks[data.tankIndex]) {
        oppTanks[data.tankIndex].targetPos.set(data.target.x, 0, data.target.z);
    }
}

function onEnemyBuyReceived(data) {
    let mySide = (typeof window.mySide !== 'undefined') ? window.mySide : 'player';
    let oppSide = (mySide === 'player') ? 'enemy' : 'player';
    let basePos = (oppSide === 'player') ? new THREE.Vector3(CORNER_OFFSET, 0, CORNER_OFFSET) : new THREE.Vector3(-CORNER_OFFSET, 0, -CORNER_OFFSET);
    spawnTank(oppSide, data.type, basePos.x + (Math.random() - 0.5) * 30, basePos.z + (Math.random() - 0.5) * 30);
}

// ==========================================
// 7. حلقة التحديث والمؤثرات القتالية
// ==========================================
function animate() {
    requestAnimationFrame(animate);

    let elapsedTime = clock.getElapsedTime();

    // 1. تحريك رفرفة الأعلام
    flagMeshes.forEach(flagMesh => {
        const pos = flagMesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            let u = pos.getX(i);
            let wave = Math.sin(elapsedTime * 5 + u * 0.2) * 1.8;
            pos.setZ(i, wave);
        }
        flagMesh.geometry.attributes.position.needsUpdate = true;
    });

    // 2. تحديث حركة الكاميرا
    if (camInputs.up) targetLookAt.z -= 3;
    if (camInputs.down) targetLookAt.z += 3;
    if (camInputs.left) targetLookAt.x -= 3;
    if (camInputs.right) targetLookAt.x += 3;
    if (camInputs.zi) cameraRadius = Math.max(60, cameraRadius - 4);
    if (camInputs.zo) cameraRadius = Math.min(550, cameraRadius + 4);
    updateCamera();

    // 3. تحديث تحركات الدبابات والقصف
    const allTanks = [...playerTanks, ...enemyTanks];
    allTanks.forEach(tank => {
        if (tank.mesh.position.distanceTo(tank.targetPos) > 4) {
            let dir = new THREE.Vector3().subVectors(tank.targetPos, tank.mesh.position).normalize();
            tank.mesh.position.addScaledVector(dir, tank.speed);
            tank.mesh.lookAt(tank.targetPos.x, tank.mesh.position.y, tank.targetPos.z);
        }

        let targets = (tank.side === 'player') ? enemyTanks : playerTanks;
        let now = Date.now();

        if (now - tank.lastShot > tank.reloadTime) {
            let closest = null, minD = tank.range;
            targets.forEach(tar => {
                let d = tank.mesh.position.distanceTo(tar.mesh.position);
                if (d < minD) { minD = d; closest = tar; }
            });

            if (closest) {
                tank.lastShot = now;
                shootBullet(tank, closest.mesh.position);
                closest.hp -= tank.damage;
                playSound(tank.type === 'rocket' ? 'rocket' : 'shoot', 0.4);

                if (closest.hp <= 0) {
                    createExplosionEffect(closest.mesh.position);
                    scene.remove(closest.mesh);
                    if (tank.side === 'player') enemyTanks = enemyTanks.filter(t => t !== closest);
                    else playerTanks = playerTanks.filter(t => t !== closest);
                    playSound('explosion', 0.6);
                }
            }
        }
    });

    renderer.render(scene, camera);
}

function shootBullet(shooter, targetVector) {
    const geo = new THREE.SphereGeometry(1.5, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const b = new THREE.Mesh(geo, mat);
    b.position.copy(shooter.mesh.position);
    b.position.y += 9;
    scene.add(b);

    let t = 0;
    let interval = setInterval(() => {
        t += 0.12;
        b.position.lerp(targetVector, t);
        if (t >= 1) {
            scene.remove(b);
            clearInterval(interval);
        }
    }, 20);
}

function createExplosionEffect(pos) {
    const pGeo = new THREE.SphereGeometry(2, 8, 8);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const p = new THREE.Mesh(pos);
    p.position.copy(pos);
    scene.add(p);

    let scale = 1;
    let timer = setInterval(() => {
        scale += 0.4;
        p.scale.set(scale, scale, scale);
        pMat.opacity -= 0.1;
        if (scale >= 5) {
            scene.remove(p);
            clearInterval(timer);
        }
    }, 30);
}
