// ملف منطق اللعبة الرئيسي الأصلي
let scene, camera, renderer, dirLight;
let playerFlagType = 'green'; let enemyFlagType = 'red';
let cameraRadius = 280, targetCameraRadius = 280;
let cameraTheta = Math.PI / 4; let cameraPhi = Math.PI / 3.5;
let targetLookAt = new THREE.Vector3(0, 0, 0);

let playerTanks = [], enemyTanks = [], obstacles = [], rotatingRadars = [], activeFlagMeshes = [];
let enemyPoleFlagMesh, playerPoleFlagMesh, enemyFlagDataRef, playerFlagDataRef;
const CORNER_OFFSET = 380;
let playerMoney = 500, enemyMoney = 500;

function init() {
    const container = document.getElementById('canvas-container');
    
    // 1. إنشاء المشهد
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

    // 6. القواعد
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

    // ربط الأحداث
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate();
}

function startGame() {
    const startMenu = document.getElementById('start-menu');
    const uiOverlay = document.getElementById('ui-overlay');
    
    if (startMenu) startMenu.style.display = 'none';
    if (uiOverlay) uiOverlay.style.display = 'block';
    
    targetLookAt.set(CORNER_OFFSET, getTerrainHeight(CORNER_OFFSET, CORNER_OFFSET), CORNER_OFFSET);
    targetCameraRadius = 110;
}

function camMove(dir, state) { 
    const speed = 15;
    if (dir === 'up') targetLookAt.z -= speed;
    if (dir === 'down') targetLookAt.z += speed;
    if (dir === 'left') targetLookAt.x -= speed;
    if (dir === 'right') targetLookAt.x += speed;
    if (dir === 'zi') targetCameraRadius = Math.max(40, targetCameraRadius - 20);
    if (dir === 'zo') targetCameraRadius = Math.min(500, targetCameraRadius + 20);
    updateCameraPosition();
}

function selectFlag(role, color) {
    if (role === 'player') playerFlagType = color; 
    else enemyFlagType = color;
}

function setSelectionMode(mode) {
    const allBtn = document.getElementById('sel-all-btn');
    const singleBtn = document.getElementById('sel-single-btn');
    if (allBtn) allBtn.classList.toggle('active', mode === 'all');
    if (singleBtn) singleBtn.classList.toggle('active', mode === 'single');
}

function updateCameraPosition() {
    cameraRadius = THREE.MathUtils.lerp(cameraRadius, targetCameraRadius, 0.15);
    camera.position.set(
        targetLookAt.x + cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta),
        targetLookAt.y + cameraRadius * Math.cos(cameraPhi),
        targetLookAt.z + cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta)
    );
    camera.lookAt(targetLookAt);
}

function animate() {
    requestAnimationFrame(animate);

    rotatingRadars.forEach(radar => {
        radar.rotation.z += 0.02;
    });

    updateCameraPosition();
    renderer.render(scene, camera);
}

window.onload = init;
