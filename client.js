/* ===================================================
 * client.js - محرك المعركة المتطور (3D + الصوت + الأعلام الحية)
 * =================================================== */

let scene, camera, renderer;
let playerMoney = 500;
let myTanks = [];
let enemyTanks = [];
let projectiles = [];

let flagMeshes = { green: null, red: null };
let flagHeights = { green: 10, red: 10 }; // ارتفاع الأعلام على السارية
let captureProgress = 0; // -100 (أحمر) إلى +100 (أخضر)
let activeOwner = 'neutral';

// التحكم باللمس والكاميرا
let isDragging = false;
let previousTouchPosition = { x: 0, y: 0 };

// المحرك الصوتي البرمجي (Web Audio API)
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
let bgMusicNode = null;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

// تشغيل موسيقى خلفية إلكترونية حماسية
function playSynthMusic(type) {
    initAudio();
    if (bgMusicNode) bgMusicNode.stop();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type === 'menu' ? 'sine' : 'sawtooth';
    osc.frequency.setValueAtTime(type === 'menu' ? 110 : 80, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    bgMusicNode = osc;
}

// مؤทرات صوت القصف والانفجار
function playSoundEffect(type) {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    if (type === 'shoot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    } else if (type === 'rocket') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    } else if (type === 'victory') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.setValueAtTime(659, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    }

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
}

// بدء اللعبة وتجهيز البيئة 3D
function startGameEngine(gameState) {
    initAudio();
    playSynthMusic('battle');

    playerMoney = gameState.initialMoney;
    document.getElementById('player-money-display').innerText = `${playerMoney} $`;

    const container = document.getElementById('canvas-container');
    container.innerHTML = '';

    // 1. المشهد والكاميرا والظلال
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdbeafe); // سماء واقعية صافية
    scene.fog = new THREE.FogExp2(0xd1d5db, 0.008);

    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 40, 50);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // تفعيل الظلال الواقعية
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 2. إضاءة الشمس والظلال
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.2);
    sunLight.position.set(40, 60, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    // 3. أرض صحراوية طبيعية بدون أي مخططات (No Grid)
    const groundGeo = new THREE.PlaneGeometry(120, 120, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 4. بناء المعسكرات الأحدث وتثبيت الأعلام
    createModernMilitaryBase(-30, -30, 'green');
    createModernMilitaryBase(30, 30, 'red');

    // إعداد التحكم باللمس للشاشة
    setupTouchControls(renderer.domElement);

    // التجميع والرفرفة المستمرة
    let clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        // محاكاة رفرفة قماش الأعلام بالرياح
        updateFlagWave(flagMeshes.green, elapsedTime);
        updateFlagWave(flagMeshes.red, elapsedTime);

        // تحديث الصواريخ والقذائف
        updateProjectiles();

        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// بناء معسكر عسكري حديث متطور
function createModernMilitaryBase(x, z, flagType) {
    const baseGroup = new THREE.Group();

    // مبنى قيادة خرساني
    const bldgGeo = new THREE.BoxGeometry(8, 4, 6);
    const bldgMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    const bldg = new THREE.Mesh(bldgGeo, bldgMat);
    bldg.position.y = 2;
    bldg.castShadow = true;
    baseGroup.add(bldg);

    // سارية العلم الحديثة
    const poleGeo = new THREE.CylinderGeometry(0.15, 0.2, 14);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(5, 7, 0);
    pole.castShadow = true;
    baseGroup.add(pole);

    // العلم ثلاثي الأبعاد مقسم للرفرفة (Segmented Cloth)
    const flagGeo = new THREE.PlaneGeometry(4.5, 2.8, 12, 8);
    const flagMat = new THREE.MeshStandardMaterial({
        map: createFlagTexture(flagType),
        side: THREE.DoubleSide,
        roughness: 0.4
    });
    const flagMesh = new THREE.Mesh(flagGeo, flagMat);
    flagMesh.position.set(7.25, 12, 0);
    flagMesh.castShadow = true;
    baseGroup.add(flagMesh);

    flagMeshes[flagType] = flagMesh;

    baseGroup.position.set(x, 0, z);
    scene.add(baseGroup);
}

// محاكاة تموج الأعلام حركياً
function updateFlagWave(flagMesh, time) {
    if (!flagMesh) return;
    const pos = flagMesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i);
        const wave = Math.sin(time * 5 + u * 2) * 0.15;
        pos.setZ(i, wave);
    }
    pos.needsUpdate = true;
}

// تصميم الأعلام السورية (3 نجوم و نجمتان)
function createFlagTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 341;
    const ctx = canvas.getContext('2d');
    const h = canvas.height / 3;

    if (type === 'green') {
        ctx.fillStyle = '#007a3d'; ctx.fillRect(0, 0, canvas.width, h);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, h, canvas.width, h);
        ctx.fillStyle = '#000000'; ctx.fillRect(0, h * 2, canvas.width, h);
        ctx.fillStyle = '#da291c';
        drawStar(ctx, 150, h + h/2, 5, 20, 9);
        drawStar(ctx, 256, h + h/2, 5, 20, 9);
        drawStar(ctx, 362, h + h/2, 5, 20, 9);
    } else {
        ctx.fillStyle = '#da291c'; ctx.fillRect(0, 0, canvas.width, h);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, h, canvas.width, h);
        ctx.fillStyle = '#000000'; ctx.fillRect(0, h * 2, canvas.width, h);
        ctx.fillStyle = '#007a3d';
        drawStar(ctx, 180, h + h/2, 5, 22, 10);
        drawStar(ctx, 332, h + h/2, 5, 22, 10);
    }
    return new THREE.CanvasTexture(canvas);
}

function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3, x = cx, y = cy, step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius; y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y); rot += step;
        x = cx + Math.cos(rot) * innerRadius; y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y); rot += step;
    }
    ctx.closePath(); ctx.fill();
}

// التحكم بالكاميرا باللمس والأسهم
function setupTouchControls(element) {
    element.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            previousTouchPosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    });

    element.addEventListener('touchmove', (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        const deltaX = e.touches[0].clientX - previousTouchPosition.x;
        const deltaY = e.touches[0].clientY - previousTouchPosition.y;

        camera.position.x -= deltaX * 0.1;
        camera.position.z -= deltaY * 0.1;

        previousTouchPosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    });

    element.addEventListener('touchend', () => { isDragging = false; });
}

function moveCam(direction) {
    const step = 4;
    if (direction === 'up') camera.position.z -= step;
    if (direction === 'down') camera.position.z += step;
    if (direction === 'left') camera.position.x -= step;
    if (direction === 'right') camera.position.x += step;
}

function zoomCam(amount) {
    camera.position.y = Math.max(12, Math.min(65, camera.position.y + amount));
}

// شراء ودعم الدبابات
function buyTank(type) {
    const cost = type === 'normal' ? 100 : 200;
    if (playerMoney >= cost) {
        playerMoney -= cost;
        document.getElementById('player-money-display').innerText = `${playerMoney} $`;
        playSoundEffect(type === 'normal' ? 'shoot' : 'rocket');
        showFloatingMsg(type === 'normal' ? 'تم استدعاء دبابة مصفحة 🛡️' : 'تم نشر راجمة صواريخ 🚀');
    } else {
        showFloatingMsg('المال غير كافٍ!');
    }
}

// تحديث حركة الصواريخ والقذائف في الفضاء 3D
function updateProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.position.add(p.velocity);
        if (p.position.y <= 0) {
            scene.remove(p);
            projectiles.splice(i, 1);
        }
    }
}

// إنهاء المعركة وعرض قائمة الإحصائيات مع دوران السينما حول معسكر الفائز
function triggerBattleEnd(winnerFlag) {
    const isWin = (myFlag === winnerFlag);
    playSoundEffect(isWin ? 'victory' : 'shoot');

    document.getElementById('victory-title').innerText = isWin ? 'لقد انتصرت في المعركة! 🎉' : 'لقد سقط معسكرك! 💔';
    document.getElementById('victory-stats').innerHTML = `
        <p>الدولة الفائزة: <strong>${winnerFlag === 'green' ? 'سوريا (3 نجوم)' : 'سوريا (نجمتان)'}</strong></p>
        <p>المال المتبقي: ${playerMoney} $</p>
    `;
    document.getElementById('victory-screen').style.display = 'flex';

    // دوران الكاميرا السينمائي حول معسكر المنتصر
    const victorBasePos = winnerFlag === 'green' ? { x: -30, z: -30 } : { x: 30, z: 30 };
    let angle = 0;
    setInterval(() => {
        angle += 0.02;
        camera.position.x = victorBasePos.x + Math.sin(angle) * 25;
        camera.position.z = victorBasePos.z + Math.cos(angle) * 25;
        camera.lookAt(victorBasePos.x, 2, victorBasePos.z);
    }, 16);
}
