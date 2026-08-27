const soundFiles = {
    menuBgm: 'sounds/menu_bgm.mp3', battleBgm: 'sounds/battle_bgm.mp3', click: 'sounds/click.mp3',
    attack: 'sounds/attack.mp3', danger: 'sounds/danger.mp3', victory: 'sounds/victory_sound.mp3',
    defeat: 'sounds/defeat_sound.mp3', shoot: 'sounds/shoot.mp3', rocket: 'sounds/rocket.mp3',
    explosion: 'sounds/explosion.mp3', buy: 'sounds/buy.mp3', idle: 'sounds/tank_idle.mp3', move: 'sounds/tank_move.mp3'
};

let menuBgmAudio = new Audio(soundFiles.menuBgm); menuBgmAudio.loop = true; menuBgmAudio.volume = 0.4;
let battleBgmAudio = new Audio(soundFiles.battleBgm); battleBgmAudio.loop = true; battleBgmAudio.volume = 0.5;

function playClickSound() { new Audio(soundFiles.click).play().catch(() => {}); }
function playSound(type, vol = 1.0) {
    if (soundFiles[type]) {
        let a = new Audio(soundFiles[type]); a.volume = vol; a.play().catch(() => {});
    }
}

let scene, camera, renderer, dirLight;
let playerFlagType = 'green', enemyFlagType = 'red';
let cameraRadius = 280, targetCameraRadius = 280;
let cameraTheta = Math.PI / 4, cameraPhi = Math.PI / 3.5;
let targetLookAt = new THREE.Vector3(0, 0, 0);
let camInputs = { up: false, down: false, left: false, right: false, zi: false, zo: false };

let playerTanks = [], enemyTanks = [], bullets = [], oilRigs = [], obstacles = [];
let selectionMode = 'all', selectedTank = null;
let raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();

const CORNER_OFFSET = 380;
let playerMoney = 500, enemyMoney = 500;
let basePlayerHP = 1000, baseEnemyHP = 1000;
let gameOver = false;

// رسومات الأعلام Canvas
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
    playerFlagType = color; enemyFlagType = color === 'green' ? 'red' : 'green';
    document.querySelectorAll('#player-flags .flag-btn').forEach(btn => {
        btn.classList.toggle('active-player', btn.innerText.includes(color === 'green' ? 'الأخضر' : 'الأحمر'));
    });
}

function showFloatingMsg(text) {
    const msg = document.getElementById('floating-msg');
    msg.innerText = text; msg.style.opacity = '1';
    setTimeout(() => { msg.style.opacity = '0'; }, 2500);
}

function startGameOnline() {
    menuBgmAudio.pause(); battleBgmAudio.play().catch(() => {});
    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('ui-overlay').style.display = 'block';

    initEngine();
}

function initEngine() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7dd3fc);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    setupLighting();
    buildWorld();

    // ضبط الكاميرا حسب معسكر اللاعب
    let startPos = (mySide === 'player') ? new THREE.Vector3(CORNER_OFFSET, 0, CORNER_OFFSET) : new THREE.Vector3(-CORNER_OFFSET, 0, -CORNER_OFFSET);
    targetLookAt.copy(startPos);
    updateCamera();

    // تجهيز الوحدات الأولى
    spawnInitialUnits();

    // أحداث النقر بالماوس واللمس
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    document.getElementById('minimap-container').addEventListener('click', onMinimapClick);

    // حلقة تجميع الأموال من آبار النفط
    setInterval(() => {
        if (!gameOver) {
            playerMoney += 15;
            document.getElementById('money-display').innerText = playerMoney;
        }
    }, 2000);

    animate();
}

function setupLighting() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    dirLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
    dirLight.position.set(300, 450, 300);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);
}

function buildWorld() {
    // 1. الأرضية
    const terrainGeo = new THREE.PlaneGeometry(1100, 1100);
    terrainGeo.rotateX(-Math.PI / 2);
    const terrainMat = new THREE.MeshStandardMaterial({ color: 0x4b6043, roughness: 0.8 });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    scene.add(terrain);

    // 2. المعسكرات (المباني)
    createBase(CORNER_OFFSET, CORNER_OFFSET, 'player');
    createBase(-CORNER_OFFSET, -CORNER_OFFSET, 'enemy');

    // 3. آبار النفط والصخور
    createOilRig(0, 0);
    createOilRig(180, -180);
    createOilRig(-180, 180);

    for (let i = 0; i < 20; i++) {
        let rx = (Math.random() - 0.5) * 800;
        let rz = (Math.random() - 0.5) * 800;
        if (Math.abs(rx) > 100 || Math.abs(rz) > 100) createRock(rx, rz);
    }
}

function createBase(x, z, side) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // المبنى الرئيسي
    const bGeo = new THREE.BoxGeometry(60, 35, 60);
    const bMat = new THREE.MeshStandardMaterial({ color: side === 'player' ? 0x1e3a8a : 0x881337 });
    const bMesh = new THREE.Mesh(bGeo, bMat);
    bMesh.position.y = 17.5; bMesh.castShadow = true; bMesh.receiveShadow = true;
    group.add(bMesh);

    // سارية العلم
    const poleGeo = new THREE.CylinderGeometry(1, 1, 50);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(0, 45, 0);
    group.add(pole);

    // قماش العلم
    const flagCanvas = document.createElement('canvas');
    flagCanvas.width = 128; flagCanvas.height = 64;
    drawSyrianFlag(flagCanvas, (side === 'player' ? playerFlagType : enemyFlagType) === 'green' ? 3 : 2);
    const flagTexture = new THREE.CanvasTexture(flagCanvas);
    const flagGeo = new THREE.PlaneGeometry(24, 14);
    const flagMat = new THREE.MeshBasicMaterial({ map: flagTexture, side: THREE.DoubleSide });
    const flagMesh = new THREE.Mesh(flagGeo, flagMat);
    flagMesh.position.set(12, 60, 0);
    group.add(flagMesh);

    scene.add(group);
}

function createOilRig(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const baseGeo = new THREE.CylinderGeometry(14, 16, 8, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 4;
    group.add(base);

    const dGeo = new THREE.ConeGeometry(8, 28, 4);
    const dMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, wireframe: true });
    const derrick = new THREE.Mesh(dGeo, dMat);
    derrick.position.y = 20;
    group.add(derrick);

    scene.add(group);
    oilRigs.push({ position: new THREE.Vector3(x, 0, z), mesh: group });
}

function createRock(x, z) {
    const geo = new THREE.DodecahedronGeometry(Math.random() * 8 + 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
    const rock = new THREE.Mesh(geo, mat);
    rock.position.set(x, 6, z);
    rock.castShadow = true;
    scene.add(rock);
    obstacles.push(rock);
}

function spawnInitialUnits() {
    // 3 دبابات لكل فريق
    for (let i = 0; i < 3; i++) {
        spawnTank('player', 'normal', CORNER_OFFSET + (i - 1) * 25, CORNER_OFFSET - 40);
        spawnTank('enemy', 'normal', -CORNER_OFFSET + (i - 1) * 25, -CORNER_OFFSET + 40);
    }
}

function spawnTank(side, type, x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // جسم الدبابة
    const bodyGeo = new THREE.BoxGeometry(14, 6, 20);
    const isMyUnit = (mySide === side);
    const bodyMat = new THREE.MeshStandardMaterial({ color: isMyUnit ? 0x15803d : 0xb91c1c });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 4; body.castShadow = true;
    group.add(body);

    // البرج والمدفع
    const turretGeo = new THREE.SphereGeometry(4.5, 8, 8);
    const turret = new THREE.Mesh(turretGeo, bodyMat);
    turret.position.y = 8;
    group.add(turret);

    const gunGeo = new THREE.CylinderGeometry(0.8, 0.8, type === 'rocket' ? 12 : 10);
    gunGeo.rotateX(Math.PI / 2);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const gun = new THREE.Mesh(gunGeo, gunMat);
    gun.position.set(0, 8, 6);
    group.add(gun);

    scene.add(group);

    const tankData = {
        mesh: group,
        side: side,
        type: type,
        hp: type === 'rocket' ? 140 : 200,
        maxHp: type === 'rocket' ? 140 : 200,
        speed: type === 'rocket' ? 0.9 : 0.7,
        range: type === 'rocket' ? 160 : 100,
        damage: type === 'rocket' ? 45 : 25,
        reloadTime: type === 'rocket' ? 1400 : 900,
        lastShot: 0,
        targetPos: new THREE.Vector3(x, 0, z),
        id: Math.random().toString(36).substring(2, 9)
    };

    if (side === 'player') playerTanks.push(tankData);
    else enemyTanks.push(tankData);
}

// التحكم بالكاميرا
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

// التعامل مع النقر بالماوس على الأرض لتوجيه الدبابات
function onPointerDown(e) {
    if (e.target.tagName !== 'CANVAS') return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length > 0) {
        let pt = intersects[0].point;
        let myTanks = (mySide === 'player') ? playerTanks : enemyTanks;

        if (selectionMode === 'all') {
            myTanks.forEach((t, idx) => {
                t.targetPos.copy(pt);
                sendMoveOrder(idx, pt);
            });
        } else if (selectedTank) {
            let idx = myTanks.indexOf(selectedTank);
            if (idx !== -1) {
                selectedTank.targetPos.copy(pt);
                sendMoveOrder(idx, pt);
            }
        }
    }
}

// استقبال حركة الخصم من الشبكة
function handleEnemyMove(data) {
    let oppTanks = (mySide === 'player') ? enemyTanks : playerTanks;
    if (oppTanks[data.tankIndex]) {
        oppTanks[data.tankIndex].targetPos.set(data.target.x, 0, data.target.z);
    }
}

// شراء الدبابات
function buyPlayerTank(type) {
    let cost = type === 'rocket' ? 300 : 150;
    if (playerMoney >= cost) {
        playerMoney -= cost;
        document.getElementById('money-display').innerText = playerMoney;
        let basePos = (mySide === 'player') ? new THREE.Vector3(CORNER_OFFSET, 0, CORNER_OFFSET) : new THREE.Vector3(-CORNER_OFFSET, 0, -CORNER_OFFSET);
        spawnTank(mySide, type, basePos.x + (Math.random() - 0.5) * 30, basePos.z + (Math.random() - 0.5) * 30);
        sendBuyOrder(type);
        playSound('buy');
    } else {
        showFloatingMsg('الرصيد غير كافٍ!');
    }
}

function handleEnemyBuy(data) {
    let oppSide = (mySide === 'player') ? 'enemy' : 'player';
    let basePos = (oppSide === 'player') ? new THREE.Vector3(CORNER_OFFSET, 0, CORNER_OFFSET) : new THREE.Vector3(-CORNER_OFFSET, 0, -CORNER_OFFSET);
    spawnTank(oppSide, data.type, basePos.x + (Math.random() - 0.5) * 30, basePos.z + (Math.random() - 0.5) * 30);
}

// الخريطة المصغرة
function onMinimapClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    targetLookAt.set(nx * 1000, 0, ny * 1000);
}

function updateMinimap() {
    const cvs = document.getElementById('minimap-canvas');
    const ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    const mapX = (x) => (x / 1000 + 0.5) * cvs.width;
    const mapY = (z) => (z / 1000 + 0.5) * cvs.height;

    // رسم الدبابات
    playerTanks.forEach(t => {
        ctx.fillStyle = '#22c55e'; ctx.beginPath();
        ctx.arc(mapX(t.mesh.position.x), mapY(t.mesh.position.z), 3, 0, Math.PI * 2); ctx.fill();
    });
    enemyTanks.forEach(t => {
        ctx.fillStyle = '#ef4444'; ctx.beginPath();
        ctx.arc(mapX(t.mesh.position.x), mapY(t.mesh.position.z), 3, 0, Math.PI * 2); ctx.fill();
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// الحلقة الرئيسية للتحديث والرسومات
function animate() {
    if (gameOver) return;
    requestAnimationFrame(animate);

    // حركة الكاميرا من الأزرار
    if (camInputs.up) targetLookAt.z -= 4;
    if (camInputs.down) targetLookAt.z += 4;
    if (camInputs.left) targetLookAt.x -= 4;
    if (camInputs.right) targetLookAt.x += 4;
    if (camInputs.zi) cameraRadius = Math.max(80, cameraRadius - 5);
    if (camInputs.zo) cameraRadius = Math.min(600, cameraRadius + 5);
    updateCamera();

    // تحديث دبابات الفريقتين (حرّك واضرب)
    const allTanks = [...playerTanks, ...enemyTanks];
    allTanks.forEach(tank => {
        // 1. الحركة
        if (tank.mesh.position.distanceTo(tank.targetPos) > 5) {
            let dir = new THREE.Vector3().subVectors(tank.targetPos, tank.mesh.position).normalize();
            tank.mesh.position.addScaledVector(dir, tank.speed);
            tank.mesh.lookAt(tank.targetPos.x, tank.mesh.position.y, tank.targetPos.z);
        }

        // 2. القتال والبحث عن الأهداف
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
                    scene.remove(closest.mesh);
                    if (tank.side === 'player') enemyTanks = enemyTanks.filter(t => t !== closest);
                    else playerTanks = playerTanks.filter(t => t !== closest);
                    playSound('explosion', 0.6);
                }
            }
        }
    });

    updateMinimap();
    renderer.render(scene, camera);
}

function shootBullet(shooter, targetVector) {
    const geo = new THREE.SphereGeometry(1.2, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const b = new THREE.Mesh(geo, mat);
    b.position.copy(shooter.mesh.position);
    b.position.y += 8;
    scene.add(b);

    let t = 0;
    let interval = setInterval(() => {
        t += 0.1;
        b.position.lerp(targetVector, t);
        if (t >= 1) {
            scene.remove(b);
            clearInterval(interval);
        }
    }, 20);
}