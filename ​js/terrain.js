let terrainMesh;
let obstacles = [];
let rotatingRadars = [];
let animatedRigs = [];
let oilRigs = [];
let activeFlagMeshes = [];
let enemyPoleFlagMesh, playerPoleFlagMesh;
let enemyFlagDataRef, playerFlagDataRef;
let enemyFlagHeight = 38.5;
let playerFlagHeight = 38.5;

function getTerrainHeight(x, z) {
    let h = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 5 + Math.sin(x * 0.008) * 8;
    let distFromCenter = Math.sqrt(x * x + z * z);
    if (distFromCenter < 140) h *= 0.2;
    return h;
}

function createHillyBrownSoilTerrain() {
    const geometry = new THREE.PlaneGeometry(1100, 1100, 50, 50);
    geometry.rotateX(-Math.PI / 2);

    const positionAttr = geometry.attributes.position;
    for (let i = 0; i < positionAttr.count; i++) {
        let px = positionAttr.getX(i);
        let pz = positionAttr.getZ(i);
        let h = getTerrainHeight(px, pz);
        positionAttr.setY(i, h);
    }
    geometry.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.9 });
    terrainMesh = new THREE.Mesh(geometry, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);
}

function createBaseStructure(parentGroup, isEnemy) {
    const wallMat = new THREE.MeshStandardMaterial({ color: isEnemy ? 0x1e1b18 : 0x334155, roughness: 0.5 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: isEnemy ? 0x27272a : 0x64748b, roughness: 0.7 });
    const darkRoofMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
    const glowMat = new THREE.MeshStandardMaterial({ 
        color: isEnemy ? 0xef4444 : 0x22c55e, 
        emissive: isEnemy ? 0x991b1b : 0x15803d, 
        roughness: 0.2 
    });
    const metalPlateMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.3, roughness: 0.4 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const windowMat = new THREE.MeshStandardMaterial({ 
        color: isEnemy ? 0xef4444 : 0x38bdf8, 
        emissive: isEnemy ? 0x991b1b : 0x0284c7, 
        roughness: 0.1 
    });

    [-18, 18].forEach(x => {
        const sideWall = new THREE.Mesh(new THREE.BoxGeometry(2.5, 7, 32), wallMat);
        sideWall.position.set(x, 3.5, 0); sideWall.castShadow = true; sideWall.receiveShadow = true; parentGroup.add(sideWall);
    });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(38.5, 7, 2.5), wallMat);
    backWall.position.set(0, 3.5, 16); backWall.castShadow = true; backWall.receiveShadow = true; parentGroup.add(backWall);

    const hqBase = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 14), concreteMat);
    hqBase.position.set(0, 4, -4); hqBase.castShadow = true; hqBase.receiveShadow = true; parentGroup.add(hqBase);

    const mainDoor = new THREE.Mesh(new THREE.BoxGeometry(3, 4.5, 0.5), doorMat);
    mainDoor.position.set(0, 2.25, 3.1); parentGroup.add(mainDoor);

    [-5, 5].forEach(wx => {
        const windowObj = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 0.4), windowMat);
        windowObj.position.set(wx, 5.5, 3.1); parentGroup.add(windowObj);
    });

    const hqTop = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 10), metalPlateMat);
    hqTop.position.set(0, 10.5, -4); hqTop.castShadow = true; parentGroup.add(hqTop);

    const hqRoof = new THREE.Mesh(new THREE.BoxGeometry(14, 1.5, 12), darkRoofMat);
    hqRoof.position.set(0, 13.5, -4); hqRoof.castShadow = true; parentGroup.add(hqRoof);

    const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.4, 10.2), glowMat);
    neonStrip.position.set(0, 12.6, -4); parentGroup.add(neonStrip);

    const radarSupport = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 3, 8), metalPlateMat);
    radarSupport.position.set(0, 15.7, -4); radarSupport.castShadow = true; parentGroup.add(radarSupport);

    const mainRadarDish = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.8, 12), metalPlateMat);
    mainRadarDish.rotation.x = Math.PI / 2;
    mainRadarDish.position.set(0, 17.5, -4);
    mainRadarDish.castShadow = true;
    parentGroup.add(mainRadarDish);
    rotatingRadars.push(mainRadarDish);
}

function createFlagPole(group, x, z, flagType, role) {
    let terrainH = getTerrainHeight(x, z);
    group.position.set(x, terrainH, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 35, 8), new THREE.MeshStandardMaterial({ color: 0xd1d5db }));
    pole.position.set(16, 17.5, 0); pole.castShadow = true; group.add(pole);

    const flagGeo = new THREE.PlaneGeometry(10, 6, 14, 4);
    const flagMat = new THREE.MeshBasicMaterial({ map: createFlagTexture(flagType), side: THREE.DoubleSide });
    const flagMesh = new THREE.Mesh(flagGeo, flagMat);
    flagMesh.position.set(21, 38.5, 0);
    group.add(flagMesh);

    let flagDataObj = { mesh: flagMesh, baseHeight: 38.5, type: flagType };
    activeFlagMeshes.push(flagDataObj);

    if (role === 'enemy') enemyFlagDataRef = flagDataObj;
    else playerFlagDataRef = flagDataObj;

    scene.add(group);
    return flagMesh;
}

function createFlagTexture(type) {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (type === 'green') {
        ctx.fillStyle = '#007a3d'; ctx.fillRect(0, 0, 128, 21);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 21, 128, 22);
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 43, 128, 21);
        drawStar(ctx, 42, 32, '#cc0000'); drawStar(ctx, 64, 32, '#cc0000'); drawStar(ctx, 85, 32, '#cc0000');
    } else if(type === 'red') {
        ctx.fillStyle = '#cc0000'; ctx.fillRect(0, 0, 128, 21);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 21, 128, 22);
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 43, 128, 21);
        drawStar(ctx, 50, 32, '#007a3d'); drawStar(ctx, 78, 32, '#007a3d');
    } else {
        ctx.fillStyle = '#e5e7eb'; ctx.fillRect(0, 0, 128, 64);
        ctx.fillStyle = '#9ca3af'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('محايد', 64, 36);
    }
    return new THREE.CanvasTexture(canvas);
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

function createOilRigs() {
    const positions = [{ x: 50, z: -50 }, { x: -50, z: 50 }, { x: -70, z: -70 }, { x: 70, z: 70 }];
    positions.forEach(pos => {
        const rigGroup = new THREE.Group();
        let terrainH = getTerrainHeight(pos.x, pos.z);
        rigGroup.position.set(pos.x, terrainH, pos.z);

        const baseMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
        const base = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 12), baseMat);
        base.position.y = 1; base.castShadow = true; base.receiveShadow = true;
        rigGroup.add(base);

        const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.5 });
        const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), frameMat);
        leftPillar.position.set(-2.5, 5, 0); leftPillar.rotation.z = 0.15; leftPillar.castShadow = true;
        rigGroup.add(leftPillar);

        const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), frameMat);
        rightPillar.position.set(2.5, 5, 0); rightPillar.rotation.z = -0.15; rightPillar.castShadow = true;
        rigGroup.add(rightPillar);

        const topBar = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, 1.2), frameMat);
        topBar.position.set(0, 9, 0); topBar.castShadow = true;
        rigGroup.add(topBar);

        const beamGroup = new THREE.Group();
        beamGroup.position.set(0, 9.4, 0);
        const walkingBeam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 14), new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.3 }));
        walkingBeam.position.set(0, 0, 1); walkingBeam.castShadow = true;
        beamGroup.add(walkingBeam);
        rigGroup.add(beamGroup);

        const flagGroup = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 18, 6), new THREE.MeshStandardMaterial({color: 0x999999}));
        pole.position.set(6, 9, -4); flagGroup.add(pole);

        const flagGeo = new THREE.PlaneGeometry(7, 4, 12, 4);
        const flagMat = new THREE.MeshBasicMaterial({ map: createFlagTexture('none'), side: THREE.DoubleSide });
        const flagMesh = new THREE.Mesh(flagGeo, flagMat);
        flagMesh.position.set(9.5, 16, -4); flagGroup.add(flagMesh);
        activeFlagMeshes.push({ mesh: flagMesh, baseHeight: 16, type: 'none' });

        rigGroup.add(flagGroup);
        scene.add(rigGroup);
        obstacles.push({ x: pos.x, z: pos.z, radius: 10 });
        
        oilRigs.push({
            x: pos.x, z: pos.z, group: rigGroup,
            beam: beamGroup,
            flagData: activeFlagMeshes[activeFlagMeshes.length - 1],
            owner: 'none', captureProgress: 0
        });
        animatedRigs.push(beamGroup);
    });
}
