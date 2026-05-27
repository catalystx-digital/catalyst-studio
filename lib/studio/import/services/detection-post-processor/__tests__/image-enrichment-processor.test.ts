import { enrichComponentImages } from '../image-enrichment-processor'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'

describe('image enrichment processor', () => {
  let logSpy: jest.SpyInstance

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('rejects tracking, logo, flag, and interpreter utility images', () => {
    const components: DetectedComponent[] = [
      {
        type: 'card-grid',
        component: 'card-grid',
        confidence: 0.9,
        content: {
          cards: [{ title: 'Emergency Department', description: 'Emergency Department care' }],
        },
      },
    ]
    const domSnapshot = `
      <section>
        <img src="https://www.facebook.com/tr?id=123" alt="">
        <img src="https://www.rch.org.au/assets/RCH-Master-500-000.png" alt="RCH">
        <img src="https://www.rch.org.au/assets/flags/vietnam.png" alt="Vietnamese">
        <img src="https://www.rch.org.au/assets/auslan-interpreter.svg" alt="Auslan">
        <h2>Emergency Department</h2>
        <p>Emergency Department care</p>
        <img src="/uploaded/ed-waiting-room.jpg" alt="Emergency Department waiting room">
      </section>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://www.rch.org.au/home/',
    })

    expect(result[0].content).toMatchObject({
      cards: [
        {
          image: {
            src: {
              mediaId: 'detected:ed-waiting-room',
              mediaType: 'image',
              url: 'https://www.rch.org.au/uploaded/ed-waiting-room.jpg',
            },
            alt: 'Emergency Department waiting room',
          },
        },
      ],
    })
    expect(JSON.stringify(result[0].content)).not.toContain('facebook.com/tr')
    expect(JSON.stringify(result[0].content)).not.toContain('RCH-Master')
    expect(JSON.stringify(result[0].content)).not.toContain('flags/vietnam')
    expect(JSON.stringify(result[0].content)).not.toContain('auslan-interpreter')
  })

  it('does not log added image when a matched candidate cannot mutate the component schema', () => {
    const components: DetectedComponent[] = [
      {
        type: 'text-block',
        component: 'text-block',
        confidence: 0.9,
        content: { heading: 'Emergency Department', body: 'Emergency Department care' },
      },
    ]
    const domSnapshot = `
      <section>
        <h2>Emergency Department</h2>
        <p>Emergency Department care</p>
        <img src="/uploaded/ed-waiting-room.jpg" alt="Emergency Department waiting room">
      </section>
    `

    enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://www.rch.org.au/home/',
    })

    expect(logSpy).not.toHaveBeenCalledWith(
      '[ImageEnrichment] Added image to component:',
      expect.anything()
    )
    expect(logSpy).toHaveBeenCalledWith(
      '[ImageEnrichment] Skipped image candidate:',
      expect.objectContaining({ reason: 'schema_unsupported_or_no_item_match' })
    )
  })

  it('does not reject content images merely because the filename contains flag or logo', () => {
    const components: DetectedComponent[] = [
      {
        type: 'card-grid',
        component: 'card-grid',
        confidence: 0.9,
        content: {
          cards: [{ title: 'Red flag symptoms', description: 'Red flag symptoms to monitor' }],
        },
      },
    ]
    const domSnapshot = `
      <section>
        <h2>Red flag symptoms</h2>
        <p>Red flag symptoms to monitor</p>
        <img src="/uploaded/red-flag-symptoms.jpg" alt="Red flag symptoms">
      </section>
    `

    const result = enrichComponentImages(components, {
      domSnapshot,
      pageUrl: 'https://www.rch.org.au/home/',
    })

    expect(result[0].content).toMatchObject({
      cards: [
        {
          image: {
            src: {
              url: 'https://www.rch.org.au/uploaded/red-flag-symptoms.jpg',
            },
          },
        },
      ],
    })
  })
})
