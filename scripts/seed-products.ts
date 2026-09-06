import 'dotenv/config';
import { PrismaClient, ProductAvailability, ProductStatus } from '@prisma/client';

const prisma = new PrismaClient();

const rawCategories = [
  {
    id: "c1000000-0000-4000-8000-000000000001",
    slug: "central-vacuum-units",
    name: "Central Vacuum Units",
    description: "High-efficiency central vacuum power units and whole-home filtration canisters.",
    icon: "Package",
    imageUrl: null,
    status: "ACTIVE",
    sortOrder: 1
  },
  {
    id: "c1000000-0000-4000-8000-000000000002",
    slug: "hose-systems",
    name: "Hose Systems & Kits",
    description: "Retractable in-wall hose systems, standard crush-proof hoses, and motorized wands.",
    icon: "Sliders",
    imageUrl: null,
    status: "ACTIVE",
    sortOrder: 2
  },
  {
    id: "c1000000-0000-4000-8000-000000000003",
    slug: "inlets-ports",
    name: "Inlets & Ports",
    description: "Architectural flush wall valves, low-voltage inlet ports, and automatic dustpans.",
    icon: "Wrench",
    imageUrl: null,
    status: "ACTIVE",
    sortOrder: 3
  },
  {
    id: "c1000000-0000-4000-8000-000000000004",
    slug: "cleaning-accessories",
    name: "Cleaning Accessories",
    description: "Multi-surface floor tools, delicate horsehair brushes, and auxiliary cleaning stations.",
    icon: "Sparkles",
    imageUrl: null,
    status: "ACTIVE",
    sortOrder: 4
  },
  {
    id: "c1000000-0000-4000-8000-000000000005",
    slug: "replacement-parts",
    name: "Replacement Parts",
    description: "Hospital-grade HEPA filters, activated carbon cartridges, and replacement gaskets.",
    icon: "Cpu",
    imageUrl: null,
    status: "ACTIVE",
    sortOrder: 5
  },
  {
    id: "c1000000-0000-4000-8000-000000000006",
    slug: "installation-parts",
    name: "Installation Parts",
    description: "ASTM-rated 2-inch PVC sweep elbows, pipe couplings, glue, and low-voltage wiring.",
    icon: "Layers",
    imageUrl: null,
    status: "ACTIVE",
    sortOrder: 6
  }
];

const rawProducts = [
  {
    id: "p1000000-0000-4000-8000-000000000001",
    categoryId: "c1000000-0000-4000-8000-000000000001",
    name: "ApexFlow Pro 950 Central Vacuum Power Unit",
    sku: "EV-PU-950",
    model: "APX-950X",
    summary: "Dual-motor high-output central vacuum power unit engineered for residences up to 12,000 sq. ft.",
    description: "The ApexFlow Pro 950 delivers medical-grade cyclonic micro-filtration and unmatched sustained suction. Encased in acoustic-dampened brushed steel, it ensures quiet operation in utility rooms while eliminating recirculated micro-dust.",
    quantity: 25,
    priceUsd: 1149.00,
    status: "ACTIVE",
    availability: "IN_STOCK",
    taxable: true,
    isFeatured: true,
    shippingLabel: "Free Freight Delivery",
    popularityRank: 1,
    imageAlt: "ApexFlow Pro 950 Central Vacuum Power Canister Unit",
    images: [],
    highlights: [
      { text: "Covers residences up to 12,000 square feet", sortOrder: 0 },
      { text: "Dual-stage high-output tangential bypass motor", sortOrder: 1 },
      { text: "Self-cleaning permanent micro-fiber filter with Gore-Tex shield", sortOrder: 2 },
      { text: "Acoustic dampening running at only 58 dBA", sortOrder: 3 }
    ],
    specifications: [
      { label: "Air Watts", value: "720 AW", sortOrder: 0 },
      { label: "Voltage", value: "120V / 15A", sortOrder: 1 },
      { label: "Noise Rating", value: "58 dBA", sortOrder: 2 },
      { label: "Canister Capacity", value: "6.5 Gallons", sortOrder: 3 }
    ],
    shippingNotes: [
      { text: "Free LTL Freight shipping with liftgate delivery", sortOrder: 0 },
      { text: "Ships in reinforced wood-braced foam crate", sortOrder: 1 }
    ]
  },
  {
    id: "p1000000-0000-4000-8000-000000000002",
    categoryId: "c1000000-0000-4000-8000-000000000001",
    name: "Aerolux WhisperQuiet 750 Compact Power Unit",
    sku: "EV-PU-750",
    model: "ALX-750Q",
    summary: "Ultra-quiet single-motor central vacuum system optimized for homes up to 7,500 sq. ft.",
    description: "Engineered for single-family homes and townhouses. Features a SoundOff internal baffle muffler, anti-vibration mounting, and hybrid filtration supporting disposable HEPA bags or bagless cyclonic collection.",
    quantity: 40,
    priceUsd: 889.00,
    status: "ACTIVE",
    availability: "IN_STOCK",
    taxable: true,
    isFeatured: false,
    shippingLabel: "Free Standard Shipping",
    popularityRank: 2,
    imageAlt: "Aerolux WhisperQuiet 750 Central Vacuum Power Canister",
    images: [],
    highlights: [
      { text: "Optimized for spaces up to 7,500 square feet", sortOrder: 0 },
      { text: "SoundOff internal muffler reduction technology", sortOrder: 1 },
      { text: "Hybrid filtration (disposable bag or bagless cyclonic)", sortOrder: 2 },
      { text: "10-Year factory motor warranty", sortOrder: 3 }
    ],
    specifications: [
      { label: "Air Watts", value: "640 AW", sortOrder: 0 },
      { label: "Water Lift", value: "138 in.", sortOrder: 1 },
      { label: "Airflow", value: "124 CFM", sortOrder: 2 },
      { label: "Weight", value: "26.8 lbs", sortOrder: 3 }
    ],
    shippingNotes: [
      { text: "Standard ground shipping via FedEx or UPS", sortOrder: 0 },
      { text: "Direct signature required upon delivery", sortOrder: 1 }
    ]
  },
  {
    id: "p1000000-0000-4000-8000-000000000003",
    categoryId: "c1000000-0000-4000-8000-000000000001",
    name: "TitanForce Commercial 1200 Vacuum Station",
    sku: "EV-PU-1200",
    model: "TF-1200C",
    summary: "Commercial-grade dual-circuit central vacuum station for large estates and commercial facilities.",
    description: "An industrial powerhouse housed in 18-gauge cold-rolled steel. Dual parallel bypass motors run multiple suction drops concurrently with consistent line velocity.",
    quantity: 12,
    priceUsd: 1799.00,
    status: "ACTIVE",
    availability: "IN_STOCK",
    taxable: true,
    isFeatured: true,
    shippingLabel: "Freight Only",
    popularityRank: 3,
    imageAlt: "TitanForce Commercial 1200 Vacuum Station",
    images: [],
    highlights: [
      { text: "Multi-user capability allows concurrent cleaning operations", sortOrder: 0 },
      { text: "Extra-large 10-gallon debris capacity bucket", sortOrder: 1 },
      { text: "Automatic thermal motor overload protection", sortOrder: 2 },
      { text: "Built for continuous commercial use and large-scale buildings", sortOrder: 3 }
    ],
    specifications: [
      { label: "Air Watts", value: "1040 AW", sortOrder: 0 },
      { label: "Voltage", value: "240V Dedicated 20A Circuit", sortOrder: 1 },
      { label: "Bucket Capacity", value: "10 Gallons", sortOrder: 2 },
      { label: "Dimensions", value: "42 in H x 16 in D", sortOrder: 3 }
    ],
    shippingNotes: [
      { text: "Ships palletized via certified LTL freight carrier", sortOrder: 0 },
      { text: "Includes commercial curbside delivery appointment", sortOrder: 1 }
    ]
  },
  {
    id: "p1000000-0000-4000-8000-000000000004",
    categoryId: "c1000000-0000-4000-8000-000000000001",
    name: "VisiClean Transparent Hybrid Canister Unit",
    sku: "EV-PU-VISI",
    model: "VSC-800H",
    summary: "Clear polycarbonate debris bucket unit with intelligent optical LED filter monitoring.",
    description: "A high-visibility power unit featuring a shatterproof clear polycarbonate collection bucket and integrated optical sensors that alert via front LED status when maintenance is needed.",
    quantity: 18,
    priceUsd: 969.00,
    status: "ACTIVE",
    availability: "IN_STOCK",
    taxable: true,
    isFeatured: false,
    shippingLabel: "Free Standard Shipping",
    popularityRank: 4,
    imageAlt: "VisiClean Transparent Canister Central Vacuum Unit",
    images: [],
    highlights: [
      { text: "Clear polycarbonate canister for instant debris level checks", sortOrder: 0 },
      { text: "Optical sensor alerts users before airflow restriction occurs", sortOrder: 1 },
      { text: "High-efficiency cyclonic separator with secondary Gore filter", sortOrder: 2 },
      { text: "Dual quick-release latch handles for easy single-hand emptying", sortOrder: 3 }
    ],
    specifications: [
      { label: "Air Watts", value: "680 AW", sortOrder: 0 },
      { label: "Bucket Volume", value: "5.5 Gallons", sortOrder: 1 },
      { label: "Filtration Efficiency", value: "99.97% @ 0.3 Microns", sortOrder: 2 },
      { label: "Casing Material", value: "Anodized Aluminum & Polycarbonate", sortOrder: 3 }
    ],
    shippingNotes: [
      { text: "Ships double-boxed with anti-static protective film", sortOrder: 0 },
      { text: "Includes universal wall-mounting plate and hardware", sortOrder: 1 }
    ]
  },
  {
    id: "p1000000-0000-4000-8000-000000000005",
    categoryId: "c1000000-0000-4000-8000-000000000001",
    name: "ProTerra EcoSilent 650 Power Unit",
    sku: "EV-PU-650",
    model: "PTR-650S",
    summary: "Energy-efficient compact power unit designed for condominiums, apartments, and smaller homes up to 4,500 sq. ft.",
    description: "Engineered for energy efficiency without suction compromise. Consumes 30% less power than traditional units while maintaining high water-lift velocity for multi-floor condos.",
    quantity: 55,
    priceUsd: 699.00,
    status: "ACTIVE",
    availability: "IN_STOCK",
    taxable: true,
    isFeatured: false,
    shippingLabel: "Free Standard Shipping",
    popularityRank: 5,
    imageAlt: "ProTerra EcoSilent 650 Power Unit",
    images: [],
    highlights: [
      { text: "Optimized for apartments, condos, and compact homes up to 4,500 sq. ft.", sortOrder: 0 },
      { text: "30% reduced electrical consumption via high-torque eco motor", sortOrder: 1 },
      { text: "Compact 28-inch vertical footprint fits utility closets", sortOrder: 2 },
      { text: "Triple-layer sound insulation chamber", sortOrder: 3 }
    ],
    specifications: [
      { label: "Air Watts", value: "590 AW", sortOrder: 0 },
      { label: "Water Lift", value: "128 in.", sortOrder: 1 },
      { label: "Voltage", value: "120V / 11A", sortOrder: 2 },
      { label: "Capacity", value: "4.2 Gallons", sortOrder: 3 }
    ],
    shippingNotes: [
      { text: "Standard ground shipping via parcel carrier", sortOrder: 0 },
      { text: "Direct to door delivery", sortOrder: 1 }
    ]
  },
  {
    id: "p1000000-0000-4000-8000-000000000006",
    categoryId: "c1000000-0000-4000-8000-000000000001",
    name: "UltraMax Dual-Cyclonic 1000 Power Unit",
    sku: "EV-PU-1000",
    model: "UMX-1000D",
    summary: "Maximum-suction dual-cyclonic filterless power unit for large multi-story homes up to 10,000 sq. ft.",
    description: "True filterless cyclonic separation forces 99% of dust and debris straight to the bottom of the canister through vortex velocity, requiring zero filter cleanings or replacement cartridges.",
    quantity: 20,
    priceUsd: 1299.00,
    status: "ACTIVE",
    availability: "IN_STOCK",
    taxable: true,
    isFeatured: true,
    shippingLabel: "Free Freight Delivery",
    popularityRank: 6,
    imageAlt: "UltraMax Dual-Cyclonic 1000 Power Unit",
    images: [],
    highlights: [
      { text: "Covers multi-story residences up to 10,000 square feet", sortOrder: 0 },
      { text: "100% filterless true cyclonic separation maintains permanent peak airflow", sortOrder: 1 },
      { text: "Heavy-gauge seam-welded steel body with corrosion-resistant finish", sortOrder: 2 },
      { text: "Outdoor venting capability eliminates all indoor exhaust", sortOrder: 3 }
    ],
    specifications: [
      { label: "Air Watts", value: "810 AW", sortOrder: 0 },
      { label: "Water Lift", value: "145 in.", sortOrder: 1 },
      { label: "Voltage", value: "120V / 15A Dedicated", sortOrder: 2 },
      { label: "Canister Capacity", value: "7.0 Gallons", sortOrder: 3 }
    ],
    shippingNotes: [
      { text: "Free freight delivery in wooden shipping crate", sortOrder: 0 },
      { text: "Includes exhaust vent pipe kit and exterior hood", sortOrder: 1 }
    ]
  },
  {
    id: "p1000000-0000-4000-8000-000000000007",
    categoryId: "c1000000-0000-4000-8000-000000000002",
    name: "Chameleon Elite Retractable Hose Complete Kit",
    sku: "EV-HK-RET50",
    model: "CHM-50R",
    summary: "In-wall retractable 50-foot hose system with automatic vacuum-powered retraction and locking handle.",
    description: "Stores directly inside the home's in-wall PVC tubing. Pull out the length required, lock the valve, and let central vacuum suction retract the hose back into the wall when finished.",
    quantity: 30,
    priceUsd: 749.00,
    status: "ACTIVE",
    availability: "IN_STOCK",
    taxable: true,
    isFeatured: true,
    shippingLabel: "Free Standard Shipping",
    popularityRank: 7,
    imageAlt: "Chameleon Elite Retractable Hose Complete System Kit",
    images: [],
    highlights: [
      { text: "Hose stores automatically inside in-wall vacuum piping network", sortOrder: 0 },
      { text: "50ft high-flexibility hose with anti-scratch fabric sock jacket", sortOrder: 1 },
      { text: "RF wireless low-voltage switch handle controls system remotely", sortOrder: 2 },
      { text: "Fully compatible with standard Chameleon and Hide-A-Hose rough-ins", sortOrder: 3 }
    ],
    specifications: [
      { label: "Hose Length", value: "50 Feet", sortOrder: 0 },
      { label: "Internal Diameter", value: "1-3/8 in. High-Flow", sortOrder: 1 },
      { label: "Inlet Compatibility", value: "Chameleon / Hide-A-Hose Valves", sortOrder: 2 },
      { label: "Handle Control", value: "Wireless RF Toggle", sortOrder: 3 }
    ],
    shippingNotes: [
      { text: "Packaged in shock-proof corrugated cylinder box", sortOrder: 0 },
      { text: "Includes wireless transmitter batteries pre-installed", sortOrder: 1 }
    ]
  },
  {
    id: "p1000000-0000-4000-8000-000000000008",
    categoryId: "c1000000-0000-4000-8000-000000000003",
    name: "Chameleon Designer Flush Wall Valve Inlet",
    sku: "EV-IN-CHM-FLUSH",
    model: "CHM-FLS-WHT",
    summary: "Ultra-flush paintable architectural central vacuum wall valve for retractable installations.",
    description: "Installs flush with drywall and accepts interior wall paint, plaster, or wallpaper to blend seamlessly into luxury living rooms and hallways.",
    quantity: 120,
    priceUsd: 79.00,
    status: "ACTIVE",
    availability: "IN_STOCK",
    taxable: true,
    isFeatured: false,
    shippingLabel: "Standard Parcel",
    popularityRank: 8,
    imageAlt: "Chameleon Designer Flush Paintable Wall Inlet Valve",
    images: [],
    highlights: [
      { text: "Textured primer-coated door accepts custom paint and wallpaper", sortOrder: 0 },
      { text: "Dual airtight rubber gaskets prevent drafts and vacuum whistling", sortOrder: 1 },
      { text: "Integrated low-voltage terminal screws for easy wiring connection", sortOrder: 2 },
      { text: "Zero protruding faceplate edges for architectural flush mounting", sortOrder: 3 }
    ],
    specifications: [
      { label: "Color / Finish", value: "Matte White Primer (Paintable)", sortOrder: 0 },
      { label: "Protrusion Profile", value: "1/8 in. Ultra-Flush", sortOrder: 1 },
      { label: "Fitting Standard", value: "Standard 2 in. Vacuum PVC", sortOrder: 2 },
      { label: "Warranty", value: "5 Years", sortOrder: 3 }
    ],
    shippingNotes: [
      { text: "Ships via express small parcel carrier", sortOrder: 0 },
      { text: "Includes plaster rough-in guard and mounting screws", sortOrder: 1 }
    ]
  },
  {
    id: "p1000000-0000-4000-8000-000000000009",
    categoryId: "c1000000-0000-4000-8000-000000000003",
    name: "VacPan Automatic Kick-Plate Dustpan Inlet",
    sku: "EV-IN-VACPAN",
    model: "VP-KICK-01",
    summary: "Foot-switched baseboard suction port that vacuums floor sweepings directly into your central unit.",
    description: "Baseboard convenience port. Tap the spring-loaded rocker switch with your foot to activate suction, sweep debris into the mouth, and kick closed to shut off.",
    quantity: 85,
    priceUsd: 59.00,
    status: "ACTIVE",
    availability: "IN_STOCK",
    taxable: true,
    isFeatured: false,
    shippingLabel: "Standard Parcel",
    popularityRank: 9,
    imageAlt: "VacPan Under-Cabinet Kick Dustpan Central Vacuum Inlet",
    images: [],
    highlights: [
      { text: "Instant foot-switch on/off activation eliminates handheld dustpans", sortOrder: 0 },
      { text: "Fits into 3-1/2 inch cabinet toe-kicks or baseboard trims", sortOrder: 1 },
      { text: "Durable heavy-duty ABS construction withstands shoe scuffs", sortOrder: 2 },
      { text: "Low-voltage electrical trigger starts power unit automatically", sortOrder: 3 }
    ],
    specifications: [
      { label: "Color", value: "Appliance White", sortOrder: 0 },
      { label: "Cutout Requirement", value: "3-1/2 in. Minimum Height", sortOrder: 1 },
      { label: "Switch Voltage", value: "24V Low Voltage", sortOrder: 2 },
      { label: "Connection", value: "Rear 2 in. Vacuum Spigot", sortOrder: 3 }
    ],
    shippingNotes: [
      { text: "Ships in recyclable retail box with cutting template", sortOrder: 0 },
      { text: "Includes wire nuts and mounting screws", sortOrder: 1 }
    ]
  },
  {
    id: "p1000000-0000-4000-8000-000000000010",
    categoryId: "c1000000-0000-4000-8000-000000000004",
    name: "ProArtisan Hardwood & Carpet Deluxe Attachment Kit",
    sku: "EV-AC-TOOL12",
    model: "ART-12PC",
    summary: "12-piece precision cleaning toolset crafted with genuine Mongolian horsehair and swivel joints.",
    description: "Engineered for luxury hardwood floors and delicate millwork. Includes a 14-inch natural bristle parquet floor tool, narrow radiator crevice tool, microfiber dusting brush, upholstery nozzle, and a wall-mount hanging caddy.",
    quantity: 50,
    priceUsd: 149.00,
    status: "ACTIVE",
    availability: "IN_STOCK",
    taxable: true,
    isFeatured: false,
    shippingLabel: "Standard Parcel",
    popularityRank: 10,
    imageAlt: "ProArtisan 12-Piece Attachment Kit for Central Vacuum",
    images: [],
    highlights: [
      { text: "100% natural horsehair bristles prevent scratching on luxury wood floors", sortOrder: 0 },
      { text: "Universal 1-1/4 inch diameter fits 99% of central vacuum wands", sortOrder: 1 },
      { text: "360-degree swivel neck joint provides effortless furniture maneuvering", sortOrder: 2 },
      { text: "Canvas hanging storage caddy included for neat organization", sortOrder: 3 }
    ],
    specifications: [
      { label: "Piece Count", value: "12 Tools & Accessories", sortOrder: 0 },
      { label: "Fitting Standard", value: "1.25 in. Friction or Button-Lock", sortOrder: 1 },
      { label: "Bristle Material", value: "Genuine Mongolian Horsehair", sortOrder: 2 },
      { label: "Floor Brush Width", value: "14 Inches", sortOrder: 3 }
    ],
    shippingNotes: [
      { text: "Packed in molded protective carton with storage caddy", sortOrder: 0 },
      { text: "Standard ground parcel delivery", sortOrder: 1 }
    ]
  },
  {
    id: "p1000000-0000-4000-8000-000000000011",
    categoryId: "c1000000-0000-4000-8000-000000000005",
    name: "HEPA Shield Active Carbon Replacement Filter Assembly",
    sku: "EV-FL-HEPA99",
    model: "HPS-99C",
    summary: "Medical-grade cylindrical HEPA cartridge with activated carbon odor-neutralizing layer.",
    description: "Essential routine maintenance filter. Captures 99.97% of particulates down to 0.3 microns, while granular carbon absorbs ozone, exhaust heat, and pet dander odors.",
    quantity: 75,
    priceUsd: 64.00,
    status: "ACTIVE",
    availability: "IN_STOCK",
    taxable: true,
    isFeatured: false,
    shippingLabel: "Standard Parcel",
    popularityRank: 11,
    imageAlt: "HEPA Shield Central Vacuum Carbon Canister Filter",
    images: [],
    highlights: [
      { text: "H13 true HEPA performance captures allergens, mites, and soot", sortOrder: 0 },
      { text: "Active carbon honeycomb eliminates stale exhaust odors", sortOrder: 1 },
      { text: "Molded silicone top gasket guarantees an airtight canister fit", sortOrder: 2 },
      { text: "Washable outer pre-filter sleeve extends core cartridge life", sortOrder: 3 }
    ],
    specifications: [
      { label: "Filtration Standard", value: "H13 True HEPA (99.97% @ 0.3µm)", sortOrder: 0 },
      { label: "Diameter", value: "11.5 Inches", sortOrder: 1 },
      { label: "Height", value: "7.8 Inches", sortOrder: 2 },
      { label: "Unit Compatibility", value: "ApexFlow Pro & Aerolux Series", sortOrder: 3 }
    ],
    shippingNotes: [
      { text: "Hermetically sealed in moisture-barrier polybag", sortOrder: 0 },
      { text: "Ships in rigid shock-absorbing cardboard carton", sortOrder: 1 }
    ]
  },
  {
    id: "p1000000-0000-4000-8000-000000000012",
    categoryId: "c1000000-0000-4000-8000-000000000006",
    name: "SweepLink 2-Inch Vacuum Pipe & Sweep Elbow Pro Bundle",
    sku: "EV-IN-PIPE20",
    model: "SWP-20KIT",
    summary: "Contractor installation pack containing ASTM gradual 90° sweep bends, couplings, and 24/2 wire.",
    description: "Gradual long-radius sweep elbows designed specifically for central vacuum installations to ensure zero in-wall clog risk and smooth passage of retractable hoses.",
    quantity: 60,
    priceUsd: 89.00,
    status: "ACTIVE",
    availability: "IN_STOCK",
    taxable: true,
    isFeatured: false,
    shippingLabel: "Standard Parcel",
    popularityRank: 12,
    imageAlt: "SweepLink Central Vacuum PVC Installation Fittings Bundle",
    images: [],
    highlights: [
      { text: "Long-radius sweep bends engineered to eliminate in-wall debris clogs", sortOrder: 0 },
      { text: "Virgin anti-static ASTM F2158 PVC compound", sortOrder: 1 },
      { text: "Includes 50ft of 24/2 stranded low-voltage trigger control wire", sortOrder: 2 },
      { text: "Universal outer diameter connects directly to standard 2-inch central vac pipe", sortOrder: 3 }
    ],
    specifications: [
      { label: "Fitting Outer Diameter", value: "2.00 Inches Standard", sortOrder: 0 },
      { label: "Bundle Quantity", value: "24 Fittings + 50ft Wire", sortOrder: 1 },
      { label: "Material Spec", value: "ASTM F2158 Anti-Static PVC", sortOrder: 2 },
      { label: "Adhesive Type", value: "Clear PVC Solvent Cement", sortOrder: 3 }
    ],
    shippingNotes: [
      { text: "Ships in heavy-duty contractor bundle packaging", sortOrder: 0 },
      { text: "Standard ground delivery within 2-4 business days", sortOrder: 1 }
    ]
  }
];

// Helper: In Postgres @db.Uuid, characters must be hex (0-9, a-f).
// 'p' is not hex, so we normalize 'p1000...' -> 'a1000...' so it is a valid UUID.
function toValidUuid(id: string): string {
  if (id.startsWith('p')) {
    return 'a' + id.slice(1);
  }
  return id;
}

async function seed() {
  console.log('🚀 Starting Product & Category Seed...');

  // Map of category slug to ID
  const categoryIdMap = new Map<string, string>();

  // 1. Seed Categories
  console.log(`\n📁 Upserting ${rawCategories.length} Categories...`);
  for (const cat of rawCategories) {
    const validCatId = toValidUuid(cat.id);

    // Delete existing category with conflicting slug if it has a different ID and 0 products
    const existingSlug = await prisma.productCategory.findUnique({
      where: { slug: cat.slug },
      include: { _count: { select: { products: true } } },
    });

    if (existingSlug && existingSlug.id !== validCatId && existingSlug._count.products === 0) {
      await prisma.productCategory.delete({ where: { id: existingSlug.id } });
    }

    const createdCat = await prisma.productCategory.upsert({
      where: { id: validCatId },
      update: {
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        imageUrl: cat.imageUrl,
        status: cat.status,
        sortOrder: cat.sortOrder,
      },
      create: {
        id: validCatId,
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        imageUrl: cat.imageUrl,
        status: cat.status,
        sortOrder: cat.sortOrder,
      },
    });

    categoryIdMap.set(cat.id, createdCat.id);
    console.log(`  ✅ Category [${createdCat.slug}]: ${createdCat.name} (ID: ${createdCat.id})`);
  }

  // 2. Seed Products
  console.log(`\n📦 Upserting ${rawProducts.length} Products with Highlights, Specs & Shipping Notes...`);
  const seededProducts: Array<{ name: string; sku: string; id: string; price: number; category: string }> = [];

  for (const prod of rawProducts) {
    const validProductId = toValidUuid(prod.id);
    const validCategoryId = categoryIdMap.get(prod.categoryId) || toValidUuid(prod.categoryId);

    // Clean up existing specs/highlights/shippingNotes for idempotency
    await prisma.productHighlight.deleteMany({ where: { productId: validProductId } });
    await prisma.productSpecification.deleteMany({ where: { productId: validProductId } });
    await prisma.productShippingNote.deleteMany({ where: { productId: validProductId } });

    const upserted = await prisma.product.upsert({
      where: { id: validProductId },
      update: {
        categoryId: validCategoryId,
        name: prod.name,
        sku: prod.sku,
        model: prod.model,
        summary: prod.summary,
        description: prod.description,
        quantity: prod.quantity,
        priceUsd: prod.priceUsd,
        status: prod.status as ProductStatus,
        availability: prod.availability as ProductAvailability,
        taxable: prod.taxable,
        isFeatured: prod.isFeatured,
        shippingLabel: prod.shippingLabel,
        popularityRank: prod.popularityRank,
        imageAlt: prod.imageAlt,
        highlights: {
          create: prod.highlights.map((h) => ({
            text: h.text,
            sortOrder: h.sortOrder,
          })),
        },
        specifications: {
          create: prod.specifications.map((s) => ({
            label: s.label,
            value: s.value,
            sortOrder: s.sortOrder,
          })),
        },
        shippingNotes: {
          create: prod.shippingNotes.map((n) => ({
            text: n.text,
            sortOrder: n.sortOrder,
          })),
        },
      },
      create: {
        id: validProductId,
        categoryId: validCategoryId,
        name: prod.name,
        sku: prod.sku,
        model: prod.model,
        summary: prod.summary,
        description: prod.description,
        quantity: prod.quantity,
        priceUsd: prod.priceUsd,
        status: prod.status as ProductStatus,
        availability: prod.availability as ProductAvailability,
        taxable: prod.taxable,
        isFeatured: prod.isFeatured,
        shippingLabel: prod.shippingLabel,
        popularityRank: prod.popularityRank,
        imageAlt: prod.imageAlt,
        highlights: {
          create: prod.highlights.map((h) => ({
            text: h.text,
            sortOrder: h.sortOrder,
          })),
        },
        specifications: {
          create: prod.specifications.map((s) => ({
            label: s.label,
            value: s.value,
            sortOrder: s.sortOrder,
          })),
        },
        shippingNotes: {
          create: prod.shippingNotes.map((n) => ({
            text: n.text,
            sortOrder: n.sortOrder,
          })),
        },
      },
    });

    seededProducts.push({
      name: upserted.name,
      sku: upserted.sku || '',
      id: upserted.id,
      price: Number(upserted.priceUsd),
      category: prod.categoryId,
    });

    console.log(`  ✅ Product [${upserted.sku}]: ${upserted.name}`);
    console.log(`     👉 ID: ${upserted.id}`);
  }

  console.log('\n✨ All 6 categories and 12 products successfully seeded in the database!\n');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
