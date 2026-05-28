export interface DistressSignals {
  taxDelinquency: boolean
  taxDelinquencyAmount?: number
  taxDelinquencyYears?: number
  fireCodeViolations: boolean
  fireCodeCount?: number
  fireCodeDetails?: string[]
  codeViolations: string[]
  lisPendens: boolean
  lisPendensAmount?: number
  decliningOccupancy: boolean
  occupancyTrend?: number
  deferredMaintenance: boolean
  maintenanceIssues?: string[]
  outOfStateOwner: boolean
  ownerAge?: number
  yearsOwned?: number
}

export type DealStatus = 'outreach-sent' | 'call-scheduled' | 'loi-stage' | 'under-contract'

export interface PipelineProperty {
  id: string
  facilityName: string
  address: string
  city: string
  state: string
  zipCode: string
  unitCount: number
  unitMix: string
  yearBuilt: number
  landAcres: number
  climatePercent: number
  estimatedValue: number
  askingPrice?: number
  noi?: number
  grossRevenue?: number
  occupancy: number
  ownerName: string
  ownerEntity: string
  ownerEntityState: string
  ownerEntityFormed?: string
  registeredAgent?: string
  ownerMailingAddress: string
  ownerPhone?: string
  ownerEmail?: string
  distressSignals: DistressSignals
  motivationScore: number
  stage: 'identified' | 'researching' | 'outreach' | 'conversation' | 'loi' | 'dd' | 'closed' | 'dead'
  currentStatus: DealStatus
  priority: 'high' | 'medium' | 'low'
  source: 'county-records' | 'drive-by' | 'inbound' | 'broker' | 'data-scrape'
  addedDate: string
  lastActivity?: string
  notes?: string
  outreachLetter?: string
}

export const mockProperties: PipelineProperty[] = [
  {
    id: 'p1',
    facilityName: 'Savannah Mini Storage',
    address: '1804 Louisville Rd',
    city: 'Savannah',
    state: 'GA',
    zipCode: '31415',
    unitCount: 195,
    unitMix: '40× 5×10, 70× 10×10, 60× 10×20, 25× 10×30',
    yearBuilt: 1996,
    landAcres: 2.1,
    climatePercent: 0,
    estimatedValue: 2100000,
    noi: 148000,
    grossRevenue: 248000,
    occupancy: 67,
    ownerName: 'Clarence E. Barrow',
    ownerEntity: 'CEB Holdings LLC',
    ownerEntityState: 'GA',
    ownerEntityFormed: '2001-05-17',
    registeredAgent: 'Georgia Registered Agents Inc.',
    ownerMailingAddress: '214 Telfair Rd, Savannah, GA 31415',
    ownerPhone: '(912) 555-0138',
    ownerEmail: 'cbarrow62@bellsouth.net',
    distressSignals: {
      taxDelinquency: true,
      taxDelinquencyAmount: 38200,
      taxDelinquencyYears: 3,
      fireCodeViolations: true,
      fireCodeCount: 2,
      fireCodeDetails: [
        'Fire suppression system inspection overdue — 2+ years',
        'Emergency exit door non-compliant (Unit Row C)',
      ],
      codeViolations: ['Fence permit expired (2022)', 'Drainage ordinance violation pending'],
      lisPendens: false,
      decliningOccupancy: true,
      occupancyTrend: -11,
      deferredMaintenance: true,
      maintenanceIssues: ['Roof sections 2 & 3 — active leaks', 'Gate keypad system inoperable', '12 overhead door springs need replacement'],
      outOfStateOwner: false,
      ownerAge: 76,
      yearsOwned: 24,
    },
    motivationScore: 91,
    stage: 'dd',
    currentStatus: 'under-contract',
    priority: 'high',
    source: 'county-records',
    addedDate: '2024-09-12',
    lastActivity: '2024-11-10',
    notes: 'LOI signed 10/28. Under due diligence. Title work in progress. Owner confirmed health issues driving timeline. Target close: Dec 12.',
    outreachLetter: `Dear Mr. Barrow,

My name is Marcus Webb with YEM Acquisitions. I'm writing because I've been reviewing self-storage properties in the Savannah area, and your facility at 1804 Louisville Road has been on my research list for several months.

I'll be direct with you: our review of public records turned up some items — property tax arrears going back a few years, and some open compliance notices from the city — that suggest the facility may be going through a difficult stretch. I've worked with dozens of owners in similar positions, and I'm not here to judge. I'm here because we buy properties exactly like this, at fair prices, without the drawn-out broker process that most people dread.

YEM Acquisitions is a private buyer focused exclusively on self-storage. We move in weeks, not months. We don't need perfect books or a freshly painted building. Whatever the challenges with the property, we've seen worse — and we're not afraid of them. We close what we commit to, and our sellers tell us the experience was far simpler than they expected.

If you'd be willing to have a brief, confidential conversation, I believe it would be worth your time. I'm available any day this week at (904) 555-0101, or you can reply directly to this letter. No obligation.

Respectfully,
Marcus Webb
YEM Acquisitions | (904) 555-0101 | joshuaernst@gmail.com`,
  },
  {
    id: 'p2',
    facilityName: 'Sunshine Mini Storage',
    address: '4821 E Hillsborough Ave',
    city: 'Tampa',
    state: 'FL',
    zipCode: '33610',
    unitCount: 424,
    unitMix: '80× 5×10, 150× 10×10, 140× 10×20, 54× 10×30',
    yearBuilt: 1998,
    landAcres: 3.6,
    climatePercent: 20,
    estimatedValue: 4100000,
    noi: 272000,
    grossRevenue: 445000,
    occupancy: 73,
    ownerName: 'Michael D. Patterson',
    ownerEntity: 'Patterson Storage LLC',
    ownerEntityState: 'FL',
    ownerEntityFormed: '1997-09-04',
    registeredAgent: 'Florida Registered Agent Corp.',
    ownerMailingAddress: '12041 Lake Shore Dr, Lutz, FL 33549',
    ownerPhone: '(813) 555-0247',
    ownerEmail: '',
    distressSignals: {
      taxDelinquency: true,
      taxDelinquencyAmount: 47300,
      taxDelinquencyYears: 2,
      fireCodeViolations: true,
      fireCodeCount: 3,
      fireCodeDetails: [
        'Fire suppression system non-operational — Building B',
        'Emergency lighting failed inspection (2 units)',
        'Exit signage missing — Rows D and E',
      ],
      codeViolations: [],
      lisPendens: false,
      decliningOccupancy: true,
      occupancyTrend: -7,
      deferredMaintenance: true,
      maintenanceIssues: ['Pavement cracking — rear lot', 'Security camera system offline', 'Front gate motor failing'],
      outOfStateOwner: false,
      ownerAge: 71,
      yearsOwned: 21,
    },
    motivationScore: 88,
    stage: 'conversation',
    currentStatus: 'call-scheduled',
    priority: 'high',
    source: 'county-records',
    addedDate: '2024-10-03',
    lastActivity: '2024-11-08',
    notes: 'Call scheduled for Nov 14 at 2pm. Owner agreed to discuss after second letter. Son is pressuring him to deal with the tax situation before year-end.',
    outreachLetter: `Dear Mr. Patterson,

My name is Marcus Webb with YEM Acquisitions, a private real estate firm that buys self-storage facilities directly from owners in the Southeast. I've been actively reviewing assets in Hillsborough County, and your facility at 4821 E Hillsborough Avenue caught my attention during that research.

In reviewing public records related to the property, I noticed there appear to be some compliance items and a tax situation that may be adding real stress to daily operations. I mention this not to pry — but because this is precisely the kind of situation where we've helped other operators find a clean exit on their own terms, without a prolonged sales process or the disruption of a public listing.

We buy directly, move quickly (typically 30–45 days from LOI to close), and we've never required a seller to reduce their price at the last minute. Our process is fully confidential — we sign an NDA before you share anything, and your tenants and staff won't know a thing until the day of closing.

If you've had any thoughts about what the next chapter looks like for the facility, I'd genuinely enjoy a brief phone call. No pressure, no obligation. You can reach me directly at (904) 555-0101 or joshuaernst@gmail.com. I'll be in the Tampa area next week if an in-person conversation would be easier.

Respectfully,
Marcus Webb
YEM Acquisitions | (904) 555-0101 | joshuaernst@gmail.com`,
  },
  {
    id: 'p3',
    facilityName: "Wheeler's Self Storage",
    address: '6104 N Loop W',
    city: 'Houston',
    state: 'TX',
    zipCode: '77091',
    unitCount: 310,
    unitMix: '60× 5×10, 110× 10×10, 100× 10×20, 40× 10×30',
    yearBuilt: 2003,
    landAcres: 2.7,
    climatePercent: 35,
    estimatedValue: 3300000,
    noi: 220000,
    grossRevenue: 368000,
    occupancy: 74,
    ownerName: 'Sandra & Roy Wheeler',
    ownerEntity: 'Wheeler Family Properties LLC',
    ownerEntityState: 'TX',
    ownerEntityFormed: '2003-02-28',
    registeredAgent: 'Texas Registered Agents LLC',
    ownerMailingAddress: '8820 Kempwood Dr, Houston, TX 77080',
    ownerPhone: '(832) 555-0319',
    ownerEmail: 'rwheeler58@yahoo.com',
    distressSignals: {
      taxDelinquency: false,
      fireCodeViolations: false,
      fireCodeDetails: [],
      codeViolations: [],
      lisPendens: true,
      lisPendensAmount: 128000,
      decliningOccupancy: true,
      occupancyTrend: -9,
      deferredMaintenance: false,
      outOfStateOwner: false,
      ownerAge: 68,
      yearsOwned: 19,
    },
    motivationScore: 79,
    stage: 'loi',
    currentStatus: 'loi-stage',
    priority: 'high',
    source: 'county-records',
    addedDate: '2024-09-28',
    lastActivity: '2024-11-09',
    notes: 'LOI sent Nov 9 at $2.95M. Lis pendens is from a contractor dispute — Roy confirmed it\'s related to a 2022 renovation gone wrong. Sandra is the decision-maker. Counter expected by Nov 18.',
    outreachLetter: `Dear Mr. and Mrs. Wheeler,

My name is Marcus Webb, and I lead acquisitions at YEM Acquisitions, a private buyer focused exclusively on self-storage in the Sun Belt. I came across your facility at 6104 N Loop West during my active search for storage assets in the Houston metro, and I wanted to reach out personally rather than through a broker.

I've done some initial research on the property and came across a few items in the public record that suggested timing might be meaningful. I won't presume to know your full situation — but I'd like you to know that if selling has come to mind, we're in a position to move quickly and confidentially, on a timeline that works for you.

YEM Acquisitions acquires directly from owners with no broker, no commission, and no public listing. We close in 30–45 days, and we've never required an owner to take a last-minute discount. Our due diligence is thorough but non-invasive — we respect that this is your business and your life's work.

A 10-minute phone call is all it takes to find out whether there's a fit. If there isn't, there's no harm done — and I won't follow up unless you ask me to. You can reach me at (904) 555-0101 anytime, or reply to this letter if you'd prefer to start there.

Respectfully,
Marcus Webb
YEM Acquisitions | (904) 555-0101 | joshuaernst@gmail.com`,
  },
  {
    id: 'p4',
    facilityName: 'Pinecrest Self Storage',
    address: '3881 Blanding Blvd',
    city: 'Jacksonville',
    state: 'FL',
    zipCode: '32210',
    unitCount: 260,
    unitMix: '50× 5×10, 90× 10×10, 90× 10×20, 30× 10×30',
    yearBuilt: 1999,
    landAcres: 2.3,
    climatePercent: 10,
    estimatedValue: 2600000,
    noi: 168000,
    grossRevenue: 292000,
    occupancy: 70,
    ownerName: 'Thomas & Wanda Gentry',
    ownerEntity: 'Gentry Properties LLC',
    ownerEntityState: 'FL',
    ownerEntityFormed: '2008-06-11',
    registeredAgent: 'FL Registered Agent Services',
    ownerMailingAddress: '5502 Ortega Farms Blvd, Jacksonville, FL 32210',
    ownerPhone: '(904) 555-0472',
    distressSignals: {
      taxDelinquency: false,
      fireCodeViolations: false,
      fireCodeDetails: [],
      codeViolations: [
        'Signage code violation — unresolved 14 months',
        'Unlicensed electrical work (2022 inspection)',
        'Drainage violation — rear runoff',
        'Fence height violation (front parcel)',
      ],
      lisPendens: true,
      lisPendensAmount: 67000,
      decliningOccupancy: true,
      occupancyTrend: -6,
      deferredMaintenance: true,
      maintenanceIssues: ['Building C soffit damage', 'Multiple unit door failures (est. 8–10 units)'],
      outOfStateOwner: false,
      ownerAge: 64,
      yearsOwned: 16,
    },
    motivationScore: 77,
    stage: 'outreach',
    currentStatus: 'outreach-sent',
    priority: 'high',
    source: 'data-scrape',
    addedDate: '2024-11-01',
    lastActivity: '2024-11-07',
    notes: 'Letter sent Nov 7. Lis pendens from contractor — confirmed it\'s related to Gentry\'s other property on 103rd St. Four unresolved code violations suggest disengaged ownership.',
    outreachLetter: `Dear Mr. Gentry,

My name is Marcus Webb with YEM Acquisitions. I'm a private buyer of self-storage facilities in the Southeast, and I've been building a watchlist of assets in the Jacksonville market over the past year. Your facility on Blanding Boulevard has been on that list for several months.

I came across some public records related to the property — active code matters and a filed lis pendens — that suggest there may be some complexity in the ownership picture right now. I've seen situations like this many times, and I know they can be genuinely exhausting to manage alongside everything else. If selling has crossed your mind as a way to simplify things, we could potentially help you close this chapter quickly and cleanly.

YEM Acquisitions buys directly from owners. We sign an NDA before any data exchange, we don't involve brokers, and we move from signed LOI to closing in 30–45 days. We price fairly and we close what we commit to — full stop. The open items on the property won't scare us away.

If you're open to a conversation — even a very preliminary one — please reach me at (904) 555-0101 or reply to this letter. I'm in Jacksonville regularly and am happy to meet you at the facility if that's easier.

Respectfully,
Marcus Webb
YEM Acquisitions | (904) 555-0101 | joshuaernst@gmail.com`,
  },
  {
    id: 'p5',
    facilityName: 'Crossroads Storage Center',
    address: '2410 Dickerson Pike',
    city: 'Nashville',
    state: 'TN',
    zipCode: '37207',
    unitCount: 350,
    unitMix: '70× 5×10, 120× 10×10, 120× 10×20, 40× 10×30',
    yearBuilt: 2005,
    landAcres: 3.0,
    climatePercent: 40,
    estimatedValue: 3800000,
    noi: 248000,
    grossRevenue: 398000,
    occupancy: 79,
    ownerName: 'Bryan T. Whitfield',
    ownerEntity: 'Pacific Coast Capital LLC',
    ownerEntityState: 'CA',
    ownerEntityFormed: '2016-03-22',
    registeredAgent: 'CA Registered Agents Inc.',
    ownerMailingAddress: '11100 Santa Monica Blvd Ste 400, Los Angeles, CA 90025',
    ownerPhone: '',
    distressSignals: {
      taxDelinquency: false,
      fireCodeViolations: false,
      fireCodeDetails: [],
      codeViolations: [],
      lisPendens: false,
      decliningOccupancy: true,
      occupancyTrend: -7,
      deferredMaintenance: true,
      maintenanceIssues: ['Security lighting inadequate — north lot', 'Digital access system outdated'],
      outOfStateOwner: true,
      ownerAge: undefined,
      yearsOwned: 8,
    },
    motivationScore: 63,
    stage: 'conversation',
    currentStatus: 'call-scheduled',
    priority: 'medium',
    source: 'data-scrape',
    addedDate: '2024-10-18',
    lastActivity: '2024-11-05',
    notes: 'LinkedIn found Bryan Whitfield — sent InMail and cold email. Call booked for Nov 15 at 11am PT. LLC registered in CA with WeWork address suggests passive investment. Worth exploring partnership dynamics.',
    outreachLetter: `Dear Mr. Whitfield,

My name is Marcus Webb with YEM Acquisitions, a private real estate firm that acquires self-storage assets across the Southeast. I'm reaching out regarding the Crossroads Storage facility on Dickerson Pike in Nashville that I understand is held by Pacific Coast Capital.

Managing a self-storage asset remotely presents real operational challenges that tend to compound over time — particularly in a competitive market like Nashville, where local operators are aggressive about pricing and online marketing. Our research suggests occupancy has trended down over the past 12 months, which is common when a facility isn't getting the hands-on attention it needs to compete locally.

We understand passive investment arrangements and the sometimes difficult conversations they require among principals. If there's any discussion among your group about whether to continue holding or to realize a gain through a clean exit, we'd be a straightforward counterparty — well-capitalized, exclusively focused on storage, and able to close without the disruption of a public process.

A brief call to explore whether there's a fit costs nothing and goes nowhere unless you choose it to. I'm happy to work around your schedule. You can reach me at (904) 555-0101 or joshuaernst@gmail.com.

Regards,
Marcus Webb
YEM Acquisitions | (904) 555-0101 | joshuaernst@gmail.com`,
  },
  {
    id: 'p6',
    facilityName: 'Blue Ridge Storage Center',
    address: '225 Swannanoa River Rd',
    city: 'Asheville',
    state: 'NC',
    zipCode: '28805',
    unitCount: 240,
    unitMix: '50× 5×10, 80× 10×10, 80× 10×20, 30× 10×30',
    yearBuilt: 2001,
    landAcres: 2.2,
    climatePercent: 25,
    estimatedValue: 2800000,
    noi: 186000,
    grossRevenue: 312000,
    occupancy: 81,
    ownerName: 'Earl R. Hutchinson',
    ownerEntity: 'Blue Ridge Storage LLC',
    ownerEntityState: 'NC',
    ownerEntityFormed: '2000-11-30',
    registeredAgent: 'NC Registered Agents Group',
    ownerMailingAddress: '44 Glendale Ave, Asheville, NC 28804',
    ownerPhone: '(828) 555-0093',
    ownerEmail: 'ehutchinson1952@gmail.com',
    distressSignals: {
      taxDelinquency: true,
      taxDelinquencyAmount: 22400,
      taxDelinquencyYears: 1,
      fireCodeViolations: false,
      fireCodeDetails: [],
      codeViolations: [],
      lisPendens: false,
      decliningOccupancy: false,
      deferredMaintenance: true,
      maintenanceIssues: ['Exterior paint overdue', 'Office HVAC needs replacement', 'Unit door seals on 14 units'],
      outOfStateOwner: false,
      ownerAge: 72,
      yearsOwned: 23,
    },
    motivationScore: 68,
    stage: 'outreach',
    currentStatus: 'outreach-sent',
    priority: 'medium',
    source: 'county-records',
    addedDate: '2024-10-25',
    lastActivity: '2024-11-02',
    notes: 'Letter sent Nov 2. Earl has owned since 2001. Local reputation as a quality operator. One year tax delinquency may just be an oversight — but at 72 with no obvious succession plan, retirement conversation may be relevant.',
    outreachLetter: `Dear Mr. Hutchinson,

My name is Marcus Webb with YEM Acquisitions. Our firm acquires self-storage facilities directly from long-term operators in the Southeast, and your facility on Swannanoa River Road has been on my radar as I evaluate the Asheville market.

Running a self-storage business for more than two decades takes real dedication — and I have genuine respect for operators who have built something of quality over that kind of timeframe. I've found that many owners at a certain stage begin to think about what the next chapter looks like, whether that means simplifying day-to-day responsibilities, taking care of estate planning, or simply realizing the full value of something they've spent years building.

We work quietly and without brokers. No signs go up on the building, your tenants and staff won't hear a thing, and we sign a mutual NDA before you share a single financial figure. Our process is designed to protect you from the first conversation to the last signature.

If you're open to it, I'd appreciate 15 minutes of your time — just a conversation. There's no pressure and no obligation. I can come to Asheville if that's more convenient than a phone call. Please reach me at (904) 555-0101 or joshuaernst@gmail.com.

With respect,
Marcus Webb
YEM Acquisitions | (904) 555-0101 | joshuaernst@gmail.com`,
  },
]

export const STAGES = [
  { key: 'identified', label: 'Identified' },
  { key: 'researching', label: 'Researching' },
  { key: 'outreach', label: 'Outreach' },
  { key: 'conversation', label: 'In Conversation' },
  { key: 'loi', label: 'LOI Sent' },
  { key: 'dd', label: 'Under DD' },
  { key: 'closed', label: 'Closed' },
  { key: 'dead', label: 'Dead' },
] as const

export function tier(score: number): 'HOT' | 'WARM' | 'COLD' {
  if (score >= 75) return 'HOT'
  if (score >= 50) return 'WARM'
  return 'COLD'
}

export function tierColor(t: 'HOT' | 'WARM' | 'COLD'): string {
  if (t === 'HOT') return 'text-red-700 border-red-400/50 bg-red-50'
  if (t === 'WARM') return 'text-amber-700 border-amber-500/50 bg-amber-50'
  return 'text-[#5A5A55] border-[#E0DDD4] bg-[#F5F5F0]'
}

export function statusLabel(s: DealStatus): string {
  const map: Record<DealStatus, string> = {
    'outreach-sent': 'Outreach Sent',
    'call-scheduled': 'Call Scheduled',
    'loi-stage': 'LOI Stage',
    'under-contract': 'Under Contract',
  }
  return map[s]
}

export function statusColor(s: DealStatus): string {
  const map: Record<DealStatus, string> = {
    'outreach-sent': 'text-[#5A5A55] border-[#E0DDD4]',
    'call-scheduled': 'text-blue-700 border-blue-400/40 bg-blue-50',
    'loi-stage': 'text-amber-700 border-amber-500/40 bg-amber-50',
    'under-contract': 'text-green-700 border-green-500/40 bg-green-50',
  }
  return map[s]
}

export function scoreColor(score: number): string {
  if (score >= 80) return 'text-red-700 border-red-400/50 bg-red-50'
  if (score >= 65) return 'text-amber-700 border-amber-500/50 bg-amber-50'
  if (score >= 45) return 'text-yellow-700 border-yellow-500/50 bg-yellow-50'
  return 'text-[#5A5A55] border-[#E0DDD4] bg-[#F5F5F0]'
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'HIGH'
  if (score >= 65) return 'MOD-HIGH'
  if (score >= 45) return 'MODERATE'
  return 'LOW'
}

export function stageBadgeColor(stage: string): string {
  const map: Record<string, string> = {
    identified: 'text-[#5A5A55] border-[#E0DDD4]',
    researching: 'text-blue-700 border-blue-400/40 bg-blue-50',
    outreach: 'text-amber-700 border-amber-500/40 bg-amber-50',
    conversation: 'text-purple-700 border-purple-400/40 bg-purple-50',
    loi: 'text-green-700 border-green-500/40 bg-green-50',
    dd: 'text-emerald-700 border-emerald-500/40 bg-emerald-50',
    closed: 'text-emerald-700 border-emerald-500/40 bg-emerald-50',
    dead: 'text-[#5A5A55]/50 border-[#E0DDD4]/50',
  }
  return map[stage] ?? 'text-[#5A5A55] border-[#E0DDD4]'
}
