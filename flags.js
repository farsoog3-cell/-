// ملف الأعلام
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
