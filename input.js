import { 
    camera, targetLookAt, cameraTheta, cameraPhi, targetCameraRadius, 
    selectionMode, playerTanks, terrainMesh, camInputs, targetMarkerMesh,
    selectedTank, setCameraTheta, setCameraPhi, setTargetCameraRadius,
    setIsDragging, setHasMoved, setPreviousTouchX, setPreviousTouchY,
    setSelectedTank, setPlayerTargetPos
} from './config.js';
import { getTerrainHeight } from './world.js';

export function camMove(dir, state) { camInputs[dir] = state; }
window.camMove = camMove;

export function processCameraInputs(isCinematicEnding) {
    if (isCinematicEnding) return;
    const moveSpeed = 5.0;
    let dx = 0, dz = 0;

    if (camInputs.up) { dx -= Math.sin(cameraTheta) * moveSpeed; dz -= Math.cos(cameraTheta) * moveSpeed; }
    if (camInputs.down) { dx += Math.sin(cameraTheta) * moveSpeed; dz += Math.cos(cameraTheta) * moveSpeed; }
    if (camInputs.left) { dx -= Math.cos(cameraTheta) * moveSpeed; dz += Math.sin(cameraTheta) * moveSpeed; }
    if (camInputs.right) { dx += Math.cos(cameraTheta) * moveSpeed; dz -= Math.sin(cameraTheta) * moveSpeed; }

    targetLookAt.x = Math.max(-420, Math.min(420, targetLookAt.x + dx));
    targetLookAt.z = Math.max(-420, Math.min(420, targetLookAt.z + dz));

    if (camInputs.zi) setTargetCameraRadius(Math.max(60, targetCameraRadius - 5));
    if (camInputs.zo) setTargetCameraRadius(Math.min(550, targetCameraRadius + 5));
}

export function setupInteraction(renderer, raycaster, mouse) {
    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', (e) => {
        if (window.gameOver || window.isCinematicEnding) return;
        setIsDragging(true);
        setHasMoved(false);
        setPreviousTouchX(e.clientX);
        setPreviousTouchY(e.clientY);
        window.touchStartX = e.clientX;
        window.touchStartY = e.clientY;
    });

    dom.addEventListener('pointermove', (e) => {
        if (!window.isDragging || window.gameOver || window.isCinematicEnding) return;
        const deltaX = e.clientX - window.previousTouchX;
        const deltaY = e.clientY - window.previousTouchY;
        if (Math.abs(e.clientX - window.touchStartX) > 5 || Math.abs(e.clientY - window.touchStartY) > 5) {
            setHasMoved(true);
        }
        if (window.hasMoved) {
            setCameraTheta(cameraTheta - deltaX * 0.008);
            setCameraPhi(Math.max(0.2, Math.min(Math.PI / 2 - 0.05, cameraPhi - deltaY * 0.008)));
        }
        setPreviousTouchX(e.clientX);
        setPreviousTouchY(e.clientY);
    });

    dom.addEventListener('pointerup', (e) => {
        if (window.gameOver || window.isCinematicEnding) return;
        setIsDragging(false);
        if (!window.hasMoved) {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);

            if (selectionMode === 'single') {
                let tankObjects = playerTanks.map(t => t.mesh);
                let intersects = raycaster.intersectObjects(tankObjects, true);
                if (intersects.length > 0) {
                    let hitMesh = intersects[0].object;
                    let found = playerTanks.find(t => t.mesh === hitMesh || t.mesh.children.includes(hitMesh));
                    if (found && !found.isDestroyed) {
                        setSelectedTank(found);
                        window.showFloatingMsg('تم تحديد الدبابة');
                        return;
                    }
                }
            }

            const intersects = raycaster.intersectObject(terrainMesh);
            if (intersects.length > 0) {
                let pos = intersects[0].point;
                setPlayerTargetPos(pos);
                targetMarkerMesh.position.copy(pos);
                targetMarkerMesh.position.y = getTerrainHeight(pos.x, pos.z) + 0.1;
                targetMarkerMesh.visible = true;

                if (selectionMode === 'all') {
                    playerTanks.forEach((t, index) => {
                        if (t.isDestroyed) return;
                        let offset = new THREE.Vector3((index%3)*8 - 8, 0, Math.floor(index/3)*8);
                        t.target = pos.clone().add(offset);
                    });
                } else if (selectedTank && !selectedTank.isDestroyed) {
                    selectedTank.target = pos.clone();
                }
            }
        }
    });

    dom.addEventListener('wheel', (e) => { 
        if(!window.isCinematicEnding) setTargetCameraRadius(Math.max(50, Math.min(550, targetCameraRadius + e.deltaY * 0.3))); 
    }, { passive: true });
}

export function setupMinimapInteraction() {
    const minimap = document.getElementById('minimap-container');
    minimap.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const rect = minimap.getBoundingClientRect();
        const xClick = e.clientX - rect.left;
        const yClick = e.clientY - rect.top;
        
        const normX = (xClick / rect.width - 0.5) * 2;
        const normZ = (yClick / rect.height - 0.5) * 2;
        
        targetLookAt.x = normX * MAP_LIMIT;
        targetLookAt.z = normZ * MAP_LIMIT;
        window.showFloatingMsg('تم نقل الكاميرا عبر الخريطة المصغرة');
    });
}