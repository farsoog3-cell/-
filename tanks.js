import { 
    scene, obstacles, TANK_RADIUS, MAP_LIMIT, tankTracks, 
    smokeParticles, treadTextureCache, setTreadTextureCache 
} from './config.js';
import { getTerrainHeight } from './world.js';
import { playSound } from './audio.js';

export function createTank(x, z, colorHex, team, type = 'normal') {
    const tankGroup = new THREE.Group();
    let isRocketTank = (type === 'rocket');
    
    let baseColor = isRocketTank ? (team === 'player' ? 0x1e3a8a : 0x7f1d1d) : colorHex;
    const armorMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.5 });
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });

    const bodySizeX = isRocketTank ? 7 : 6;
    const bodySizeZ = isRocketTank ? 10 : 9;
    const body = new THREE.Mesh(new THREE.BoxGeometry(bodySizeX, 2.2, bodySizeZ), armorMat);
    body.position.y = 1.2; body.name = "body"; body.castShadow = true; body.receiveShadow = true; tankGroup.add(body);
    
    const leftTrack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.7, bodySizeZ + 0.2), trackMat);
    leftTrack.position.set(-(bodySizeX/2 + 0.5), 0.8, 0); leftTrack.castShadow = true; tankGroup.add(leftTrack);
    
    const rightTrack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.7, bodySizeZ + 0.2), trackMat);
    rightTrack.position.set((bodySizeX/2 + 0.5), 0.8, 0); rightTrack.castShadow = true; tankGroup.add(rightTrack);
    
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 1.5, 10), armorMat);
    turret.position.y = 2.8; turret.name = "turret"; turret.castShadow = true; tankGroup.add(turret);
    
    if (isRocketTank) {
        const launcherPod = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 4), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
        launcherPod.position.set(0, 3.8, 0); launcherPod.name = "launcherPod"; launcherPod.castShadow = true; tankGroup.add(launcherPod);
    } else {
        const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 6), armorMat);
        cannon.rotation.x = Math.PI / 2; cannon.position.set(0, 2.8, 4); cannon.name = "cannon"; cannon.castShadow = true; tankGroup.add(cannon);
    }

    let terrainY = getTerrainHeight(x, z);
    tankGroup.position.set(x, terrainY, z);
    scene.add(tankGroup);

    const hpLabel = document.createElement('div');
    hpLabel.className = `tank-hp-label ${team === 'player' ? 'hp-player' : 'hp-enemy'}`;
    let initialHp = isRocketTank ? 200 : 100;
    hpLabel.innerText = `${initialHp}`;
    document.getElementById('hp-labels-container').appendChild(hpLabel);

    let idleAudio = new Audio('sounds/tank_idle.mp3');
    idleAudio.loop = true;
    idleAudio.volume = 0.25;

    let moveAudio = new Audio('sounds/tank_move.mp3');
    moveAudio.loop = true;
    moveAudio.volume = 0.45;

    return { 
        mesh: tankGroup, 
        hpLabel: hpLabel, 
        target: null, 
        team: team, 
        type: type, 
        hp: initialHp, 
        maxHp: initialHp, 
        lastShot: 0, 
        isDestroyed: false,
        destructionTimer: 0,
        idleAudio: idleAudio,
        moveAudio: moveAudio,
        isIdlePlaying: false,
        isMovePlaying: false,
        lastTrackPos: new THREE.Vector3(x, terrainY, z)
    };
}

function getRealisticTreadTexture() {
    if (treadTextureCache) return treadTextureCache;
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#261408';
    ctx.fillRect(0, 0, 64, 128);
    
    ctx.fillStyle = '#110a04';
    for (let y = 8; y < 128; y += 16) {
        ctx.fillRect(6, y, 52, 6);
        ctx.fillStyle = '#3a2211';
        ctx.fillRect(6, y + 6, 52, 2);
        ctx.fillStyle = '#110a04';
    }

    let texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 3);
    return texture;
}

export function spawnRealisticTankTracks(centerPos, rotationY, bodyWidth) {
    const halfWidth = bodyWidth / 2 + 0.3;
    const trackGeo = new THREE.PlaneGeometry(1.2, 3.2);
    trackGeo.rotateX(-Math.PI / 2);

    const trackMat = new THREE.MeshBasicMaterial({ 
        map: getRealisticTreadTexture(), 
        transparent: true, 
        opacity: 0.9 
    });

    const offsetX = Math.cos(rotationY) * halfWidth;
    const offsetZ = Math.sin(rotationY) * halfWidth;

    let terrainH = getTerrainHeight(centerPos.x - offsetX, centerPos.z + offsetZ);
    const leftMesh = new THREE.Mesh(trackGeo, trackMat);
    leftMesh.position.set(centerPos.x - offsetX, terrainH + 0.04, centerPos.z + offsetZ);
    leftMesh.rotation.y = rotationY;
    scene.add(leftMesh);
    tankTracks.push({ mesh: leftMesh, life: 350 });

    let terrainH2 = getTerrainHeight(centerPos.x + offsetX, centerPos.z - offsetZ);
    const rightMesh = new THREE.Mesh(trackGeo, trackMat.clone());
    rightMesh.position.set(centerPos.x + offsetX, terrainH2 + 0.04, centerPos.z - offsetZ);
    rightMesh.rotation.y = rotationY;
    scene.add(rightMesh);
    tankTracks.push({ mesh: rightMesh, life: 350 });
}

export function updateTankAudio(tank, isMoving, gameOver) {
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

export function isPositionSafe(nextPos, currentTank, playerTanks, enemyTanks) {
    if (Math.abs(nextPos.x) > MAP_LIMIT || Math.abs(nextPos.z) > MAP_LIMIT) return false;

    for (let obs of obstacles) {
        let dx = nextPos.x - obs.x; 
        let dz = nextPos.z - obs.z;
        if (Math.sqrt(dx * dx + dz * dz) < obs.radius + TANK_RADIUS) return false;
    }

    let allTanks = [...playerTanks, ...enemyTanks];
    for (let other of allTanks) {
        if (other === currentTank || other.isDestroyed) continue;
        let dx = nextPos.x - other.mesh.position.x;
        let dz = nextPos.z - other.mesh.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < TANK_RADIUS * 2.2) return false;
    }
    return true;
}

export function getSmartMovementVector(currentPos, desiredDir, currentTank, playerTanks, enemyTanks) {
    let bestDir = desiredDir.clone().normalize();
    let testPos = currentPos.clone().add(bestDir.clone().multiplyScalar(0.35));
    if (isPositionSafe(testPos, currentTank, playerTanks, enemyTanks)) return bestDir;

    let angles = [0.4, -0.4, 0.8, -0.8, 1.2, -1.2, Math.PI / 2, -Math.PI / 2];
    for (let angle of angles) {
        let rotatedDir = desiredDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).normalize();
        let altTestPos = currentPos.clone().add(rotatedDir.multiplyScalar(0.35));
        if (isPositionSafe(altTestPos, currentTank, playerTanks, enemyTanks)) return rotatedDir;
    }
    return null;
}

export function updateTanksDamageVisual(tankData) {
    let healthPercent = tankData.hp / tankData.maxHp;
    let colorHex = healthPercent > 0.6 ? null : (healthPercent > 0.3 ? 0x555555 : 0x111111);
    if (colorHex !== null) {
        tankData.mesh.traverse((child) => {
            if (child.isMesh && child.material && child.name !== "") {
                child.material.color.setHex(colorHex);
            }
        });
    }
}