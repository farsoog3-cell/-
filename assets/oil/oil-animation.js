// External oil/flag animation controller. The game calls updateOilExternalAnimation(rig, dt).
function updateOilExternalAnimation(rig, dt){
  if(!rig || !rig.flagData || !rig.flagData.mesh) return;
  const flag=rig.flagData.mesh;
  const t=(performance.now()-((rig.flagData.waveStart||performance.now())))*0.0028;
  flag.rotation.z=Math.sin(t)*0.045;
  flag.rotation.y=Math.sin(t*0.72)*0.035;
  flag.position.y=(rig.flagData.baseHeight||9.15)+Math.sin(t*0.9)*0.035;
  if(rig.externalOilRoot){
    const pump=rig.externalOilRoot.getObjectByName('oil_pump_head');
    if(pump) pump.rotation.z=Math.sin(t*0.85)*0.055;
    const arm=rig.externalOilRoot.getObjectByName('oil_pump_arm');
    if(arm) arm.rotation.z=Math.sin(t*0.85)*0.055;
  }
}
