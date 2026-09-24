import { ContactInfo, Lead } from './leadsData'

// Shared by the API route and the leads page so the pre-flight count the user
// sees and the work the server actually does can never disagree.

/** True when contact_info holds at least one real value. Rows imported from the
 *  scrapers often look like {"email":null,"phone":null} — populated in the
 *  column sense, but carrying no contact data, so they still need enrichment. */
export function hasRealContact(ci: ContactInfo | undefined | null): boolean {
  if (!ci) return false
  return !!(
    (ci.phone && ci.phone.trim()) ||
    (ci.email && ci.email.trim()) ||
    (ci.linkedIn && ci.linkedIn.trim()) ||
    (ci.mailingAddress && ci.mailingAddress.trim())
  )
}

const COMPANY_TOKENS = /\b(llc|l\.l\.c|inc|incorporated|corp|corporation|co|company|lp|llp|ltd|limited|trust|trustee|holdings?|properties|property|storage|mini|self|partners?|group|associates?|enterprises?|management|investments?|realty|capital|ventures?|bank|estate|listing|portfolio|facility|facilities|rentals?|centers?|centres?|systems?|services?|solutions?)\b/i

const PLACEHOLDERS = /^(bizquest listing|listing|unknown|n\/?a|none|owner|test|tbd|-+)$/i

/** Apollo's people/match endpoint matches a PERSON. Sending it a company or a
 *  placeholder burns a credit and returns nothing, so screen those out locally
 *  before spending anything. */
export function looksLikePersonName(raw: string | undefined | null): boolean {
  if (!raw) return false
  const name = raw.trim()
  if (!name) return false
  if (PLACEHOLDERS.test(name)) return false
  if (/\d/.test(name)) return false            // case numbers, "STORAGE USA #511"
  if (/[#&@/]/.test(name)) return false
  if (COMPANY_TOKENS.test(name)) return false

  const words = name.replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 4) return false
  return words.every(w => /^[A-Za-z'’-]+$/.test(w))
}

export type SkipReason = 'has-contact' | 'no-owner-name' | 'not-a-person-name'

/** Why this lead would be skipped, or null when it is worth an Apollo call. */
export function skipReasonFor(lead: Lead): SkipReason | null {
  if (hasRealContact(lead.contactInfo)) return 'has-contact'
  if (!lead.ownerName || !lead.ownerName.trim()) return 'no-owner-name'
  if (!looksLikePersonName(lead.ownerName)) return 'not-a-person-name'
  return null
}

/** Leads worth spending a credit on, best score first. */
export function enrichCandidates(leads: Lead[]): Lead[] {
  return leads
    .filter(l => skipReasonFor(l) === null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}
