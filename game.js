// ==========================================
// 1. الأصوات والإعدادات العامة
// ==========================================
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

// ==========================================
// 2. المحرك والرسوميات 3D
// ==========================================
let scene, camera, renderer, dirLight;
let playerFlagType = 'green', enemyFlagType = 'red';
let cameraRadius = 280;
let cameraTheta = Math.PI / 4, cameraPhi = Math.PI / 3.5;
let targetLookAt = new THREE.Vector3(0, 0, 0);
let camInputs = { up: false, down: false, left: false, right: false, zi: false, zo: false };

let playerTanks = [], enemyTanks = [], bullets = [], oilRigs = [], flagMeshes = [];
let selectionMode = 'all', selectedTank = null;
let raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();

const CORNER_OFFSET = 380;
let playerMoney = 500, enemyMoney = 500;
let gameOver = false;
let clock = new THREE.Clock();

// رسم الأعلام بدقة على الـ Canvas
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
    scene.background = new THREE.Color(0x60a5fa); // سماء واقعية
    scene.fog = new THREE.FogExp2(0x60a5fa, 0.0008);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    setupLighting();
    buildWorld();

    let startPos = (mySide === 'player') ? new THREE.Vector3(CORNER_OFFSET, 0, CORNER_OFFSET) : new THREE.Vector3(-CORNER_OFFSET, 0, -CORNER_OFFSET);
    targetLookAt.copy(startPos);
    updateCamera();

    spawnInitialUnits();

    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    document.getElementById('minimap-container').addEventListener('click', onMinimapClick);

    setInterval(() => {
        if (!gameOver) {
            playerMoney += 20;
            document.getElementById('money-display').innerText = playerMoney;
        }
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
// 3. بناء العالم، الأرضية والأعلام اللامعة
// ==========================================
function buildWorld() {
    // أرضية عالية التفاصيل
    const terrainGeo = new THREE.PlaneGeometry(1200, 1200, 64, 64);
    terrainGeo.rotateX(-Math.PI / 2);
    
    // إضافة تضاريس خفيفة للأرضية
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        let vx = pos.getX(i), vz = pos.getZ(i);
        pos.setY(i, Math.sin(vx * 0.01) * Math.cos(vz * 0.01) * 3);
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.9, metalness: 0.1 });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    scene.add(terrain);

    // المباني والأعلام
    createBase(CORNER_OFFSET, CORNER_OFFSET, 'player');
    createBase(-CORNER_OFFSET, -CORNER_OFFSET, 'enemy');

    // آبار النفط الميكانيكية
    createOilRig(0, 0);
    createOilRig(200, -200);
    createOilRig(-200, 200);
}

function createBase(x, z, side) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // حصن القاعدة
    const bGeo = new THREE.BoxGeometry(70, 40, 70);
    const bMat = new THREE.MeshStandardMaterial({ color: side === 'player' ? 0x1e3a8a : 0x991b1b, roughness: 0.4 });
    const bMesh = new THREE.Mesh(bGeo, bMat);
    bMesh.position.y = 20; bMesh.castShadow = true; bMesh.receiveShadow = true;
    group.add(bMesh);

    // سارية العلم
    const poleGeo = new THREE.CylinderGeometry(1.5, 1.5, 75);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.8 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(0, 37.5, 0);
    group.add(pole);

    // قماش العلم الديناميكي (رفرفة قماشية)
    const flagCanvas = document.createElement('canvas');
    flagCanvas.width = 256; flagCanvas.height = 128;
    drawSyrianFlag(flagCanvas, (side === 'player' ? playerFlagType : enemyFlagType) === 'green' ? 3 : 2);
    const flagTexture = new THREE.CanvasTexture(flagCanvas);
    
    // شبكة علم بمرونة أعلى للرفرفة
    const flagGeo = new THREE.PlaneGeometry(36, 20, 16, 8);
    const flagMat = new THREE.MeshStandardMaterial({ map: flagTexture, side: THREE.DoubleSide, roughness: 0.5 });
    const flagMesh = new THREE.Mesh(flagGeo, flagMat);
    flagMesh.position.set(18, 62, 0);
    flagMesh.castShadow = true;
    
    group.add(flagMesh);
    scene.add(group);

    // تخزين شبكة العلم لتحريكها لاحقاً
    flagMeshes.push(flagMesh);
}

function createOilRig(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // قاعدة البئر
    const baseGeo = new THREE.CylinderGeometry(16, 20, 10, 12);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 5; base.castShadow = true;
    group.add(base);

    // البرج الهيكلي
    const dGeo = new THREE.ConeGeometry(10, 36, 4);
    const dMat = new THREE.MeshStandardMaterial({ color: 0xd97706, wireframe: true });
    const derrick = new THREE.Mesh(dGeo, dMat);
    derrick.position.y = 23;
    group.add(derrick);

    // خزان النفط الأسود اللامع
    const tankGeo = new THREE.SphereGeometry(6, 16, 16);
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.1, metalness: 0.9 });
    const oilTank = new THREE.Mesh(tankGeo, tankMat);
    oilTank.position.y = 12;
    group.add(oilTank);

    scene.add(group);
    oilRigs.push({ mesh: group, position: new THREE.Vector3(x, 0, z) });
}

// ==========================================
// 4. الدبابات والوحدات القتالية
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

    const isMyUnit = (mySide === side);
    const primaryColor = isMyUnit ? 0x15803d : 0xb91c1c;

    // هيكل الدبابة الرئيسي
    const bodyGeo = new THREE.BoxGeometry(16, 7, 24);
    const bodyMat = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.6, metalness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 4.5; body.castShadow = true; body.receiveShadow = true;
    group.add(body);

    // الجنزير الجانبي
    const trackGeo = new THREE.BoxGeometry(3, 6, 26);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const leftTrack = new THREE.Mesh(trackGeo, trackMat); leftTrack.position.set(-9.5, 3.5, 0);
    const rightTrack = new THREE.Mesh(trackGeo, trackMat); rightTrack.position.set(9.5, 3.5, 0);
    group.add(leftTrack); group.add(rightTrack);

    // البرج الرئيسي
    const turretGeo = new THREE.CylinderGeometry(6, 7, 5, 12);
    const turretMat = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.5 });
    const turret = new THREE.Mesh(turretGeo, turretMat);
    turret.position.y = 9.5; turret.castShadow = true;
    group.add(turret);

    // سبطانة المدفع / الصواريخ
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
// 5. حلقة التحديث والمتحركات (Animation Loop)
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
    document.getElementById('sel-all-btn').classList.toggle('active', mode === 'all');
    document.getElementById('sel-single-btn').classList.toggle('active', mode === 'single');
}

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

function handleEnemyMove(data) {
    let oppTanks = (mySide === 'player') ? enemyTanks : playerTanks;
    if (oppTanks[data.tankIndex]) {
        oppTanks[data.tankIndex].targetPos.set(data.target.x, 0, data.target.z);
    }
}

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

    playerTanks.forEach(t => {
        ctx.fillStyle = '#22c55e'; ctx.beginPath();
        ctx.arc(mapX(t.mesh.position.x), mapY(t.mesh.position.z), 3.5, 0, Math.PI * 2); ctx.fill();
    });
    enemyTanks.forEach(t => {
        ctx.fillStyle = '#ef4444'; ctx.beginPath();
        ctx.arc(mapX(t.mesh.position.x), mapY(t.mesh.position.z), 3.5, 0, Math.PI * 2); ctx.fill();
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    if (gameOver) return;
    requestAnimationFrame(animate);

    let elapsedTime = clock.getElapsedTime();

    // 1. أنيميشن رفرفة الأعلام بالفيزياء القماشية
    flagMeshes.forEach(flagMesh => {
        const pos = flagMesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            let u = pos.getX(i);
            let wave = Math.sin(elapsedTime * 5 + u * 0.2) * 1.8;
            pos.setZ(i, wave);
        }
        flagMesh.geometry.attributes.position.needsUpdate = true;
    });

    // 2. حركة الكاميرا من الأزرار
    if (camInputs.up) targetLookAt.z -= 4;
    if (camInputs.down) targetLookAt.z += 4;
    if (camInputs.left) targetLookAt.x -= 4;
    if (camInputs.right) targetLookAt.x += 4;
    if (camInputs.zi) cameraRadius = Math.max(80, cameraRadius - 5);
    if (camInputs.zo) cameraRadius = Math.min(600, cameraRadius + 5);
    updateCamera();

    // 3. تحديث الدبابات، القتال، وإطلاق القذائف
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

    updateMinimap();
    renderer.render(scene, camera);
}

// مؤثر الانفجارات البصرية
function createExplosionEffect(pos) {
    const pGeo = new THREE.SphereGeometry(2, 8, 8);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const p = new THREE.Mesh(pGeo, pMat);
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
