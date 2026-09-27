/** @jest-environment node */
import type { DetectedComponent } from '../types'
import { findInventedText, normalizeText, pageTextCorpus } from './text-provenance'

const component = (content: Record<string, unknown>): DetectedComponent => ({component: 'fixture', type: 'fixture' as any, confidence: 1, content})
const flags = (content: Record<string, unknown>, html: string) => findInventedText([component(content)], pageTextCorpus(html))

test('flags an invented FAQ answer and leaves content unchanged', () => {
  const content = {items: [{question: 'What is the joining fee?', answer: 'There is no fee at all.'}]}
  expect(flags(content, '<p>What is the joining fee?</p>')).toEqual([
    {componentIndex: 0, type: 'field', path: 'content.items[0].answer', value: 'There is no fee at all.'}
  ])
  expect(content.items[0].answer).toBe('There is no fee at all.')
})

test('flags invented labels in an array without changing item indexes', () => {
  const content = {links: [{label: 'Visit our shop', href: '/shop'}, {label: 'Learn more', href: '/learn'}]}
  expect(flags(content, '<a>Visit our shop</a>')).toEqual([
    {componentIndex: 0, type: 'field', path: 'content.links[1].label', value: 'Learn more'}
  ])
})

test('keeps HTML entities, case changes, and inline tag text from trees', () => {
  expect(flags({title: 'Join the ACME&nbsp;Club!'}, '<p>join the Acme club</p>')).toEqual([])
  expect(flags({title: 'Join the ACME Club today'}, '<p>Join the <b>ACME</b> Club today</p>')).toEqual([])
})

test('skips non-text fields, alt, and form-field identifiers', () => {
  const content = {href: '/join', variant: 'primary', icon: 'sparkle', backgroundColor: '#abcdef', alt: 'Invented image description', fields: [{name: 'query', id: 'search-query', label: 'Search site'}]}
  expect(flags(content, '<label>Search site</label>')).toEqual([])
})

test('skips numeric strings and reads raw form attributes', () => {
  expect(flags({value: '100', placeholder: 'Email address', title: 'Join today'}, '<input value="200" placeholder="Email address" title="Join today">')).toEqual([])
})

test('reads alt and aria-label as source evidence', () => {
  expect(flags({title: 'A friendly illustrated guide', label: 'Open the member menu'}, '<img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" alt="A friendly illustrated guide"><button aria-label="Open the member menu"></button>')).toEqual([])
})

test('keeps a long paragraph when one word differs', () => {
  const source = Array.from({length: 6}, () => 'The bright garden welcomes guests throughout spring with music and food beside the historic river every Sunday afternoon').join(' ')
  expect(flags({body: source.replace('historic', 'ancient')}, `<p>${source}</p>`)).toEqual([])
  expect(normalizeText(normalizeText(source))).toBe(normalizeText(source))
})

test('keeps a nav label found elsewhere on the same page', () => {
  expect(flags({label: 'Member services'}, '<main><p>Current block</p></main><nav>Member services</nav>')).toEqual([])
})

test('compares HTML field text without markup', () => {
  expect(flags({bodyHtml: '<p>Join the Acme club</p>'}, '<section>Join the Acme club</section>')).toEqual([])
})

test('keeps words split by link gaps in the source', () => {
  expect(flags({body: 'Acme is . Our code is open'}, '<p>Acme is <a href="/about">free software</a>. Our code is open</p>')).toEqual([])
})

test('folds curly apostrophes when matching source copy', () => {
  expect(flags({body: 'You’ll love this collection'}, "<p>You'll love this collection</p>")).toEqual([])
})

test('flags an absent sentence', () => {
  expect(flags({body: 'Please refer to the membership terms.'}, '<p>Join the Acme club today.</p>')).toEqual([
    {componentIndex: 0, type: 'field', path: 'content.body', value: 'Please refer to the membership terms.'}
  ])
})
