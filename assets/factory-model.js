/* مصنع الجيش الخارجي — يعتمد على كائنات Three.js ووظائف اللعبة المعرّفة في index.html.
   حافظ على تحميل هذا الملف بعد Three.js وقبل كود اللعبة الرئيسي. */

function createArmyFactory(x,z,ghost=false){
        // مصنع جيش جديد: حظيرة إنتاج كبيرة وباب شحن مرتفع، من نفس معسكر القيادة لكن بوظيفة مصنع واضحة.
        const group=new THREE.Group(); group.name='armyFactory_USAReference';
        const M=(c,r=.78,m=.12)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
        const concrete=M(0xb9bab3,.94,.04), wall=M(0xd0d2cc,.84,.08), panel=M(0xaeb3b0,.68,.30);
        const roof=M(0x59615f,.58,.68), dark=M(0x1e2523,.86,.28), steel=M(0x858d8a,.46,.76);
        const glass=M(0x243d3d,.26,.60), sand=M(0x81765a,.98,.02);
        const accentColor=group.userData.factoryOwner==='enemy'?(battleConfig.enemyColor||'#f43f5e'):(battleConfig.playerColor||'#168cff');
        const accent=new THREE.MeshStandardMaterial({color:accentColor,roughness:.58,metalness:.25}); accent.userData.teamAccent=true;
        const box=(w,h,d,mat,px,py,pz,ry=0)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(px,py,pz);o.rotation.y=ry;o.castShadow=true;o.receiveShadow=true;group.add(o);return o;};
        const cyl=(r,h,mat,px,py,pz,seg=18,rx=0,rz=0)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg),mat);o.position.set(px,py,pz);o.rotation.x=rx;o.rotation.z=rz;o.castShadow=true;o.receiveShadow=true;group.add(o);return o;};
        const line=(a,b,mat=steel)=>{const d=new THREE.Vector3().subVectors(b,a),len=d.length();const o=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,len,8),mat);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());group.add(o);return o;};

        // منصة المصنع.
        box(29,.34,24,concrete,0,.18,0);
        box(27.5,.16,22.5,dark,0,.42,0);

        // قاعة الإنتاج الرئيسية: أعرض وأعلى من الثكنة.
        box(18.5,5.4,10.0,wall,0,3.25,-.4);
        box(19.0,.32,10.5,panel,0,6.08,-.4);
        box(18.2,.22,10.0,roof,0,6.35,-.4);

        // حواف معدنية وألواح سقف متكررة.
        for(let px=-7.5;px<=7.5;px+=2.5){
            box(.14,.34,9.5,steel,px,6.52,-.4);
        }
        box(19.2,.22,.30,steel,0,6.48,-5.42);
        box(19.2,.22,.30,steel,0,6.48,4.62);

        // باب المصنع الكبير جداً: فتحة إنتاج وشحن واضحة.
        const doorL=box(4.35,5.55,.34,dark,-4.5,3.15,4.72);
        const doorR=box(4.35,5.55,.34,dark,4.5,3.15,4.72);
        doorL.name='factoryDoorLeft'; doorR.name='factoryDoorRight';
        const innerL=box(3.82,4.85,.10,glass,-4.5,3.15,4.91);
        const innerR=box(3.82,4.85,.10,glass,4.5,3.15,4.91);
        innerL.name='factoryDoorInnerLeft'; innerR.name='factoryDoorInnerRight';
        box(10.5,.34,.48,steel,0,6.05,4.72);
        for(const px of [-9.6,9.6]) box(.34,6.1,.58,steel,px,3.15,4.67);

        // شرائط تعريف بلون الفصيل حول باب الإنتاج.
        box(17.8,.20,.14,accent,0,5.72,5.08);
        box(2.0,.16,.14,accent,-7.0,5.52,5.10);
        box(2.0,.16,.14,accent,7.0,5.52,5.10);

        // شبابيك مراقبة وإدارة على الجانبين.
        for(const px of [-7.7,-5.4,5.4,7.7]){
            box(1.45,1.20,.12,glass,px,3.55,-5.48);
            box(1.55,.10,.14,steel,px,4.20,-5.50);
            box(1.55,.10,.14,accent,px,2.88,-5.50);
        }

        // جناح صيانة جانبي — يميز المصنع عن المعسكر.
        for(const px of [-12.0,12.0]){
            box(4.6,3.15,7.0,wall,px,2.12,-.3);
            box(4.8,.28,7.3,roof,px,3.86,-.3);
            box(3.0,2.0,.14,glass,px,2.65,3.28);
            box(3.2,.12,.14,accent,px,3.68,3.31);
        }

        // خزانات خدمة ووقود بجانب المصنع.
        for(let i=0;i<3;i++){
            const px=8.4+i*1.65;
            cyl(.92,2.45,panel,px,1.65,7.0,20);
            cyl(.98,.12,dark,px,2.91,7.0,20);
            cyl(.12,.22,accent,px,3.06,7.0,10);
        }
        const tank=new THREE.Mesh(new THREE.CylinderGeometry(2.15,2.15,5.4,24),panel);
        tank.rotation.z=Math.PI/2; tank.position.set(-9.3,2.15,7.0); group.add(tank);
        for(let px=-11.4;px<=-7.2;px+=1.4){
            const ring=new THREE.Mesh(new THREE.TorusGeometry(2.16,.10,10,24),dark);
            ring.rotation.y=Math.PI/2; ring.position.set(px,2.15,7.0); group.add(ring);
        }
        // شعار فصيل على الخزان.
        const starShape=new THREE.Shape();
        for(let i=0;i<10;i++){const r=i%2?.48:1.05,a=-Math.PI/2+i*Math.PI/5,xx=Math.cos(a)*r,yy=Math.sin(a)*r;i?starShape.lineTo(xx,yy):starShape.moveTo(xx,yy);}
        starShape.closePath();
        const starMat=new THREE.MeshBasicMaterial({color:0x8f9795,side:THREE.DoubleSide});starMat.userData={teamAccent:true};const star=new THREE.Mesh(new THREE.ShapeGeometry(starShape),starMat);star.name='factoryFactionMark';
        star.rotation.y=Math.PI/2; star.position.set(-12.08,2.15,7.0); group.add(star);

        // برج اتصالات وخدمة صغير فقط — المصنع لا يحتوي على رادار.
        const tx=-10.5,tz=-7.0;
        for(const [dx,dz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
            line(new THREE.Vector3(tx+dx,.55,tz+dz),new THREE.Vector3(tx+dx*.45,6.6,tz+dz*.45),steel);
        }
        for(let yy=1.8;yy<6.4;yy+=1.25){
            const s=.95-(yy-.55)/6.0*.35;
            line(new THREE.Vector3(tx-s,yy,tz-s),new THREE.Vector3(tx+s,yy,tz+s),dark);
            line(new THREE.Vector3(tx+s,yy,tz-s),new THREE.Vector3(tx-s,yy,tz+s),dark);
        }
        cyl(.08,2.8,steel,tx,7.7,tz,8);
        const comm=new THREE.Group(); comm.name='factoryComms'; comm.position.set(tx,8.9,tz); group.add(comm);
        const commPanel=new THREE.Mesh(new THREE.BoxGeometry(1.25,.55,.18),accent); commPanel.position.set(0,0,.35); comm.add(commPanel);
        const beacon=new THREE.Mesh(new THREE.SphereGeometry(.10,10,8),new THREE.MeshStandardMaterial({color:0x9ca3af,emissive:0x1f2937,emissiveIntensity:.45})); beacon.position.y=.45; comm.add(beacon);

        // رافعة تحميل داخلية/خارجية، تعطي إحساس المصنع الحقيقي.
        box(10.5,.20,.20,steel,0,5.65,-4.65);
        for(const px of [-5.0,5.0]){ line(new THREE.Vector3(px,5.65,-4.65),new THREE.Vector3(px,1.1,-4.65),steel); box(1.2,.18,.18,accent,px,1.0,-4.65); }

        // سلالم خدمة وصناديق وقطع غيار.
        for(const px of [-13.2,13.2]){
            for(let i=0;i<4;i++) box(2.0,.16,.70,concrete,px,.60+i*.12,4.9-i*.70);
        }
        for(let i=0;i<5;i++) box(1.1,.85,.9,sand,-5.0+i*1.1,1.0,8.5);
        for(let i=0;i<4;i++) box(1.0,.9,1.0,panel,5.2+i*.95,1.05,8.5);

        // أعلام المصنع.
        const factoryFlagTeam=ghost?(typeof playerFlagType==='string'?playerFlagType:(battleConfig.playerColor||'#168cff')):((group.userData.factoryOwner==='enemy')?(typeof enemyFlagType==='string'?enemyFlagType:(battleConfig.enemyColor||'#f43f5e')):(typeof playerFlagType==='string'?playerFlagType:(battleConfig.playerColor||'#168cff')));
        const makeFlag=(px,pz,h,scale=1)=>{
            const pole=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,h,10),steel);pole.position.set(px,h/2,pz);group.add(pole);
            const fm=new THREE.MeshStandardMaterial({map:createFlagTexture(factoryFlagTeam),side:THREE.DoubleSide,transparent:true,roughness:.68,metalness:.02});
            const cloth=new THREE.Mesh(new THREE.PlaneGeometry(2.2*scale,1.25*scale,10,4),fm);cloth.position.set(px+1.05*scale,h-.62*scale,pz);cloth.name='factoryFlag';group.add(cloth);return cloth;
        };
        const factoryFlagMesh=makeFlag(-6.8,8.2,6.6,.9);
        const factoryFlagData={mesh:factoryFlagMesh,baseHeight:6.6,type:factoryFlagTeam,factoryFlag:true,owner:(group.userData.factoryOwner||'player')};
        activeFlagMeshes.push(factoryFlagData); group.userData.factoryFlagData=factoryFlagData;

        const groundY=getBuildingGroundLevel(x,z,'factory',factoryPlacementRotation); group.position.set(x,groundY+.03,z);
        group.scale.setScalar(ghost?.95:.08); group.rotation.y=factoryPlacementRotation;
        if(ghost) group.traverse(o=>{if(o.material){o.material.transparent=true;o.material.opacity=.30;o.material.depthWrite=false;o.material.emissive?.setHex(0x173b20);o.material.emissiveIntensity=.5;}});
        scene.add(group);

        if(!ghost){
            const hpLabel=document.createElement('div'); hpLabel.className='hp-structure factory '+(group.userData.factoryOwner==='enemy'?'enemy':'player');
            const hpFill=document.createElement('div'); hpFill.className='structure-hp-fill'; hpLabel.appendChild(hpFill);
            document.getElementById('hp-labels-container').appendChild(hpLabel); group.userData.hpLabel=hpLabel;group.userData.hpFill=hpFill;
        }
        return {mesh:group,x,z,progress:0,duration:REAL_BUILD_FACTORY_SEC*REAL_TICKS_PER_SECOND,done:!ghost,ghost,rotation:factoryPlacementRotation,door:doorL,doorInner:innerL,doorRight:doorR,doorInnerRight:innerR,owner:(group.userData.factoryOwner||'player'),hp:1600,maxHp:1600,isDestroyed:false,hpRevealUntil:0,collisionRadius:14,isFactory:true,...(!ghost?{hpLabel:group.userData.hpLabel,hpFill:group.userData.hpFill}:{})};
    }

function animateFactoryDoors(factory, duration=3200){
        if(!factory || !factory.mesh) return;
        const doorNames=['factoryDoorLeft','factoryDoorRight','factoryDoorInnerLeft','factoryDoorInnerRight'];
        const doors=doorNames.map(n=>factory.mesh.getObjectByName(n)).filter(Boolean);
        doors.forEach(d=>{
            if(d.userData.factoryDoorOriginalX===undefined) d.userData.factoryDoorOriginalX=d.position.x;
            const side=d.name.includes('Left')?-1:1;
            const distance=d.name.includes('Inner')?3.25:3.9;
            d.position.x=d.userData.factoryDoorOriginalX + side*distance;
        });
        factory._doorsOpenUntil=performance.now()+duration;
        clearTimeout(factory._doorCloseTimer);
        factory._doorCloseTimer=setTimeout(()=>{
            doors.forEach(d=>{ if(d.userData.factoryDoorOriginalX!==undefined) d.position.x=d.userData.factoryDoorOriginalX; });
        },duration);
    }
