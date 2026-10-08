// External oil/flag animation. The game owns placement and capture logic.
window.animateExternalOilRig=function(rig,now){
 if(!rig) return;
 const root=rig.externalOilRoot;
 if(root){ const beam=root.getObjectByName('pump_beam')||root.getObjectByName('oil_beam'); if(beam) beam.rotation.z=Math.sin(now*.0022)*.16; const rod=root.getObjectByName('pump_rod'); if(rod) rod.position.y=2.55+Math.sin(now*.0022)*.55; }
 const flag=rig.flagData&&rig.flagData.mesh; if(flag){ const base=rig.flagData.baseHeight||flag.position.y; flag.rotation.y=Math.sin(now*.003)*.10; flag.position.y=base+Math.sin(now*.003)*.06; }
};
