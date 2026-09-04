import { scene, bullets, tacticalMissiles, shockwaves, smokeParticles } from './config.js';
import { getTerrainHeight } from './world.js';
import { playSound } from './audio.js';
import { updateTanksDamageVisual } from './tanks.js';

export function addSmokeParticle(pos, customColor = 0x222222, scale = 1) {
    const geo = new THREE.SphereGeometry(0.8 * scale, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: customColor, transparent: true, opacity: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    let groundH = getTerrainHeight(pos.x, pos.z);
    mesh.position.copy(pos).add(new THREE.Vector3((Math.random()-0.5)*2, Math.max(2, groundH + 2), (Math.random()-0.5)*2));
    scene.add(mesh);
    smokeParticles.push({ mesh: mesh, life: 35, vy: 0.12 });
}

export function fireBullet(fromTank, targetTank, triggerShakeCallback) {
    const now = Date.now();
    if (now - fromTank.lastShot < 1200) return;
    fromTank.lastShot = now;
    
    playSound('shoot', fromTank.team === 'player' ? 1.0 : 0.4);
    if (fromTank.team === 'player') {
        playSound('attack', 0.8);
        triggerShakeCallback(1.2);
    } else {
        playSound('danger', 0.8);
    }

    const bulletMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffcc00 }));
    bulletMesh.position.copy(fromTank.mesh.position).add(new THREE.Vector3(0, 3, 0));
    scene.add(bulletMesh);
    bullets.push({ mesh: bulletMesh, fromTank: fromTank, fromTeam: fromTank.team, targetTank: targetTank, speed: 2.2, damage: 34 });
}

export function fireTacticalMissile(fromTank, targetTank, triggerShakeCallback) {
    const now = Date.now();
    if (now - fromTank.lastShot < 3500) return;
    fromTank.lastShot = now;

    playSound('rocket', fromTank.team === 'player' ? 1.0 : 0.5);
    if (fromTank.team === 'player') {
        playSound('attack', 0.9);
        triggerShakeCallback(2.5);
    } else {
        playSound('danger', 0.9);
    }

    const missileGeo = new THREE.ConeGeometry(0.4, 2.5, 6);
    missileGeo.rotateX(Math.PI / 2);
    const missileMesh = new THREE.Mesh(missileGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    let startPos = fromTank.mesh.position.clone().add(new THREE.Vector3(0, 4, 0));
    missileMesh.position.copy(startPos);
    scene.add(missileMesh);

    let targetPos = targetTank.mesh.position.clone();

    tacticalMissiles.push({
        mesh: missileMesh, 
        fromTeam: fromTank.team, 
        targetTank: targetTank,
        startPos: startPos, 
        targetPos: targetPos,
        progress: 0,
        totalDuration: 75
    });
}

export function createShockwaveAndExplosion(centerPos, fromTeam, playerTanks, enemyTanks, addLostTanksCallback) {
    playSound('explosion');
    const ringGeo = new THREE.RingGeometry(0.5, 1, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff6600, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(centerPos); 
    ringMesh.position.y = getTerrainHeight(centerPos.x, centerPos.z) + 0.2;
    scene.add(ringMesh);

    const beamGeo = new THREE.CylinderGeometry(3, 8, 1, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.copy(centerPos); 
    beamMesh.position.y = getTerrainHeight(centerPos.x, centerPos.z) + 5;
    scene.add(beamMesh);

    shockwaves.push({ ring: ringMesh, beam: beamMesh, life: 25, scaleSpeed: 1.4 });
    for (let i = 0; i < 8; i++) addSmokeParticle(centerPos, 0xff4500, 1.8);

    let allTanks = [...playerTanks, ...enemyTanks];
    allTanks.forEach(tank => {
        if (tank.isDestroyed) return;
        let dist = tank.mesh.position.distanceTo(centerPos);
        if (dist < 28) {
            let damageAmount = Math.floor(110 * (1 - dist / 28));
            tank.hp -= Math.max(30, damageAmount);
            updateTanksDamageVisual(tank);
            if (tank.hp <= 0 && !tank.isDestroyed) {
                tank.isDestroyed = true;
                tank.target = null;
                if (fromTeam === 'player' && tank.team === 'enemy') addLostTanksCallback('enemy');
                else if (fromTeam === 'enemy' && tank.team === 'player') addLostTanksCallback('player');
            }
        }
    });
}