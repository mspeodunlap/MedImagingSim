import assert from "node:assert/strict";
import { test } from "node:test";
import { acquireMr, defaultPlan, planFromAcquisition, presets, readPlan, tissueProperties } from "../src/mr.js";
import { fatWaterHz, samplingMetrics, tissueSignal, timingError } from "../public/mr-physics.js";
import { echoWeight, filterPhase } from "../src/mr-reconstruction.js";
import { validateProtocol } from "../src/protocols.js";

const close = (a,b,tolerance=1e-9) => assert.ok(Math.abs(a-b)<tolerance, `${a} differs from ${b}`);
const form = p => new URLSearchParams(Object.entries(p).filter(([,v])=>v!=null));

test("SE recovery and full-TE decay obey the analytic tissue equation, independent of preset name", () => {
  const tissue={density:0.8,t1:1000,t2:100,t2Star:50};
  const signal=p=>tissueSignal({...defaultPlan,...p},tissue);
  close(signal({tr:1000,te:100}),255*0.8*(1-Math.exp(-1))*Math.exp(-1));
  close(signal({tr:1000,te:150})/signal({tr:1000,te:50}),Math.exp(-1));
  close(signal({preset:'t1',tr:1000,te:100}),signal({preset:'pd',tr:1000,te:100}));
  assert.ok(signal({tr:2000})>signal({tr:500}));
});

test("GRE follows T2-star and has a tissue-specific Ernst maximum rather than monotonic flip gain", () => {
  const tissue={density:1,t1:1000,t2:100,t2Star:40};
  const p={...defaultPlan,...presets.gre,preset:'gre'};
  const ernst=Math.acos(Math.exp(-p.tr/tissue.t1))*180/Math.PI;
  const best=tissueSignal({...p,flip:ernst},tissue);
  assert.ok(best>tissueSignal({...p,flip:1},tissue));
  assert.ok(best>tissueSignal({...p,flip:90},tissue));
  close(tissueSignal({...p,te:p.te+40},tissue)/tissueSignal(p,tissue),Math.exp(-1));
});

test("IR keeps the sign until complex partial-volume/magnitude reconstruction and shifts its null with TR", () => {
  const tissue=tissueProperties[3], p={...defaultPlan,...presets.ir,preset:'ir'};
  const nullTi=tr=>-tissue.t1*Math.log((1+Math.exp(-tr/tissue.t1))/2);
  close(tissueSignal({...p,ti:nullTi(p.tr)},tissue),0,1e-10);
  assert.ok(tissueSignal({...p,ti:nullTi(p.tr)-200},tissue)<0);
  assert.ok(tissueSignal({...p,ti:nullTi(p.tr)+200},tissue)>0);
  assert.ok(nullTi(4000)<nullTi(8500));
});

test("sampling SNR uses voxel volume and acquisition time with consistent Hz/pixel bandwidth", () => {
  const m=p=>samplingMetrics({...defaultPlan,...p});
  close(m({}).relativeSamplingSnr,1);
  close(m({thickness:10}).relativeSamplingSnr,2);
  close(m({fov:110}).relativeSamplingSnr,0.25);
  close(m({matrix:64,phaseMatrix:128}).relativeSamplingSnr,2);
  close(m({phaseMatrix:64}).relativeSamplingSnr,Math.sqrt(2));
  close(m({averages:4}).relativeSamplingSnr,2);
  close(m({bandwidth:500}).relativeSamplingSnr,1/Math.sqrt(2));
  close(m({phaseFov:50}).relativeSamplingSnr,0.5);
  close(m({oversampling:100}).relativeSamplingSnr,Math.sqrt(2));
  close(m({acquisition:'3D',slices:16,gap:0}).relativeSamplingSnr,4);
  close(m({bandwidth:100}).readoutMs,10);
  close(m({bandwidth:100}).chemicalShiftPixels,fatWaterHz/100);
  close(m({bandwidth:200}).chemicalShiftPixels*2,m({bandwidth:100}).chemicalShiftPixels);
});

test("scan time distinguishes phase lines, readout samples, multislice packages and 3D partitions", () => {
  const p={...defaultPlan,phaseMatrix:64,slices:1}; const m=over=>samplingMetrics({...p,...over});
  close(m({matrix:64}).durationSeconds,m({matrix:128}).durationSeconds);
  close(m({phaseMatrix:128}).durationSeconds,2*m({}).durationSeconds);
  close(m({averages:4}).durationSeconds,4*m({}).durationSeconds);
  close(m({oversampling:100}).durationSeconds,2*m({}).durationSeconds);
  const short={...p,...presets.gre,preset:'gre',slices:24};
  assert.ok(samplingMetrics(short).packages>1);
  const volume=samplingMetrics({...short,acquisition:'3D',gap:0});
  close(volume.durationSeconds,short.tr/1000*64*24);
  assert.equal(volume.packages,1);
});

test("readout, preparation, echo spacing and train duration dependencies are enforced for submitted plans", () => {
  const p={...defaultPlan,...presets.tse,preset:'tse'};
  assert.ok(readPlan(form(p)));
  assert.equal(readPlan(form({...defaultPlan,bandwidth:80,te:12})),null);
  assert.ok(readPlan(form({...defaultPlan,bandwidth:80,te:20})));
  assert.equal(readPlan(form({...p,bandwidth:80})),null);
  assert.ok(readPlan(form({...p,bandwidth:80,echoSpacing:20})));
  assert.equal(readPlan(form({...p,tr:250,echoTrain:32,echoSpacing:10})),null);
  assert.equal(readPlan(form({...p,te:10,echoSpacing:20})),null);
  assert.equal(readPlan(form({...defaultPlan,...presets.ir,preset:'ir',tr:2300,ti:2200,te:100})),null);
  assert.match(timingError({...p,bandwidth:80}),/Echo spacing/);
  const duplicated=form(p);duplicated.append('echoSpacing','20'); assert.equal(readPlan(duplicated),null);
});

test("echo modulation preserves DC and attenuates phase frequencies by the predicted tissue T2 factor", () => {
  for(const n of [64,96,128,137]) for(const horizontal of [false,true]) {
    const rows=horizontal?2:n,columns=horizontal?n:2,k=7,t2=75,train=8,spacing=10;
    const pixels=Float64Array.from({length:rows*columns},(_,i)=>10+Math.cos(2*Math.PI*k*(horizontal?i%columns:Math.floor(i/columns))/n));
    filterPhase(pixels,rows,columns,horizontal,train,spacing,t2);
    const weight=echoWeight(k,n,train,spacing,t2);
    for(let i=0;i<pixels.length;i++)close(pixels[i],10+weight*Math.cos(2*Math.PI*k*(horizontal?i%columns:Math.floor(i/columns))/n),1e-9);
  }
  assert.ok(echoWeight(40,128,16,20,75)<echoWeight(40,128,4,10,75));
});

function cornerPower(scan) {
  const {rows,columns}=scan.geometry;let total=0,count=0;
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++)
    if((row<16||row>=rows-16)&&(col<16||col>=columns-16)){total+=scan.pixels[row*columns+col]**2;count++;}
  return total/count;
}
test("rendered magnitude noise has a Rayleigh floor and responds quantitatively to averages and thickness", () => {
  const p={...defaultPlan,slices:1,fov:260,offset:0};
  const base=acquireMr(p),averaged=acquireMr({...p,averages:4}),thick=acquireMr({...p,thickness:10});
  const expected=2*base.parameters.physics.noiseSigma**2;
  assert.ok(Math.abs(cornerPower(base)/expected-1)<0.12);
  assert.ok(Math.abs(cornerPower(base)/cornerPower(averaged)-4)<0.35);
  assert.ok(Math.abs(cornerPower(base)/cornerPower(thick)-4)<0.35);
  assert.ok(cornerPower(base)>0);
});

test("FSE train and echo spacing change acquired image detail, not only metadata/time", () => {
  const p={...defaultPlan,...presets.tse,preset:'tse',slices:1,offset:22};
  const a=acquireMr({...p,echoTrain:4}),b=acquireMr({...p,echoTrain:16}),c=acquireMr({...p,echoTrain:16,echoSpacing:20});
  assert.notDeepEqual(a.pixels,b.pixels);assert.notDeepEqual(b.pixels,c.pixels);
  assert.ok(a.parameters.durationSeconds>b.parameters.durationSeconds);
  const roughness=scan=>{let sum=0;for(let r=1;r<128;r++)for(let col=20;col<108;col++)sum+=(scan.pixels[r*128+col]-scan.pixels[(r-1)*128+col])**2;return sum;};
  assert.ok(roughness(a)>roughness(b));assert.ok(roughness(b)>roughness(c));
});

test("legacy FSE plans gain a documented read-time spacing without rewriting saved definitions or image metadata", () => {
  const old={...defaultPlan,...presets.tse,preset:'tse'};delete old.echoSpacing;
  const source={sequences:[{name:'Older FSE',plan:old}]},original=JSON.stringify(source);
  const valid=validateProtocol(source);assert.equal(valid.sequences[0].plan.echoSpacing,10);assert.equal(JSON.stringify(source),original);
  const record={geometry:'{}',parameters:JSON.stringify(old)};
  assert.equal(planFromAcquisition(record).echoSpacing,10);assert.equal(record.parameters,JSON.stringify(old));
  const scan=acquireMr(valid.sequences[0].plan);
  assert.equal(scan.engineVersion,'analytic-mr-v3');assert.equal(scan.parameters.physics.version,scan.engineVersion);
});

test("fat displacement changes rendered images along readout and rotates when phase/readout are exchanged", () => {
  const centroid=scan=>{let mass=0,x=0,y=0;for(let row=0;row<128;row++)for(let col=0;col<128;col++){
    const w=Math.max(0,scan.pixels[row*128+col]-20);mass+=w;x+=w*col;y+=w*row;
  }return [x/mass,y/mass];};
  for(const phaseDirection of ['vertical','horizontal']){
    const p={...defaultPlan,slices:1,fov:260,offset:0,te:30,phaseDirection};
    // Matched BW/NSA keeps the identical complex noise realization and amplitude.
    const narrow=acquireMr({...p,bandwidth:250,averages:1}),wide=acquireMr({...p,bandwidth:500,averages:2});
    const a=centroid(narrow),b=centroid(wide),readoutAxis=phaseDirection==='vertical'?0:1;
    assert.ok(a[readoutAxis]-b[readoutAxis]>0.05);
    assert.ok(Math.abs(a[1-readoutAxis]-b[1-readoutAxis])<0.01);
    close(narrow.parameters.physics.noiseSigma,wide.parameters.physics.noiseSigma);
  }
});
