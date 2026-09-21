/**
 * @jest-environment node
 */
import { normalizeFooterContent } from '../nav-normalizers'

const options = { parentCanonicalType: 'page' }

/** A "powered by CookieYes" consent badge, as it arrives from detection. */
const consentVendorBadge = {
  alt: 'Cookieyes logo',
  src: {
    mediaId: 'detected:poweredbtcky-svg',
    mediaType: 'image',
    url: 'https://cdn-cookieyes.com/assets/images/poweredbtcky.svg'
  }
}

describe('footer logo resolution', () => {
  it('falls back to the site name when the only logo is a consent vendor badge', () => {
    // The regression this pins: rejecting the badge used to return early, which
    // skipped the site-name text fallback as well, so the footer rendered no
    // logo at all where it should have rendered "Acme".
    const { content } = normalizeFooterContent(
      { logo: consentVendorBadge, siteName: 'Acme' },
      options
    )

    expect(content.logo).toEqual(expect.objectContaining({ text: 'Acme' }))
    expect(JSON.stringify(content.logo).toLowerCase()).not.toContain('cookieyes')
    expect(JSON.stringify(content.logo).toLowerCase()).not.toContain('poweredbtcky')
  })

  it('publishes no logo when a consent vendor badge is all there is', () => {
    const { content } = normalizeFooterContent({ logo: consentVendorBadge }, options)

    expect(content.logo).toBeUndefined()
  })

  it('leaves a genuine footer logo untouched', () => {
    const { content } = normalizeFooterContent(
      {
        logo: {
          alt: 'Acme Group',
          src: {
            mediaId: 'detected:acme-logo-svg',
            mediaType: 'image',
            url: 'https://www.acme.com/themes/logo.svg'
          }
        },
        siteName: 'Acme'
      },
      options
    )

    expect(content.logo).toEqual(
      expect.objectContaining({
        alt: 'Acme Group',
        src: expect.objectContaining({
          mediaId: 'detected:acme-logo-svg',
          mediaType: 'image',
          url: 'https://www.acme.com/themes/logo.svg'
        })
      })
    )
  })

  it('skips a consent vendor badge in favour of a real logo in a later alias', () => {
    // The navbar loop continues to the next candidate rather than abandoning
    // the resolution; the footer alias chain now behaves the same way.
    const { content } = normalizeFooterContent(
      {
        logo: consentVendorBadge,
        logoImage: {
          alt: 'Acme Group',
          src: {
            mediaId: 'detected:acme-logo-svg',
            mediaType: 'image',
            url: 'https://www.acme.com/themes/logo.svg'
          }
        }
      },
      options
    )

    expect(content.logo).toEqual(
      expect.objectContaining({
        src: expect.objectContaining({ mediaId: 'detected:acme-logo-svg' })
      })
    )
    expect(JSON.stringify(content.logo).toLowerCase()).not.toContain('cookieyes')
  })
})
