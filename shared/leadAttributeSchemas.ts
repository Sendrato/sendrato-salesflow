/**
 * Lead Attribute Schemas
 *
 * Defines the attribute fields available for each lead type.
 * The UI renders these dynamically — no DB migration needed to add a new type.
 *
 * Field types:
 *  - number: numeric input
 *  - text: short text input
 *  - textarea: multi-line text
 *  - select: dropdown from options[]
 *  - date: date picker
 */

export type AttributeFieldType = "number" | "text" | "textarea" | "select" | "date";

export interface AttributeField {
  key: string;
  label: string;
  type: AttributeFieldType;
  unit?: string; // e.g. "days", "visitors", "£"
  options?: string[]; // for select type
  placeholder?: string;
  description?: string; // tooltip hint
  icon?: string; // lucide icon name
}

export interface LeadTypeSchema {
  label: string;
  description: string;
  color: string; // tailwind color class for badge
  fields: AttributeField[];
  sizeKey?: string; // attribute key that represents the "size" of this lead type
  sizeUnit?: string; // display unit for the size value
}

export const LEAD_TYPE_SCHEMAS: Record<string, LeadTypeSchema> = {
  default: {
    label: "General",
    description: "Standard B2B lead",
    color: "bg-slate-100 text-slate-700",
    fields: [],
  },

  event: {
    label: "Event",
    description: "Agricultural shows, state fairs, exhibitions",
    color: "bg-amber-100 text-amber-800",
    sizeKey: "visitorCount",
    sizeUnit: "visitors",
    fields: [
      {
        key: "visitorCount",
        label: "Est. Visitors",
        type: "number",
        unit: "visitors",
        placeholder: "e.g. 240000",
        description: "Estimated total visitor attendance",
        icon: "Users",
      },
      {
        key: "eventDurationDays",
        label: "Duration",
        type: "number",
        unit: "days",
        placeholder: "e.g. 4",
        description: "Number of days the event runs",
        icon: "Calendar",
      },
      {
        key: "typicalDates",
        label: "Typical Dates",
        type: "text",
        placeholder: "e.g. Late July",
        description: "When the event typically takes place",
        icon: "CalendarDays",
      },
      {
        key: "region",
        label: "Region",
        type: "text",
        placeholder: "e.g. Wales, Scotland, England - North",
        description: "Geographic region of the event",
        icon: "MapPin",
      },
      {
        key: "hotelNeedScore",
        label: "Hotel Need Score",
        type: "select",
        options: ["LOW", "MEDIUM", "HIGH", "VERY HIGH"],
        description: "How strong is the demand for nearby hotel accommodation",
        icon: "Hotel",
      },
      {
        key: "revenueEngineFit",
        label: "Revenue Engine Fit",
        type: "select",
        options: ["POOR", "MODERATE", "GOOD", "EXCELLENT"],
        description: "How well this event fits our revenue model",
        icon: "TrendingUp",
      },
      {
        key: "venueCapacity",
        label: "Venue Capacity",
        type: "number",
        unit: "people",
        placeholder: "e.g. 35000",
        description: "Maximum daily capacity of the venue",
        icon: "Building2",
      },
      {
        key: "eventCategory",
        label: "Event Category",
        type: "select",
        options: [
          "Agricultural Show",
          "Music Festival",
          "State Fair",
          "Food & Drink Festival",
          "Sports Event",
          "Trade Show",
          "Cultural Festival",
          "Air Show",
          "Motor Show",
          "Other",
        ],
        description: "Type of event",
        icon: "Tag",
      },
      {
        key: "ticketPriceRange",
        label: "Ticket Price Range",
        type: "text",
        placeholder: "e.g. £15 - £45",
        description: "Typical ticket price range",
        icon: "Ticket",
      },
      {
        key: "organizerName",
        label: "Organizer / Society",
        type: "text",
        placeholder: "e.g. Royal Welsh Agricultural Society",
        description: "Name of the organizing body",
        icon: "Building",
      },
    ],
  },

  festival: {
    label: "Festival",
    description: "Music festivals, cultural festivals",
    color: "bg-purple-100 text-purple-800",
    sizeKey: "visitorCount",
    sizeUnit: "visitors",
    fields: [
      {
        key: "visitorCount",
        label: "Est. Attendance",
        type: "number",
        unit: "visitors",
        placeholder: "e.g. 80000",
        icon: "Users",
      },
      {
        key: "eventDurationDays",
        label: "Duration",
        type: "number",
        unit: "days",
        placeholder: "e.g. 3",
        icon: "Calendar",
      },
      {
        key: "typicalDates",
        label: "Typical Dates",
        type: "text",
        placeholder: "e.g. August Bank Holiday",
        icon: "CalendarDays",
      },
      {
        key: "region",
        label: "Region",
        type: "text",
        placeholder: "e.g. Somerset, UK",
        icon: "MapPin",
      },
      {
        key: "campingAvailable",
        label: "Camping",
        type: "select",
        options: ["Yes - on site", "Yes - nearby", "No"],
        description: "Whether camping is available at or near the festival",
        icon: "Tent",
      },
      {
        key: "hotelNeedScore",
        label: "Hotel Need Score",
        type: "select",
        options: ["LOW", "MEDIUM", "HIGH", "VERY HIGH"],
        icon: "Hotel",
      },
      {
        key: "revenueEngineFit",
        label: "Revenue Engine Fit",
        type: "select",
        options: ["POOR", "MODERATE", "GOOD", "EXCELLENT"],
        icon: "TrendingUp",
      },
      {
        key: "ticketPriceRange",
        label: "Ticket Price Range",
        type: "text",
        placeholder: "e.g. £200 - £350",
        icon: "Ticket",
      },
      {
        key: "headlinerGenre",
        label: "Genre / Theme",
        type: "text",
        placeholder: "e.g. Rock, Electronic, Jazz",
        icon: "Music",
      },
    ],
  },

  conference: {
    label: "Conference",
    description: "Industry conferences, trade events, summits",
    color: "bg-blue-100 text-blue-800",
    sizeKey: "attendeeCount",
    sizeUnit: "attendees",
    fields: [
      {
        key: "attendeeCount",
        label: "Est. Attendees",
        type: "number",
        unit: "attendees",
        placeholder: "e.g. 2500",
        icon: "Users",
      },
      {
        key: "eventDurationDays",
        label: "Duration",
        type: "number",
        unit: "days",
        placeholder: "e.g. 2",
        icon: "Calendar",
      },
      {
        key: "typicalDates",
        label: "Typical Dates",
        type: "text",
        placeholder: "e.g. October",
        icon: "CalendarDays",
      },
      {
        key: "region",
        label: "City / Region",
        type: "text",
        placeholder: "e.g. London, UK",
        icon: "MapPin",
      },
      {
        key: "sponsorshipTiers",
        label: "Sponsorship Tiers",
        type: "text",
        placeholder: "e.g. Gold £10k, Silver £5k",
        icon: "Award",
      },
      {
        key: "speakerCount",
        label: "Speakers",
        type: "number",
        unit: "speakers",
        placeholder: "e.g. 40",
        icon: "Mic",
      },
      {
        key: "hotelNeedScore",
        label: "Hotel Need Score",
        type: "select",
        options: ["LOW", "MEDIUM", "HIGH", "VERY HIGH"],
        icon: "Hotel",
      },
    ],
  },

  hospitality: {
    label: "Hospitality",
    description: "Hotels, venues, catering companies",
    color: "bg-green-100 text-green-800",
    sizeKey: "roomCount",
    sizeUnit: "rooms",
    fields: [
      {
        key: "propertyCount",
        label: "Properties / Locations",
        type: "number",
        unit: "locations",
        placeholder: "e.g. 12",
        icon: "Building2",
      },
      {
        key: "roomCount",
        label: "Total Rooms",
        type: "number",
        unit: "rooms",
        placeholder: "e.g. 450",
        icon: "BedDouble",
      },
      {
        key: "starRating",
        label: "Star Rating",
        type: "select",
        options: ["1 star", "2 star", "3 star", "4 star", "5 star", "Boutique", "Budget"],
        icon: "Star",
      },
      {
        key: "pmsSystem",
        label: "PMS System",
        type: "text",
        placeholder: "e.g. Opera, Mews, Cloudbeds",
        description: "Property Management System in use",
        icon: "Server",
      },
      {
        key: "annualOccupancy",
        label: "Annual Occupancy",
        type: "text",
        placeholder: "e.g. 78%",
        icon: "BarChart",
      },
    ],
  },

  saas: {
    label: "SaaS",
    description: "Software-as-a-service companies",
    color: "bg-cyan-100 text-cyan-800",
    sizeKey: "userCount",
    sizeUnit: "users",
    fields: [
      {
        key: "mrr",
        label: "MRR",
        type: "number",
        unit: "USD/mo",
        placeholder: "e.g. 50000",
        description: "Monthly Recurring Revenue",
        icon: "DollarSign",
      },
      {
        key: "arr",
        label: "ARR",
        type: "number",
        unit: "USD/yr",
        placeholder: "e.g. 600000",
        description: "Annual Recurring Revenue",
        icon: "TrendingUp",
      },
      {
        key: "userCount",
        label: "Active Users",
        type: "number",
        unit: "users",
        placeholder: "e.g. 1200",
        icon: "Users",
      },
      {
        key: "techStack",
        label: "Tech Stack",
        type: "text",
        placeholder: "e.g. React, Node, AWS",
        icon: "Code",
      },
      {
        key: "integrations",
        label: "Key Integrations",
        type: "text",
        placeholder: "e.g. Stripe, Salesforce, HubSpot",
        icon: "Plug",
      },
      {
        key: "churnRate",
        label: "Churn Rate",
        type: "text",
        placeholder: "e.g. 2.5%/mo",
        icon: "TrendingDown",
      },
    ],
  },

  partner: {
    label: "Partner",
    description: "Potential partnerships, collaborations",
    color: "bg-indigo-100 text-indigo-800",
    fields: [
      {
        key: "partnerType",
        label: "Partner Type",
        type: "select",
        options: [
          "Technology",
          "Distribution",
          "Referral",
          "Strategic Alliance",
          "Co-marketing",
          "Other",
        ],
        description: "Type of partnership",
        icon: "Handshake",
      },
      {
        key: "companySize",
        label: "Company Size",
        type: "select",
        options: ["1-10", "11-50", "51-200", "201-1000", "1000+"],
        description: "Number of employees",
        icon: "Users",
      },
      {
        key: "mutualBenefit",
        label: "Mutual Benefit",
        type: "textarea",
        placeholder: "e.g. Shared customer base, complementary products",
        description: "What both parties gain from the partnership",
        icon: "ArrowLeftRight",
      },
      {
        key: "partnerFit",
        label: "Partner Fit",
        type: "select",
        options: ["POOR", "MODERATE", "GOOD", "EXCELLENT"],
        description: "How well this partner aligns with our goals",
        icon: "Target",
      },
    ],
  },

  retail: {
    label: "Retail",
    description: "Retail chains, e-commerce, consumer brands",
    color: "bg-rose-100 text-rose-800",
    sizeKey: "storeCount",
    sizeUnit: "stores",
    fields: [
      {
        key: "storeCount",
        label: "Store Count",
        type: "number",
        unit: "stores",
        placeholder: "e.g. 45",
        icon: "Store",
      },
      {
        key: "annualRevenue",
        label: "Annual Revenue",
        type: "text",
        placeholder: "e.g. £12M",
        icon: "DollarSign",
      },
      {
        key: "ecommercePresence",
        label: "E-commerce",
        type: "select",
        options: ["None", "Basic website", "Full e-commerce", "Marketplace only", "Omnichannel"],
        icon: "ShoppingCart",
      },
      {
        key: "posSystem",
        label: "POS System",
        type: "text",
        placeholder: "e.g. Square, Shopify POS, Lightspeed",
        icon: "CreditCard",
      },
    ],
  },

  venue: {
    label: "Venue",
    description: "Concert halls, arenas, exhibition centres, stadiums",
    color: "bg-teal-100 text-teal-800",
    sizeKey: "venueCapacity",
    sizeUnit: "people",
    fields: [
      {
        key: "venueCapacity",
        label: "Capacity",
        type: "number",
        unit: "people",
        placeholder: "e.g. 15000",
        description: "Maximum venue capacity",
        icon: "Users",
      },
      {
        key: "venueType",
        label: "Venue Type",
        type: "select",
        options: [
          "Arena",
          "Concert Hall",
          "Exhibition Centre",
          "Stadium",
          "Theatre",
          "Conference Centre",
          "Outdoor Grounds",
          "Hotel / Resort",
          "Multi-purpose",
          "Other",
        ],
        description: "Type of venue",
        icon: "Building2",
      },
      {
        key: "seatedCapacity",
        label: "Seated Capacity",
        type: "number",
        unit: "seats",
        placeholder: "e.g. 8000",
        description: "Number of seated positions",
        icon: "Armchair",
      },
      {
        key: "standingCapacity",
        label: "Standing Capacity",
        type: "number",
        unit: "people",
        placeholder: "e.g. 15000",
        description: "Maximum standing capacity",
        icon: "Users",
      },
      {
        key: "numberOfRooms",
        label: "Rooms / Spaces",
        type: "number",
        unit: "rooms",
        placeholder: "e.g. 6",
        description: "Number of separate event spaces",
        icon: "LayoutGrid",
      },
      {
        key: "region",
        label: "City / Region",
        type: "text",
        placeholder: "e.g. Manchester, UK",
        icon: "MapPin",
      },
      {
        key: "annualEvents",
        label: "Annual Events",
        type: "number",
        unit: "events/yr",
        placeholder: "e.g. 200",
        description: "Approximate number of events hosted per year",
        icon: "CalendarRange",
      },
      {
        key: "cateringInHouse",
        label: "Catering",
        type: "select",
        options: ["In-house", "External only", "Both", "None"],
        description: "Catering arrangements",
        icon: "UtensilsCrossed",
      },
      {
        key: "parkingCapacity",
        label: "Parking",
        type: "text",
        placeholder: "e.g. 2000 spaces, multi-storey",
        description: "Parking availability",
        icon: "Car",
      },
      {
        key: "revenueEngineFit",
        label: "Revenue Engine Fit",
        type: "select",
        options: ["POOR", "MODERATE", "GOOD", "EXCELLENT"],
        description: "How well this venue fits our revenue model",
        icon: "TrendingUp",
      },
    ],
  },

  event_promotor: {
    label: "Event Promotor",
    description: "Organisation that organises multiple events",
    color: "bg-orange-100 text-orange-800",
    sizeKey: "totalEventsManaged",
    sizeUnit: "events",
    fields: [
      {
        key: "totalEventsManaged",
        label: "Total Events Managed",
        type: "number",
        unit: "events",
        placeholder: "e.g. 12",
        description: "Number of events managed by this promotor",
        icon: "CalendarRange",
      },
      {
        key: "primaryRegion",
        label: "Primary Region",
        type: "text",
        placeholder: "e.g. UK, Netherlands",
        description: "Main geographic operating region",
        icon: "MapPin",
      },
      {
        key: "promotorCategory",
        label: "Promotor Category",
        type: "select",
        options: [
          "Multi-genre",
          "Agricultural",
          "Music & Arts",
          "Sports",
          "Trade & Exhibition",
          "Food & Drink",
          "Other",
        ],
        description: "Primary category of events managed",
        icon: "Tag",
      },
      {
        key: "revenueEngineFit",
        label: "Revenue Engine Fit",
        type: "select",
        options: ["POOR", "MODERATE", "GOOD", "EXCELLENT"],
        description: "How well this promotor fits our revenue model",
        icon: "TrendingUp",
      },
    ],
  },
};

/**
 * Get the attribute schema for a given lead type.
 * Falls back to 'default' (empty fields) if type not found.
 */
export function getLeadTypeSchema(leadType: string): LeadTypeSchema {
  return LEAD_TYPE_SCHEMAS[leadType] ?? LEAD_TYPE_SCHEMAS.default;
}

/**
 * Get all lead types as options for a select dropdown.
 */
export function getLeadTypeOptions() {
  return Object.entries(LEAD_TYPE_SCHEMAS).map(([value, schema]) => ({
    value,
    label: schema.label,
    description: schema.description,
    color: schema.color,
  }));
}

/**
 * Get the event-level attribute fields for sub-events under an Event Promotor.
 * Reuses the same fields as the "Event" lead type.
 */
export function getPromotorEventFields(): AttributeField[] {
  return LEAD_TYPE_SCHEMAS.event.fields;
}

/**
 * Extract the numeric "size" of a lead based on its type-specific size key.
 * Returns null if the lead type has no size key or the value is missing/non-numeric.
 */
export function getLeadSize(
  leadType: string,
  attrs: Record<string, unknown> | null | undefined
): number | null {
  const schema = getLeadTypeSchema(leadType);
  if (!schema.sizeKey || !attrs) return null;
  const raw = attrs[schema.sizeKey];
  if (raw === undefined || raw === null || raw === "") return null;
  const num = typeof raw === "number" ? raw : Number(raw);
  return isNaN(num) ? null : Math.round(num);
}

/**
 * Build a text summary of lead attributes for RAG indexing.
 */
export function buildAttributeText(leadType: string, attributes: Record<string, unknown>): string {
  const schema = getLeadTypeSchema(leadType);
  if (!schema.fields.length || !attributes) return "";

  const parts: string[] = [`Lead Type: ${schema.label}`];
  for (const field of schema.fields) {
    const val = attributes[field.key];
    if (val !== undefined && val !== null && val !== "") {
      const unit = field.unit ? ` ${field.unit}` : "";
      parts.push(`${field.label}: ${val}${unit}`);
    }
  }
  return parts.join("\n");
}
