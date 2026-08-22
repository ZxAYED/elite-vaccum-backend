export type DemoService = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  startingPrice: number;
  estimatedDurationMinutes: number;
  includes: string[];
  active: boolean;
};

export type DemoProduct = {
  id: string;
  name: string;
  sku: string;
  model: string;
  category: string;
  description: string;
  price: number;
  active: boolean;
};

export type DemoCustomerProperty = {
  id: string;
  address: string;
  system: {
    manufacturer: string;
    model: string;
    installedYear: number;
  };
};

export type DemoCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  properties: DemoCustomerProperty[];
};

export type DemoServiceHistoryRecord = {
  id: string;
  customerId: string;
  propertyId: string;
  serviceName: string;
  serviceDate: string;
  technician: string;
  summary: string;
  workPerformed: string[];
};

export type DemoServiceOrderStatus =
  | 'TECHNICIAN_ASSIGNED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'REPORT_SUBMITTED'
  | 'COMPLETED';

export type DemoServiceOrder = {
  id: string;
  customerId: string;
  propertyId: string;
  serviceId: string;
  status: DemoServiceOrderStatus;
  issueSummary: string;
  technician: string | null;
  appointment: {
    date: string;
    timeWindow: string;
  } | null;
  createdAt: string;
};

export const demoServices: DemoService[] = [
  {
    id: 'service-demo-001',
    slug: 'vacuum-repair',
    name: 'Vacuum Repair',
    category: 'Repair',
    description:
      'Diagnosis and repair of central vacuum power units, motors, switches, electrical components, and related system problems.',
    startingPrice: 145,
    estimatedDurationMinutes: 90,
    includes: [
      'Initial system inspection',
      'Power unit diagnostic',
      'Basic electrical testing',
      'Repair recommendation',
    ],
    active: true,
  },
  {
    id: 'service-demo-002',
    slug: 'maintenance-troubleshooting',
    name: 'Maintenance & Troubleshooting',
    category: 'Maintenance',
    description:
      'Preventive maintenance and troubleshooting for central vacuum systems.',
    startingPrice: 110,
    estimatedDurationMinutes: 75,
    includes: [
      'System performance check',
      'Filter inspection',
      'Hose inspection',
      'Wall inlet inspection',
      'Basic troubleshooting',
    ],
    active: true,
  },
  {
    id: 'service-demo-003',
    slug: 'low-suction-fix',
    name: 'Low Suction Fix',
    category: 'Repair',
    description:
      'Inspection and troubleshooting for weak or inconsistent central vacuum suction.',
    startingPrice: 125,
    estimatedDurationMinutes: 90,
    includes: [
      'Suction testing',
      'Hose and inlet inspection',
      'Filter and collection inspection',
      'Pipe blockage assessment',
      'Power unit performance check',
    ],
    active: true,
  },
  {
    id: 'service-demo-004',
    slug: 'broken-inlet-repair',
    name: 'Broken Inlet Repair',
    category: 'Repair',
    description:
      'Inspection and repair or replacement of damaged central vacuum wall inlets.',
    startingPrice: 95,
    estimatedDurationMinutes: 60,
    includes: [
      'Wall inlet inspection',
      'Low-voltage connection check',
      'Seal inspection',
      'Repair or replacement recommendation',
    ],
    active: true,
  },
  {
    id: 'service-demo-005',
    slug: 'general-service',
    name: 'General Service',
    category: 'Maintenance',
    description:
      'General central vacuum maintenance when there is no clearly identified specific problem.',
    startingPrice: 105,
    estimatedDurationMinutes: 60,
    includes: [
      'General system inspection',
      'Basic performance testing',
      'Visible component inspection',
      'Maintenance recommendations',
    ],
    active: true,
  },
  {
    id: 'service-demo-006',
    slug: 'system-inspection',
    name: 'System Inspection',
    category: 'Inspection',
    description:
      'Detailed inspection of the central vacuum system to identify possible faults or maintenance requirements.',
    startingPrice: 89,
    estimatedDurationMinutes: 60,
    includes: [
      'Power unit inspection',
      'Wall inlet inspection',
      'Hose inspection',
      'System condition assessment',
    ],
    active: true,
  },
];

export const demoProducts: DemoProduct[] = [
  {
    id: 'product-demo-001',
    name: 'Premium Central Vacuum Hose - 30 ft',
    sku: 'ECV-HOSE-30',
    model: 'PH30',
    category: 'Hose',
    description:
      'Thirty-foot replacement central vacuum hose compatible with common central vacuum inlet systems.',
    price: 179,
    active: true,
  },
  {
    id: 'product-demo-002',
    name: 'Premium Central Vacuum Hose - 35 ft',
    sku: 'ECV-HOSE-35',
    model: 'PH35',
    category: 'Hose',
    description:
      'Thirty-five-foot replacement central vacuum hose for larger cleaning areas.',
    price: 199,
    active: true,
  },
  {
    id: 'product-demo-003',
    name: 'Hide-A-Hose Retractable Hose - 40 ft',
    sku: 'ECV-HAH-40',
    model: 'HAH40',
    category: 'Retractable Hose',
    description:
      'Retractable hose designed for compatible Hide-A-Hose central vacuum installations.',
    price: 429,
    active: true,
  },
  {
    id: 'product-demo-004',
    name: 'Standard Wall Inlet Valve',
    sku: 'ECV-INLET-01',
    model: 'IV100',
    category: 'Inlet',
    description:
      'Replacement wall inlet valve for compatible central vacuum systems.',
    price: 34.99,
    active: true,
  },
  {
    id: 'product-demo-005',
    name: 'Central Vacuum Filter Replacement Kit',
    sku: 'ECV-FILTER-01',
    model: 'FK200',
    category: 'Filter',
    description:
      'Replacement filter kit for selected central vacuum power units.',
    price: 49.99,
    active: true,
  },
  {
    id: 'product-demo-006',
    name: 'Deluxe Cleaning Attachment Set',
    sku: 'ECV-ATTACH-01',
    model: 'DA500',
    category: 'Accessories',
    description:
      'Cleaning accessory kit containing floor, upholstery, crevice, and dusting attachments.',
    price: 119,
    active: true,
  },
];

export const demoCustomers: DemoCustomer[] = [
  {
    id: 'customer-demo-001',
    name: 'Avery Stone',
    email: 'avery.stone@example.com',
    phone: '+1-555-0101',
    properties: [
      {
        id: 'property-demo-001',
        address: '123 Heritage Lane, Demo City, NJ 00000',
        system: {
          manufacturer: 'VacuMaid',
          model: 'SR64',
          installedYear: 2019,
        },
      },
    ],
  },
  {
    id: 'customer-demo-002',
    name: 'Jordan Parker',
    email: 'jordan.parker@example.com',
    phone: '+1-555-0102',
    properties: [
      {
        id: 'property-demo-002',
        address: '88 Sample Ridge Road, Demo Town, NY 00000',
        system: {
          manufacturer: 'Cyclo Vac',
          model: 'H725',
          installedYear: 2021,
        },
      },
    ],
  },
];

export const demoServiceHistory: DemoServiceHistoryRecord[] = [
  {
    id: 'history-demo-001',
    customerId: 'customer-demo-001',
    propertyId: 'property-demo-001',
    serviceName: 'Annual Maintenance',
    serviceDate: '2025-05-14',
    technician: 'Demo Technician Alex',
    summary: 'Annual central vacuum maintenance completed.',
    workPerformed: [
      'Inspected power unit',
      'Cleaned collection area',
      'Checked wall inlets',
    ],
  },
  {
    id: 'history-demo-002',
    customerId: 'customer-demo-001',
    propertyId: 'property-demo-001',
    serviceName: 'Filter Replacement',
    serviceDate: '2025-11-02',
    technician: 'Demo Technician Alex',
    summary: 'Filter showed significant wear and was replaced.',
    workPerformed: [
      'Removed old filter',
      'Installed replacement filter',
      'Tested suction after replacement',
    ],
  },
  {
    id: 'history-demo-003',
    customerId: 'customer-demo-001',
    propertyId: 'property-demo-001',
    serviceName: 'Hose Repair',
    serviceDate: '2026-03-18',
    technician: 'Demo Technician Morgan',
    summary: 'Intermittent hose connection issue repaired.',
    workPerformed: [
      'Inspected hose connection',
      'Repaired damaged connection',
      'Verified hose operation',
    ],
  },
  {
    id: 'history-demo-004',
    customerId: 'customer-demo-002',
    propertyId: 'property-demo-002',
    serviceName: 'System Inspection',
    serviceDate: '2026-02-10',
    technician: 'Demo Technician Morgan',
    summary: 'General system inspection completed.',
    workPerformed: [
      'Inspected power unit',
      'Tested suction',
      'Checked wall inlet seals',
    ],
  },
];

export const demoServiceOrders: DemoServiceOrder[] = [
  {
    id: 'SO-1004',
    customerId: 'customer-demo-001',
    propertyId: 'property-demo-001',
    serviceId: 'service-demo-002',
    status: 'COMPLETED',
    issueSummary: 'Annual maintenance requested.',
    technician: 'Demo Technician Alex',
    appointment: {
      date: '2026-05-12',
      timeWindow: '9:00 AM - 11:00 AM',
    },
    createdAt: '2026-05-05',
  },
  {
    id: 'SO-1005',
    customerId: 'customer-demo-002',
    propertyId: 'property-demo-002',
    serviceId: 'service-demo-004',
    status: 'TECHNICIAN_ASSIGNED',
    issueSummary: 'One wall inlet is loose and intermittently loses power.',
    technician: 'Demo Technician Morgan',
    appointment: null,
    createdAt: '2026-08-15',
  },
  {
    id: 'SO-1006',
    customerId: 'customer-demo-001',
    propertyId: 'property-demo-001',
    serviceId: 'service-demo-003',
    status: 'SCHEDULED',
    issueSummary:
      'Weak suction upstairs and inconsistent suction from two wall inlets.',
    technician: 'Demo Technician Alex',
    appointment: {
      date: '2026-08-20',
      timeWindow: '10:00 AM - 12:00 PM',
    },
    createdAt: '2026-08-16',
  },
  {
    id: 'SO-1007',
    customerId: 'customer-demo-002',
    propertyId: 'property-demo-002',
    serviceId: 'service-demo-001',
    status: 'IN_PROGRESS',
    issueSummary: 'Power unit starts but shuts down after several minutes.',
    technician: 'Demo Technician Morgan',
    appointment: {
      date: '2026-08-17',
      timeWindow: '1:00 PM - 3:00 PM',
    },
    createdAt: '2026-08-14',
  },
  {
    id: 'SO-1008',
    customerId: 'customer-demo-001',
    propertyId: 'property-demo-001',
    serviceId: 'service-demo-006',
    status: 'REPORT_SUBMITTED',
    issueSummary: 'System inspection requested after renovation work.',
    technician: 'Demo Technician Alex',
    appointment: {
      date: '2026-08-12',
      timeWindow: '2:00 PM - 4:00 PM',
    },
    createdAt: '2026-08-08',
  },
];
