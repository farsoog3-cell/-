import { 
    scene, camera, renderer, cameraRadius, targetCameraRadius, 
    cameraTheta, cameraPhi, targetLookAt, shakeTimer, shakeIntensity,
    playerTanks, enemyTanks, bullets, tacticalMissiles, shockwaves, smokeParticles,
    rotatingRadars, animatedRigs, playerMoney, enemyMoney, totalMoneySpent,
    totalTanksLost, enemyTanksLost, oilRigs, gameTick, flagWaveTime, activeFlagMeshes,
    playerBuildCooldown, enemyBuildCooldown, CORNER_OFFSET, CAPTURE_RADIUS,
    playerFlagType, enemyFlagType, gameOver, isCinematicEnding, cinematicTargetLook,
    raycaster, mouse, terrainMesh, targetMarkerMesh, playerTargetPos,
    setGameOver, setIsCinematicEnding, setCinematicTargetLook, setPlayerMoney, setEnemyMoney,
    setTotalMoneySpent, setTotalTanksLost, setEnemyTanksLost, setGameTick,
    setPlayerBuildCooldown, setEnemyBuildCooldown, setCaptureProgress, setEnemyCaptureProgress,
    setScene, setCamera, setRenderer, setTargetMarkerMesh, cameraRadius as currentCamRadius
} from './config.js';
import { playSound, menuBgmAudio, battleBgmAudio } from './audio.js';
import { setupLighting, createHillyBrownSoilTerrain, createBases, createOilRigs, createFlagTexture } from './world.js';
import { createTank, spawnRealisticTankTracks, updateTankAudio, getSmartMovementVector } from './tanks.js';
import { fireBullet, fireTacticalMissile, createShockwaveAndExplosion, addSmokeParticle } from './combat.js';
import { processCameraInputs, setupInteraction, setupMinimapInteraction } from './input.js';
import { updateEconomyUI, renderMinimap, showFloatingMsg } from './ui.js';

window.selectFlag = function(role, color) {
    if (role === 'player') {
        if (color === enemyFlagType) window.enemyFlagType = color === 'green' ? 'red' : 'green';
        window.playerFlagType = color;
    } else {
        if (color === window.playerFlagType) window.playerFlagType = color === 'green' ? 'red' : 'green';
        window.enemyFlagType = color;
    }
    updateFlagButtonsUI();
};

function updateFlagButtonsUI() {
    document.querySelectorAll('#player-flags .flag-btn').forEach(btn => {
        btn.classList.toggle('active-player', btn.innerText.includes(window.playerFlagType === 'green' ? 'الأخضر' : 'الأحمر'));
    });
    document.querySelectorAll('#enemy-flags .flag-btn').forEach(btn => {
        btn.classList.toggle('active-enemy', btn.innerText.includes(window.enemyFlagType === 'green' ? 'الأحمر' : 'الأخضر'));
    });
}

window.setSelectionMode = function(mode) {
    window.selectionMode = mode;
    document.getElementById('sel-all-btn').classList.toggle('active', mode === 'all');
    document.getElementById('sel-single-btn').classList.toggle('active', mode === 'single');
    if (mode === 'all') window.selectedTank = null;
    showFloatingMsg(mode === 'all' ? 'تم تحديد جميع الدبابات' : 'اضغط على الدبابة لتحديدها');
};

window.startGame = function() {
    menuBgmAudio.pause();
    menuBgmAudio.currentTime = 0;
    battleBgmAudio.play().catch(e => {});

    document.getElementById('start-menu').style.display = 'none';
    document.getElementById('ui-overlay').style.display = 'block';
    playSound('buy');

    let playerCampX = CORNER_OFFSET;
    let playerCampZ = CORNER_OFFSET;
    let terrainH = getTerrainHeight(playerCampX, playerCampZ);

    targetLookAt.set(playerCampX, terrainH, playerCampZ);
    window.targetCameraRadius = 110; 
    window.cameraPhi = Math.PI / 3.8;
    updateCameraPosition();

    showFloatingMsg('بدأت المعركة! الكاميرا الآن فوق معسكرك.');
};

window.buyPlayerTank = function(type) {
    if (playerBuildCooldown > 0) return;
    let cost = (type === 'rocket') ? 300 : 150;
    if (playerMoney >= cost) {
        setPlayerMoney(playerMoney - cost);
        setTotalMoneySpent(totalMoneySpent + cost);
        setPlayerBuildCooldown(1200);
        updateEconomyUI();
        playSound('buy');
        let pColor = window.playerFlagType === 'green' ? 0x2e3b23 : 0x6b3a2a;
        let pX = CORNER_OFFSET - 50 + (Math.random() - 0.5) * 20;
        let pZ = CORNER_OFFSET - 50 + (Math.random() - 0.5) * 20;
        let newTank = createTank(pX, pZ, pColor, 'player', type);
        newTank.mesh.rotation.y = -Math.PI / 4;
        
        if (playerTargetPos) {
            newTank.target = playerTargetPos.clone();
        }

        playerTanks.push(newTank);
        showFloatingMsg(type === 'rocket' ? 'تم طلب دبابة صواريخ' : 'تم طلب دبابة عادية');
    }
};

function getTerrainHeight(x, z) {
    let h = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 5 + Math.sin(x * 0.008) * 8;
    let distFromCenter = Math.sqrt(x * x + z * z);
    if (distFromCenter < 140) h *= 0.2;
    return h;
}

function animateFlags() {
    window.flagWaveTime = (window.flagWaveTime || 0) + 0.15;
    rotatingRadars.forEach(radar => { radar.rotation.y += 0.025; });

    activeFlagMeshes.forEach(item => {
        const positions = item.mesh.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            let u = positions.getX(i);
            let v = positions.getY(i);
            if (u > -4.8) {
                let distanceFactor = (u + 5) / 10;
                let wave = Math.sin(window.flagWaveTime * 2.5 - u * 1.2) * 0.7 * distanceFactor;
                let secondaryWave = Math.cos(window.flagWaveTime * 4 - v * 0.8) * 0.3 * distanceFactor;
                positions.setZ(i, wave + secondaryWave);
            }
        }
        positions.needsUpdate = true;
    });
}

function createTargetMarker() {
    const geo = new THREE.RingGeometry(1, 2, 16); geo.rotateX(-Math.PI / 2);
    let marker = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }));
    marker.visible = false;
    scene.add(marker);
    setTargetMarkerMesh(marker);
}

function updateCameraPosition() {
    window.cameraRadius = THREE.MathUtils.lerp(window.cameraRadius || 280, targetCameraRadius, 0.15);
    let shakeX = 0, shakeY = 0;
    if (shakeTimer > 0) {
        setShakeTimer(shakeTimer - 1);
        shakeX = (Math.random() - 0.5) * shakeIntensity;
        shakeY = (Math.random() - 0.5) * shakeIntensity;
    }
    if (isCinematicEnding && cinematicTargetLook) {
        targetLookAt.lerp(cinematicTargetLook, 0.05);
        window.cameraRadius = THREE.MathUtils.lerp(window.cameraRadius, 70, 0.05);
        window.cameraTheta = cameraTheta + 0.01;
    }
    camera.position.x = targetLookAt.x + window.cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta) + shakeX;
    camera.position.y = targetLookAt.y + window.cameraRadius * Math.cos(cameraPhi) + shakeY;
    camera.position.z = targetLookAt.z + window.cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
    camera.lookAt(targetLookAt);
}

function triggerCameraShake(intensity = 1.8) {
    window.shakeTimer = 18;
    window.shakeIntensity = intensity;
}

function updateTankHpLabels() {
    const tempV = new THREE.Vector3();
    const allTanks = [...playerTanks, ...enemyTanks];
    allTanks.forEach(tank => {
        if (tank.isDestroyed) { tank.hpLabel.style.display = 'none'; return; }
        tank.hpLabel.style.display = 'block';
        tank.mesh.getWorldPosition(tempV);
        tempV.y += (3.8 * tank.mesh.scale.y); 
        tempV.project(camera);
        if (tempV.z > 1) { tank.hpLabel.style.display = 'none'; return; }
        const x = (tempV.x * .5 + .5) * window.innerWidth;
        const y = (-(tempV.y * .5) + .5) * window.innerHeight;
        tank.hpLabel.style.left = `${x}px`;
        tank.hpLabel.style.top = `${y}px`;
        tank.hpLabel.innerText = `${tank.hp}`;
    });
}

function updateTanksMovement() {
    if (window.gameOver) return;

    if (playerBuildCooldown > 0) { setPlayerBuildCooldown(playerBuildCooldown - 1); updateEconomyUI(); }
    if (enemyBuildCooldown > 0) setEnemyBuildCooldown(enemyBuildCooldown - 1);

    for (let i = tankTracks.length - 1; i >= 0; i--) {
        let tr = tankTracks[i];
        tr.life--;
        if (tr.life < 100) tr.mesh.material.opacity = (tr.life / 100) * 0.9;
        if (tr.life <= 0) {
            scene.remove(tr.mesh);
            tr.mesh.geometry.dispose();
            tr.mesh.material.dispose();
            tankTracks.splice(i, 1);
        }
    }

    for (let i = smokeParticles.length - 1; i >= 0; i--) {
        let p = smokeParticles[i];
        p.life--; p.mesh.position.y += p.vy; p.mesh.scale.multiplyScalar(1.03); p.mesh.material.opacity -= 0.025;
        if (p.life <= 0) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); smokeParticles.splice(i, 1); }
    }

    for (let i = shockwaves.length - 1; i >= 0; i--) {
        let sw = shockwaves[i];
        sw.life--;
        sw.ring.scale.addScalar(sw.scaleSpeed);
        sw.ring.material.opacity -= 0.04;
        sw.beam.scale.y += 0.8;
        sw.beam.material.opacity -= 0.04;
        if (sw.life <= 0) {
            scene.remove(sw.ring); sw.ring.geometry.dispose(); sw.ring.material.dispose();
            scene.remove(sw.beam); sw.beam.geometry.dispose(); sw.beam.material.dispose();
            shockwaves.splice(i, 1);
        }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        if (!b.targetTank || !b.targetTank.mesh.parent || b.targetTank.isDestroyed) {
            scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); bullets.splice(i, 1);
            continue;
        }
        let dir = new THREE.Vector3().subVectors(b.targetTank.mesh.position, b.mesh.position);
        if (dir.length() < 2.5) {
            b.targetTank.hp -= b.damage;
            playSound('explosion');
            addSmokeParticle(b.targetTank.mesh.position);
            if (b.targetTank.hp <= 0 && !b.targetTank.isDestroyed) {
                b.targetTank.isDestroyed = true;
                b.targetTank.target = null;
                updateTankAudio(b.targetTank, false, window.gameOver);
                if (b.fromTeam === 'player') setTotalTanksLost(totalTanksLost + 1);
                else setEnemyTanksLost(enemyTanksLost + 1);
            }
            scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); bullets.splice(i, 1);
        } else {
            b.mesh.position.add(dir.normalize().multiplyScalar(b.speed));
        }
    }

    for (let i = tacticalMissiles.length - 1; i >= 0; i--) {
        let m = tacticalMissiles[i];
        if (m.targetTank && !m.targetTank.isDestroyed) m.targetPos.copy(m.targetTank.mesh.position);

        m.progress++;
        let t = m.progress / m.totalDuration;

        if (t >= 1.0) {
            createShockwaveAndExplosion(m.targetPos, m.fromTeam, playerTanks, enemyTanks, (team) => {
                if (team === 'enemy') setEnemyTanksLost(enemyTanksLost + 1);
                else setTotalTanksLost(totalTanksLost + 1);
            });
            if (m.fromTeam === 'player') triggerCameraShake(2.2);
            scene.remove(m.mesh); m.mesh.geometry.dispose(); m.mesh.material.dispose();
            tacticalMissiles.splice(i, 1);
        } else {
            let currentPos = new THREE.Vector3().lerpVectors(m.startPos, m.targetPos, t);
            let arcHeight = Math.sin(t * Math.PI) * 45;
            currentPos.y += arcHeight;
            m.mesh.position.copy(currentPos);
            addSmokeParticle(m.mesh.position, 0xdddddd, 1.0);
        }
    }

    let allTanksCombined = [...playerTanks, ...enemyTanks];
    allTanksCombined.forEach(tankData => {
        if (tankData.isDestroyed) {
            tankData.destructionTimer++;
            if (tankData.destructionTimer <= 600) {
                if (tankData.destructionTimer % 15 === 0) addSmokeParticle(tankData.mesh.position, 0x111111, 1.5);
            } else {
                tankData.mesh.visible = false;
                tankData.hpLabel.remove();
            }
            updateTankAudio(tankData, false, window.gameOver);
            return;
        }

        let isMoving = false;
        let enemyTarget = enemyTanks.find(e => !e.isDestroyed && e.mesh.position.distanceTo(tankData.mesh.position) < (tankData.type === 'rocket' ? 140 : 110));

        if (tankData.team === 'enemy') {
            enemyTarget = playerTanks.find(p => !p.isDestroyed && p.mesh.position.distanceTo(tankData.mesh.position) < (tankData.type === 'rocket' ? 140 : 110));
        }

        if (tankData.type === 'rocket' && enemyTarget) {
            let distToTarget = tankData.mesh.position.distanceTo(enemyTarget.mesh.position);
            if (distToTarget < 60) {
                let retreatDir = new THREE.Vector3().subVectors(tankData.mesh.position, enemyTarget.mesh.position).setY(0).normalize();
                let safeDir = getSmartMovementVector(tankData.mesh.position, retreatDir, tankData, playerTanks, enemyTanks);
                if (safeDir) {
                    let nextPos = tankData.mesh.position.clone().add(safeDir.multiplyScalar(0.3));
                    nextPos.y = getTerrainHeight(nextPos.x, nextPos.z);
                    tankData.mesh.position.copy(nextPos); 
                    isMoving = true;
                }
            } else if (distToTarget > 110) {
                let dir = new THREE.Vector3().subVectors(enemyTarget.mesh.position, tankData.mesh.position).setY(0).normalize();
                let safeDir = getSmartMovementVector(tankData.mesh.position, dir, tankData, playerTanks, enemyTanks);
                if (safeDir) {
                    let nextPos = tankData.mesh.position.clone().add(safeDir.multiplyScalar(0.35));
                    nextPos.y = getTerrainHeight(nextPos.x, nextPos.z);
                    tankData.mesh.position.copy(nextPos); 
                    isMoving = true;
                }
            }
            fireTacticalMissile(tankData, enemyTarget, triggerCameraShake);
        } else {
            if (tankData.team === 'player') {
                if (tankData.target) {
                    const dist = tankData.mesh.position.distanceTo(tankData.target);
                    if (dist > 1.5) {
                        const desiredDir = new THREE.Vector3().subVectors(tankData.target, tankData.mesh.position).setY(0).normalize();
                        let safeDir = getSmartMovementVector(tankData.mesh.position, desiredDir, tankData, playerTanks, enemyTanks);
                        if (safeDir) {
                            isMoving = true;
                            tankData.mesh.rotation.y += (Math.atan2(safeDir.x, safeDir.z) - tankData.mesh.rotation.y) * 0.15;
                            let nextPos = tankData.mesh.position.clone().add(safeDir.multiplyScalar(0.35));
                            nextPos.y = getTerrainHeight(nextPos.x, nextPos.z);
                            tankData.mesh.position.copy(nextPos);
                        }
                    } else {
                        if (tankData.target === playerTargetPos) targetMarkerMesh.visible = false;
                        tankData.target = null; 
                    }
                }
            } else {
                if (!tankData.target || Math.random() < 0.01) {
                    tankData.target = new THREE.Vector3(CORNER_OFFSET + (Math.random() - 0.5) * 40, 0, CORNER_OFFSET + (Math.random() - 0.5) * 40);
                    tankData.target.y = getTerrainHeight(tankData.target.x, tankData.target.z);
                }
                const dist = tankData.mesh.position.distanceTo(tankData.target);
                if (dist > 1.5) {
                    const desiredDir = new THREE.Vector3().subVectors(tankData.target, tankData.mesh.position).setY(0).normalize();
                    let safeDir = getSmartMovementVector(tankData.mesh.position, desiredDir, tankData, playerTanks, enemyTanks);
                    if (safeDir) {
                        isMoving = true;
                        tankData.mesh.rotation.y += (Math.atan2(safeDir.x, safeDir.z) - tankData.mesh.rotation.y) * 0.15;
                        let nextPos = tankData.mesh.position.clone().add(safeDir.multiplyScalar(0.32));
                        nextPos.y = getTerrainHeight(nextPos.x, nextPos.z);
                        tankData.mesh.position.copy(nextPos);
                    }
                }
            }
            if (enemyTarget) fireBullet(tankData, enemyTarget, triggerCameraShake);
        }

        if (isMoving) {
            if (tankData.mesh.position.distanceTo(tankData.lastTrackPos) > 2.8) {
                let bodyWidth = tankData.type === 'rocket' ? 7 : 6;
                spawnRealisticTankTracks(tankData.mesh.position, tankData.mesh.rotation.y, bodyWidth);
                tankData.lastTrackPos.copy(tankData.mesh.position);
            }
        }

        updateTankAudio(tankData, isMoving, window.gameOver);
    });

    if (enemyMoney >= 150 && enemyBuildCooldown === 0 && enemyTanks.filter(t => !t.isDestroyed).length < 5) {
        let buyType = (enemyMoney >= 300 && Math.random() > 0.5) ? 'rocket' : 'normal';
        let cost = (buyType === 'rocket') ? 300 : 150;
        if (enemyMoney >= cost) {
            setEnemyMoney(enemyMoney - cost);
            setEnemyBuildCooldown(1200); 
            let eColor = window.playerFlagType === 'green' ? 0x6b3a2a : 0x2e3b23;
            let eX = -CORNER_OFFSET + 50 + (Math.random() - 0.5) * 20;
            let eZ = -CORNER_OFFSET + 50 + (Math.random() - 0.5) * 20;
            let newEnemyTank = createTank(eX, eZ, eColor, 'enemy', buyType);
            newEnemyTank.mesh.rotation.y = -Math.PI / 4;
            enemyTanks.push(newEnemyTank);
        }
    }

    updateTankHpLabels();
}

function checkLogicAndEconomy() {
    if (window.gameOver) return;
    setGameTick(gameTick + 1);
    if (gameTick % 60 === 0) {
        let pIncome = 0, eIncome = 0;
        oilRigs.forEach(rig => {
            if (rig.owner === 'player') pIncome += 10;
            else if (rig.owner === 'enemy') eIncome += 10;
        });
        if (pIncome > 0) { setPlayerMoney(playerMoney + pIncome); updateEconomyUI(); }
        if (eIncome > 0) setEnemyMoney(enemyMoney + eIncome);
    }

    oilRigs.forEach(rig => {
        let playerNear = playerTanks.some(t => !t.isDestroyed && t.mesh.position.distanceTo(new THREE.Vector3(rig.x, getTerrainHeight(rig.x, rig.z), rig.z)) < 22);
        let enemyNear = enemyTanks.some(t => !t.isDestroyed && t.mesh.position.distanceTo(new THREE.Vector3(rig.x, getTerrainHeight(rig.x, rig.z), rig.z)) < 22);

        if (playerNear && !enemyNear && rig.owner !== 'player') {
            rig.captureProgress += 1.5;
            if (rig.captureProgress >= 100) {
                rig.owner = 'player';
                rig.flagData.mesh.material.map = createFlagTexture(window.playerFlagType);
                rig.flagData.type = window.playerFlagType;
                showFloatingMsg('تمت السيطرة على بئر النفط!');
            }
        } else if (enemyNear && !playerNear && rig.owner !== 'enemy') {
            rig.captureProgress -= 1.5;
            if (rig.captureProgress <= -100) {
                rig.owner = 'enemy';
                rig.flagData.mesh.material.map = createFlagTexture(window.enemyFlagType);
                rig.flagData.type = window.enemyFlagType;
            }
        }
    });

    const enemyBasePos = new THREE.Vector3(-CORNER_OFFSET, getTerrainHeight(-CORNER_OFFSET, -CORNER_OFFSET), -CORNER_OFFSET);
    const playerBasePos = new THREE.Vector3(CORNER_OFFSET, getTerrainHeight(CORNER_OFFSET, CORNER_OFFSET), CORNER_OFFSET);

    let playerAtEnemyBase = playerTanks.some(t => !t.isDestroyed && t.mesh.position.distanceTo(enemyBasePos) < CAPTURE_RADIUS);
    let enemyAtPlayerBase = enemyTanks.some(t => !t.isDestroyed && t.mesh.position.distanceTo(playerBasePos) < CAPTURE_RADIUS);
    
    const captureText = document.getElementById('capture-status-text');
    const captureFill = document.getElementById('capture-bar-fill');

    if (playerAtEnemyBase) {
        window.captureProgress = (window.captureProgress || 0) + 0.3;
        captureText.innerText = `السيطرة على العدو: ${Math.floor(window.captureProgress)}%`;
        captureFill.style.width = `${Math.min(100, window.captureProgress)}%`;
        captureFill.style.backgroundColor = '#22c55e';
        
        if (window.enemyFlagDataRef) {
            window.enemyFlagHeight = THREE.MathUtils.lerp(38.5, 5, window.captureProgress / 100);
            window.enemyPoleFlagMesh.position.y = window.enemyFlagHeight;
        }
        if (window.captureProgress >= 100) {
            if (window.enemyFlagDataRef) {
                window.enemyFlagDataRef.mesh.material.map = createFlagTexture(window.playerFlagType);
                window.enemyFlagDataRef.mesh.material.needsUpdate = true;
                window.enemyPoleFlagMesh.position.y = 38.5;
            }
            startCinematicEnding(true);
        }
    } else if (window.captureProgress > 0 && window.captureProgress < 100 && !enemyAtPlayerBase) {
        window.captureProgress -= 0.1;
        captureFill.style.width = `${window.captureProgress}%`;
        if (window.enemyFlagDataRef) {
            window.enemyFlagHeight = THREE.MathUtils.lerp(38.5, 5, window.captureProgress / 100);
            window.enemyPoleFlagMesh.position.y = window.enemyFlagHeight;
        }
    }

    if (enemyAtPlayerBase) {
        window.enemyCaptureProgress = (window.enemyCaptureProgress || 0) + 0.25;
        captureText.innerText = `اختراق معسكرك: ${Math.floor(window.enemyCaptureProgress)}%`;
        captureFill.style.width = `${Math.min(100, window.enemyCaptureProgress)}%`;
        captureFill.style.backgroundColor = '#ef4444';

        if (window.playerFlagDataRef) {
            window.playerFlagHeight = THREE.MathUtils.lerp(38.5, 5, window.enemyCaptureProgress / 100);
            window.playerPoleFlagMesh.position.y = window.playerFlagHeight;
        }
        if (window.enemyCaptureProgress >= 100) {
            if (window.playerFlagDataRef) {
                window.playerFlagDataRef.mesh.material.map = createFlagTexture(window.enemyFlagType);
                window.playerFlagDataRef.mesh.material.needsUpdate = true;
                window.playerPoleFlagMesh.position.y = 38.5;
            }
            startCinematicEnding(false);
        }
    } else if (window.enemyCaptureProgress > 0 && window.enemyCaptureProgress < 100 && !playerAtEnemyBase) {
        window.enemyCaptureProgress -= 0.1;
        captureFill.style.width = `${window.enemyCaptureProgress}%`;
        captureFill.style.backgroundColor = '#22c55e';
        if (window.playerFlagDataRef) {
            window.playerFlagHeight = THREE.MathUtils.lerp(38.5, 5, window.enemyCaptureProgress / 100);
            window.playerPoleFlagMesh.position.y = window.playerFlagHeight;
        }
    }
}

function startCinematicEnding(isPlayerWinner) {
    setGameOver(true);
    setIsCinematicEnding(true);
    
    battleBgmAudio.pause();
    battleBgmAudio.currentTime = 0;

    [...playerTanks, ...enemyTanks].forEach(t => updateTankAudio(t, false, true));
    document.getElementById('ui-overlay').style.display = 'none';

    if (isPlayerWinner) playSound('victory', 1.0);
    else playSound('defeat', 1.0);

    setCinematicTargetLook(isPlayerWinner ? new THREE.Vector3(-CORNER_OFFSET, getTerrainHeight(-CORNER_OFFSET, -CORNER_OFFSET) + 15, -CORNER_OFFSET) : new THREE.Vector3(CORNER_OFFSET, getTerrainHeight(CORNER_OFFSET, CORNER_OFFSET) + 15, CORNER_OFFSET));

    setTimeout(() => { triggerVictoryScreen(isPlayerWinner); }, 3000);
}

function triggerVictoryScreen(isPlayerWinner) {
    const screen = document.getElementById('victory-screen');
    const title = document.getElementById('victory-title');
    const statsBox = document.getElementById('stats-content');
    screen.style.display = 'flex';

    let winningFlag = isPlayerWinner ? window.playerFlagType : window.enemyFlagType;
    if (isPlayerWinner) {
        title.innerText = "انتصار ساحق! 🚩"; title.style.color = "#22c55e";
    } else {
        title.innerText = "هزيمة قاسية! ⚠️ لقد سيطر العدو على معسكرك!"; title.style.color = "#ef4444";
    }

    let activePlayerTanks = playerTanks.filter(t => !t.isDestroyed).length;
    statsBox.innerHTML = `
        • العلم المنتصر: ${winningFlag === 'green' ? 'الأخضر (3 نجوم)' : 'الأحمر (نجمتان)'}<br>
        • خسائر دباباتك: ${totalTanksLost}<br>
        • دبابات العدو المدمرة: ${enemyTanksLost}<br>
        • إجمالي المال المصروف: ${totalMoneySpent}$<br>
        • الدبابات الحية المتبقية: ${activePlayerTanks}
    `;
    renderVictoryFlagCanvas(winningFlag);
}

function renderVictoryFlagCanvas(flagType) {
    const canvas = document.getElementById('victory-flag-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 180; canvas.height = 100;
    if (flagType === 'green') {
        ctx.fillStyle = '#007a3d'; ctx.fillRect(0, 0, 180, 33);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 33, 180, 34);
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 67, 180, 33);
        drawStar(ctx, 50, 50, '#cc0000'); drawStar(ctx, 90, 50, '#cc0000'); drawStar(ctx, 130, 50, '#cc0000');
    } else {
        ctx.fillStyle = '#cc0000'; ctx.fillRect(0, 0, 180, 33);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 33, 180, 34);
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 67, 180, 33);
        drawStar(ctx, 70, 50, '#007a3d'); drawStar(ctx, 110, 50, '#007a3d');
    }
}

function drawStar(ctx, cx, cy, color) {
    let rot = Math.PI / 2 * 3; let step = Math.PI / 5;
    ctx.beginPath(); ctx.moveTo(cx, cy - 8);
    for (let i = 0; i < 5; i++) {
        ctx.lineTo(cx + Math.cos(rot) * 8, cy + Math.sin(rot) * 8); rot += step;
        ctx.lineTo(cx + Math.cos(rot) * 3.5, cy + Math.sin(rot) * 3.5); rot += step;
    }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

function init() {
    const container = document.getElementById('canvas-container');
    let newScene = new THREE.Scene();
    newScene.background = new THREE.Color(0x7dd3fc);
    newScene.fog = new THREE.FogExp2(0x7dd3fc, 0.0018);
    setScene(newScene);

    let newCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1500);
    setCamera(newCamera);
    updateCameraPosition();

    let newRenderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    newRenderer.setSize(window.innerWidth, window.innerHeight);
    newRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    newRenderer.shadowMap.enabled = true;
    newRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(newRenderer.domElement);
    setRenderer(newRenderer);

    setupLighting();
    createHillyBrownSoilTerrain();
    createBases(createTank);
    createOilRigs();
    createTargetMarker();
    setupInteraction(newRenderer, raycaster, mouse);
    setupMinimapInteraction();

    updateEconomyUI();
    window.addEventListener('resize', () => {
        newCamera.aspect = window.innerWidth / window.innerHeight;
        newCamera.updateProjectionMatrix();
        newRenderer.setSize(window.innerWidth, window.innerHeight);
    });
    animate();
}

function animate() {
    requestAnimationFrame(animate);
    processCameraInputs(isCinematicEnding);
    updateCameraPosition();
    updateTanksMovement();
    checkLogicAndEconomy();
    animateFlags();
    renderMinimap();
    
    let time = Date.now() * 0.003;
    animatedRigs.forEach((beam, index) => {
        beam.rotation.x = Math.sin(time + index) * 0.35;
    });

    renderer.render(scene, camera);
}

window.onload = init;