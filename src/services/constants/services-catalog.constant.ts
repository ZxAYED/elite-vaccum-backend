import { RequestSymptom, ServiceGroup } from '@prisma/client';

export interface FixedServiceOffering {
  key: string;
  slug: string;
  group: ServiceGroup;
  title: string;
  iconKey: string;
  summary: string;
  description: string;
  sortOrder: number;
  recommendedSymptoms: RequestSymptom[];
}

export const SYMPTOM_DEFINITIONS: {
  key: RequestSymptom;
  label: string;
  description?: string;
}[] = [
  { key: RequestSymptom.UNIT_NOT_TURNING_ON, label: 'Unit not turning on' },
  { key: RequestSymptom.UNIT_DOES_NOT_SHUT_OFF, label: 'Unit does not shut off' },
  { key: RequestSymptom.CLOGGED, label: 'Clogged' },
  { key: RequestSymptom.LOW_SUCTION, label: 'Low suction' },
  { key: RequestSymptom.WALL_OR_POWER_HOSE_PROBLEM, label: 'Wall or power hose problem' },
  { key: RequestSymptom.BROKEN_INLET, label: 'Broken inlet' },
  { key: RequestSymptom.NOISE, label: 'Noise' },
  { key: RequestSymptom.OTHER, label: 'Other' },
];

export const FIXED_SERVICES_CATALOG: FixedServiceOffering[] = [

  // GROUP 1: SERVICE_AND_MAINTENANCE

  {
    key: 'VACUUM_REPAIR',
    slug: 'vacuum-repair',
    group: ServiceGroup.SERVICE_AND_MAINTENANCE,
    title: 'Vacuum Repair',
    iconKey: 'Wrench',
    summary: 'Diagnostics and repair for suction loss, motor noise, and inlet issues.',
    description:
      'Expert comprehensive diagnostic and field repair service for all central vacuum power units, piping lines, motor carbon brushes, and circuit board failures.',
    sortOrder: 1,
    recommendedSymptoms: [
      RequestSymptom.UNIT_NOT_TURNING_ON,
      RequestSymptom.UNIT_DOES_NOT_SHUT_OFF,
      RequestSymptom.NOISE,
      RequestSymptom.OTHER,
    ],
  },
  {
    key: 'MAINTENANCE_TROUBLESHOOTING',
    slug: 'maintenance-troubleshooting',
    group: ServiceGroup.SERVICE_AND_MAINTENANCE,
    title: 'Maintenance & Troubleshooting',
    iconKey: 'Pulse',
    summary: 'Preventative care to ensure your system operates at peak efficiency year-round.',
    description:
      'Scheduled maintenance covering motor chamber sealing, bag/filter replacement, relief valve calibration, and circuit safety tests.',
    sortOrder: 2,
    recommendedSymptoms: [
      RequestSymptom.LOW_SUCTION,
      RequestSymptom.NOISE,
      RequestSymptom.OTHER,
    ],
  },
  {
    key: 'LOW_SUCTION_FIX',
    slug: 'low-suction-fix',
    group: ServiceGroup.SERVICE_AND_MAINTENANCE,
    title: 'Low Suction Fix',
    iconKey: 'ShieldCheck',
    summary: 'Specialized blockage removal and seal integrity checks for restored power.',
    description:
      'High-pressure reverse air flushing, optical endoscopy camera line inspection, and airtightness leak testing across the entire run.',
    sortOrder: 3,
    recommendedSymptoms: [
      RequestSymptom.LOW_SUCTION,
      RequestSymptom.CLOGGED,
      RequestSymptom.WALL_OR_POWER_HOSE_PROBLEM,
    ],
  },
  {
    key: 'BROKEN_INLET_REPAIR',
    slug: 'broken-inlet-repair',
    group: ServiceGroup.SERVICE_AND_MAINTENANCE,
    title: 'Broken Inlet Repair',
    iconKey: 'Sliders',
    summary: 'Replacement of damaged wall valves and low-voltage wiring restoration.',
    description:
      'Precision repair and replacement of loose, cracked, or unresponsive wall inlet valves, backing plates, and 24V low-voltage trigger wiring.',
    sortOrder: 4,
    recommendedSymptoms: [
      RequestSymptom.BROKEN_INLET,
      RequestSymptom.WALL_OR_POWER_HOSE_PROBLEM,
    ],
  },
  {
    key: 'GENERAL_SERVICE',
    slug: 'general-service',
    group: ServiceGroup.SERVICE_AND_MAINTENANCE,
    title: 'General Service',
    iconKey: 'Wrench',
    summary: 'Comprehensive system health check including filter cleaning and line purging.',
    description:
      'Complete end-to-end checkup for residential central vacuums including canister emptying, cyclone cone cleaning, line deodorizing, and suction gauge measurements.',
    sortOrder: 5,
    recommendedSymptoms: [
      RequestSymptom.LOW_SUCTION,
      RequestSymptom.NOISE,
      RequestSymptom.CLOGGED,
      RequestSymptom.OTHER,
    ],
  },
  {
    key: 'SYSTEM_INSPECTION',
    slug: 'system-inspection',
    group: ServiceGroup.SERVICE_AND_MAINTENANCE,
    title: 'System Inspection',
    iconKey: 'ShieldCheck',
    summary: 'Detailed inspection of your central vacuum system to identify hidden issues.',
    description:
      'Comprehensive multi-point inspection for real estate transactions, renovation readiness, and system performance baseline certifications.',
    sortOrder: 6,
    recommendedSymptoms: [RequestSymptom.OTHER],
  },


  // GROUP 2: INSTALLATION

  {
    key: 'NEW_SYSTEM',
    slug: 'new-system',
    group: ServiceGroup.INSTALLATION,
    title: 'New System',
    iconKey: 'Home',
    summary: 'Full blueprinting and installation for new home constructions.',
    description:
      'Turnkey engineering and installation of complete central vacuum systems during framing or rough-in construction phases with lifetime piping warranty.',
    sortOrder: 7,
    recommendedSymptoms: [],
  },
  {
    key: 'CUSTOM_FIT',
    slug: 'custom-fit',
    group: ServiceGroup.INSTALLATION,
    title: 'Custom Fit',
    iconKey: 'Wrench',
    summary: 'Bespoke layouts for commercial or unique residential spaces.',
    description:
      'Custom piping layouts, heavy-duty commercial power units, multi-user filtration systems, and bespoke accessory docks for specialized properties.',
    sortOrder: 8,
    recommendedSymptoms: [],
  },
  {
    key: 'SYSTEM_UPGRADE',
    slug: 'system-upgrade',
    group: ServiceGroup.INSTALLATION,
    title: 'System Upgrade',
    iconKey: 'Upgrade',
    summary: 'Retrofitting modern power units to existing piping networks.',
    description:
      'Replace aging power units with ultra-quiet, high-efficiency HEPA filtration systems while retaining existing wall valves and piping.',
    sortOrder: 9,
    recommendedSymptoms: [],
  },
  {
    key: 'ARCHITECTURAL',
    slug: 'architectural',
    group: ServiceGroup.INSTALLATION,
    title: 'Architectural',
    iconKey: 'Compass',
    summary: 'Seamless integration into luxury bespoke home designs.',
    description:
      'Flush-mount designer inlets, chameleon retractable hose integration, kick-sweep vacpans, and concealed routing for luxury estates.',
    sortOrder: 10,
    recommendedSymptoms: [],
  },
];

export const STANDARD_TIME_SLOTS = [
  {
    slot: 'Morning - 8:00 AM to 11:00 AM',
    label: 'Morning - 8:00 AM to 11:00 AM',
    timeWindow: 'Morning - 8:00 AM to 11:00 AM',
    period: 'MORNING',
    startTime: '08:00 AM',
    endTime: '11:00 AM',
  },
  {
    slot: 'Midday - 11:00 AM to 2:00 PM',
    label: 'Midday - 11:00 AM to 2:00 PM',
    timeWindow: 'Midday - 11:00 AM to 2:00 PM',
    period: 'MIDDAY',
    startTime: '11:00 AM',
    endTime: '02:00 PM',
  },
  {
    slot: 'Afternoon - 2:00 PM to 5:00 PM',
    label: 'Afternoon - 2:00 PM to 5:00 PM',
    timeWindow: 'Afternoon - 2:00 PM to 5:00 PM',
    period: 'AFTERNOON',
    startTime: '02:00 PM',
    endTime: '05:00 PM',
  },
  {
    slot: 'Evening - 5:00 PM to 7:00 PM',
    label: 'Evening - 5:00 PM to 7:00 PM',
    timeWindow: 'Evening - 5:00 PM to 7:00 PM',
    period: 'EVENING',
    startTime: '05:00 PM',
    endTime: '07:00 PM',
  },
  {
    slot: 'Late Evening - 7:00 PM to 9:00 PM',
    label: 'Late Evening - 7:00 PM to 9:00 PM',
    timeWindow: 'Late Evening - 7:00 PM to 9:00 PM',
    period: 'LATE_EVENING',
    startTime: '07:00 PM',
    endTime: '09:00 PM',
  },
];
