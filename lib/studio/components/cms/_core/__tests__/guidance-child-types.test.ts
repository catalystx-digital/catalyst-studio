/**
 * A definition's guidance is read by the import model and copied literally. If
 * it names a component type that is not registered, the model emits that type,
 * the page stores it, and the renderer then fails to load it - taking the whole
 * page down with it. Two of eighteen pages in a real import died this way,
 * because two-column's own example advertised a child of type "image" while the
 * supported-children list three lines above it said to use "image-gallery".
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { loadAllDefinitions, getDefinedTypes, getSubComponentTypes } from '../definition-loader'

// `href` objects in the same examples carry a "type" too, naming a link kind
// rather than a component. Nothing else belongs here: "image" in particular is
// the exact value this test exists to reject.
const LINK_KINDS = new Set(['internal', 'external'])

describe('definition guidance only names registered component types', () => {
  let allowed: Set<string>

  beforeAll(async () => {
    await loadAllDefinitions()
    allowed = new Set([...getDefinedTypes(), ...getSubComponentTypes()])
  })

  it('knows the registry loaded', () => {
    expect(allowed.size).toBeGreaterThan(10)
  })

  it('two-column guidance names only types the renderer can load', () => {
    const file = join(__dirname, '../../content/two-column/two-column.def.ts')
    const text = readFileSync(file, 'utf8')

    // Guidance embeds JSON examples as single-quoted strings, so the inner
    // double quotes survive verbatim: '"type": "text-block"'.
    const named = new Set<string>()
    for (const match of text.matchAll(/"type"\s*:\s*"([a-z0-9-]+)"/g)) named.add(match[1])

    expect(named.size).toBeGreaterThan(0)

    const unknown = [...named].filter(
      type => !allowed.has(type) && !LINK_KINDS.has(type)
    )
    expect(unknown).toEqual([])
  })

  it('image is still not a component type, which is why the guidance must not name it', () => {
    expect(allowed.has('image')).toBe(false)
    expect(allowed.has('image-gallery')).toBe(true)
  })
})
