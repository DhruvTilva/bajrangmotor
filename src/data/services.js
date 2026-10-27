// ─────────────────────────────────────────────────────────────────────────────
// SERVICES — rendered into the interactive "Service Explorer".
//
// source:  'signboard'      → painted on the garage's roadside board (verified)
//          'previous-site'  → listed on the owner's previous website (confirm)
// hotspot: position on the car photo, in its pixel coordinates
//          (2284 × 1219, see src/components/car.js).
// ─────────────────────────────────────────────────────────────────────────────

export const services = [
  {
    id: 'alignment',
    title: 'Computerised 3D Wheel Alignment',
    zone: 'Front wheel',
    source: 'signboard',
    hotspot: { x: 1106, y: 978 },
    body: 'Cameras on the alignment rig read targets clamped to each wheel and measure the angles the wheels sit at. Out-of-line wheels are a common reason a car pulls to one side or wears a tyre on one edge.',
    signs: ['Car pulls left or right', 'Steering wheel off-centre', 'Tyre worn on one edge'],
  },
  {
    id: 'balancing',
    title: 'Computerised Wheel Balancing',
    zone: 'Rear wheel',
    source: 'signboard',
    hotspot: { x: 172, y: 738 },
    body: 'Each wheel is spun on a balancing machine, which shows exactly where small correction weights need to go. An unbalanced wheel usually shows up as vibration at speed.',
    signs: ['Steering shakes at speed', 'Seat or floor vibration', 'After fitting new tyres'],
  },
  {
    id: 'tyres',
    title: 'Tyre Changing',
    zone: 'Tyres',
    source: 'signboard',
    hotspot: { x: 1010, y: 1140 },
    body: 'Tyres are removed and fitted on a tyre-changer machine in the workshop. Bring the car in for a replacement, a puncture check or a swap between wheels.',
    signs: ['Worn or cracked tread', 'Slow puncture', 'Bulge on the sidewall'],
  },
  {
    id: 'suspension',
    title: 'Suspension & Steering Parts',
    zone: 'Wheel arch',
    source: 'previous-site',
    hotspot: { x: 1050, y: 760 },
    body: 'Inspection, repair and replacement of suspension and steering components: the parts that keep the ride settled and the wheels pointing where you steer.',
    signs: ['Knocking over bumps', 'Car feels floaty or bouncy', 'Uneven ride height'],
  },
  {
    id: 'engine',
    title: 'Engine & Component Repair',
    zone: 'Bonnet',
    source: 'previous-site',
    hotspot: { x: 1650, y: 500 },
    body: 'Diagnosis and repair of engine-related components. Tell us what you hear, smell or see on the dashboard. It helps us find the problem faster.',
    signs: ['Warning light on', 'New noise or smell', 'Loss of power'],
  },
  {
    id: 'battery',
    title: 'Battery Replacement',
    zone: 'Electrical',
    source: 'previous-site',
    hotspot: { x: 1470, y: 700 },
    body: 'Old or weak batteries checked and replaced, along with related issues such as leaking or corroded terminals.',
    signs: ['Slow or no start', 'Dim headlamps', 'White deposits on terminals'],
  },
  {
    id: 'oil',
    title: 'Oil, Filters & Coolant',
    zone: 'Service',
    source: 'previous-site',
    hotspot: { x: 1960, y: 860 },
    body: 'Engine oil changes along with oil filter, diesel filter and coolant replacement, the routine work that keeps an engine healthy.',
    signs: ['Due as per service book', 'Oil warning light', 'Engine running hot'],
  },
  {
    id: 'accident',
    title: 'Advice After an Accident',
    zone: 'Body',
    source: 'previous-site',
    hotspot: { x: 700, y: 640 },
    body: 'Had a knock? We can take a look and advise you on what needs doing next and where it is best repaired.',
    signs: ['Panel or bumper damage', 'Car pulls after impact', 'Not sure where to start'],
  },
];
