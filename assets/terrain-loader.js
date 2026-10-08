// External terrain loader used by the game.
function loadExternalTerrainMap() {
        if (typeof THREE.GLTFLoader !== 'function') {
            console.error('GLTFLoader is required. External terrain was not loaded.');
            return;
        }
        const loader = new THREE.GLTFLoader();
        loader.load('assets/terrain_map.glb', function(gltf) {
            const root = gltf.scene || gltf.scenes[0];
            let firstMesh = null;
            root.traverse(function(obj) { if (obj.isMesh && !firstMesh) firstMesh = obj; });
            if (!firstMesh) { console.error('terrain_map.glb contains no mesh.'); return; }

            // Build an exact 161x161 height grid from the external GLB vertices.
            const pos = firstMesh.geometry.attributes.position;
            const count = pos.count;
            const side = Math.round(Math.sqrt(count));
            const heights = new Float32Array(count);
            for (let i=0;i<count;i++) heights[i]=pos.getY(i);
            const minX=-450, maxX=450, minZ=-450, maxZ=450;
            window.__externalTerrainHeightSampler = function(x,z){
                const fx = THREE.MathUtils.clamp((x-minX)/(maxX-minX)*(side-1),0,side-1);
                const fz = THREE.MathUtils.clamp((z-minZ)/(maxZ-minZ)*(side-1),0,side-1);
                const x0=Math.floor(fx), z0=Math.floor(fz);
                const x1=Math.min(side-1,x0+1), z1=Math.min(side-1,z0+1);
                const tx=fx-x0, tz=fz-z0;
                const h00=heights[z0*side+x0], h10=heights[z0*side+x1];
                const h01=heights[z1*side+x0], h11=heights[z1*side+x1];
                return (h00+(h10-h00)*tx)*(1-tz)+(h01+(h11-h01)*tx)*tz;
            };

            // This GLB has geometry only; its material is deliberately external.
            const geo=firstMesh.geometry;
            const uv=[];
            for(let i=0;i<pos.count;i++){
                const u=(pos.getX(i)+450)/900*5;
                const v=(pos.getZ(i)+450)/900*5;
                uv.push(u,v);
            }
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
            if(!geo.attributes.normal) geo.computeVertexNormals();

            const texLoader=new THREE.TextureLoader();
            const albedo=texLoader.load('assets/terrain_albedo.jpg');
            const roughness=texLoader.load('assets/terrain_roughness.jpg');
            const normal=texLoader.load('assets/terrain_normal.jpg');
            albedo.encoding=THREE.sRGBEncoding;
            albedo.wrapS=albedo.wrapT=THREE.RepeatWrapping;
            roughness.wrapS=roughness.wrapT=THREE.RepeatWrapping;
            normal.wrapS=normal.wrapT=THREE.RepeatWrapping;
            const mat=new THREE.MeshStandardMaterial({
                map:albedo, roughnessMap:roughness, normalMap:normal,
                roughness:0.96, metalness:0.0, normalScale:new THREE.Vector2(0.55,0.55)
            });
            firstMesh.material=mat;
            firstMesh.castShadow=false; firstMesh.receiveShadow=true;
            externalTerrainModel=root;
            root.position.set(0,0,0); root.rotation.set(0,0,0); root.scale.set(1,1,1);
            scene.add(root);
            terrainMesh=firstMesh;
            console.log('External terrain + external textures loaded.');
        }, undefined, function(error) {
            console.error('Could not load external terrain:', error);
            // No fallback terrain is created.
        });
    }
