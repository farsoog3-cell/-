// ملف الأرض والتضاريس والقواعد
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
