/**
 * Page-level questions.
 *
 * @module decisions/questions/page
 */
import { defineQuestion } from '../registry'
import type { BooleanQuestion, DecisionContext, DecisionState } from '../types'

/**
 * Today's behaviour, in one place: the two hardcoded substrings
 * sitemap-discovery.service.ts isLikelyPrivate matches on.
 *
 * Extracted, not rewritten — the body below is the previous inline fallback
 * verbatim, so page.isInternal answers exactly what it answered before and
 * needs no version bump (its instructions, criteria, threshold and facets are
 * untouched, and a version bump would split its 199 observations in two).
 *
 * It is exported so that the second question can use THE SAME rule rather than
 * a hand-copied twin. Two copies would drift, and the moment they drifted the
 * shadow log would stop comparing the two questions against the same baseline,
 * which is the only reason the second question is worth asking.
 */
export function matchesHardcodedInternalPath(context: DecisionContext): boolean {
  if (!context.url) return false
  try {
    const path = new URL(context.url).pathname.toLowerCase()
    return path.includes('/intranet/') || path.includes('/picu_intranet/')
  } catch {
    return false
  }
}

/**
 * Wave 1's first question, and the first one to be flipped out of shadow.
 *
 * It replaces the only barrier stopping internal, staff-only pages from being
 * imported onto a public site — sitemap-discovery.service.ts isLikelyPrivate,
 * which recognises exactly two hardcoded substrings, the second of which is one
 * customer's path. Every other organisation's staff directory, patient portal
 * or internal policy page currently passes straight through and is published.
 */
export const pageIsInternal: BooleanQuestion = defineQuestion<BooleanQuestion>({
  id: 'page.isInternal',
  version: 2,
  owner: 'import',
  shape: 'boolean',
  // URL only. This question is asked during sitemap discovery, before any page
  // is fetched, so headings and body text do not exist yet. Declaring facets we
  // cannot supply would claim evidence the model never sees.
  facets: ['url'],

  instructions:
    'Judging only from its URL, is this page intended for staff, members or ' +
    'internal users of the organisation, rather than for the general public?',

  criteria: {
    true:
      'The path points at an internal area: a staff intranet or portal, an employee ' +
      'or member area, an admin or management section, an internal directory, or a ' +
      'login-gated area. Any language, not only English.',
    false:
      'The path points at a page meant for the public: marketing, services, news, ' +
      'contact, or any page a visitor is expected to find and read.'
  },

  // v2. Only call a page internal when the model is confident. A low cut is
  // NOT safer here, which is the opposite of what this question shipped with.
  //
  // v1 used 0.35, on the reasoning that the errors are asymmetric: that
  // excluding a public page costs merely one missing page while including an
  // internal one publishes a client's intranet. The second half holds. The
  // first half is wrong about magnitude, and 79 observations from
  // a large hospital site show why — at 0.35 the twelve disagreements on
  // that site would all have been excluded, including clinical guidance used
  // internationally, family support and public department microsites.
  // Dropping those is not "one missing page" — it is some of the most
  // valuable public content on the site.
  //
  // The model separates cleanly only at the top of the range. It scored the
  // one genuinely internal path at 0.97, while its mid-range
  // scores are reasoning from department acronyms and
  // are not reliable. 0.84 is the widest gap in the observed distribution.
  //
  // Validated since on two further sites, 120 observations, 99% agreement
  // with the existing rule and exactly one disagreement:
  // a member-portal page at 0.94 — a genuine member
  // area that the two hardcoded substrings do not match. Nothing else on
  // those sites scored above 0.56, so 0.84 is not fitted to the first site.
  // That run's own recommendation was 0.76; 0.84 is kept rather than
  // re-tuned on each new sample, and both catch the same pages here.
  //
  // The deeper limitation stands: this question is asked during discovery,
  // when only the URL exists. A path alone cannot separate "internal
  // department area" from "public department microsite" — which is what the
  // unreliable 0.35-0.71 band on the first site was. Asking it again after
  // fetch, with headings and body text, is the real fix, not a better cut.
  threshold: 0.84,

  // On total failure, exclude. The opposite of the usual "when in doubt, carry
  // on" default, and the right one here.
  //
  // "Total failure" is narrow and deliberate, and the next two lines are what
  // make it true rather than aspirational. It means the model was asked and
  // nothing usable came back: the request failed, it timed out, the response
  // omitted this question, or the answer arrived in a shape the client cannot
  // read. In every one of those the system is blind, and being blind about a
  // staff intranet must not mean publishing it - which is what happened
  // before `whenUnanswered` existed, because the failure path ran the fallback
  // below, and the fallback answers false for every path that is not one of
  // two hardcoded substrings.
  //
  // It does NOT mean an uncertain answer. A page scoring under 0.84 is the
  // ordinary case - most pages are - and it runs the fallback and gets
  // published, exactly as the threshold comment above intends. Nor does it
  // mean the model being off, or in shadow mode: in both of those this
  // question answers with the old rule and nothing else, which is the whole
  // site published as it is today. Shadow mode is the default, and a failed
  // request while shadowing must not start dropping pages from an import that
  // opted in to nothing.
  failSafe: true,
  whenUnanswered: 'failSafe',

  // Today's rule, kept verbatim. It still governs while the question is in
  // shadow mode.
  fallback: (_state: DecisionState, context: DecisionContext): boolean =>
    matchesHardcodedInternalPath(context)
})

/**
 * The same question, asked after the page has been fetched.
 *
 * pageIsInternal above is asked during sitemap discovery, when a URL is all
 * that exists. Its own threshold comment records where that runs out: across
 * 199 observations it was reliable only at the top of the range, and its
 * 0.35-0.71 band was the model reasoning from department acronyms. On
 * a large hospital site that band flagged family support, clinical guidance
 * used internationally and department microsites — every one of them public.
 * A path cannot tell an internal department area from a
 * public department microsite, because the two are spelled the same way.
 *
 * Content might. "Log in with your staff credentials" and "Our support
 * service welcomes families" are not spelled the same way. This question
 * exists to find out whether that is true, on real pages, at a measurable rate.
 *
 * IT TAKES NO ACTION. See `effect` below.
 */
export const pageIsInternalFromContent: BooleanQuestion = defineQuestion<BooleanQuestion>({
  // Named for what makes it different from its sibling: not a new subject, the
  // same subject on different evidence. Anyone reading a shadow-log row, or
  // the two ids side by side, can see which one saw the page.
  id: 'page.isInternalFromContent',
  version: 1,
  owner: 'import',
  shape: 'boolean',

  // Chosen to be exactly what the call site can actually supply, and no more.
  // page.isInternal's facet comment states the rule this follows: declaring a
  // facet we cannot fill claims evidence the model never sees.
  //
  //  - 'url'       kept, so this is the URL question PLUS content rather than
  //                content instead of a URL. If content changes an answer, the
  //                shadow log shows it changed with the path still in view,
  //                which is the comparison that matters against page.isInternal.
  //  - 'headings'  the direct evidence. "Staff intranet" and "Family support
  //                service" are the same shape of path and different
  //                shapes of heading.
  //  - 'text'      the page's own title and description, which is where a
  //                members-only or staff-only page usually says so outright.
  //
  // Deliberately NOT declared:
  //  - 'counts'    the call site assembles evidence nodes from metadata and
  //                detected headings, so a count of images, links and
  //                background images would be a count of the assembly, not of
  //                the page. It would read as a fact and be false.
  //  - 'links', 'media', 'structure', 'nodes'
  //                the call site has no link, image or DOM-outline evidence to
  //                hand at this point. Declaring them would render empty or
  //                misleading blocks.
  facets: ['url', 'headings', 'text'],

  instructions:
    'Reading this page — its title, description and headings, alongside its ' +
    'URL — is it intended for staff, members or internal users of the ' +
    'organisation, rather than for the general public?',

  criteria: {
    true:
      'The page itself is an internal area: a staff intranet or portal, an ' +
      'employee or member area, an admin or management section, an internal ' +
      'directory, or a page that asks the reader to sign in with credentials ' +
      'the organisation issues. Any language, not only English.',
    false:
      'The page is written for the public, including a public microsite for a ' +
      'department, unit, centre or programme. A department name, an acronym or ' +
      'a clinical or technical subject does not make a page internal; ' +
      'professional readers outside the organisation are still the public.'
  },

  // PROVISIONAL, AND UNDERIVED. This question has zero observations.
  //
  // It is NOT 0.84. That number was derived from 199 URL-only observations of
  // a different question, by finding the widest gap in that question's
  // distribution; it describes where a URL-only model separates, and carrying
  // it over would dress an untested question in another question's evidence.
  //
  // 0.5 is a neutral placeholder and is not a claim about anything. Nothing
  // reads it today — the question takes no action — so it decides only which
  // way a shadow row's recorded model value rounds. Derive a real one from
  // this question's OWN rows (scripts/decisions/derive-thresholds) before it is
  // ever allowed to affect behaviour.
  threshold: 0.5,

  // Nothing acts on this answer, so failSafe cannot cost anything today. It
  // mirrors page.isInternal - both the value and the failure behaviour - so
  // the two questions differ in their evidence and in nothing else, which is
  // the only way the comparison stays clean.
  failSafe: true,
  whenUnanswered: 'failSafe',

  // RECORD ONLY — DO NOT WIRE THIS TO A BEHAVIOUR.
  //
  // This question exists to gather evidence about whether content separates
  // internal from public better than a URL does. Nobody knows yet whether it
  // does. Until that is measured on real pages there is nothing to act on, and
  // acting anyway would repeat the mistake this whole exercise is correcting:
  // page.isInternal shipped a threshold of 0.35 on reasoning rather than
  // observation, and 79 real observations showed it would have dropped some of
  // the most valuable public content on the site.
  //
  // So: no skipping, no dropping, no flagging, no reordering, no annotating a
  // page on the strength of this answer. Deciding what to DO comes after the
  // evidence. If you are here to "finish" this, the thing that is missing is
  // observations, not a call site.
  effect: 'record-only',

  // The SAME rule page.isInternal falls back to, by reference. Not re-typed:
  // the whole point of asking twice is that both questions are measured
  // against one identical baseline.
  fallback: (_state: DecisionState, context: DecisionContext): boolean =>
    matchesHardcodedInternalPath(context)
})
