// Procore-style standard cost code list used by the "Create Budget Code" flow.
//
// Cost codes are organised into top-level categories (divisions) that each
// contain a list of subcategories. The Create Budget Code picker first shows the
// categories; selecting one drills into its subcategories.

export type CostCodeSubcategory = {
  /** Full code, e.g. "01-000" */
  code: string;
  /** Subcategory name, e.g. "Purpose" */
  name: string;
};

export type CostCodeCategory = {
  /** Division code, e.g. "01" */
  code: string;
  /** Division name, e.g. "General Requirements" */
  name: string;
  subcategories: CostCodeSubcategory[];
};

export const COST_CODE_CATEGORIES: CostCodeCategory[] = [
  {
    code: "01",
    name: "General Requirements",
    subcategories: [
      { code: "01-000", name: "Purpose" },
      { code: "01-002", name: "Instructions" },
      { code: "01-010", name: "Project Manager" },
      { code: "01-011", name: "Project Engineer" },
      { code: "01-012", name: "Superintendent" },
      { code: "01-013", name: "Project Coordinator" },
      { code: "01-014", name: "Project Executive" },
      { code: "01-500", name: "Temporary Facilities and Controls" },
      { code: "01-510", name: "Temporary Utilities" },
      { code: "01-511", name: "Temporary Electricity" },
      { code: "01-514", name: "Temporary Heating, Cooling and Ventilation" },
      { code: "01-515", name: "Temporary Lighting" },
      { code: "01-517", name: "Temporary Telephone" },
      { code: "01-518", name: "Temporary Water" },
      { code: "01-520", name: "Construction Facilities" },
      { code: "01-523", name: "Sanitary Facilities" },
      { code: "01-530", name: "Temporary Construction" },
      { code: "01-540", name: "Construction Aids" },
      { code: "01-550", name: "Vehicular Access and Parking" },
      { code: "01-560", name: "Temporary Barriers and Enclosures" },
      { code: "01-570", name: "Temporary Controls" },
      { code: "01-580", name: "Project Identification" },
      { code: "01-700", name: "Execution and Closeout Requirements" },
      { code: "01-740", name: "Cleaning" },
      { code: "01-770", name: "Closeout Procedures" },
    ],
  },
  {
    code: "02",
    name: "Site Construction",
    subcategories: [
      { code: "02-050", name: "Basic Site Materials and Methods" },
      { code: "02-100", name: "Site Remediation" },
      { code: "02-200", name: "Site Preparation" },
      { code: "02-220", name: "Site Demolition" },
      { code: "02-230", name: "Site Clearing" },
      { code: "02-240", name: "Dewatering" },
      { code: "02-300", name: "Earthwork" },
      { code: "02-310", name: "Grading" },
      { code: "02-315", name: "Excavation and Fill" },
      { code: "02-360", name: "Soil Treatment" },
      { code: "02-400", name: "Tunneling, Boring, and Jacking" },
      { code: "02-450", name: "Foundation and Load-Bearing Elements" },
      { code: "02-500", name: "Utility Services" },
      { code: "02-600", name: "Drainage and Containment" },
      { code: "02-700", name: "Bases, Ballasts, Pavements, and Appurtenances" },
      { code: "02-740", name: "Flexible Pavement" },
      { code: "02-750", name: "Rigid Pavement" },
      { code: "02-770", name: "Curbs and Gutters" },
      { code: "02-780", name: "Unit Pavers" },
      { code: "02-800", name: "Site Improvements and Amenities" },
      { code: "02-810", name: "Irrigation System" },
      { code: "02-820", name: "Fences and Gates" },
      { code: "02-900", name: "Planting" },
      { code: "02-920", name: "Lawns and Grasses" },
      { code: "02-930", name: "Exterior Plants" },
    ],
  },
  {
    code: "03",
    name: "Concrete",
    subcategories: [
      { code: "03-050", name: "Basic Concrete Materials and Methods" },
      { code: "03-100", name: "Concrete Forms and Accessories" },
      { code: "03-200", name: "Concrete Reinforcement" },
      { code: "03-300", name: "Cast-In-Place Concrete" },
      { code: "03-330", name: "Architectural Concrete" },
      { code: "03-370", name: "Specially Placed Concrete" },
      { code: "03-400", name: "Precast Concrete" },
      { code: "03-500", name: "Cementitious Decks and Underlayment" },
      { code: "03-600", name: "Grouts" },
      { code: "03-700", name: "Mass Concrete" },
      { code: "03-900", name: "Concrete Restoration and Cleaning" },
    ],
  },
  {
    code: "04",
    name: "Masonry",
    subcategories: [
      { code: "04-050", name: "Basic Masonry Materials and Methods" },
      { code: "04-200", name: "Masonry Units" },
      { code: "04-210", name: "Clay Masonry Units" },
      { code: "04-220", name: "Concrete Masonry Units" },
      { code: "04-400", name: "Stone" },
      { code: "04-500", name: "Refractories" },
      { code: "04-600", name: "Corrosion-Resistant Masonry" },
      { code: "04-700", name: "Simulated Masonry" },
      { code: "04-800", name: "Masonry Assemblies" },
      { code: "04-900", name: "Masonry Restoration and Cleaning" },
    ],
  },
  {
    code: "05",
    name: "Metals",
    subcategories: [
      { code: "05-050", name: "Basic Metal Materials and Methods" },
      { code: "05-100", name: "Structural Metal Framing" },
      { code: "05-200", name: "Metal Joists" },
      { code: "05-300", name: "Metal Deck" },
      { code: "05-400", name: "Cold-Formed Metal Framing" },
      { code: "05-500", name: "Metal Fabrications" },
      { code: "05-510", name: "Metal Stairs" },
      { code: "05-520", name: "Handrails and Railings" },
      { code: "05-700", name: "Ornamental Metal" },
      { code: "05-800", name: "Expansion Control" },
      { code: "05-900", name: "Metal Restoration and Cleaning" },
    ],
  },
  {
    code: "06",
    name: "Wood and Plastics",
    subcategories: [
      { code: "06-050", name: "Basic Wood and Plastic Materials and Methods" },
      { code: "06-100", name: "Rough Carpentry" },
      { code: "06-150", name: "Wood Decking" },
      { code: "06-200", name: "Finish Carpentry" },
      { code: "06-400", name: "Architectural Woodwork" },
      { code: "06-500", name: "Structural Plastics" },
      { code: "06-600", name: "Plastic Fabrications" },
      { code: "06-900", name: "Wood and Plastic Restoration and Cleaning" },
    ],
  },
  {
    code: "07",
    name: "Thermal and Moisture Protection",
    subcategories: [
      { code: "07-050", name: "Basic Thermal and Moisture Protection Materials" },
      { code: "07-100", name: "Dampproofing and Waterproofing" },
      { code: "07-200", name: "Thermal Protection" },
      { code: "07-210", name: "Building Insulation" },
      { code: "07-300", name: "Shingles, Roof Tiles, and Roof Coverings" },
      { code: "07-400", name: "Roofing and Siding Panels" },
      { code: "07-500", name: "Membrane Roofing" },
      { code: "07-600", name: "Flashing and Sheet Metal" },
      { code: "07-700", name: "Roof Specialties and Accessories" },
      { code: "07-800", name: "Fire and Smoke Protection" },
      { code: "07-900", name: "Joint Sealers" },
    ],
  },
  {
    code: "08",
    name: "Doors and Windows",
    subcategories: [
      { code: "08-050", name: "Basic Door and Window Materials and Methods" },
      { code: "08-100", name: "Metal Doors and Frames" },
      { code: "08-200", name: "Wood and Plastic Doors" },
      { code: "08-300", name: "Specialty Doors" },
      { code: "08-330", name: "Coiling Doors and Grilles" },
      { code: "08-360", name: "Overhead Doors" },
      { code: "08-400", name: "Entrances and Storefronts" },
      { code: "08-500", name: "Windows" },
      { code: "08-600", name: "Skylights" },
      { code: "08-700", name: "Hardware" },
      { code: "08-800", name: "Glazing" },
      { code: "08-900", name: "Glazed Curtain Wall" },
    ],
  },
  {
    code: "09",
    name: "Finishes",
    subcategories: [
      { code: "09-050", name: "Basic Finish Materials and Methods" },
      { code: "09-200", name: "Plaster and Gypsum Board" },
      { code: "09-250", name: "Gypsum Board" },
      { code: "09-300", name: "Tile" },
      { code: "09-400", name: "Terrazzo" },
      { code: "09-500", name: "Ceilings" },
      { code: "09-510", name: "Acoustical Ceilings" },
      { code: "09-600", name: "Flooring" },
      { code: "09-650", name: "Resilient Flooring" },
      { code: "09-680", name: "Carpet" },
      { code: "09-700", name: "Wall Finishes" },
      { code: "09-800", name: "Acoustical Treatment" },
      { code: "09-900", name: "Paints and Coatings" },
      { code: "09-910", name: "Painting" },
    ],
  },
  {
    code: "10",
    name: "Specialties",
    subcategories: [
      { code: "10-100", name: "Visual Display Boards" },
      { code: "10-150", name: "Compartments and Cubicles" },
      { code: "10-200", name: "Louvers and Vents" },
      { code: "10-260", name: "Wall and Corner Guards" },
      { code: "10-300", name: "Fireplaces and Stoves" },
      { code: "10-400", name: "Identification Devices" },
      { code: "10-440", name: "Signage" },
      { code: "10-500", name: "Lockers" },
      { code: "10-520", name: "Fire Protection Specialties" },
      { code: "10-550", name: "Postal Specialties" },
      { code: "10-600", name: "Partitions" },
      { code: "10-800", name: "Toilet, Bath, and Laundry Accessories" },
      { code: "10-900", name: "Wardrobe and Closet Specialties" },
    ],
  },
  {
    code: "11",
    name: "Equipment",
    subcategories: [
      { code: "11-010", name: "Maintenance Equipment" },
      { code: "11-020", name: "Security and Vault Equipment" },
      { code: "11-040", name: "Ecclesiastical Equipment" },
      { code: "11-050", name: "Library Equipment" },
      { code: "11-060", name: "Theater and Stage Equipment" },
      { code: "11-130", name: "Audio-Visual Equipment" },
      { code: "11-150", name: "Parking Control Equipment" },
      { code: "11-160", name: "Loading Dock Equipment" },
      { code: "11-400", name: "Food Service Equipment" },
      { code: "11-450", name: "Residential Equipment" },
      { code: "11-500", name: "Industrial and Process Equipment" },
      { code: "11-600", name: "Laboratory Equipment" },
      { code: "11-700", name: "Medical Equipment" },
    ],
  },
  {
    code: "12",
    name: "Furnishings",
    subcategories: [
      { code: "12-050", name: "Fabrics" },
      { code: "12-100", name: "Art" },
      { code: "12-300", name: "Manufactured Casework" },
      { code: "12-400", name: "Furnishings and Accessories" },
      { code: "12-500", name: "Furniture" },
      { code: "12-600", name: "Multiple Seating" },
      { code: "12-700", name: "Systems Furniture" },
      { code: "12-900", name: "Other Furnishings" },
    ],
  },
  {
    code: "13",
    name: "Special Construction",
    subcategories: [
      { code: "13-010", name: "Air-Supported Structures" },
      { code: "13-020", name: "Building Modules" },
      { code: "13-030", name: "Special Purpose Rooms" },
      { code: "13-080", name: "Sound, Vibration, and Seismic Control" },
      { code: "13-100", name: "Lightning Protection" },
      { code: "13-120", name: "Pre-Engineered Structures" },
      { code: "13-150", name: "Swimming Pools" },
      { code: "13-200", name: "Storage Tanks" },
      { code: "13-700", name: "Security Access and Surveillance" },
      { code: "13-800", name: "Building Automation and Control" },
      { code: "13-900", name: "Fire Suppression" },
    ],
  },
  {
    code: "14",
    name: "Conveying Systems",
    subcategories: [
      { code: "14-100", name: "Dumbwaiters" },
      { code: "14-200", name: "Elevators" },
      { code: "14-300", name: "Escalators and Moving Walks" },
      { code: "14-400", name: "Lifts" },
      { code: "14-500", name: "Material Handling" },
      { code: "14-600", name: "Hoists and Cranes" },
      { code: "14-700", name: "Turntables" },
      { code: "14-800", name: "Scaffolding" },
      { code: "14-900", name: "Transportation" },
    ],
  },
  {
    code: "15",
    name: "Mechanical",
    subcategories: [
      { code: "15-050", name: "Basic Mechanical Materials and Methods" },
      { code: "15-100", name: "Building Services Piping" },
      { code: "15-200", name: "Process Piping" },
      { code: "15-300", name: "Fire Protection Piping" },
      { code: "15-400", name: "Plumbing Fixtures and Equipment" },
      { code: "15-500", name: "Heat-Generation Equipment" },
      { code: "15-600", name: "Refrigeration Equipment" },
      { code: "15-700", name: "Heating, Ventilating, and Air Conditioning (HVAC)" },
      { code: "15-800", name: "Air Distribution" },
      { code: "15-900", name: "HVAC Instrumentation and Controls" },
      { code: "15-950", name: "Testing, Adjusting, and Balancing" },
    ],
  },
  {
    code: "16",
    name: "Electrical",
    subcategories: [
      { code: "16-050", name: "Basic Electrical Materials and Methods" },
      { code: "16-100", name: "Wiring Methods" },
      { code: "16-200", name: "Electrical Power" },
      { code: "16-300", name: "Transmission and Distribution" },
      { code: "16-400", name: "Low-Voltage Distribution" },
      { code: "16-500", name: "Lighting" },
      { code: "16-700", name: "Communications" },
      { code: "16-800", name: "Sound and Video" },
      { code: "16-900", name: "Electrical Controls" },
    ],
  },
  {
    code: "17",
    name: "Markup and Contingency",
    subcategories: [
      { code: "17-100", name: "Overhead" },
      { code: "17-200", name: "Profit" },
      { code: "17-300", name: "General Liability Insurance" },
      { code: "17-400", name: "Bonds" },
      { code: "17-500", name: "Contingency" },
      { code: "17-600", name: "Fee" },
      { code: "17-700", name: "Taxes" },
    ],
  },
];

export type CostType = {
  /** Abbreviation, e.g. "L" */
  code: string;
  /** Name, e.g. "Labor" */
  name: string;
};

export const COST_TYPES: CostType[] = [
  { code: "E", name: "Equipment" },
  { code: "L", name: "Labor" },
  { code: "M", name: "Materials" },
  { code: "O", name: "Other" },
  { code: "OC", name: "Owner Cost" },
  { code: "S", name: "Commitment" },
  { code: "SVC", name: "Professional Services" },
];

/** Label shown in a cost type dropdown row, e.g. "L - Labor". */
export function costTypeLabel(t: CostType): string {
  return `${t.code} - ${t.name}`;
}

/** Label shown in a cost code subcategory row, e.g. "01-000 - Purpose". */
export function subcategoryLabel(s: CostCodeSubcategory): string {
  return `${s.code} - ${s.name}`;
}
