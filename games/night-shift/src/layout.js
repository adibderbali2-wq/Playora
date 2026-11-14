// St. Aldric Memorial Hospital — floor plan + set dressing.
// Grid cells are 3 m. Ground floor occupies rows 0-12, the sub-level lab rows 16-22.
import * as P from './props.js';
import { CEIL } from './level.js';
import { rng, rr, setSeed } from './textures.js';

export const LAYOUT = {
  W: 17, H: 23,
  rooms: {
    r101: { zone: 'patient', rects: [[0, 0, 3, 3]], name: 'Room 101' },
    r102: { zone: 'patient', rects: [[3, 0, 3, 3]], name: 'Room 102' },
    r103: { zone: 'patient', rects: [[6, 0, 3, 3]], name: 'Room 103' },
    nurse: { zone: 'office', rects: [[9, 0, 3, 3]], name: 'Nurse Station' },
    wardCorr: { zone: 'corridor', rects: [[0, 3, 12, 1]], name: 'Ward B Corridor' },
    lobby: { zone: 'lobby', rects: [[12, 0, 5, 6]], name: 'Reception' },
    security: { zone: 'office', rects: [[14, 6, 3, 2]], name: 'Security Office' },
    corr2: { zone: 'clinicCorr', rects: [[13, 6, 1, 6], [0, 12, 14, 1]], name: 'East Wing' },
    storA: { zone: 'storage', rects: [[11, 6, 2, 2]], name: 'Supply Room' },
    or1: { zone: 'surgery', rects: [[14, 8, 3, 3]], name: 'Operating Room 1' },
    or2: { zone: 'surgery', rects: [[10, 8, 3, 3]], name: 'Operating Room 2' },
    er: { zone: 'er', rects: [[2, 7, 6, 5]], name: 'Emergency Department' },
    storB: { zone: 'storage', rects: [[8, 9, 2, 3]], name: 'Linen Store' },
    labA: { zone: 'lab', rects: [[0, 16, 3, 3]], name: 'Lab A — Pathology' },
    labB: { zone: 'lab', rects: [[3, 16, 4, 3]], name: 'Lab B — Virology' },
    archive: { zone: 'office', rects: [[7, 16, 3, 3]], name: 'Records Archive' },
    gen: { zone: 'generator', rects: [[10, 16, 4, 3]], name: 'Generator Room' },
    labCorr: { zone: 'labCorr', rects: [[0, 19, 14, 1]], name: 'Sub-Level B2' },
    cold: { zone: 'storage', rects: [[0, 20, 4, 3]], name: 'Cold Storage' },
    contain: { zone: 'containment', rects: [[5, 20, 8, 3]], name: 'Containment Hall' },
  },
  zoneFloor: { patient: 'floorWard', corridor: 'floorWard', office: 'floorWard', lobby: 'floorLobby', clinicCorr: 'floorClinic', storage: 'floorConcrete', surgery: 'floorClinic', er: 'floorClinic', lab: 'floorLab', labCorr: 'floorLab', generator: 'floorConcrete', containment: 'floorConcrete' },
  zoneWall: { patient: 'wallWard', corridor: 'wallWard', office: 'wallOffice', lobby: 'wallLobby', clinicCorr: 'wallClinic', storage: 'wallStorage', surgery: 'wallClinicBlood', er: 'wallClinic', lab: 'wallLab', labCorr: 'wallLab', generator: 'wallStorage', containment: 'wallStorage' },
  doors: [
    { id: 'd101', cell: [1, 2], side: 'S', type: 'wood', label: 'Room 101' },
    { id: 'd102', cell: [4, 2], side: 'S', type: 'wood', label: 'Room 102' },
    { id: 'd103', cell: [7, 2], side: 'S', type: 'wood', label: 'Room 103' },
    { id: 'nurseGap', cell: [10, 2], side: 'S', type: 'opening' },
    { id: 'ward', cell: [11, 3], side: 'E', type: 'double', key: 'wardKey', label: 'Ward B Exit' },
    { id: 'main', cell: [16, 3], side: 'E', type: 'double', sealed: true, chained: true, label: 'Main Entrance' },
    { id: 'security', cell: [15, 6], side: 'N', type: 'wood', label: 'Security Office' },
    { id: 'south', cell: [13, 6], side: 'N', type: 'metal', key: 'securityKey', label: 'East Wing' },
    { id: 'storA', cell: [12, 7], side: 'E', type: 'wood', label: 'Supply Room' },
    { id: 'or1', cell: [14, 9], side: 'W', type: 'double', label: 'Operating Room 1' },
    { id: 'or2', cell: [12, 9], side: 'E', type: 'double', label: 'Operating Room 2' },
    { id: 'er', cell: [5, 11], side: 'S', type: 'double', key: 'redCard', label: 'Emergency Department' },
    { id: 'storB', cell: [8, 11], side: 'S', type: 'wood', label: 'Linen Store' },
    { id: 'stairs', cell: [0, 12], side: 'W', type: 'metal', key: 'basementKey', label: 'Stairwell B' },
    { id: 'labA', cell: [1, 18], side: 'S', type: 'metal', label: 'Lab A' },
    { id: 'labB', cell: [5, 18], side: 'S', type: 'metal', label: 'Lab B' },
    { id: 'archive', cell: [8, 18], side: 'S', type: 'wood', label: 'Records Archive' },
    { id: 'gen', cell: [11, 18], side: 'S', type: 'metal', label: 'Generator Room' },
    { id: 'cold', cell: [2, 20], side: 'N', type: 'metal', label: 'Cold Storage' },
    { id: 'contain', cell: [9, 20], side: 'N', type: 'double', sealed: true, label: 'Containment Hall' },
    { id: 'labStairs', cell: [0, 19], side: 'W', type: 'metal', sealed: true, label: 'Stairwell B' },
    { id: 'exit', cell: [13, 19], side: 'E', type: 'exit', key: 'power', label: 'Emergency Exit' },
  ],
  windows: [
    [1, 0, 'N'], [4, 0, 'N'], [7, 0, 'N'], [10, 0, 'N'], [12, 0, 'N'], [14, 0, 'N'], [16, 0, 'N'],
    [16, 1, 'E'], [16, 5, 'E'], [16, 9, 'E'], [2, 8, 'W'], [2, 10, 'W'], [16, 7, 'E'],
  ],
  wallOverrides: [
    [5, 3, 'S', 'wallWardMsg'], [2, 3, 'S', 'wallWardBlood'], [8, 3, 'N', 'wallWardBlood'], [4, 1, 'E', 'wallWardBlood'],
    [12, 2, 'W', 'wallLobbyMsg'], [3, 12, 'S', 'wallClinicBlood'], [9, 12, 'S', 'wallClinicBlood'],
    [7, 19, 'S', 'wallLabMsg'], [13, 9, 'E', 'wallClinicBlood'],
  ],
};

const C = (x) => (x + 0.5) * 3; // cell centre helper

export function dress(world, M) {
  setSeed(9001);
  const b = world.b;
  const F = (x, z, opts) => world.addFixture(x, z, opts);

  /* --------------------------------------------------- Room 101 (start) */
  b.at(2.2, 3.4, 0); P.bed(b, M, { messy: true });
  b.at(0.65, 1.3, 0); P.bedside(b, M);
  b.at(3.6, 1.4, 0); P.ivStand(b, M);
  b.at(7.0, 3.4, 0); P.bed(b, M, { bloody: true, body: true });
  b.at(8.3, 1.3, 0); P.bedside(b, M);
  b.at(4.6, 4.2, 0); P.curtain(b, M, 3.5, CEIL, 0.5);
  b.at(6.8, 7.4, 2.2); P.wheelchair(b, M, true);
  b.at(1.2, 7.8, 0.3); P.chair(b, M, true);
  b.at(5, 6.5); P.debris(b, M, 6, 1.6); P.papers(b, M, 5, 1.2);
  P.bloodDecal(b, M, 6.4, 5.4, 1.4, 'pool'); P.bloodDecal(b, M, 5.2, 7.2, 1.0, 'trail', 0.6);
  F(4.5, 4.5, { state: 'dead' });

  /* -------------------------------------------------------- Room 102 */
  b.at(11.2, 3.2, 0); P.bed(b, M, { bloody: true });
  b.at(9.65, 1.2, 0); P.bedside(b, M);
  b.at(16.2, 3.2, 0); P.bed(b, M, { body: true, bloody: true });
  b.at(17.4, 1.2, 0); P.bedside(b, M);
  b.at(16.2, 7.5, Math.PI / 2); P.gurney(b, M, { body: true });
  b.at(10.4, 7.6, 0); P.ivStand(b, M, true);
  b.at(13.5, 6.4); P.debris(b, M, 7, 1.5);
  P.bloodDecal(b, M, 13.8, 6.0, 1.8, 'pool'); P.bloodDecal(b, M, 12.6, 7.4, 1.0, 'splat');
  F(13.5, 4.5, { state: 'flicker', intensity: 6 });

  /* -------------------------------------------------------- Room 103 */
  b.at(20.2, 3.2, 0); P.bed(b, M, {});
  b.at(18.65, 1.2, 0); P.bedside(b, M);
  b.at(25.5, 2.0, Math.PI); P.desk(b, M, { w: 1.6, monitor: false });
  b.at(25.4, 3.2, Math.PI); P.chair(b, M);
  b.at(26.3, 7.0, -Math.PI / 2); P.shelfRack(b, M, { w: 1.6, d: 0.45, h: 1.8, fill: 0.7 });
  b.at(21.5, 7.3, 0.7); P.wheelchair(b, M, false);
  b.at(22.5, 5.5); P.papers(b, M, 8, 1.6);
  P.bloodDecal(b, M, 20.3, 5.4, 1.2, 'trail', 1.4);
  F(22.5, 4.5, { state: 'on', intensity: 4, kind: 'bulb', color: 0xffc68a, range: 8 });

  /* ---------------------------------------------------- Nurse station */
  b.at(31.5, 4.4, 0); P.receptionDesk(b, M);
  b.at(28.0, 0.6, 0); P.filingCabinet(b, M, true);
  b.at(28.6, 0.6, 0); P.filingCabinet(b, M);
  b.at(35.4, 2.2, -Math.PI / 2); P.shelfRack(b, M, { w: 2.4, d: 0.45, h: 2, fill: 1.2 });
  b.at(28.4, 6.8, 0.4); P.chair(b, M, true);
  b.at(34.5, 7.2, 0); P.monitorCart(b, M, false);
  b.at(30, 7); P.papers(b, M, 10, 1.6); P.debris(b, M, 5, 1);
  F(31.5, 4.5, { state: 'flicker', intensity: 7 });

  /* ---------------------------------------------------- Ward corridor */
  const wz = 10.5;
  b.at(1.2, 10.5, Math.PI / 2 + 0.2); P.bed(b, M, { messy: true }); // barricade at dead end
  b.at(0.9, 9.6, 0.4); P.chair(b, M, true);
  b.at(1.8, 11.4, 1.3); P.wheelchair(b, M, true);
  b.at(8.5, 11.5, Math.PI / 2); P.gurney(b, M, { body: true });
  b.at(14.5, 9.45, 0); P.waitingChairs(b, M, 3);
  b.at(19.5, 11.6, Math.PI / 2); P.gurney(b, M, {});
  b.at(26.8, 11.55, 0); P.wheelchair(b, M, false);
  b.at(29.5, 9.55, 0); P.vending(b, M);
  b.at(33.5, 11.6, 0); P.trashBin(b, M, true);
  b.at(22.4, 9.5, 0); P.extinguisher(b, M);
  for (let x = 3; x < 36; x += 4.5) { b.at(x + rr(-1, 1), wz + rr(-0.6, 0.6)); P.debris(b, M, 3, 0.8); }
  P.bloodDecal(b, M, 10.5, 10.4, 1.2, 'trail', Math.PI / 2); P.bloodDecal(b, M, 12.6, 10.6, 1.2, 'trail', Math.PI / 2 + 0.2);
  P.bloodDecal(b, M, 23.5, 10.2, 1.5, 'pool');
  F(4.5, wz, { state: 'dead' }); F(10.5, wz, { state: 'flicker' }); F(16.5, wz, { state: 'dead', hang: true });
  F(22.5, wz, { state: 'on', intensity: 6 }); F(28.5, wz, { state: 'dead' }); F(34.5, wz, { state: 'flicker' });

  /* ------------------------------------------------------- Reception */
  b.at(42.5, 7.2, Math.PI); P.receptionDesk(b, M);
  b.at(46.5, 12.6, Math.PI); P.waitingChairs(b, M, 5, 2);
  b.at(46.5, 14.4, 0); P.waitingChairs(b, M, 5);
  b.at(49.5, 16.6, Math.PI / 2 + 0.3); P.waitingChairs(b, M, 3, 0);
  b.at(37.0, 0.8, 0); P.deadPlant(b, M); b.at(50.2, 0.8, 0); P.deadPlant(b, M);
  b.at(37.2, 16.8, 0); P.vending(b, M);
  b.at(49.8, 4.5, 0.5); P.wheelchair(b, M, false);
  b.at(38.5, 12.5, 0.6); P.gurney(b, M, { bloody: true });
  b.at(44, 3); P.papers(b, M, 12, 2.5); b.at(41, 14); P.debris(b, M, 10, 2.5);
  P.bloodDecal(b, M, 41.0, 9.4, 2.0, 'pool'); P.bloodDecal(b, M, 44.5, 10.4, 1.4, 'trail', 1.2);
  P.bloodDecal(b, M, 48.5, 9.0, 1.4, 'splat');
  F(39, 3, { state: 'dead' }); F(45, 3, { state: 'flicker', intensity: 8 }); F(42, 9.5, { state: 'dead', hang: true });
  F(48, 9.5, { state: 'on', intensity: 5 }); F(42, 15, { state: 'flicker' }); F(48, 15, { state: 'dead' });

  /* -------------------------------------------------- Security office */
  b.at(44.5, 20.3, Math.PI); P.desk(b, M, { w: 2.0 });
  b.at(44.5, 19.6, Math.PI); P.crt(b, M, -0.5, 0.78, 0, 0, true); P.crt(b, M, 0.4, 0.78, 0, 0, true);
  b.at(44.5, 21.5, 0.4); P.chair(b, M);
  b.at(50.4, 19.4, -Math.PI / 2); P.filingCabinet(b, M);
  b.at(50.4, 20.0, -Math.PI / 2); P.filingCabinet(b, M, true);
  b.at(49.5, 23.3, Math.PI); P.shelfRack(b, M, { w: 2, h: 2 });
  b.at(47, 22); P.papers(b, M, 8, 1.4);
  P.bloodDecal(b, M, 47.5, 21.5, 1.3, 'pool');
  F(46.5, 21, { state: 'flicker', intensity: 6 });

  /* ------------------------------------------------- Supply room (A) */
  b.at(34.0, 19.0, 0); P.shelfRack(b, M, { w: 2.2, fill: 1.3 });
  b.at(37.6, 19.0, 0); P.shelfRack(b, M, { w: 2.2, fill: 1.3 });
  b.at(33.6, 22.5, Math.PI / 2); P.shelfRack(b, M, { w: 2.4, fill: 1 });
  b.at(36.5, 22.5); P.debris(b, M, 8, 1);
  F(36, 21, { state: 'on', kind: 'bulb', intensity: 3.5, range: 7, color: 0xffb070 });

  /* ------------------------------------------------- East wing corridors */
  b.at(41.4, 25.0, Math.PI / 2); P.gurney(b, M, {});
  b.at(39.7, 31.5, 0.3); P.wheelchair(b, M, true);
  b.at(41.3, 34.5, 0); P.extinguisher(b, M);
  for (let z = 20; z < 36; z += 5) { b.at(40.5 + rr(-0.6, 0.6), z); P.debris(b, M, 3, 0.7); }
  for (let x = 3; x < 40; x += 5) { b.at(x, 37.5 + rr(-0.6, 0.6)); P.debris(b, M, 3, 0.8); }
  b.at(31.5, 38.5, 0); P.waitingChairs(b, M, 4, 1);
  b.at(20.5, 36.6, Math.PI / 2); P.gurney(b, M, { body: true });
  b.at(9.5, 38.4, 0); P.vending(b, M);
  b.at(4.5, 36.5, 0.8); P.wheelchair(b, M, false);
  P.bloodDecal(b, M, 40.5, 27.5, 1.2, 'trail', 0.1); P.bloodDecal(b, M, 25, 37.5, 1.4, 'trail', Math.PI / 2);
  P.bloodDecal(b, M, 12, 37.4, 1.6, 'pool'); P.bloodDecal(b, M, 3, 37.6, 1.2, 'splat');
  F(40.5, 21, { state: 'flicker' }); F(40.5, 27, { state: 'dead' }); F(40.5, 33, { state: 'on', intensity: 5 });
  F(34.5, 37.5, { state: 'dead' }); F(28.5, 37.5, { state: 'flicker' }); F(22.5, 37.5, { state: 'dead', hang: true });
  F(16.5, 37.5, { state: 'on', intensity: 5 }); F(10.5, 37.5, { state: 'dead' }); F(4.5, 37.5, { state: 'flicker' });
  F(1.5, 37.5, { state: 'on', kind: 'red', intensity: 4, color: 0xff2020, range: 7 });

  /* ------------------------------------------------ Operating rooms */
  for (const [ox, mir] of [[46.5, 1], [34.5, -1]]) {
    b.at(ox, 28.5, Math.PI / 2); P.opTable(b, M);
    b.at(ox, 28.5); P.surgicalLamp(b, M, CEIL);
    b.at(ox - 0.6 * mir, 26.4, 0); P.instrumentTray(b, M);
    b.at(ox + 2.6 * mir, 25.4, mir > 0 ? -Math.PI / 2 : Math.PI / 2); P.anesthesia(b, M);
    b.at(ox + 2.6 * mir, 31.6, 0); P.monitorCart(b, M, mir > 0);
    b.at(ox - 2.4 * mir, 32.3, 0); P.shelfRack(b, M, { w: 1.6, d: 0.45, h: 1.8 });
    b.at(ox, 29.5); P.debris(b, M, 5, 2);
    P.bloodDecal(b, M, ox + 0.6, 29.6, 2.2, 'pool'); P.bloodDecal(b, M, ox - 1.5, 30.6, 1.2, 'splat');
  }
  F(46.5, 26, { state: 'strobe', intensity: 7 }); F(34.5, 31, { state: 'dead' }); F(34.5, 26, { state: 'pulse', kind: 'red', intensity: 4, color: 0xff2020, range: 8 });

  /* ------------------------------------------------------ ER */
  for (let i = 0; i < 4; i++) {
    const x = 8.0 + i * 4.2;
    b.at(x, 23.4, 0); P.bed(b, M, { bloody: i % 2 === 0, body: i === 1 });
    b.at(x + 2.1, 23.4, Math.PI / 2); P.curtain(b, M, 2.6, CEIL, 0.8);
    b.at(x + 1.3, 22.0, 0); P.monitorCart(b, M, i === 2);
  }
  for (let i = 0; i < 3; i++) {
    const x = 9.0 + i * 5;
    b.at(x, 33.4, Math.PI); P.bed(b, M, { bloody: i === 1, body: i === 2 });
    b.at(x + 2.4, 33.3, Math.PI / 2); P.curtain(b, M, 2.6, CEIL, 0.6);
  }
  b.at(16.5, 28.4, 0); P.receptionDesk(b, M);
  b.at(22.6, 25.0, -Math.PI / 2); P.shelfRack(b, M, { w: 2.2, fill: 1.2 });
  b.at(7.3, 28.5, Math.PI / 2); P.gurney(b, M, { body: true });
  b.at(12, 30); P.debris(b, M, 12, 3); b.at(19, 31); P.papers(b, M, 10, 2);
  b.at(21.5, 31.8, 0.7); P.wheelchair(b, M, true);
  P.bloodDecal(b, M, 10.5, 26.5, 2.2, 'pool'); P.bloodDecal(b, M, 14, 31.4, 1.6, 'trail', 0.4);
  P.bloodDecal(b, M, 19.5, 27, 1.4, 'splat'); P.bloodDecal(b, M, 7.6, 31.6, 1.3, 'pool');
  F(9, 25, { state: 'flicker' }); F(16.5, 25, { state: 'dead' }); F(22, 25, { state: 'on', intensity: 5 });
  F(9, 32, { state: 'dead' }); F(16.5, 32, { state: 'flicker', intensity: 7 }); F(22, 32, { state: 'dead', hang: true });

  /* --------------------------------------------------- Linen store B */
  b.at(25.0, 29.4, Math.PI / 2); P.shelfRack(b, M, { w: 2.6, fill: 1.3 });
  b.at(29.0, 29.4, -Math.PI / 2); P.shelfRack(b, M, { w: 2.6, fill: 1.3 });
  b.at(27, 32); P.debris(b, M, 6, 1);
  F(27, 31, { state: 'dead' });

  /* ============================================== SUB-LEVEL B2 (lab) */
  // Lab A pathology
  b.at(4.5, 49.4, 0); P.labBench(b, M, { w: 3.2 });
  b.at(1.0, 53, Math.PI / 2); P.fridge(b, M);
  b.at(4.5, 53.6, Math.PI / 2); P.gurney(b, M, { body: true });
  b.at(7.8, 55.6, -Math.PI / 2); P.labBench(b, M, { w: 2.0 });
  P.bloodDecal(b, M, 3.4, 55, 1.4, 'pool');
  F(4.5, 52.5, { state: 'flicker', intensity: 6 });
  // Lab B virology
  b.at(12.0, 49.4, 0); P.labBench(b, M, { w: 3.0 });
  b.at(18.0, 49.4, 0); P.labBench(b, M, { w: 3.0 });
  b.at(11.0, 53.5); P.tube(b, M);
  b.at(15.0, 53.5); P.tube(b, M, { broken: true });
  b.at(19.0, 53.5); P.tube(b, M);
  b.at(15, 55.5); P.debris(b, M, 8, 2);
  P.bloodDecal(b, M, 15, 54.5, 2.0, 'pool');
  F(12, 51, { state: 'on', intensity: 5, color: 0xbfffd8 }); F(18, 51, { state: 'flicker', color: 0xbfffd8 });
  // Archive
  for (let i = 0; i < 3; i++) { b.at(22.8 + i * 2.2, 49.8, 0); P.shelfRack(b, M, { w: 1.9, d: 0.45, h: 2.2, fill: 1.3 }); }
  b.at(27.2, 54.6, 0); P.desk(b, M, { w: 1.8 });
  b.at(22.0, 55.8, Math.PI / 2); P.filingCabinet(b, M, true);
  b.at(22.0, 55.2, Math.PI / 2); P.filingCabinet(b, M);
  b.at(25, 53); P.papers(b, M, 16, 2);
  F(25.5, 52.5, { state: 'on', kind: 'bulb', intensity: 3.5, range: 8, color: 0xffb070 });
  // Generator room
  b.at(36.0, 50.2, 0); P.generator(b, M);
  b.at(31.0, 49.2, 0); P.serverRack(b, M); b.at(31.8, 49.2, 0); P.serverRack(b, M);
  b.at(40.6, 54.5, -Math.PI / 2); P.shelfRack(b, M, { w: 2.0, fill: 0.8 });
  b.at(36, 55); P.debris(b, M, 6, 2);
  F(36, 53.5, { state: 'pulse', kind: 'red', intensity: 4, color: 0xff2020, range: 9 });
  // Lab corridor
  for (let x = 3; x < 41; x += 4.5) { b.at(x, 58.5 + rr(-0.7, 0.7)); P.debris(b, M, 3, 0.7); }
  b.at(10.5, 59.6, Math.PI / 2); P.gurney(b, M, { body: true });
  b.at(31.5, 57.5, 0.4); P.wheelchair(b, M, true);
  P.bloodDecal(b, M, 20, 58.5, 1.4, 'trail', Math.PI / 2); P.bloodDecal(b, M, 26, 58.6, 1.4, 'trail', Math.PI / 2);
  for (let x = 4.5; x < 42; x += 6) F(x, 58.5, { state: [0, 2, 4].includes((x / 6) | 0) ? 'flicker' : 'dead', color: 0xcfe8ff });
  F(40.5, 58.5, { state: 'pulse', kind: 'red', intensity: 5, color: 0xff2020, range: 9 });
  // Cold storage
  for (let i = 0; i < 4; i++) { b.at(1.2 + i * 2.6, 68.3, Math.PI); P.fridge(b, M); }
  b.at(6, 63.5, 0.3); P.gurney(b, M, { body: true });
  b.at(2.0, 63.0, Math.PI / 2); P.shelfRack(b, M, { w: 2.2 });
  F(6, 64.5, { state: 'flicker', intensity: 5, color: 0xbfe0ff });
  // Containment hall
  for (let i = 0; i < 4; i++) { b.at(18 + i * 5.5, 66, 0); P.tube(b, M, { broken: i !== 2 }); }
  b.at(27, 63); P.debris(b, M, 16, 4);
  P.bloodDecal(b, M, 22, 64, 2.4, 'pool'); P.bloodDecal(b, M, 31, 63.5, 2.0, 'trail', 0.5);
  F(20, 64.5, { state: 'dead' }); F(27, 64.5, { state: 'pulse', kind: 'red', intensity: 4, color: 0xff2020, range: 10 }); F(34, 64.5, { state: 'dead' });
}
