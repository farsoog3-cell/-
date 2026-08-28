/* ===================================================
 * client.js - محرك المعركة الثلاثي الأبعاد المعدل
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

    // 1. المشهد والكاميرا والسماء
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // سماء زرقاء مشمسة
    scene.fog = new THREE.FogExp2(0xd2b48c, 0.015); // ضباب صحراوي خفيف بالفقس

    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 35, 45);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 2. إضاءة الشمس والبيئة الصحراوية
    const ambientLight = new THREE.AmbientLight(0xfffaed, 0.9);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5ea, 1.2);
    sunLight.position.set(30, 50, 20);
    scene.add(sunLight);

    // 3. الأرض الرملية الصحراوية
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({ 
        color: 0xdec68b, // لون الرمال الصحراوية
        roughness: 0.9 
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // 4. منطقة الاستحواذ بالمنتصف (دائرة الاستحواذ العسكرية)
    const capGeo = new THREE.CylinderGeometry(8, 8, 0.2, 32);
    const capMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, wireframe: true });
    const capZone = new THREE.Mesh(capGeo, capMat);
    capZone.position.y = 0.1;
    scene.add(capZone);

    // 5. بناء المعسكرين العسكريين بالأعلام
    createMilitaryBase(-25, -25, 'green'); // المعسكر الأخضر (أرض المضيف/الأخضر)
    createMilitaryBase(25, 25, 'red');     // المعسكر الأحمر (أرض الضيف/الأحمر)

    // 6. تحديد معسكر اللاعب بناءً على العلم المختاره
    const mySpawnPos = (myFlag === 'green') ? { x: -25, z: -25 } : { x: 25, z: 25 };
    const enemySpawnPos = (myFlag === 'green') ? { x: 25, z: 25 } : { x: -25, z: -25 };

    // إنشاء دبابات البداية عند المعسكر المحدد
    spawnTank(mySpawnPos.x + 4, mySpawnPos.z, myFlag, true);
    spawnTank(enemySpawnPos.x - 4, enemySpawnPos.z, (myFlag === 'green' ? 'red' : 'green'), false);

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

// دالة إنشاء معسكر عسكري متكامل مع العلم
function createMilitaryBase(baseX, baseZ, flagType) {
    const baseGroup = new THREE.Group();

    // خيام وحواجز عسكرية
    const tentGeo = new THREE.ConeGeometry(3, 3, 4);
    const tentMat = new THREE.MeshStandardMaterial({ color: 0x556b2f }); // لون تمويه عسكري

    const tent1 = new THREE.Mesh(tentGeo, tentMat);
    tent1.position.set(-4, 1.5, -4);
    baseGroup.add(tent1);

    const tent2 = new THREE.Mesh(tentGeo, tentMat);
    tent2.position.set(4, 1.5, -4);
    baseGroup.add(tent2);

    // أكياس رمل للحماية
    const wallGeo = new THREE.BoxGeometry(10, 1.2, 1);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xc2b280 });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(0, 0.6, 5);
    baseGroup.add(wall);

    // سارية العلم (Pole)
    const poleGeo = new THREE.CylinderGeometry(0.15, 0.15, 12);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(0, 6, 0);
    baseGroup.add(pole);

    // إنشاء قماش العلم برسم 2D Canvas متطور
    const flagTexture = createFlagTexture(flagType);
    const flagGeo = new THREE.PlaneGeometry(4, 2.5);
    const flagMat = new THREE.MeshBasicMaterial({ map: flagTexture, side: THREE.DoubleSide });
    const flagMesh = new THREE.Mesh(flagGeo, flagMat);
    flagMesh.position.set(2, 10.5, 0);
    baseGroup.add(flagMesh);

    baseGroup.position.set(baseX, 0, baseZ);
    scene.add(baseGroup);
}

// دالة لرسم العلم السوري الأخضر والأحمر على Canvas كخامة للـ 3D
function createFlagTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 341;
    const ctx = canvas.getContext('2d');

    const h = canvas.height / 3;

    if (type === 'green') {
        // علم ثورة سوريا (أخضر / أبيض / أسود + 3 نجوم حمراء)
        ctx.fillStyle = '#007a3d'; ctx.fillRect(0, 0, canvas.width, h);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, h, canvas.width, h);
        ctx.fillStyle = '#000000'; ctx.fillRect(0, h * 2, canvas.width, h);

        // 3 نجوم حمراء
        ctx.fillStyle = '#da291c';
        drawStar(ctx, 150, h + h/2, 5, 22, 10);
        drawStar(ctx, 256, h + h/2, 5, 22, 10);
        drawStar(ctx, 362, h + h/2, 5, 22, 10);
    } else {
        // علم سوريا (أحمر / أبيض / أسود + نجمتين خضراوين)
        ctx.fillStyle = '#da291c'; ctx.fillRect(0, 0, canvas.width, h);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, h, canvas.width, h);
        ctx.fillStyle = '#000000'; ctx.fillRect(0, h * 2, canvas.width, h);

        // نجمتان خضراوان
        ctx.fillStyle = '#007a3d';
        drawStar(ctx, 180, h + h/2, 5, 24, 11);
        drawStar(ctx, 332, h + h/2, 5, 24, 11);
    }

    return new THREE.CanvasTexture(canvas);
}

// دالة مساعدة لرسم النجوم على الأعلام
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
}

function spawnTank(x, z, color, isMine) {
    const group = new THREE.Group();
    
    // جسم الدبابة العسكري
    const bodyGeo = new THREE.BoxGeometry(2.2, 1, 3.2);
    const bodyMat = new THREE.MeshStandardMaterial({ color: color === 'green' ? 0x2e5a1c : 0xa63a2a });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    group.add(body);

    // برج الدبابة
    const turretGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.7, 16);
    const turretMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const turret = new THREE.Mesh(turretGeo, turretMat);
    turret.position.set(0, 1.35, 0);
    group.add(turret);

    // المدفع الرئيسي
    const cannonGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.8, 8);
    const cannonMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const cannon = new THREE.Mesh(cannonGeo, cannonMat);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(0, 1.35, 1.1);
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
        const mySpawnPos = (myFlag === 'green') ? { x: -25, z: -25 } : { x: 25, z: 25 };
        spawnTank(mySpawnPos.x + (Math.random() * 6 - 3), mySpawnPos.z + (Math.random() * 6 - 3), myFlag, true);
        showFloatingMsg(`تم تعزيز معسكرك بدبابة جديدة 🛡️`);
    } else {
        showFloatingMsg("المال غير كافٍ!");
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
        camera.position.y = Math.max(15, Math.min(65, camera.position.y + amount));
    }
}
