/* ===================================================
 * client.js - محرك المعركة الثلاثي الأبعاد والدبابات
 * =================================================== */

let scene, camera, renderer;
let playerMoney = 500;
let myTanks = [];
let enemyTanks = [];
let selectMode = 'all';

function startGameEngine(gameState) {
    playerMoney = gameState.initialMoney;
    document.getElementById('player-money-display').innerText = `${playerMoney} $`;

    const container = document.getElementById('canvas-container');
    container.innerHTML = '';

    // 1. المشهد والكاميرا
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 35, 35);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 2. الإضاءة
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(20, 40, 20);
    scene.add(dirLight);

    // 3. الأرضية والشبكة
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const grid = new THREE.GridHelper(60, 20, 0x38bdf8, 0x334155);
    grid.position.y = 0.01;
    scene.add(grid);

    // 4. منطقة الاستحواذ
    const capGeo = new THREE.CylinderGeometry(6, 6, 0.2, 32);
    const capMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, wireframe: true });
    const capZone = new THREE.Mesh(capGeo, capMat);
    scene.position.y = 0.05;
    scene.add(capZone);

    // إنشاء دبابات أولية
    spawnTank(isHost ? -15 : 15, isHost ? -15 : 15, isHost ? 'green' : 'red', true);
    spawnTank(isHost ? 15 : -15, isHost ? 15 : -15, isHost ? 'red' : 'green', false);

    // التحديث المستمر
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function spawnTank(x, z, color, isMine) {
    const group = new THREE.Group();
    
    // جسم الدبابة
    const bodyGeo = new THREE.BoxGeometry(2, 1, 3);
    const bodyMat = new THREE.MeshStandardMaterial({ color: color === 'green' ? 0x22c55e : 0xef4444 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    group.add(body);

    // البرج
    const turretGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 16);
    const turretMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    const turret = new THREE.Mesh(turretGeo, turretMat);
    turret.position.set(0, 1.2, 0);
    group.add(turret);

    // المدفع
    const cannonGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.5, 8);
    const cannonMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    const cannon = new THREE.Mesh(cannonGeo, cannonMat);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(0, 1.2, 1);
    group.add(cannon);

    group.position.set(x, 0, z);
    scene.add(group);

    if (isMine) myTanks.push(group);
    else enemyTanks.push(group);
}

function buyTank(type) {
    const cost = type === 'normal' ? 100 : 200;
    if (playerMoney >= cost) {
        playerMoney -= cost;
        document.getElementById('player-money-display').innerText = `${playerMoney} $`;
        const startX = isHost ? -20 : 20;
        const startZ = isHost ? -20 : 20;
        spawnTank(startX + (Math.random() * 4 - 2), startZ + (Math.random() * 4 - 2), isHost ? 'green' : 'red', true);
        showFloatingMsg(`تم شراء دبابة جديد 🛡️`);
    } else {
        showFloatingMsg("المال لا يكفي!");
    }
}

function setSelectMode(mode) {
    selectMode = mode;
    document.getElementById('btn-select-all').classList.toggle('active', mode === 'all');
    document.getElementById('btn-select-single').classList.toggle('active', mode === 'single');
}

function moveCam(dx, dz) {
    if (camera) {
        camera.position.x += dx;
        camera.position.z += dz;
    }
}

function zoomCam(amount) {
    if (camera) {
        camera.position.y = Math.max(15, Math.min(60, camera.position.y + amount));
    }
}
