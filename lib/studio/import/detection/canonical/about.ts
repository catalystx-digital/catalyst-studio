import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { registerCanonicalComponent } from './registry'
import type { CanonicalComponentDefinition } from './registry'

let registered = false

export const aboutCanonicalDefinitions: CanonicalComponentDefinition[] = [
  {
    canonicalType: ComponentType.TeamGrid,
    componentType: ComponentType.TeamGrid,
    summary: 'Team grid section for leadership, staff, or contributor profiles.',
    fragments: ['team-member', 'profile-card'],
    cues: ['team grid', 'team members', 'leadership'],
    sampleContent: {
      heading: 'Meet the leadership team',
      members: [
        {
          type: 'team-member',
          content: {
            name: 'Jonah Patel',
            title: 'CEO & Co-founder',
            bio: 'Previously led platform strategy at Atlassian.',
            image: {
              src: 'https://cdn.example.com/team/jonah.jpg',
              alt: 'Jonah Patel'
            },
            socialLinks: [
              { label: 'LinkedIn', url: 'https://www.linkedin.com/in/jonahpatel/' }
            ]
          }
        },
        {
          type: 'team-member',
          content: {
            name: 'Linh Tran',
            title: 'VP of Product',
            bio: 'Drives roadmap for collaboration and AI-assisted workflows.',
            image: {
              src: 'https://cdn.example.com/team/linh.jpg',
              alt: 'Linh Tran'
            }
          }
        }
      ],
      columns: { desktop: 3 }
    }
  },
  {
    canonicalType: ComponentType.AboutSection,
    componentType: ComponentType.AboutSection,
    summary: 'About section combining company story, values, milestones, and supporting statistics.',
    fragments: ['story', 'values', 'milestones', 'stats'],
    cues: ['about section', 'company story', 'our mission'],
    sampleContent: {
      heading: 'Built for modern experience teams',
      subheading: 'Catalyst Studio unifies creation, collaboration, and governance.',
      story: 'We founded Catalyst to help teams iterate faster without sacrificing quality.',
      values: [
        { title: 'Move fast with guardrails', description: 'Balance speed with governance so teams can trust every release.' },
        { title: 'Design for humans', description: 'Prioritize accessibility and clarity in every surface.' }
      ],
      milestones: [
        { year: '2022', title: 'Seed funding and first design partners' },
        { year: '2023', title: 'Launched AI-assisted editor' }
      ],
      stats: [
        { value: '4x', label: 'Faster publishing velocity' },
        { value: '98%', label: 'Customer satisfaction' }
      ],
      layout: 'two-column'
    }
  },
  {
    canonicalType: ComponentType.Mission,
    componentType: ComponentType.Mission,
    summary: 'Mission statement section highlighting purpose, vision, and core focus.',
    fragments: ['mission-statement', 'vision', 'supporting-points'],
    cues: ['mission statement', 'company mission', 'purpose'],
    sampleContent: {
      heading: 'Our mission',
      mission: 'Empower every team to create, launch, and scale digital experiences without friction.',
      vision: 'A composable future where content, design, and data stay in sync.',
      focusAreas: [
        { title: 'Collaboration', description: 'Enable marketing, product, and engineering to work together seamlessly.' },
        { title: 'Governance', description: 'Ensure every brand touchpoint meets enterprise-quality standards.' }
      ]
    }
  },
  {
    canonicalType: ComponentType.Timeline,
    componentType: ComponentType.Timeline,
    summary: 'Timeline section for chronological milestones, roadmap events, or history entries.',
    fragments: ['timeline-event', 'timeline-track'],
    cues: ['company timeline', 'roadmap timeline', 'chronology'],
    sampleContent: {
      title: 'Catalyst milestones',
      events: [
        {
          type: 'timeline-event',
          content: {
            date: '2022',
            title: 'Company founded',
            description: 'Raised seed to build AI-first content platform.'
          }
        },
        {
          type: 'timeline-event',
          content: {
            date: '2023',
            title: 'First enterprise launch',
            description: 'Scaled to support Fortune 500 content programs.'
          }
        }
      ],
      layout: 'vertical',
      showConnectors: true
    }
  }
]

export function registerAboutCanonicalComponents(): void {
  if (registered) {
    return
  }

  for (const definition of aboutCanonicalDefinitions) {
    registerCanonicalComponent(definition)
  }

  registered = true
}
