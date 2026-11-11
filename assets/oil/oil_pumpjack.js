/* Animated oil pumpjack asset for CONTROL BATTLE.
   Requires THREE.js to be loaded before this file. */
(function () {
  'use strict';
  if (!window.THREE) {
    console.error('Oil pumpjack: THREE.js must be loaded first.');
    return;
  }

  window.createAnimatedOilPump = function (targetGroup) {
    if (!targetGroup || targetGroup.getObjectByName('animatedOilPumpjack')) return null;

    const T = window.THREE;
    const root = new T.Group();
    root.name = 'animatedOilPumpjack';
    targetGroup.add(root);

    const steel = new T.MeshStandardMaterial({color:0x59636a, metalness:0.82, roughness:0.34});
    const darkSteel = new T.MeshStandardMaterial({color:0x252c30, metalness:0.78, roughness:0.42});
    const yellow = new T.MeshStandardMaterial({color:0xc59b35, metalness:0.62, roughness:0.38});
    const red = new T.MeshStandardMaterial({color:0x8e3025, metalness:0.48, roughness:0.46});
    const black = new T.MeshStandardMaterial({color:0x111719, metalness:0.2, roughness:0.88});
    const concrete = new T.MeshStandardMaterial({color:0x555953, metalness:0.08, roughness:0.94});

    function part(parent, geo, mat, x,y,z, rx=0,ry=0,rz=0) {
      const m = new T.Mesh(geo,mat);
      m.position.set(x,y,z); m.rotation.set(rx,ry,rz);
      m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    }
    function beamBetween(parent, a, b, radius, mat, sides=10) {
      const A = new T.Vector3(...a), B = new T.Vector3(...b);
      const d = new T.Vector3().subVectors(B,A);
      const m = part(parent,new T.CylinderGeometry(radius,radius,d.length(),sides),mat,
        (A.x+B.x)/2,(A.y+B.y)/2,(A.z+B.z)/2);
      m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());
      return m;
    }

    // Heavy steel skid and two raised A-frame supports.
    part(root,new T.BoxGeometry(8.2,.42,5.0),darkSteel,0,.35,0);
    part(root,new T.BoxGeometry(7.7,.16,4.6),concrete,0,.62,0);
    for (const z of [-1.45,1.45]) {
      beamBetween(root,[-2.35,.72,z],[0,5.55,z],.22,steel);
      beamBetween(root,[2.35,.72,z],[0,5.55,z],.22,steel);
      beamBetween(root,[-2.35,.72,z],[2.35,.72,z],.15,darkSteel);
      beamBetween(root,[-2.35,.72,z],[0,3.0,z],.105,yellow);
      beamBetween(root,[2.35,.72,z],[0,3.0,z],.105,yellow);
    }
    beamBetween(root,[0,3.2,-1.55],[0,3.2,1.55],.24,darkSteel);

    // Main rotating crank and counterweights.
    const crank = new T.Group(); crank.position.set(0,3.35,0); root.add(crank);
    for (const z of [-1.9,1.9]) {
      part(crank,new T.CylinderGeometry(1.08,1.08,.22,32),darkSteel,0,0,z,Math.PI/2);
      part(crank,new T.CylinderGeometry(.82,.82,.24,32),steel,0,0,z,Math.PI/2);
      part(crank,new T.CylinderGeometry(.18,.18,.32,20),yellow,0,0,z,Math.PI/2);
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4;
        part(crank,new T.BoxGeometry(.10,1.7,.12),steel,
          Math.cos(a)*.48,Math.sin(a)*.48,z,0,0,a);
      }
      part(crank,new T.BoxGeometry(.62,.82,.42),yellow,1.15,.15,z,0,0,-.2);
    }

    // Walking beam pivots above the A-frame.
    const beam = new T.Group(); beam.position.set(0,5.55,0); root.add(beam);
    part(beam,new T.BoxGeometry(10.2,.58,1.05),red,0,0,0);
    part(beam,new T.BoxGeometry(2.0,.76,1.35),darkSteel,-3.95,.05,0);
    part(beam,new T.BoxGeometry(1.35,.62,1.25),yellow,4.15,-.04,0);
    // Horse-head at the well side.
    part(beam,new T.BoxGeometry(.42,2.15,1.42),darkSteel,4.95,-.86,0,0,0,-.12);
    part(beam,new T.TorusGeometry(.58,.12,10,24,Math.PI),yellow,4.95,-1.72,0,0,0,Math.PI);
    // Polished bridle rods and polished polished pitman rods.
    const bridle = new T.Group(); bridle.position.set(4.92,-1.7,0); beam.add(bridle);
    beamBetween(beam,[-3.75,-.18,-.68],[-2.55,-2.1,-.68],.12,steel);
    beamBetween(beam,[-3.75,-.18,.68],[-2.55,-2.1,.68],.12,steel);

    // Walking beam horse-head stroke guide and polished vertical sucker rod.
    const rod = part(root,new T.CylinderGeometry(.075,.075,4.2,12),steel,4.95,2.2,0);
    const wellHead = new T.Group(); wellHead.position.set(4.95,.78,0); root.add(wellHead);
    part(wellHead,new T.BoxGeometry(1.6,.45,1.55),yellow,0,0,0);
    part(wellHead,new T.CylinderGeometry(.32,.32,.5,16),darkSteel,0,.4,0);
    part(wellHead,new T.CylinderGeometry(.12,.12,1.0,12),steel,0,.9,0);

    // Motor and belt housing on the rear side.
    part(root,new T.BoxGeometry(2.4,1.45,1.75),darkSteel,-2.9,1.55,2.0);
    part(root,new T.CylinderGeometry(.72,.72,.32,28),red,-2.9,1.55,3.0,Math.PI/2);
    part(root,new T.CylinderGeometry(.48,.48,.36,24),steel,-2.9,1.55,3.22,Math.PI/2);
    part(root,new T.BoxGeometry(1.2,.34,.45),yellow,-2.9,2.42,2.0);
    // Small service ladder and safety rail.
    for(let i=0;i<6;i++) part(root,new T.BoxGeometry(.9,.09,.10),yellow,-3.75,.95+i*.42,-2.05);
    beamBetween(root,[-4.15,1.0,-2.05],[-4.15,3.3,-2.05],.055,steel);
    beamBetween(root,[-3.35,1.0,-2.05],[-3.35,3.3,-2.05],.055,steel);

    // Pumpjack animation: slow, continuous nodding stroke.
    let phase = Math.random()*Math.PI*2;
    let last = performance.now();
    let alive = true;
    function tick(now) {
      if (!alive || !root.parent) return;
      const dt = Math.min(.05,(now-last)/1000); last=now;
      phase += dt*1.15;
      const swing = Math.sin(phase)*0.34;
      beam.rotation.z = swing;
      crank.rotation.z = phase;
      const rodY = 2.2 + Math.sin(phase)*.72;
      rod.position.y = rodY;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    root.userData.disposeOilPump = function(){ alive=false; };
    return root;
  };
})();