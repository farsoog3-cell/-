let playerTanks = [];
let enemyTanks = [];
let bullets = [];
let tacticalMissiles = [];
let shockwaves = [];
let smokeParticles = [];
let tankTracks = [];
let treadTextureCache = null;

function createTank(x, z, colorHex, team, type = 'normal') {
    const tankGroup = new THREE.Group();
    let isRocketTank = (type === 'rocket');
    
    let baseColor = isRocketTank ? (team === 'player' ? 0x1e3a8a : 0x7f1d1d) : colorHex;
    const armorMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.5 });
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

    const bodySizeX = isRocketTank ? 7 : 6;
    const bodySizeZ = isRocketTank ? 10 : 9;
    const body = new THREE.Mesh(new THREE.BoxGeometry(bodySizeX, 2.2, bodySizeZ), armorMat);
    body.position.y = 1.2; body.castShadow = true; body.receiveShadow = true; tankGroup.add(body);
    
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.7, bodySizeZ + 0.2), trackMat);
    leftTrack.position.set(-(bodySizeX/2 + 0.5), 0.8, 0); leftTrack.castShadow = true; tankGroup.add(leftTrack);
    
    const rightTrack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.7, bodySizeZ + 0.2), trackMat);
    rightTrack.position.set((bodySizeX/2 + 0.5), 0.8, 0); rightTrack.castShadow = true; tankGroup.add(rightTrack);
    
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 1.5, 10), armorMat);
    turret.position.y = 2.8; turret.castShadow = true; tankGroup.add(turret);
    
    if (isRocketTank) {
        const launcherPod = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 4), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
        launcherPod.position.set(0, 3.8, 0); launcherPod.castShadow = true; tankGroup.add(launcherPod);
    } else {
        const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 6), armorMat);
        cannon.rotation.x = Math.PI / 2; cannon.position.set(0, 2.8, 4); cannon.castShadow = true; tankGroup.add(cannon);
    }

    let terrainY = getTerrainHeight(x, z);
    tankGroup.position.set(x, terrainY, z);
    scene.add(tankGroup);

    const hpLabel = document.createElement('div');
    hpLabel.className = `tank-hp-label ${team === 'player' ? 'hp-player' : 'hp-enemy'}`;
    let initialHp = isRocketTank ? 200 : 100;
    hpLabel.innerText = `${initialHp}`;
    document.getElementById('hp-labels-container').appendChild(hpLabel);

    let idleAudio = new Audio(soundFiles.idle);
    idleAudio.loop = true; idleAudio.volume = 0.25;

    let moveAudio = new Audio(soundFiles.move);
    moveAudio.loop = true; moveAudio.volume = 0.45;

    return { 
        mesh: tankGroup, hpLabel: hpLabel, target: null, team: team, type: type, 
        hp: initialHp, maxHp: initialHp, lastShot: 0, isDestroyed: false, destructionTimer: 0,
        idleAudio: idleAudio, moveAudio: moveAudio, isIdlePlaying: false, isMovePlaying: false,
        lastTrackPos: new THREE.Vector3(x, terrainY, z)
    };
}

function updateTankAudio(tank, isMoving) {
    if (gameOver || tank.isDestroyed) {
        if (tank.isIdlePlaying) { tank.idleAudio.pause(); tank.idleAudio.currentTime = 0; tank.isIdlePlaying = false; }
        if (tank.isMovePlaying) { tank.moveAudio.pause(); tank.moveAudio.currentTime = 0; tank.isMovePlaying = false; }
        return;
    }
    if (isMoving) {
        if (tank.isIdlePlaying) { tank.idleAudio.pause(); tank.idleAudio.currentTime = 0; tank.isIdlePlaying = false; }
        if (!tank.isMovePlaying) { tank.moveAudio.play().then(() => { tank.isMovePlaying = true; }).catch(e => {}); }
    } else {
        if (tank.isMovePlaying) { tank.moveAudio.pause(); tank.moveAudio.currentTime = 0; tank.isMovePlaying = false; }
        if (!tank.isIdlePlaying) { tank.idleAudio.play().then(() => { tank.isIdlePlaying = true; }).catch(e => {}); }
    }
}
