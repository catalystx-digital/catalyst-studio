import { salvageTruncatedJson } from '../json-parsing'

describe('salvageTruncatedJson', () => {
  it('returns null for complete JSON', () => {
    expect(salvageTruncatedJson('{"sectionKey":"footer","components":[]}')).toBeNull()
  })

  it('returns null for a syntax error that is not a cut-off', () => {
    // Balanced brackets, invalid content: a parse failure that must keep
    // surfacing as a parse failure rather than being silently rewritten.
    expect(salvageTruncatedJson('{"components":[,]}')).toBeNull()
  })

  it('returns null for empty or whitespace input', () => {
    expect(salvageTruncatedJson('')).toBeNull()
    expect(salvageTruncatedJson('   ')).toBeNull()
  })

  it('keeps finished array elements and drops the one still being written', () => {
    const salvage = salvageTruncatedJson('{"items":[{"a":1},{"a"')
    expect(salvage).not.toBeNull()
    expect(salvage!.text).toBe('{"items":[{"a":1}]}')
    expect(JSON.parse(salvage!.text)).toEqual({ items: [{ a: 1 }] })
    expect(salvage!.closedContainers).toBe(2)
    expect(salvage!.droppedChars).toBe(5)
  })

  it('keeps the components a truncated section reply did finish', () => {
    // Shape of one site's footer reply: sectionKey and two whole
    // components present, the third cut off mid-object.
    const raw =
      '{"sectionKey":"footer","components":[' +
      '{"component":"footer","confidence":0.9,"content":{"copyright":"Example"}},' +
      '{"component":"navbar","confidence":0.8,"content":{"menuItems":[]}},' +
      '{"component":"card-grid","confidence":0.7,"content":{"cards":[{"title":"Cont'

    const salvage = salvageTruncatedJson(raw)
    expect(salvage).not.toBeNull()
    const parsed = JSON.parse(salvage!.text) as {
      sectionKey: string
      components: Array<{ component: string }>
    }
    expect(parsed.sectionKey).toBe('footer')
    expect(parsed.components.map(component => component.component)).toEqual(['footer', 'navbar'])
  })

  it('drops a container that was opened but never filled instead of closing it empty', () => {
    // `{` for the second card opened and nothing inside it finished, so the
    // second card must disappear rather than survive as `{}` and then fail
    // schema validation for missing required fields.
    const salvage = salvageTruncatedJson('{"cards":[{"title":"A"},{"tit')
    expect(salvage).not.toBeNull()
    expect(JSON.parse(salvage!.text)).toEqual({ cards: [{ title: 'A' }] })
  })

  it('cuts back to the last finished key when a value is missing', () => {
    const salvage = salvageTruncatedJson('{"sectionKey":"footer","components":')
    expect(salvage).not.toBeNull()
    expect(JSON.parse(salvage!.text)).toEqual({ sectionKey: 'footer' })
  })

  it('does not mistake brackets or escaped quotes inside strings for structure', () => {
    const salvage = salvageTruncatedJson('{"items":[{"text":"a [b] {c} \\" d"},{"text":"unfinis')
    expect(salvage).not.toBeNull()
    expect(JSON.parse(salvage!.text)).toEqual({ items: [{ text: 'a [b] {c} " d' }] })
  })

  it('salvages a truncated top-level array', () => {
    const salvage = salvageTruncatedJson('[{"a":1},{"a":2},{"a"')
    expect(salvage).not.toBeNull()
    expect(JSON.parse(salvage!.text)).toEqual([{ a: 1 }, { a: 2 }])
  })

  it('returns null when nothing inside the outermost container finished', () => {
    // `{"components":[{"comp` has no complete element anywhere. The only thing
    // a cut could produce is `{}` or an empty components array, neither of
    // which carries a recoverable component, so this is a failure and must be
    // reported as one rather than as an empty success.
    expect(salvageTruncatedJson('{"components":[{"comp')).toBeNull()
  })

  it('returns null when a top-level array finished no element', () => {
    expect(salvageTruncatedJson('[{"a"')).toBeNull()
  })

  describe('the bound: only components the model finished survive', () => {
    // One reply, cut at three places around the point where its first
    // component closes. `afterFirstComponent` is that closing brace: cut after
    // it and one whole component arrived, cut before it and none did.
    const reply =
      '{"sectionKey":"main-1","components":[' +
      '{"component":"hero","content":{"title":"Welcome","cta":{"label":"Book","href":"/book"}}},' +
      '{"component":"card-grid","content":{"cards":[{"title":"A"},{"title":"B"},{"title":"C"'
    const afterFirstComponent = reply.indexOf('},{"component":"card-grid"') + 1

    it('keeps a component the reply closed, when the cut lands just after it', () => {
      const salvage = salvageTruncatedJson(reply.slice(0, afterFirstComponent + 30))
      expect(salvage).not.toBeNull()
      const parsed = JSON.parse(salvage!.text) as { components: Array<{ component: string }> }
      expect(parsed.components.map(component => component.component)).toEqual(['hero'])
    })

    it('drops a component the reply never closed, even when most of it arrived', () => {
      // Cut one character before the hero's closing brace: every field of the
      // hero is present, and it is still discarded, because "nearly finished"
      // is not a claim the reply supports.
      const salvage = salvageTruncatedJson(reply.slice(0, afterFirstComponent - 1))
      expect(salvage).toBeNull()
    })

    it('does not keep a half-written component just because its inner array finished items', () => {
      // The whole reply arrived except the last card's closing brace: the
      // card-grid holds 2 finished cards out of an unknown total. Salvaging
      // into that array would publish a card-grid missing content nobody can
      // count, so only the component that closed survives.
      const salvage = salvageTruncatedJson(reply)
      expect(salvage).not.toBeNull()
      const parsed = JSON.parse(salvage!.text) as { components: Array<{ component: string }> }
      expect(parsed.components.map(component => component.component)).toEqual(['hero'])
    })

    it('discards a bigger share of the reply for a good salvage than for the rejected ones', () => {
      // Why droppedChars is not the bound. The salvage that keeps only finished
      // work throws away far more received text than the two salvages this
      // change rejects, so any fraction-of-characters threshold would keep the
      // wrong ones and reject the right one.
      const good = salvageTruncatedJson(reply)!
      expect(good.droppedChars / reply.length).toBeGreaterThan(0.4)

      const navbarCutAtLinkThree =
        '{"sectionKey":"header-0","components":[{"component":"navbar","content":{"links":[' +
        '{"label":"Link 1","href":"/link-1"},{"label":"Link 2","href":"/link-2"},{"label":"Link 3"'
      expect(salvageTruncatedJson(navbarCutAtLinkThree)).toBeNull()
    })
  })
})
