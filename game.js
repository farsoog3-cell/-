Const soundFiles = {
    MenuBgm: 'sounds/menu_bgm.mp3',
    BattleBgm: 'sounds/battle_bgm.mp3',
    Click: 'sounds/click.mp3',
    Attack: 'sounds/attack.mp3',
    Danger: 'sounds/danger.mp3',
    Victory: 'sounds/victory_sound.mp3',
    Defeat: 'sounds/defeat_sound.mp3',
    Shoot: 'sounds/shoot.mp3',
    Rocket: 'sounds/rocket.mp3',
    Explosion: 'sounds/explosion.mp3',
    Buy: 'sounds/buy.mp3',
    Idle: 'sounds/tank_idle.mp3',
    Move: 'sounds/tank_move.mp3'
};

Let menuBgmAudio = new Audio(soundFiles.menuBgm);
MenuBgmAudio.loop = true;
MenuBgmAudio.volume = 0.4;

Let battleBgmAudio = new Audio(soundFiles.battleBgm);
BattleBgmAudio.loop = true;
BattleBgmAudio.volume = 0.5;

Window.addEventListener('pointerdown', () => {
    If (menuBgmAudio.paused && document.getElementById('start-menu').style.display !== 'none') {
        MenuBgmAudio.play().catch(e => {});
    }
}, { once: true });

Function playClickSound() {
    Const audio = new Audio(soundFiles.click);
    Audio.volume = 0.6;
    Audio.play().catch(e => {});
}

Function playSound(type, volume = 1.0) {
    If (soundFiles[type]) {
        Const audio = new Audio(soundFiles[type]);
        Audio.volume = volume;
        Audio.play().catch(e => {});
    }
}

Let scene, camera, renderer, dirLight;
Let playerFlagType = 'green';
Let enemyFlagType = 'red';

Let cameraRadius = 280, targetCameraRadius = 280;
Let cameraTheta = Math.PI / 4;
Let cameraPhi = Math.PI / 3.5;
Let targetLookAt = new THREE.Vector3(0, 0, 0);

Let shakeTimer = 0;
Let shakeIntensity = 0;
Let camInputs = { up: false, down: false, left: false, right: false, zi: false, zo: false };

Let isDragging = false;
Let previousTouchX = 0;
Let previousTouchY = 0;
Let touchStartX = 0;
Let touchStartY = 0;
Let hasMoved = false;

Let playerTanks = [];
Let enemyTanks = [];
Let bullets = [];
Let tacticalMissiles = [];
Let shockwaves = [];
Let smokeParticles = [];
Let obstacles = []; 
Let rotatingRadars = [];
Let tankTracks = [];
Let treadTextureCache = null;
Let animatedRigs = [];

Let selectionMode = 'all';
Let selectedTank = null;
Let playerTargetPos = null;

Let targetMarkerMesh;
Let raycaster = new THREE.Raycaster();
Let mouse = new THREE.Vector2();
Let terrainMesh;

Let enemyPoleFlagMesh, playerPoleFlagMesh;
Let enemyFlagDataRef, playerFlagDataRef;
Let enemyFlagHeight = 38.5;
Let playerFlagHeight = 38.5;

Let captureProgress = 0;
Let enemyCaptureProgress = 0;
Let gameOver = false;
Let isCinematicEnding = false;
Let cinematicTargetLook = null;

Const CORNER_OFFSET = 380; 
Const MAP_LIMIT = 460;
Const CAPTURE_RADIUS = 38;
Const TANK_RADIUS = 4.5; 

Let playerMoney = 500;
Let enemyMoney = 500;
Let totalMoneySpent = 0;
Let totalTanksLost = 0;
Let enemyTanksLost = 0;
Let oilRigs = [];
Let gameTick = 0;
Let flagWaveTime = 0;
Let activeFlagMeshes = [];

Let playerBuildCooldown = 0;
Let enemyBuildCooldown = 0;

Function getTerrainHeight(x, z) {
    Let h = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 5 + Math.sin(x * 0.008) * 8;
    Let distFromCenter = Math.sqrt(x * x + z * z);
    If (distFromCenter < 140) h *= 0.2;
    Return h;
}

Function showFloatingMsg(text) {
    Const msg = document.getElementById('floating-msg');
    Msg.innerText = text;
    Msg.style.opacity = '1';
    setTimeout(() => { msg.style.opacity = '0'; }, 2000);
}

Function init() {
    Const container = document.getElementById('canvas-container');
    Scene = new THREE.Scene();
    Scene.background = new THREE.Color(0x7dd3fc);
    Scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0018);

    Camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1500);
    updateCameraPosition();

    Renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
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

Function camMove(dir, state) { camInputs[dir] = state; }

Function processCameraInputs() {
    If (isCinematicEnding) return;
    Const moveSpeed = 5.0;
    Let dx = 0, dz = 0;

    If (camInputs.up) { dx -= Math.sin(cameraTheta) * moveSpeed; dz -= Math.cos(cameraTheta) * moveSpeed; }
    If (camInputs.down) { dx += Math.sin(cameraTheta) * moveSpeed; dz += Math.cos(cameraTheta) * moveSpeed; }
    If (camInputs.left) { dx -= Math.cos(cameraTheta) * moveSpeed; dz += Math.sin(cameraTheta) * moveSpeed; }
    If (camInputs.right) { dx += Math.cos(cameraTheta) * moveSpeed; dz -= Math.sin(cameraTheta) * moveSpeed; }

    TargetLookAt.x = Math.max(-420, Math.min(420, targetLookAt.x + dx));
    TargetLookAt.z = Math.max(-420, Math.min(420, targetLookAt.z + dz));

    If (camInputs.zi) targetCameraRadius = Math.max(60, targetCameraRadius - 5);
    If (camInputs.zo) targetCameraRadius = Math.min(550, targetCameraRadius + 5);
}

Function selectFlag(role, color) {
    If (role === 'player') {
        If (color === enemyFlagType) enemyFlagType = color === 'green' ? 'red' : 'green';
        PlayerFlagType = color;
    } else {
        If (color === playerFlagType) playerFlagType = color === 'green' ? 'red' : 'green';
        EnemyFlagType = color;
    }
    UpdateFlagButtonsUI();
}

Function updateFlagButtonsUI() {
    Document.querySelectorAll('#player-flags .flag-btn').forEach(btn => {
        Btn.classList.toggle('active-player', btn.innerText.includes(playerFlagType === 'green' ? 'الأخضر' : 'الأحمر'));
    });
    Document.querySelectorAll('#enemy-flags .flag-btn').forEach(btn => {
        Btn.classList.toggle('active-enemy', btn.innerText.includes(enemyFlagType === 'green' ? 'الأخضر' : 'الأحمر'));
    });
}

Function setSelectionMode(mode) {
    SelectionMode = mode;
    Document.getElementById('sel-all-btn').classList.toggle('active', mode === 'all');
    Document.getElementById('sel-single-btn').classList.toggle('active', mode === 'single');
    If (mode === 'all') selectedTank = null;
    ShowFloatingMsg(mode === 'all' ? 'تم تحديد جميع الدبابات' : 'اضغط على الدبابة لتحديدها');
}

Function startGame() {
    MenuBgmAudio.pause();
    MenuBgmAudio.currentTime = 0;
    BattleBgmAudio.play().catch(e => {});

    Document.getElementById('start-menu').style.display = 'none';
    Document.getElementById('ui-overlay').style.display = 'block';
    PlaySound('buy');

    Let playerCampX = CORNER_OFFSET;
    Let playerCampZ = CORNER_OFFSET;
    Let terrainH = getTerrainHeight(playerCampX, playerCampZ);

    TargetLookAt.set(playerCampX, terrainH, playerCampZ);
    TargetCameraRadius = 110; 
    CameraPhi = Math.PI / 3.8;
    CameraRadius = targetCameraRadius;
    updateCameraPosition();

    ShowFloatingMsg('بدأت المعركة! الكاميرا الآن فوق معسكرك.');
}

Function setupLighting() {
    Scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    
    DirLight = new THREE.DirectionalLight(0xfffbeb, 1.2);
    dirLight.position.set(300, 450, 300);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 1200;
    Let d = 450;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    Scene.add(dirLight);
}

Function createHillyBrownSoilTerrain() {
    Const geometry = new THREE.PlaneGeometry(1100, 1100, 50, 50);
    Geometry.rotateX(-Math.PI / 2);

    Const positionAttr = geometry.attributes.position;
    For (let i = 0; i < positionAttr.count; i++) {
        Let px = positionAttr.getX(i);
        Let pz = positionAttr.getZ(i);
        Let h = getTerrainHeight(px, pz);
        PositionAttr.setY(i, h);
    }
    Geometry.computeVertexNormals();

    Const terrainMat = new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.9 });
    TerrainMesh = new THREE.Mesh(geometry, terrainMat);
    terrainMesh.receiveShadow = true;
    Scene.add(terrainMesh);
}

Function createBaseStructure(parentGroup, isEnemy) {
    Const wallMat = new THREE.MeshStandardMaterial({ color: isEnemy ? 0x1e1b18 : 0x334155, roughness: 0.5 });
    Const concreteMat = new THREE.MeshStandardMaterial({ color: isEnemy ? 0x27272a : 0x64748b, roughness: 0.7 });
    Const darkRoofMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    Const glowMat = new THREE.MeshStandardMaterial({ 
        Color: isEnemy ? 0xef4444 : 0x22c55e, 
        Emissive: isEnemy ? 0x991b1b : 0x15803d, 
        Roughness: 0.2 
    });
    Const metalPlateMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.3, roughness: 0.4 });
    Const doorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    Const windowMat = new THREE.MeshStandardMaterial({ 
        Color: isEnemy ? 0xef4444 : 0x38bdf8, 
        Emissive: isEnemy ? 0x991b1b : 0x0284c7, 
        Roughness: 0.1 
    });

    [-18, 18].forEach(x => {
        Const sideWall = new THREE.Mesh(new THREE.BoxGeometry(2.5, 7, 32), wallMat);
        SideWall.position.set(x, 3.5, 0); sideWall.castShadow = true; sideWall.receiveShadow = true; parentGroup.add(sideWall);
    });
    Const backWall = new THREE.Mesh(new THREE.BoxGeometry(38.5, 7, 2.5), wallMat);
    BackWall.position.set(0, 3.5, 16); backWall.castShadow = true; backWall.receiveShadow = true; parentGroup.add(backWall);

    Const hqBase = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 14), concreteMat);
    HqBase.position.set(0, 4, -4); hqBase.castShadow = true; hqBase.receiveShadow = true; parentGroup.add(hqBase);

    Const mainDoor = new THREE.Mesh(new THREE.BoxGeometry(3, 4.5, 0.5), doorMat);
    MainDoor.position.set(0, 2.25, 3.1); parentGroup.add(mainDoor);

    [-5, 5].forEach(wx => {
        Const windowObj = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 0.4), windowMat);
        WindowObj.position.set(wx, 5.5, 3.1); parentGroup.add(windowObj);
    });

    Const hqTop = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 10), metalPlateMat);
    HqTop.position.set(0, 10.5, -4); hqTop.castShadow = true; parentGroup.add(hqTop);

    Const hqRoof = new THREE.Mesh(new THREE.BoxGeometry(14, 1.5, 12), darkRoofMat);
    HqRoof.position.set(0, 13.5, -4); hqRoof.castShadow = true; parentGroup.add(hqRoof);

    Const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.4, 10.2), glowMat);
    NeonStrip.position.set(0, 12.6, -4); parentGroup.add(neonStrip);

    Const radarSupport = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 3, 8), metalPlateMat);
    RadarSupport.position.set(0, 15.7, -4); radarSupport.castShadow = true; parentGroup.add(radarSupport);

    Const mainRadarDish = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.8, 12), metalPlateMat);
    MainRadarDish.rotation.x = Math.PI / 2;
    MainRadarDish.position.set(0, 17.5, -4);
    MainRadarDish.castShadow = true;
    ParentGroup.add(mainRadarDish);
    RotatingRadars.push(mainRadarDish);
}

Function createBases() {
    Const playerBaseGroup = new THREE.Group();
    PlayerBaseGroup.position.set(CORNER_OFFSET, getTerrainHeight(CORNER_OFFSET, CORNER_OFFSET), CORNER_OFFSET);
    PlayerBaseGroup.rotation.y = -(3 * Math.PI) / 4; 

    Const enemyBaseGroup = new THREE.Group();
    EnemyBaseGroup.position.set(-CORNER_OFFSET, getTerrainHeight(-CORNER_OFFSET, -CORNER_OFFSET), -CORNER_OFFSET);
    EnemyBaseGroup.rotation.y = -(3 * Math.PI) / 4;

    If (playerFlagType === 'green') {
        CreateBaseStructure(playerBaseGroup, false);
        CreateBaseStructure(enemyBaseGroup, true);
    } else {
        CreateBaseStructure(playerBaseGroup, true);
        CreateBaseStructure(enemyBaseGroup, false);
    }

    Scene.add(playerBaseGroup);
    Scene.add(enemyBaseGroup);

    Obstacles.push({ x: CORNER_OFFSET, z: CORNER_OFFSET, radius: 22 });
    Obstacles.push({ x: -CORNER_OFFSET, z: -CORNER_OFFSET, radius: 22 });

    Let pColor = playerFlagType === 'green' ? 0x2e3b23 : 0x6b3a2a;
    Let eColor = playerFlagType === 'green' ? 0x6b3a2a : 0x2e3b23;
    
    Let pTankX = CORNER_OFFSET - 45;
    Let pTankZ = CORNER_OFFSET - 45;
    Let eTankX = -CORNER_OFFSET + 45;
    Let eTankZ = -CORNER_OFFSET + 45;

    Let playerTank = createTank(pTankX, pTankZ, pColor, 'player', 'normal');
    Let enemyTank = createTank(eTankX, eTankZ, eColor, 'enemy', 'normal');

    PlayerTank.mesh.rotation.y = -Math.PI / 4;
    EnemyTank.mesh.rotation.y = -Math.PI / 4;

    PlayerTanks.push(playerTank);
    EnemyTanks.push(enemyTank);
        
    EnemyPoleFlagMesh = createFlagPole(new THREE.Group(), -CORNER_OFFSET, -CORNER_OFFSET, enemyFlagType, 'enemy');
    PlayerPoleFlagMesh = createFlagPole(new THREE.Group(), CORNER_OFFSET, CORNER_OFFSET, playerFlagType, 'player');
}

Function createOilRigs() {
    Const positions = [
        { x: 50, z: -50 }, 
        { x: -50, z: 50 },
        { x: -70, z: -70 },
        { x: 70, z: 70 }
    ];

    Positions.forEach(pos => {
        Const rigGroup = new THREE.Group();
        Let terrainH = getTerrainHeight(pos.x, pos.z);
        RigGroup.position.set(pos.x, terrainH, pos.z);

        Const baseMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
        Const base = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 12), baseMat);
        Base.position.y = 1; base.castShadow = true; base.receiveShadow = true;
        RigGroup.add(base);

        Const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.5 });
        Const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), frameMat);
        LeftPillar.position.set(-2.5, 5, 0); leftPillar.rotation.z = 0.15; leftPillar.castShadow = true;
        RigGroup.add(leftPillar);

        Const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), frameMat);
        RightPillar.position.set(2.5, 5, 0); rightPillar.rotation.z = -0.15; rightPillar.castShadow = true;
        RigGroup.add(rightPillar);

        Const topBar = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, 1.2), frameMat);
        TopBar.position.set(0, 9, 0); topBar.castShadow = true;
        RigGroup.add(topBar);

        Const beamGroup = new THREE.Group();
        BeamGroup.position.set(0, 9.4, 0);

        Const walkingBeam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 14), new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.3 }));
        WalkingBeam.position.set(0, 0, 1); walkingBeam.castShadow = true;
        BeamGroup.add(walkingBeam);

        Const horseheadMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
        Const horsehead = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3, 2), horseheadMat);
        Horsehead.position.set(0, -1.2, 7.5); horsehead.castShadow = true;
        BeamGroup.add(horsehead);

        Const weightMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
        Const counterweight = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 3), weightMat);
        Counterweight.position.set(0, -1, -5.5); counterweight.castShadow = true;
        BeamGroup.add(counterweight);

        RigGroup.add(beamGroup);

        Const motorBox = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshStandardMaterial({ color: 0x334155 }));
        MotorBox.position.set(0, 2.5, -5.5); motorBox.castShadow = true;
        RigGroup.add(motorBox);

        Const flagGroup = new THREE.Group();
        Const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 18, 6), new THREE.MeshStandardMaterial({color: 0x999999}));
        Pole.position.set(6, 9, -4); flagGroup.add(pole);

        Const flagGeo = new THREE.PlaneGeometry(7, 4, 12, 4);
        Const flagMat = new THREE.MeshBasicMaterial({ map: createFlagTexture('none'), side: THREE.DoubleSide });
        Const flagMesh = new THREE.Mesh(flagGeo, flagMat);
        FlagMesh.position.set(9.5, 16, -4); flagGroup.add(flagMesh);
        ActiveFlagMeshes.push({ mesh: flagMesh, baseHeight: 16, type: 'none' });

        RigGroup.add(flagGroup);
        Scene.add(rigGroup);
        
        Obstacles.push({ x: pos.x, z: pos.z, radius: 10 });
        
        OilRigs.push({
            X: pos.x, z: pos.z, group: rigGroup,
            Beam: beamGroup,
            FlagData: activeFlagMeshes[activeFlagMeshes.length - 1],
            Owner: 'none', captureProgress: 0
        });
        
        AnimatedRigs.push(beamGroup);
    });
}

Function createTank(x, z, colorHex, team, type = 'normal') {
    Const tankGroup = new THREE.Group();
    Let isRocketTank = (type === 'rocket');
    
    Const camoMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.4, metalness: 0.85 });
    Const darkArmorMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3, metalness: 0.9 });
    Const trackMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9, metalness: 0.5 });
    Const goldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.2, metalness: 0.9 });
    Const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0284c7, transparent: true, opacity: 0.7, roughness: 0.1, metalness: 0.9 });
    Const scudBodyMat = new THREE.MeshStandardMaterial({ color: 0x3a4a32, roughness: 0.4, metalness: 0.7 });
    Const metalGirdersMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.2, metalness: 0.95 });
    Const flameMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });

    If (isRocketTank) {
        Const scudChassis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 11.0), camoMat);
        ScudChassis.position.set(0, 0.9, 0);
        ScudChassis.castShadow = true;
        TankGroup.add(scudChassis);

        Const scudCabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 2.6), darkArmorMat);
        ScudCabin.position.set(0, 1.65, 4.2);
        TankGroup.add(scudCabin);

        Const cabinGlassFront = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.2), glassMat);
        CabinGlassFront.position.set(0, 1.85, 5.51);
        TankGroup.add(cabinGlassFront);

        [-1.4, 1.4].forEach(wheelX => {
            [-3.8, -1.6, 0.6, 3.2].forEach(zPos => {
                Const heavyWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.45, 24), trackMat);
                HeavyWheel.rotation.z = Math.PI / 2;
                HeavyWheel.position.set(wheelX, 0.6, zPos);
                HeavyWheel.castShadow = true;
                TankGroup.add(heavyWheel);
            });
        });

        // تم ضبط الحاوية والقاذف ليصبح اتجاه مقدمة الصاروخ نحو الأمام (رأس الشاحنة) بدلاً من الخلف
        Const scudLauncherRig = new THREE.Group();
        ScudLauncherRig.name = "rocketContainer";
        scudLauncherRig.position.set(0, 1.55, 1.0); 

        [-0.45, 0.45].forEach(gx => {
            Const girder = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 9.0), metalGirdersMat);
            Girder.position.set(gx, 0.15, 0);
            ScudLauncherRig.add(girder);
        });

        Const scudRocketAssembly = new THREE.Group();
        ScudRocketAssembly.name = "scudRocketAssembly";
        ScudRocketAssembly.position.set(0, 0.5, 0);

        Const scudBody = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 8.5, 32), scudBodyMat);
        ScudBody.rotation.x = Math.PI / 2;
        ScudBody.castShadow = true;
        ScudRocketAssembly.add(scudBody);

        Const scudNoseTip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.0, 32), scudBodyMat);
        ScudNoseTip.rotation.x = Math.PI / 2;
        ScudNoseTip.position.set(0, 0, -5.25); // اتجاه الرأس للأمام
        ScudRocketAssembly.add(scudNoseTip);

        For (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
            Const rocketFin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 1.0), darkArmorMat);
            RocketFin.position.set(Math.cos(angle) * 0.55, Math.sin(angle) * 0.55, 4.0);
            ScudRocketAssembly.add(rocketFin);
        }

        Const scudFlame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 3.5, 16), flameMat);
        ScudFlame.rotation.x = Math.PI / 2;
        ScudFlame.position.set(0, 0, 6.0);
        ScudFlame.name = "scudFlame";
        ScudFlame.visible = false;
        ScudRocketAssembly.add(scudFlame);

        ScudLauncherRig.add(scudRocketAssembly);
        TankGroup.add(scudLauncherRig);

    } else {
        Const mainHull = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.2, 8.0), camoMat);
        MainHull.position.y = 0.9;
        MainHull.castShadow = true;
        TankGroup.add(mainHull);

        Const frontArmor = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.9, 2.8), darkArmorMat);
        FrontArmor.position.set(0, 1.1, 2.9);
        FrontArmor.rotation.x = -Math.PI / 10;
        FrontArmor.castShadow = true;
        TankGroup.add(frontArmor);

        For (let eraX = -1.5; eraX <= 1.5; eraX += 1.0) {
            Const eraBlock = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.6), darkArmorMat);
            EraBlock.position.set(eraX, 1.6, 3.8);
            EraBlock.castShadow = true;
            TankGroup.add(eraBlock);
        }

        [-2.3, 2.3].forEach(tx => {
            Const track = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 8.4), trackMat);
            Track.position.set(tx, 0.65, 0);
            Track.castShadow = true;
            TankGroup.add(track);

            Const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 8.2), darkArmorMat);
            Skirt.position.set(tx > 0 ? tx + 0.35 : tx - 0.35, 0.85, 0);
            Skirt.castShadow = true;
            TankGroup.add(skirt);
        });

        Const rTurretAssembly = new THREE.Group();
        RTurretAssembly.name = "turretAssembly";
        Const rTurret = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.2, 3.8), camoMat);
        RTurret.position.set(0, 2.1, -0.2);
        RTurret.castShadow = true;
        RTurretAssembly.add(rTurret);

        Const turretArmor = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.2, 4), darkArmorMat);
        TurretArmor.rotation.y = Math.PI / 4;
        TurretArmor.position.set(0, 2.1, 0.8);
        TurretArmor.scale.set(1, 0.8, 1.2);
        RTurretAssembly.add(turretArmor);

        Const rBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 8.5, 16), darkArmorMat);
        RBarrel.rotation.x = Math.PI / 2;
        RBarrel.position.set(0, 2.3, -4.6);
        RBarrel.castShadow = true;
        RTurretAssembly.add(rBarrel);

        [ -1.0, 0.5, 2.0 ].forEach(zPos => {
            Const thermalRing = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.4, 16), camoMat);
            ThermalRing.rotation.x = Math.PI / 2;
            ThermalRing.position.set(0, 2.3, -2.5 - zPos);
            RTurretAssembly.add(thermalRing);
        });

        Const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.8), darkArmorMat);
        MuzzleBrake.position.set(0, 2.3, -8.7);
        RTurretAssembly.add(muzzleBrake);

        Const commanderCupola = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 16), darkArmorMat);
        CommanderCupola.position.set(0.8, 2.8, 0.3);
        RTurretAssembly.add(commanderCupola);

        Const rwsBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.6), darkArmorMat);
        RwsBase.position.set(0.8, 3.1, 0.3);
        RTurretAssembly.add(rwsBase);

        Const miniGun = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8), darkArmorMat);
        MiniGun.rotation.x = Math.PI / 2;
        MiniGun.position.set(0.8, 3.15, -0.4);
        RTurretAssembly.add(miniGun);

        [-1.3, 1.3].forEach(rx => {
            Const apsRadar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), goldMat);
            ApsRadar.position.set(rx, 2.4, -1.5);
            RTurretAssembly.add(apsRadar);
        });

        Const sensorOptic = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 16), glassMat);
        SensorOptic.rotation.x = Math.PI / 2;
        SensorOptic.position.set(-0.8, 2.4, 1.7);
        RTurretAssembly.add(sensorOptic);

        Const tankMuzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), flameMat);
        TankMuzzleFlash.position.set(0, 2.3, -9.2);
        TankMuzzleFlash.name = "muzzleFlash";
        TankMuzzleFlash.visible = false;
        RTurretAssembly.add(tankMuzzleFlash);

        TankGroup.add(rTurretAssembly);
    }

    Let terrainY = getTerrainHeight(x, z);
    TankGroup.position.set(x, terrainY, z);
    Scene.add(tankGroup);

    Const hpLabel = document.createElement('div');
    HpLabel.className = `tank-hp-label ${team === 'player' ? 'hp-player' : 'hp-enemy'}`;
    Let initialHp = isRocketTank ? 200 : 100;
    HpLabel.innerText = `${initialHp}`;
    Document.getElementById('hp-labels-container').appendChild(hpLabel);

    Let idleAudio = new Audio(soundFiles.idle);
    IdleAudio.loop = true;
    IdleAudio.volume = 0.25;

    Let moveAudio = new Audio(soundFiles.move);
    MoveAudio.loop = true;
    MoveAudio.volume = 0.45;

    Return { 
        Mesh: tankGroup, 
        HpLabel: hpLabel, 
        Target: null, 
        Team: team, 
        Type: type, 
        Hp: initialHp, 
        MaxHp: initialHp, 
        LastShot: 0, 
        IsDestroyed: false,
        DestructionTimer: 0,
        IdleAudio: idleAudio,
        MoveAudio: moveAudio,
        IsIdlePlaying: false,
        IsMovePlaying: false,
        LastTrackPos: new THREE.Vector3(x, terrainY, z),
        DeploymentProgress: 0
    };
}

Function getRealisticTreadTexture() {
    If (treadTextureCache) return treadTextureCache;
    Const canvas = document.createElement('canvas');
    Canvas.width = 64; canvas.height = 128;
    Const ctx = canvas.getContext('2d');
    
    Ctx.fillStyle = '#261408';
    Ctx.fillRect(0, 0, 64, 128);
    
    Ctx.fillStyle = '#110a04';
    For (let y = 8; y < 128; y += 16) {
        Ctx.fillRect(6, y, 52, 6);
        Ctx.fillStyle = '#3a2211';
        Ctx.fillRect(6, y + 6, 52, 2);
        Ctx.fillStyle = '#110a04';
    }

    TreadTextureCache = new THREE.CanvasTexture(canvas);
    TreadTextureCache.wrapS = THREE.RepeatWrapping;
    TreadTextureCache.wrapT = THREE.RepeatWrapping;
    TreadTextureCache.repeat.set(1, 3);
    Return treadTextureCache;
}

Function spawnRealisticTankTracks(centerPos, rotationY, bodyWidth) {
    Const halfWidth = bodyWidth / 2 + 0.3;
    Const trackGeo = new THREE.PlaneGeometry(1.2, 3.2);
    TrackGeo.rotateX(-Math.PI / 2);

    Const trackMat = new THREE.MeshBasicMaterial({ 
        Map: getRealisticTreadTexture(), 
        Transparent: true, 
        Opacity: 0.9 
    });

    Const offsetX = Math.cos(rotationY) * halfWidth;
    Const offsetZ = Math.sin(rotationY) * halfWidth;

    Let terrainH = getTerrainHeight(centerPos.x - offsetX, centerPos.z + offsetZ);
    Const leftMesh = new THREE.Mesh(trackGeo, trackMat);
    LeftMesh.position.set(centerPos.x - offsetX, terrainH + 0.04, centerPos.z + offsetZ);
    LeftMesh.rotation.y = rotationY;
    Scene.add(leftMesh);
    TankTracks.push({ mesh: leftMesh, life: 350 });

    Let terrainH2 = getTerrainHeight(centerPos.x + offsetX, centerPos.z - offsetZ);
    Const rightMesh = new THREE.Mesh(trackGeo, trackMat.clone());
    RightMesh.position.set(centerPos.x + offsetX, terrainH2 + 0.04, centerPos.z - offsetZ);
    RightMesh.rotation.y = rotationY;
    Scene.add(rightMesh);
    TankTracks.push({ mesh: rightMesh, life: 350 });
}

Function updateTankAudio(tank, isMoving) {
    If (gameOver || tank.isDestroyed) {
        If (tank.isIdlePlaying) { tank.idleAudio.pause(); tank.idleAudio.currentTime = 0; tank.isIdlePlaying = false; }
        If (tank.isMovePlaying) { tank.moveAudio.pause(); tank.moveAudio.currentTime = 0; tank.isMovePlaying = false; }
        Return;
    }

    If (isMoving) {
        If (tank.isIdlePlaying) { tank.idleAudio.pause(); tank.idleAudio.currentTime = 0; tank.isIdlePlaying = false; }
        If (!tank.isMovePlaying) { tank.moveAudio.play().then(() => { tank.isMovePlaying = true; }).catch(e => {}); }
    } else {
        If (tank.isMovePlaying) { tank.moveAudio.pause(); tank.moveAudio.currentTime = 0; tank.isMovePlaying = false; }
        If (!tank.isIdlePlaying) { tank.idleAudio.play().then(() => { tank.isIdlePlaying = true; }).catch(e => {}); }
    }
}

Function addSmokeParticle(pos, customColor = 0x222222, scale = 1) {
    Const geo = new THREE.SphereGeometry(0.8 * scale, 6, 6);
    Const mat = new THREE.MeshBasicMaterial({ color: customColor, transparent: true, opacity: 0.7 });
    Const mesh = new THREE.Mesh(geo, mat);
    Let groundH = getTerrainHeight(pos.x, pos.z);
    Mesh.position.copy(pos).add(new THREE.Vector3((Math.random()-0.5)*2, Math.max(2, groundH + 2), (Math.random()-0.5)*2));
    Scene.add(mesh);
    SmokeParticles.push({ mesh: mesh, life: 35, vy: 0.12 });
}

Function updateTanksDamageVisual(tankData) {
    Let healthPercent = tankData.hp / tankData.maxHp;
    Let colorHex = healthPercent > 0.6 ? null : (healthPercent > 0.3 ? 0x555555 : 0x111111);
    If (colorHex !== null) {
        TankData.mesh.traverse((child) => {
            If (child.isMesh && child.material && child.name !== "") {
                Child.material.color.setHex(colorHex);
            }
        });
    }
}

Function buyPlayerTank(type) {
    If (playerBuildCooldown > 0) return;
    Let cost = (type === 'rocket') ? 300 : 150;
    If (playerMoney >= cost) {
        PlayerMoney -= cost;
        TotalMoneySpent += cost;
        PlayerBuildCooldown = 1200;
        updateEconomyUI();
        playSound('buy');
        Let pColor = playerFlagType === 'green' ? 0x2e3b23 : 0x6b3a2a;
        Let pX = CORNER_OFFSET - 50 + (Math.random() - 0.5) * 20;
        Let pZ = CORNER_OFFSET - 50 + (Math.random() - 0.5) * 20;
        Let newTank = createTank(pX, pZ, pColor, 'player', type);
        NewTank.mesh.rotation.y = -Math.PI / 4;
        
        If (playerTargetPos) {
            NewTank.target = playerTargetPos.clone();
        }

        PlayerTanks.push(newTank);
        ShowFloatingMsg(type === 'rocket' ? 'تم طلب منظومة صواريخ سكود' : 'تم طلب دبابة القتال Razorback');
    }
}

Function createFlagPole(group, x, z, flagType, role) {
    Let terrainH = getTerrainHeight(x, z);
    Group.position.set(x, terrainH, z);
    Const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 35, 8), new THREE.MeshStandardMaterial({ color: 0xd1d5db }));
    Pole.position.set(16, 17.5, 0); pole.castShadow = true; group.add(pole);

    Const flagGeo = new THREE.PlaneGeometry(10, 6, 14, 4);
    Const flagMat = new THREE.MeshBasicMaterial({ map: createFlagTexture(flagType), side: THREE.DoubleSide });
    Const flagMesh = new THREE.Mesh(flagGeo, flagMat);
    FlagMesh.position.set(21, 38.5, 0);
    Group.add(flagMesh);

    Let flagDataObj = { mesh: flagMesh, baseHeight: 38.5, type: flagType };
    ActiveFlagMeshes.push(flagDataObj);

    If (role === 'enemy') enemyFlagDataRef = flagDataObj;
    else playerFlagDataRef = flagDataObj;

    Scene.add(group);
    Return flagMesh;
}

Function createFlagTexture(type) {
    Const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
    Const ctx = canvas.getContext('2d');
    If (type === 'green') {
        Ctx.fillStyle = '#007a3d'; ctx.fillRect(0, 0, 128, 21);
        Ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 21, 128, 22);
        Ctx.fillStyle = '#000000'; ctx.fillRect(0, 43, 128, 21);
        DrawStar(ctx, 42, 32, '#cc0000'); drawStar(ctx, 64, 32, '#cc0000'); drawStar(ctx, 85, 32, '#cc0000');
    } else if(type === 'red') {
        Ctx.fillStyle = '#cc0000'; ctx.fillRect(0, 0, 128, 21);
        Ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 21, 128, 22);
        Ctx.fillStyle = '#000000'; ctx.fillRect(0, 43, 128, 21);
        DrawStar(ctx, 50, 32, '#007a3d'); drawStar(ctx, 78, 32, '#007a3d');
    } else {
        Ctx.fillStyle = '#e5e7eb'; ctx.fillRect(0, 0, 128, 64);
        Ctx.fillStyle = '#9ca3af'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
        Ctx.fillText('محايد', 64, 36);
    }
    Return new THREE.CanvasTexture(canvas);
}

Function drawStar(ctx, cx, cy, color) {
    Let rot = Math.PI / 2 * 3; let step = Math.PI / 5;
    Ctx.beginPath(); ctx.moveTo(cx, cy - 8);
    For (let i = 0; i < 5; i++) {
        Ctx.lineTo(cx + Math.cos(rot) * 8, cy + Math.sin(rot) * 8); rot += step;
        Ctx.lineTo(cx + Math.cos(rot) * 3.5, cy + Math.sin(rot) * 3.5); rot += step;
    }
    Ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

Function animateFlags() {
    FlagWaveTime += 0.15;
    RotatingRadars.forEach(radar => { radar.rotation.y += 0.025; });

    ActiveFlagMeshes.forEach(item => {
        Const positions = item.mesh.geometry.attributes.position;
        For (let i = 0; i < positions.count; i++) {
            Let u = positions.getX(i);
            Let v = positions.getY(i);
            If (u > -4.8) {
                Let distanceFactor = (u + 5) / 10;
                Let wave = Math.sin(flagWaveTime * 2.5 - u * 1.2) * 0.7 * distanceFactor;
                Let secondaryWave = Math.cos(flagWaveTime * 4 - v * 0.8) * 0.3 * distanceFactor;
                Positions.setZ(i, wave + secondaryWave);
            }
        }
        Positions.needsUpdate = true;
    });
}

Function createTargetMarker() {
    Const geo = new THREE.RingGeometry(1, 2, 16); geo.rotateX(-Math.PI / 2);
    TargetMarkerMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }));
    TargetMarkerMesh.visible = false;
    Scene.add(targetMarkerMesh);
}

Function updateCameraPosition() {
    CameraRadius = THREE.MathUtils.lerp(cameraRadius, targetCameraRadius, 0.15);
    Let shakeX = 0, shakeY = 0;
    If (shakeTimer > 0) {
        ShakeTimer--;
        ShakeX = (Math.random() - 0.5) * shakeIntensity;
        ShakeY = (Math.random() - 0.5) * shakeIntensity;
    }
    If (isCinematicEnding && cinematicTargetLook) {
        TargetLookAt.lerp(cinematicTargetLook, 0.05);
        CameraRadius = THREE.MathUtils.lerp(cameraRadius, 70, 0.05);
        CameraTheta += 0.01;
    }
    Camera.position.x = targetLookAt.x + cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta) + shakeX;
    Camera.position.y = targetLookAt.y + cameraRadius * Math.cos(cameraPhi) + shakeY;
    Camera.position.z = targetLookAt.z + cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
    Camera.lookAt(targetLookAt);
}

Function triggerCameraShake(intensity = 1.8) {
    ShakeTimer = 18;
    ShakeIntensity = intensity;
}

Function setupInteraction() {
    Const dom = renderer.domElement;
    Dom.addEventListener('pointerdown', (e) => {
        If (gameOver || isCinematicEnding) return;
        IsDragging = true;
        HasMoved = false;
        PreviousTouchX = e.clientX;
        PreviousTouchY = e.clientY;
        TouchStartX = e.clientX;
        TouchStartY = e.clientY;
    });

    Dom.addEventListener('pointermove', (e) => {
        If (!isDragging || gameOver || isCinematicEnding) return;
        Const deltaX = e.clientX - previousTouchX;
        Const deltaY = e.clientY - previousTouchY;
        If (Math.abs(e.clientX - touchStartX) > 5 || Math.abs(e.clientY - touchStartY) > 5) {
            HasMoved = true;
        }
        If (hasMoved) {
            CameraTheta -= deltaX * 0.008;
            CameraPhi = Math.max(0.2, Math.min(Math.PI / 2 - 0.05, cameraPhi - deltaY * 0.008));
        }
        PreviousTouchX = e.clientX;
        PreviousTouchY = e.clientY;
    });

    Dom.addEventListener('pointerup', (e) => {
        If (gameOver || isCinematicEnding) return;
        IsDragging = false;
        If (!hasMoved) {
            Mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            Mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            Raycaster.setFromCamera(mouse, camera);

            If (selectionMode === 'single') {
                Let tankObjects = playerTanks.map(t => t.mesh);
                Let intersects = raycaster.intersectObjects(tankObjects, true);
                If (intersects.length > 0) {
                    Let hitMesh = intersects[0].object;
                    Let found = playerTanks.find(t => t.mesh === hitMesh || t.mesh.children.includes(hitMesh));
                    If (found && !found.isDestroyed) {
                        SelectedTank = found;
                        ShowFloatingMsg('تم تحديد الوحدة');
                        Return;
                    }
                }
            }

            Const intersects = raycaster.intersectObject(terrainMesh);
            If (intersects.length > 0) {
                PlayerTargetPos = intersects[0].point;
                TargetMarkerMesh.position.copy(playerTargetPos);
                TargetMarkerMesh.position.y = getTerrainHeight(playerTargetPos.x, playerTargetPos.z) + 0.1;
                TargetMarkerMesh.visible = true;

                If (selectionMode === 'all') {
                    PlayerTanks.forEach((t, index) => {
                        If (t.isDestroyed) return;
                        Let offset = new THREE.Vector3((index%3)*8 - 8, 0, Math.floor(index/3)*8);
                        T.target = playerTargetPos.clone().add(offset);
                    });
                } else if (selectedTank && !selectedTank.isDestroyed) {
                    SelectedTank.target = playerTargetPos.clone();
                }
            }
        }
    });

    Dom.addEventListener('wheel', (e) => { 
        If(!isCinematicEnding) targetCameraRadius = Math.max(50, Math.min(550, targetCameraRadius + e.deltaY * 0.3)); 
    }, { passive: true });
}

Function setupMinimapInteraction() {
    Const minimap = document.getElementById('minimap-container');
    Minimap.addEventListener('pointerdown', (e) => {
        E.stopPropagation();
        Const rect = minimap.getBoundingClientRect();
        Const xClick = e.clientX - rect.left;
        Const yClick = e.clientY - rect.top;
        
        Const normX = (xClick / rect.width - 0.5) * 2;
        Const normZ = (yClick / rect.height - 0.5) * 2;
        
        Let worldX = normX * MAP_LIMIT;
        Let worldZ = normZ * MAP_LIMIT;
        
        TargetLookAt.x = worldX;
        TargetLookAt.z = worldZ;
        ShowFloatingMsg('تم نقل الكاميرا عبر الخريطة المصغرة');
    });
}

Function renderMinimap() {
    Const canvas = document.getElementById('minimap-canvas');
    Const ctx = canvas.getContext('2d');
    Const w = canvas.width;
    Const h = canvas.height;
    
    Ctx.clearRect(0, 0, w, h);
    
    Ctx.fillStyle = '#1e293b';
    Ctx.beginPath();
    Ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2);
    Ctx.fill();
    
    Const scale = (w / 2) / MAP_LIMIT;

    Ctx.fillStyle = '#22c55e';
    Ctx.fillRect(w/2 + CORNER_OFFSET * scale - 3, h/2 + CORNER_OFFSET * scale - 3, 6, 6);
    Ctx.fillStyle = '#ef4444';
    Ctx.fillRect(w/2 + (-CORNER_OFFSET) * scale - 3, h/2 + (-CORNER_OFFSET) * scale - 3, 6, 6);

    PlayerTanks.forEach(t => {
        If (t.isDestroyed) return;
        Let mx = w/2 + t.mesh.position.x * scale;
        Let mz = h/2 + t.mesh.position.z * scale;
        Ctx.fillStyle = '#22c55e';
        Ctx.beginPath(); ctx.arc(mx, mz, 2.5, 0, Math.PI*2); ctx.fill();
    });

    EnemyTanks.forEach(t => {
        If (t.isDestroyed) return;
        Let mx = w/2 + t.mesh.position.x * scale;
        Let mz = h/2 + t.mesh.position.z * scale;
        Ctx.fillStyle = '#ef4444';
        Ctx.beginPath(); ctx.arc(mx, mz, 2.5, 0, Math.PI*2); ctx.fill();
    });

    Let camMx = w/2 + targetLookAt.x * scale;
    Let camMz = h/2 + targetLookAt.z * scale;
    Ctx.strokeStyle = '#38bdf8';
    Ctx.lineWidth = 1.5;
    Ctx.beginPath(); ctx.arc(camMx, camMz, 6, 0, Math.PI*2); ctx.stroke();
}

Function getSmartMovementVector(currentPos, desiredDir, currentTank) {
    Let bestDir = desiredDir.clone().normalize();
    Let testPos = currentPos.clone().add(bestDir.clone().multiplyScalar(0.35));
    If (isPositionSafe(testPos, currentTank)) return bestDir;

    Let angles = [0.4, -0.4, 0.8, -0.8, 1.2, -1.2, Math.PI / 2, -Math.PI / 2];
    For (let angle of angles) {
        Let rotatedDir = desiredDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).normalize();
        Let altTestPos = currentPos.clone().add(rotatedDir.multiplyScalar(0.35));
        If (isPositionSafe(altTestPos, currentTank)) return rotatedDir;
    }
    Return null;
}

Function isPositionSafe(nextPos, currentTank) {
    If (Math.abs(nextPos.x) > MAP_LIMIT || Math.abs(nextPos.z) > MAP_LIMIT) return false;

    For (let obs of obstacles) {
        Let dx = nextPos.x - obs.x; 
        Let dz = nextPos.z - obs.z;
        If (Math.sqrt(dx * dx + dz * dz) < obs.radius + TANK_RADIUS) return false;
    }

    Let allTanks = [...playerTanks, ...enemyTanks];
    For (let other of allTanks) {
        If (other === currentTank || other.isDestroyed) continue;
        Let dx = nextPos.x - other.mesh.position.x;
        Let dz = nextPos.z - other.mesh.position.z;
        If (Math.sqrt(dx * dx + dz * dz) < TANK_RADIUS * 2.2) return false;
    }
    Return true;
}

Function fireBullet(fromTank, targetTank) {
    Const now = Date.now();
    If (now - fromTank.lastShot < 1200) return;
    FromTank.lastShot = now;
    
    PlaySound('shoot', fromTank.team === 'player' ? 1.0 : 0.4);
    If (fromTank.team === 'player') {
        PlaySound('attack', 0.8);
        TriggerCameraShake(1.2);
    } else {
        PlaySound('danger', 0.8);
    }

    Const bulletMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffcc00 }));
    BulletMesh.position.copy(fromTank.mesh.position).add(new THREE.Vector3(0, 3, 0));
    Scene.add(bulletMesh);
    Bullets.push({ mesh: bulletMesh, fromTank: fromTank, fromTeam: fromTank.team, targetTank: targetTank, speed: 2.2, damage: 34 });
}

// دالة إطلاق الصاروخ الفعلي من شاحنة السكود ليطير ويسقط في الهدف
Function fireTacticalMissile(fromTank, targetTank) {
    Const now = Date.now();
    If (now - fromTank.lastShot < 3500) return;
    FromTank.lastShot = now;

    PlaySound('rocket', fromTank.team === 'player' ? 1.0 : 0.5);
    If (fromTank.team === 'player') {
        PlaySound('attack', 0.9);
        TriggerCameraShake(2.5);
    } else {
        PlaySound('danger', 0.9);
    }

    // إنشاء نموذج الصاروخ الذي سيطير في الهواء
    Const missileGeo = new THREE.ConeGeometry(0.4, 2.5, 6);
    MissileGeo.rotateX(Math.PI / 2);
    Const missileMesh = new THREE.Mesh(missileGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    
    Let startPos = fromTank.mesh.position.clone().add(new THREE.Vector3(0, 4, 0));
    MissileMesh.position.copy(startPos);
    Scene.add(missileMesh);

    Let targetPos = targetTank.mesh.position.clone();

    TacticalMissiles.push({
        Mesh: missileMesh, 
        FromTeam: fromTank.team, 
        TargetTank: targetTank,
        StartPos: startPos, 
        TargetPos: targetPos,
        Progress: 0,
        TotalDuration: 75
    });
}

Function createShockwaveAndExplosion(centerPos, fromTeam) {
    PlaySound('explosion');
    Const ringGeo = new THREE.RingGeometry(0.5, 1, 32);
    RingGeo.rotateX(-Math.PI / 2);
    Const ringMat = new THREE.MeshBasicMaterial({ color: 0xff6600, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    Const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    RingMesh.position.copy(centerPos); 
    RingMesh.position.y = getTerrainHeight(centerPos.x, centerPos.z) + 0.2;
    Scene.add(ringMesh);

    Const beamGeo = new THREE.CylinderGeometry(3, 8, 1, 16, 1, true);
    Const beamMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    Const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    BeamMesh.position.copy(centerPos); 
    BeamMesh.position.y = getTerrainHeight(centerPos.x, centerPos.z) + 5;
    Scene.add(beamMesh);

    Shockwaves.push({ ring: ringMesh, beam: beamMesh, life: 25, scaleSpeed: 1.4 });
    For (let i = 0; i < 8; i++) addSmokeParticle(centerPos, 0xff4500, 1.8);

    Let allTanks = [...playerTanks, ...enemyTanks];
    AllTanks.forEach(tank => {
        If (tank.isDestroyed) return;
        Let dist = tank.mesh.position.distanceTo(centerPos);
        If (dist < 28) {
            Let damageAmount = Math.floor(110 * (1 - dist / 28));
            Tank.hp -= Math.max(30, damageAmount);
            UpdateTanksDamageVisual(tank);
            If (tank.hp <= 0 && !tank.isDestroyed) {
                Tank.isDestroyed = true;
                Tank.target = null;
                updateTankAudio(tank, false);
                If (fromTeam === 'player' && tank.team === 'enemy') enemyTanksLost++;
                else if (fromTeam === 'enemy' && tank.team === 'player') totalTanksLost++;
            }
        }
    });
}

Function updateTankHpLabels() {
    Const tempV = new THREE.Vector3();
    Const allTanks = [...playerTanks, ...enemyTanks];
    AllTanks.forEach(tank => {
        If (tank.isDestroyed) { tank.hpLabel.style.display = 'none'; return; }
        Tank.hpLabel.style.display = 'block';
        Tank.mesh.getWorldPosition(tempV);
        TempV.y += (3.8 * tank.mesh.scale.y); 
        TempV.project(camera);
        If (tempV.z > 1) { tank.hpLabel.style.display = 'none'; return; }
        Const x = (tempV.x * .5 + .5) * window.innerWidth;
        Const y = (-(tempV.y * .5) + .5) * window.innerHeight;
        Tank.hpLabel.style.left = `${x}px`;
        Tank.hpLabel.style.top = `${y}px`;
        Tank.hpLabel.innerText = `${tank.hp}`;
    });
}

Function updateTanksMovement() {
    If (gameOver) return;

    If (playerBuildCooldown > 0) { playerBuildCooldown--; updateEconomyUI(); }
    If (enemyBuildCooldown > 0) enemyBuildCooldown--;

    Let time = Date.now() * 0.005;

    For (let i = tankTracks.length - 1; i >= 0; i--) {
        Let tr = tankTracks[i];
        Tr.life--;
        If (tr.life < 100) tr.mesh.material.opacity = (tr.life / 100) * 0.9;
        If (tr.life <= 0) {
            Scene.remove(tr.mesh);
            Tr.mesh.geometry.dispose();
            Tr.mesh.material.dispose();
            TankTracks.splice(i, 1);
        }
    }

    For (let i = smokeParticles.length - 1; i >= 0; i--) {
        Let p = smokeParticles[i];
        P.life--; p.mesh.position.y += p.vy; p.mesh.scale.multiplyScalar(1.03); p.mesh.material.opacity -= 0.025;
        If (p.life <= 0) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); smokeParticles.splice(i, 1); }
    }

    For (let i = shockwaves.length - 1; i >= 0; i--) {
        Let sw = shockwaves[i];
        Sw.life--;
        Sw.ring.scale.addScalar(sw.scaleSpeed);
        Sw.ring.material.opacity -= 0.04;
        Sw.beam.scale.y += 0.8;
        Sw.beam.material.opacity -= 0.04;
        If (sw.life <= 0) {
            Scene.remove(sw.ring); sw.ring.geometry.dispose(); sw.ring.material.dispose();
            Scene.remove(sw.beam); sw.beam.geometry.dispose(); sw.beam.material.dispose();
            Shockwaves.splice(i, 1);
        }
    }

    For (let i = bullets.length - 1; i >= 0; i--) {
        Let b = bullets[i];
        If (!b.targetTank || !b.targetTank.mesh.parent || b.targetTank.isDestroyed) {
            Scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); bullets.splice(i, 1);
            Continue;
        }
        Let dir = new THREE.Vector3().subVectors(b.targetTank.mesh.position, b.mesh.position);
        If (dir.length() < 2.5) {
            B.targetTank.hp -= b.damage;
            PlaySound('explosion');
            AddSmokeParticle(b.targetTank.mesh.position);
            UpdateTanksDamageVisual(b.targetTank);
            If (b.targetTank.hp <= 0 && !b.targetTank.isDestroyed) {
                B.targetTank.isDestroyed = true;
                B.targetTank.target = null;
                updateTankAudio(b.targetTank, false);
                If (b.fromTeam === 'player') totalTanksLost++;
                else enemyTanksLost++;
            }
            Scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); bullets.splice(i, 1);
        } else {
            B.mesh.position.add(dir.normalize().multiplyScalar(b.speed));
        }
    }

    For (let i = tacticalMissiles.length - 1; i >= 0; i--) {
        Let m = tacticalMissiles[i];
        If (m.targetTank && !m.targetTank.isDestroyed) m.targetPos.copy(m.targetTank.mesh.position);

        M.progress++;
        Let tVal = m.progress / m.totalDuration;

        If (tVal >= 1.0) {
            CreateShockwaveAndExplosion(m.targetPos, m.fromTeam);
            If (m.fromTeam === 'player') triggerCameraShake(2.2);
            Scene.remove(m.mesh); m.mesh.geometry.dispose(); m.mesh.material.dispose();
            TacticalMissiles.splice(i, 1);
        } else {
            Let currentPos = new THREE.Vector3().lerpVectors(m.startPos, m.targetPos, tVal);
            Let arcHeight = Math.sin(tVal * Math.PI) * 45;
            CurrentPos.y += arcHeight;
            M.mesh.position.copy(currentPos);
            AddSmokeParticle(m.mesh.position, 0xdddddd, 1.0);
        }
    }

    Let allTanksCombined = [...playerTanks, ...enemyTanks];
    AllTanksCombined.forEach(tankData => {
        If (tankData.isDestroyed) {
            TankData.destructionTimer++;
            If (tankData.destructionTimer <= 600) {
                If (tankData.destructionTimer % 15 === 0) addSmokeParticle(tankData.mesh.position, 0x111111, 1.5);
            } else {
                TankData.mesh.visible = false;
                TankData.hpLabel.remove();
            }
            UpdateTankAudio(tankData, false);
            Return;
        }

        Let isMoving = false;
        Let detectRange = (tankData.type === 'rocket') ? 250 : 120;
        Let enemyTarget = null;
        Let candidatePool = (tankData.team === 'player') ? enemyTanks : playerTanks;
        
        Let minDst = Infinity;
        CandidatePool.forEach(cand => {
            If (!cand.isDestroyed) {
                Let d = tankData.mesh.position.distanceTo(cand.mesh.position);
                If (d < detectRange && d < minDst) {
                    MinDst = d;
                    EnemyTarget = cand;
                }
            }
        });

        If (tankData.type === 'normal') {
            Let turretAsm = tankData.mesh.getObjectByName("turretAssembly");
            Let muzzleFlash = tankData.mesh.getObjectByName("muzzleFlash");
            
            If (enemyTarget) {
                Let angleToEnemy = Math.atan2(
                    EnemyTarget.mesh.position.x - tankData.mesh.position.x,
                    EnemyTarget.mesh.position.z - tankData.mesh.position.z
                );
                If (turretAsm) {
                    TurretAsm.rotation.y = angleToEnemy - tankData.mesh.rotation.y;
                }
                If (muzzleFlash) {
                    MuzzleFlash.visible = (Math.sin(time * 6) > 0.8);
                }
                FireBullet(tankData, enemyTarget);
            } else {
                If (turretAsm) turretAsm.rotation.y = 0;
                If (muzzleFlash) muzzleFlash.visible = false;
            }
        }

        Let isDeploying = false;
        If (tankData.type === 'rocket') {
            Let rocketContainer = tankData.mesh.getObjectByName("rocketContainer");
            Let scudRocketAssembly = rocketContainer ? rocketContainer.getObjectByName("scudRocketAssembly") : null;
            Let scudFlame = scudRocketAssembly ? scudRocketAssembly.getObjectByName("scudFlame") : null;

            If (enemyTarget) {
                IsMoving = false; 
                Let targetRotationY = Math.atan2(
                    EnemyTarget.mesh.position.x - tankData.mesh.position.x,
                    EnemyTarget.mesh.position.z - tankData.mesh.position.z
                );
                TankData.mesh.rotation.y = THREE.MathUtils.lerp(tankData.mesh.rotation.y, targetRotationY, 0.1);

                IsDeploying = true;
                TankData.deploymentProgress = Math.min(1, tankData.deploymentProgress + 0.05);

                If (tankData.deploymentProgress >= 0.8) {
                    If (scudFlame) scudFlame.visible = true;
                    // إخفاء الصاروخ المثبت مؤقتاً عند الإطلاق لتجنب التكرار ولطيران الصاروخ الجديد
                    If (scudRocketAssembly) scudRocketAssembly.visible = false;
                    FireTacticalMissile(tankData, enemyTarget);
                }
            } else {
                IsDeploying = false;
                TankData.deploymentProgress = Math.max(0, tankData.deploymentProgress - 0.05);
                If (scudRocketAssembly) scudRocketAssembly.visible = true;
                If (scudFlame) scudFlame.visible = false;
            }

            If (rocketContainer) {
                // تعديل زاوية رفع القاذف لتتوافق مع الاتجاه الصحيح نحو الأمام
                Let targetTilt = tankData.deploymentProgress * (Math.PI / 3.2);
                RocketContainer.rotation.x = THREE.MathUtils.lerp(rocketContainer.rotation.x, targetTilt, 0.15);
            }
        }

        If (!isDeploying) {
            If (tankData.team === 'player') {
                If (tankData.target) {
                    Const dist = tankData.mesh.position.distanceTo(tankData.target);
                    If (dist > 1.5) {
                        Const desiredDir = new THREE.Vector3().subVectors(tankData.target, tankData.mesh.position).setY(0).normalize();
                        Let safeDir = getSmartMovementVector(tankData.mesh.position, desiredDir, tankData);
                        If (safeDir) {
                            IsMoving = true;
                            TankData.mesh.rotation.y += (Math.atan2(safeDir.x, safeDir.z) - tankData.mesh.rotation.y) * 0.15;
                            Let nextPos = tankData.mesh.position.clone().add(safeDir.multiplyScalar(0.35));
                            NextPos.y = getTerrainHeight(nextPos.x, nextPos.z);
                            TankData.mesh.position.copy(nextPos);
                        }
                    } else {
                        If (tankData.target === playerTargetPos) targetMarkerMesh.visible = false;
                        TankData.target = null; 
                    }
                }
            } else {
                If (!enemyTarget) {
                    If (!tankData.target || Math.random() < 0.01) {
                        TankData.target = new THREE.Vector3(CORNER_OFFSET + (Math.random() - 0.5) * 40, 0, CORNER_OFFSET + (Math.random() - 0.5) * 40);
                        TankData.target.y = getTerrainHeight(tankData.target.x, tankData.target.z);
                    }
                    Const dist = tankData.mesh.position.distanceTo(tankData.target);
                    If (dist > 1.5) {
                        Const desiredDir = new THREE.Vector3().subVectors(tankData.target, tankData.mesh.position).setY(0).normalize();
                        Let safeDir = getSmartMovementVector(tankData.mesh.position, desiredDir, tankData);
                        If (safeDir) {
                            IsMoving = true;
                            TankData.mesh.rotation.y += (Math.atan2(safeDir.x, safeDir.z) - tankData.mesh.rotation.y) * 0.15;
                            Let nextPos = tankData.mesh.position.clone().add(safeDir.multiplyScalar(0.32));
                            NextPos.y = getTerrainHeight(nextPos.x, nextPos.z);
                            TankData.mesh.position.copy(nextPos);
                        }
                    }
                }
            }
        }

        If (isMoving) {
            If (tankData.mesh.position.distanceTo(tankData.lastTrackPos) > 2.8) {
                Let bodyWidth = tankData.type === 'rocket' ? 2.6 : 4.2;
                SpawnRealisticTankTracks(tankData.mesh.position, tankData.mesh.rotation.y, bodyWidth);
                TankData.lastTrackPos.copy(tankData.mesh.position);
            }
        }

        UpdateTankAudio(tankData, isMoving);
    });

    If (enemyMoney >= 150 && enemyBuildCooldown === 0 && enemyTanks.filter(t => !t.isDestroyed).length < 5) {
        Let buyType = (enemyMoney >= 300 && Math.random() > 0.5) ? 'rocket' : 'normal';
        Let cost = (buyType === 'rocket') ? 300 : 150;
        If (enemyMoney >= cost) {
            EnemyMoney -= cost;
            EnemyBuildCooldown = 1200; 
            Let eColor = playerFlagType === 'green' ? 0x6b3a2a : 0x2e3b23;
            Let eX = -CORNER_OFFSET + 50 + (Math.random() - 0.5) * 20;
            Let eZ = -CORNER_OFFSET + 50 + (Math.random() - 0.5) * 20;
            Let newEnemyTank = createTank(eX, eZ, eColor, 'enemy', buyType);
            NewEnemyTank.mesh.rotation.y = -Math.PI / 4;
            EnemyTanks.push(newEnemyTank);
        }
    }

    UpdateTankHpLabels();
}

Function updateEconomyUI() {
    Document.getElementById('money-display').innerText = playerMoney;
    Const buyBtn = document.getElementById('buy-tank-btn');
    Const rocketBtn = document.getElementById('buy-rocket-tank-btn');

    If (playerBuildCooldown > 0) {
        Let secs = Math.ceil(playerBuildCooldown / 60);
        BuyBtn.innerText = `انتظار (${secs}ث)`;
        RocketBtn.innerText = `انتظار (${secs}ث)`;
        BuyBtn.disabled = true;
        RocketBtn.disabled = true;
    } else {
        BuyBtn.innerText = `Razorback (150$)`;
        RocketBtn.innerText = `صواريخ سكود (300$)`;
        BuyBtn.disabled = (playerMoney < 150);
        RocketBtn.disabled = (playerMoney < 300);
    }
}

Function checkLogicAndEconomy() {
    If (gameOver) return;
    GameTick++;
    If (gameTick % 60 === 0) {
        Let pIncome = 0, eIncome = 0;
        OilRigs.forEach(rig => {
            If (rig.owner === 'player') pIncome += 10;
            else if (rig.owner === 'enemy') eIncome += 10;
        });
        If (pIncome > 0) { playerMoney += pIncome; updateEconomyUI(); }
        If (eIncome > 0) enemyMoney += eIncome;
    }

    OilRigs.forEach(rig => {
        Let playerNear = playerTanks.some(t => !t.isDestroyed && t.mesh.position.distanceTo(new THREE.Vector3(rig.x, getTerrainHeight(rig.x, rig.z), rig.z)) < 22);
        Let enemyNear = enemyTanks.some(t => !t.isDestroyed && t.mesh.position.distanceTo(new THREE.Vector3(rig.x, getTerrainHeight(rig.x, rig.z), rig.z)) < 22);

        If (playerNear && !enemyNear && rig.owner !== 'player') {
            Rig.captureProgress += 1.5;
            If (rig.captureProgress >= 100) {
                Rig.owner = 'player';
                Rig.flagData.mesh.material.map = createFlagTexture(playerFlagType);
                Rig.flagData.type = playerFlagType;
                ShowFloatingMsg('تمت السيطرة على بئر النفط!');
            }
        } else if (enemyNear && !playerNear && rig.owner !== 'enemy') {
            Rig.captureProgress -= 1.5;
            If (rig.captureProgress <= -100) {
                Rig.owner = 'enemy';
                Rig.flagData.mesh.material.map = createFlagTexture(enemyFlagType);
                Rig.flagData.type = enemyFlagType;
            }
        }
    });

    Const enemyBasePos = new THREE.Vector3(-CORNER_OFFSET, getTerrainHeight(-CORNER_OFFSET, -CORNER_OFFSET), -CORNER_OFFSET);
    Const playerBasePos = new THREE.Vector3(CORNER_OFFSET, getTerrainHeight(CORNER_OFFSET, CORNER_OFFSET), CORNER_OFFSET);

    Let playerAtEnemyBase = playerTanks.some(t => !t.isDestroyed && t.mesh.position.distanceTo(enemyBasePos) < CAPTURE_RADIUS);
    Let enemyAtPlayerBase = enemyTanks.some(t => !t.isDestroyed && t.mesh.position.distanceTo(playerBasePos) < CAPTURE_RADIUS);
    
    Const captureText = document.getElementById('capture-status-text');
    Const captureFill = document.getElementById('capture-bar-fill');

    If (playerAtEnemyBase) {
        CaptureProgress += 0.3;
        CaptureText.innerText = `السيطرة على العدو: ${Math.floor(captureProgress)}%`;
        CaptureFill.style.width = `${Math.min(100, captureProgress)}%`;
        CaptureFill.style.backgroundColor = '#22c55e';
        
        If (enemyFlagDataRef) {
            EnemyFlagHeight = THREE.MathUtils.lerp(38.5, 5, captureProgress / 100);
            EnemyPoleFlagMesh.position.y = enemyFlagHeight;
        }
        If (captureProgress >= 100) {
            If (enemyFlagDataRef) {
                EnemyFlagDataRef.mesh.material.map = createFlagTexture(playerFlagType);
                EnemyFlagDataRef.mesh.material.needsUpdate = true;
                EnemyPoleFlagMesh.position.y = 38.5;
            }
            StartCinematicEnding(true);
        }
    } else if (captureProgress > 0 && captureProgress < 100 && !enemyAtPlayerBase) {
        CaptureProgress -= 0.1;
        CaptureFill.style.width = `${captureProgress}%`;
        If (enemyFlagDataRef) {
            EnemyFlagHeight = THREE.MathUtils.lerp(38.5, 5, captureProgress / 100);
            EnemyPoleFlagMesh.position.y = enemyFlagHeight;
        }
    }

    If (enemyAtPlayerBase) {
        EnemyCaptureProgress += 0.25;
        CaptureText.innerText = `اختراق معسكرك: ${Math.floor(enemyCaptureProgress)}%`;
        CaptureFill.style.width = `${Math.min(100, enemyCaptureProgress)}%`;
        CaptureFill.style.backgroundColor = '#ef4444';

        If (playerFlagDataRef) {
            PlayerFlagHeight = THREE.MathUtils.lerp(38.5, 5, enemyCaptureProgress / 100);
            PlayerPoleFlagMesh.position.y = playerFlagHeight;
        }
        If (enemyCaptureProgress >= 100) {
            If (playerFlagDataRef) {
                PlayerFlagDataRef.mesh.material.map = createFlagTexture(enemyFlagType);
                PlayerFlagDataRef.mesh.material.needsUpdate = true;
                PlayerPoleFlagMesh.position.y = 38.5;
            }
            StartCinematicEnding(false);
        }
    } else if (enemyCaptureProgress > 0 && enemyCaptureProgress < 100 && !playerAtEnemyBase) {
        EnemyCaptureProgress -= 0.1;
        CaptureFill.style.width = `${enemyCaptureProgress}%`;
        CaptureFill.style.backgroundColor = '#22c55e';
        If (playerFlagDataRef) {
            PlayerFlagHeight = THREE.MathUtils.lerp(38.5, 5, enemyCaptureProgress / 100);
            PlayerPoleFlagMesh.position.y = playerFlagHeight;
        }
    }
}

Function startCinematicEnding(isPlayerWinner) {
    GameOver = true;
    IsCinematicEnding = true;
    
    BattleBgmAudio.pause();
    BattleBgmAudio.currentTime = 0;

    [...playerTanks, ...enemyTanks].forEach(t => updateTankAudio(t, false));
    Document.getElementById('ui-overlay').style.display = 'none';

    If (isPlayerWinner) playSound('victory', 1.0);
    else playSound('defeat', 1.0);

    CinematicTargetLook = isPlayerWinner ? new THREE.Vector3(-CORNER_OFFSET, getTerrainHeight(-CORNER_OFFSET, -CORNER_OFFSET) + 15, -CORNER_OFFSET) : new THREE.Vector3(CORNER_OFFSET, getTerrainHeight(CORNER_OFFSET, CORNER_OFFSET) + 15, CORNER_OFFSET);

    setTimeout(() => { triggerVictoryScreen(isPlayerWinner); }, 3000);
}

Function triggerVictoryScreen(isPlayerWinner) {
    Const screen = document.getElementById('victory-screen');
    Const title = document.getElementById('victory-title');
    Const statsBox = document.getElementById('stats-content');
    Screen.style.display = 'flex';

    Let winningFlag = isPlayerWinner ? playerFlagType : enemyFlagType;
    If (isPlayerWinner) {
        Title.innerText = "انتصار ساحق! 🚩"; title.style.color = "#22c55e";
    } else {
        Title.innerText = "هزيمة قاسية! ⚠️ لقد سيطر العدو على معسكرك!"; title.style.color = "#ef4444";
    }

    Let activePlayerTanks = playerTanks.filter(t => !t.isDestroyed).length;
    StatsBox.innerHTML = `
        • العلم المنتصر: ${winningFlag === 'green' ? 'الأخضر (3 نجوم)' : 'الأحمر (نجمتان)'}<br>
        • خسائر وحداتك: ${totalTanksLost}<br>
        • وحدات العدو المدمرة: ${enemyTanksLost}<br>
        • إجمالي المال المصروف: ${totalMoneySpent}$<br>
        • الوحدات الحية المتبقية: ${activePlayerTanks}
    `;
    RenderVictoryFlagCanvas(winningFlag);
}

Function renderVictoryFlagCanvas(flagType) {
    Const canvas = document.getElementById('victory-flag-canvas');
    Const ctx = canvas.getContext('2d');
    Canvas.width = 180; canvas.height = 100;
    If (flagType === 'green') {
        Ctx.fillStyle = '#007a3d'; ctx.fillRect(0, 0, 180, 33);
        Ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 33, 180, 34);
        Ctx.fillStyle = '#000000'; ctx.fillRect(0, 67, 180, 33);
        DrawStar(ctx, 50, 50, '#cc0000'); drawStar(ctx, 90, 50, '#cc0000'); drawStar(ctx, 130, 50, '#cc0000');
    } else {
        Ctx.fillStyle = '#cc0000'; ctx.fillRect(0, 0, 180, 33);
        Ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 33, 180, 34);
        Ctx.fillStyle = '#000000'; ctx.fillRect(0, 67, 180, 33);
        DrawStar(ctx, 70, 50, '#007a3d'); drawStar(ctx, 110, 50, '#007a3d');
    }
}

Function onWindowResize() {
    Camera.aspect = window.innerWidth / window.innerHeight;
    Camera.updateProjectionMatrix();
    Renderer.setSize(window.innerWidth, window.innerHeight);
}

Function animate() {
    RequestAnimationFrame(animate);
    ProcessCameraInputs();
    UpdateCameraPosition();
    UpdateTanksMovement();
    CheckLogicAndEconomy();
    AnimateFlags();
    RenderMinimap();
    
    Let time = Date.now() * 0.003;
    AnimatedRigs.forEach((beam, index) => {
        Beam.rotation.x = Math.sin(time + index) * 0.35;
    });

    Renderer.render(scene, camera);
}

Window.onload = init;
