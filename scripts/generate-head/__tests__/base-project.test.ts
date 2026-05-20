import { addBaseProjectFiles } from '../generator/base-project'
import { ProjectBuilder } from '../generator/project-builder'

describe('base project generation', () => {
  const buildBuilder = () => new ProjectBuilder('/tmp')

  it('injects alias variables when design system CSS is provided', () => {
    const builder = buildBuilder()
    const sampleCss = {
      canonical: '  --ds-primary: 200 50% 45%;',
      aliases: [
        '  --background: 210 42% 55%;',
        '  --color-bg-primary: #123456;',
        '  --radius: 8px;'
      ].join('\n'),
      combined: [
        '  --ds-primary: 200 50% 45%;',
        '  --background: 210 42% 55%;',
        '  --color-bg-primary: #123456;',
        '  --radius: 8px;'
      ].join('\n'),
      sections: {
        root: [
          '  --ds-primary: 200 50% 45%;',
          '  --background: 210 42% 55%;',
          '  --color-bg-primary: #123456;',
          '  --radius: 8px;'
        ].join('\n'),
        dark: [
          '  color-scheme: dark;',
          '  --background: 240 40% 10%;'
        ].join('\n'),
        themeLight: [
          '  color-scheme: light;',
          '  --color-bg-primary: #123456;'
        ].join('\n'),
        themeDark: [
          '  color-scheme: dark;',
          '  --color-bg-primary: #101820;'
        ].join('\n'),
        themeInverted: [
          '  color-scheme: dark;',
          '  --color-bg-primary: #f5faff;'
        ].join('\n')
      }
    }

    addBaseProjectFiles(builder, {
      projectName: 'test',
      siteName: 'Test Site',
      studioLibAliasPath: './lib',
      remoteImagePatterns: [],
      designSystemCss: sampleCss
    })

    const themeFile = builder.listFiles().find(file => file.path === 'app/(theme)/design-system.css')
    expect(themeFile).toBeDefined()

    const themeContent = themeFile?.contents.toString() ?? ''
    expect(themeContent).toContain('--background: 210 42% 55%;')
    expect(themeContent).toContain('--color-bg-primary: #123456;')
    expect(themeContent).toContain('.dark {\n  color-scheme: dark;\n  --background: 240 40% 10%;')
    expect(themeContent).not.toContain('--background: 210 33% 98%')

    const globals = builder.listFiles().find(file => file.path === 'app/globals.css')
    expect(globals).toBeDefined()
    expect(globals?.contents.toString()).toContain("@import './(theme)/design-system.css';")
  })

  it('falls back to Catalyst defaults when no design system CSS is provided', () => {
    const builder = buildBuilder()

    addBaseProjectFiles(builder, {
      projectName: 'test',
      siteName: 'Test Site',
      studioLibAliasPath: './lib',
      remoteImagePatterns: []
    })

    const themeFile = builder.listFiles().find(file => file.path === 'app/(theme)/design-system.css')
    expect(themeFile).toBeDefined()

    const themeContent = themeFile?.contents.toString() ?? ''
    expect(themeContent).toContain('--background: 210 33% 98%')
    expect(themeContent).toContain('--color-bg-primary: #ffffff;')
  })
})
