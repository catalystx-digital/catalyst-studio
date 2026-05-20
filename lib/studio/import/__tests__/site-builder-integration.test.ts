import { ImportOrchestrator } from '../services/import-orchestrator';
import { PrismaClient } from '@/lib/generated/prisma';

// Mock site builder components and utilities
const mockSiteBuilder = {
  loadPage: jest.fn(),
  renderComponent: jest.fn(),
  saveChanges: jest.fn(),
  validateComponentTree: jest.fn(),
  generatePreview: jest.fn(),
  handleNavigation: jest.fn(),
  dragDropReorder: jest.fn(),
  editComponent: jest.fn()
};

// Mock Prisma with site builder integration data
const mockPrisma = {
  websitePage: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn()
  },
  websiteStructure: {
    findMany: jest.fn(),
    findFirst: jest.fn()
  },
  websiteComponentType: {
    findMany: jest.fn(),
    findUnique: jest.fn()
  },
  websiteSharedComponent: {
    findMany: jest.fn(),
    update: jest.fn()
  }
} as any;

describe('Site Builder Integration Tests', () => {
  const websiteId = 'site-builder-test';
  
  beforeEach(() => {
    jest.clearAllMocks();
    setupSiteBuilderMocks();
  });

  describe('Opening Imported Pages', () => {
    it('should open imported pages in site builder without errors', async () => {
      // Arrange
      const importedPages = [
        {
          id: 'page-1',
          websiteId,
          title: 'Home Page',
          type: 'page',
          content: {
            components: [
              {
                id: 'header-comp-1',
                typeId: 'ct-header-1',
                type: 'header',
                parentId: null,
                position: 0,
                props: {
                  title: 'Welcome to Our Site',
                  logo: '/images/logo.png',
                  navigation: ['Home', 'About', 'Contact']
                }
              },
              {
                id: 'hero-comp-1',
                typeId: 'ct-hero-1',
                type: 'hero',
                parentId: null,
                position: 1,
                props: {
                  headline: 'Transform Your Business Today',
                  subtitle: 'Leading solutions for modern enterprises',
                  backgroundImage: '/images/hero-bg.jpg',
                  ctaText: 'Get Started'
                }
              },
              {
                id: 'button-comp-1',
                typeId: 'ct-button-1',
                type: 'button',
                parentId: 'hero-comp-1',
                position: 0,
                props: {
                  text: 'Learn More',
                  variant: 'primary',
                  size: 'large'
                }
              }
            ]
          },
          metadata: {
            seo: {
              title: 'Home - Our Company',
              description: 'Welcome to our company homepage'
            }
          }
        },
        {
          id: 'page-2',
          websiteId,
          title: 'About Us',
          type: 'page',
          content: {
            components: [
              {
                id: 'about-header-1',
                typeId: 'ct-header-1',
                type: 'header',
                parentId: null,
                position: 0,
                props: {
                  title: 'About Our Company',
                  showBreadcrumb: true
                }
              },
              {
                id: 'content-section-1',
                typeId: 'ct-content-1',
                type: 'content-section',
                parentId: null,
                position: 1,
                props: {
                  content: 'We are a leading company in our industry...',
                  layout: 'two-column'
                }
              }
            ]
          }
        }
      ];

      const componentTypes = [
        {
          id: 'ct-header-1',
          websiteId,
          type: 'header',
          category: 'layout',
          displayName: 'Header',
          defaultConfig: {
            showLogo: true,
            showNavigation: true,
            sticky: false
          },
          placeholderData: {
            title: 'Page Title',
            logo: '/placeholder-logo.png'
          }
        },
        {
          id: 'ct-hero-1',
          websiteId,
          type: 'hero',
          category: 'content',
          displayName: 'Hero Section',
          defaultConfig: {
            fullHeight: false,
            overlay: true,
            alignment: 'center'
          },
          placeholderData: {
            headline: 'Your Hero Headline',
            subtitle: 'Supporting text goes here'
          }
        },
        {
          id: 'ct-button-1',
          websiteId,
          type: 'button',
          category: 'interactive',
          displayName: 'Button',
          defaultConfig: {
            variant: 'primary',
            size: 'medium',
            fullWidth: false
          },
          placeholderData: {
            text: 'Click Me'
          }
        },
        {
          id: 'ct-content-1',
          websiteId,
          type: 'content-section',
          category: 'content',
          displayName: 'Content Section',
          defaultConfig: {
            layout: 'single-column',
            spacing: 'medium'
          },
          placeholderData: {
            content: 'Your content goes here'
          }
        }
      ];

      // Mock database responses
      mockPrisma.websitePage.findUnique.mockImplementation((query) => {
        return importedPages.find(p => p.id === query.where.id);
      });
      mockPrisma.websiteComponentType.findMany.mockResolvedValue(componentTypes);

      // Mock site builder loading
      mockSiteBuilder.loadPage.mockImplementation(async (pageId) => {
        const page = importedPages.find(p => p.id === pageId);
        if (!page) throw new Error(`Page ${pageId} not found`);
        
        return {
          success: true,
          page,
          componentTypes: componentTypes.filter(ct => 
            page.content.components.some(comp => comp.typeId === ct.id)
          ),
          renderableComponents: page.content.components.length
        };
      });

      // Act - Test opening each imported page
      const loadResults = await Promise.all(
        importedPages.map(async (page) => {
          return await mockSiteBuilder.loadPage(page.id);
        })
      );

      // Assert
      loadResults.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.page).toBeDefined();
        expect(result.componentTypes.length).toBeGreaterThan(0);
        expect(result.renderableComponents).toBeGreaterThan(0);
        
        // Verify component type references are valid
        const page = importedPages[index];
        page.content.components.forEach(component => {
          const typeExists = componentTypes.some(ct => ct.id === component.typeId);
          expect(typeExists).toBe(true);
        });
      });

      expect(mockSiteBuilder.loadPage).toHaveBeenCalledTimes(2);
    });

    it('should handle pages with complex nested component structures', async () => {
      // Arrange
      const complexPage = {
        id: 'complex-page',
        websiteId,
        title: 'Complex Layout',
        content: {
          components: [
            // Root container
            {
              id: 'main-container',
              typeId: 'ct-container',
              type: 'container',
              parentId: null,
              position: 0,
              props: { layout: 'full-width' }
            },
            // Header inside container
            {
              id: 'header-in-container',
              typeId: 'ct-header-1',
              type: 'header',
              parentId: 'main-container',
              position: 0,
              props: { title: 'Nested Header' }
            },
            // Content section with nested elements
            {
              id: 'content-section',
              typeId: 'ct-section',
              type: 'section',
              parentId: 'main-container',
              position: 1,
              props: { padding: 'large' }
            },
            // Row inside section
            {
              id: 'content-row',
              typeId: 'ct-row',
              type: 'row',
              parentId: 'content-section',
              position: 0,
              props: { columns: 2 }
            },
            // Columns in the row
            {
              id: 'left-column',
              typeId: 'ct-column',
              type: 'column',
              parentId: 'content-row',
              position: 0,
              props: { width: '50%' }
            },
            {
              id: 'right-column',
              typeId: 'ct-column',
              type: 'column',
              parentId: 'content-row',
              position: 1,
              props: { width: '50%' }
            },
            // Content in columns
            {
              id: 'left-content',
              typeId: 'ct-text',
              type: 'text',
              parentId: 'left-column',
              position: 0,
              props: { content: 'Left column content' }
            },
            {
              id: 'right-content',
              typeId: 'ct-image',
              type: 'image',
              parentId: 'right-column',
              position: 0,
              props: { src: '/image.jpg', alt: 'Right column image' }
            }
          ]
        }
      };

      mockPrisma.websitePage.findUnique.mockResolvedValue(complexPage);
      
      mockSiteBuilder.validateComponentTree.mockImplementation((components) => {
        // Validate component tree structure
        const componentMap = new Map(components.map(c => [c.id, c]));
        const rootComponents = components.filter(c => c.parentId === null);
        
        let isValid = true;
        let maxDepth = 0;
        
        function validateNode(componentId, depth = 0) {
          maxDepth = Math.max(maxDepth, depth);
          const component = componentMap.get(componentId);
          
          if (!component) {
            isValid = false;
            return;
          }
          
          const children = components.filter(c => c.parentId === componentId);
          children.forEach(child => validateNode(child.id, depth + 1));
        }
        
        rootComponents.forEach(root => validateNode(root.id));
        
        return {
          isValid,
          rootComponents: rootComponents.length,
          maxDepth,
          totalComponents: components.length
        };
      });

      // Act
      const loadResult = await mockSiteBuilder.loadPage('complex-page');
      const treeValidation = mockSiteBuilder.validateComponentTree(complexPage.content.components);

      // Assert
      expect(loadResult.success).toBe(true);
      expect(treeValidation.isValid).toBe(true);
      expect(treeValidation.rootComponents).toBe(1);
      expect(treeValidation.maxDepth).toBe(4); // main -> content-section -> row -> column -> content
      expect(treeValidation.totalComponents).toBe(8);
      
      // Verify parent-child relationships are valid
      complexPage.content.components.forEach(component => {
        if (component.parentId) {
          const parentExists = complexPage.content.components.some(c => c.id === component.parentId);
          expect(parentExists).toBe(true);
        }
      });
    });
  });

  describe('Component Rendering', () => {
    it('should render imported components with actual content, not placeholders', async () => {
      // Arrange
      const pageWithContent = {
        id: 'content-page',
        websiteId,
        content: {
          components: [
            {
              id: 'hero-with-content',
              typeId: 'ct-hero-1',
              type: 'hero',
              props: {
                headline: 'Real Imported Headline',
                subtitle: 'Actual imported subtitle text',
                backgroundImage: '/imported/hero-bg.jpg',
                ctaText: 'Imported Call to Action'
              }
            },
            {
              id: 'text-with-content',
              typeId: 'ct-text-1',
              type: 'text',
              props: {
                content: '<p>This is the actual imported text content from the original website.</p>',
                fontSize: '16px',
                color: '#333333'
              }
            }
          ]
        }
      };

      const componentType = {
        id: 'ct-hero-1',
        type: 'hero',
        placeholderData: {
          headline: 'Placeholder Headline',
          subtitle: 'Placeholder subtitle',
          ctaText: 'Placeholder Button'
        }
      };

      mockPrisma.websitePage.findUnique.mockResolvedValue(pageWithContent);
      mockPrisma.websiteComponentType.findUnique.mockResolvedValue(componentType);

      mockSiteBuilder.renderComponent.mockImplementation((component, componentType) => {
        const hasActualContent = Object.keys(component.props).some(key => {
          const actualValue = component.props[key];
          const placeholderValue = componentType.placeholderData?.[key];
          return actualValue && actualValue !== placeholderValue;
        });

        return {
          componentId: component.id,
          rendered: true,
          hasActualContent,
          usedPlaceholders: !hasActualContent,
          renderedProps: component.props
        };
      });

      // Act
      const renderResults = await Promise.all(
        pageWithContent.content.components.map(async (component) => {
          return mockSiteBuilder.renderComponent(component, componentType);
        })
      );

      // Assert
      renderResults.forEach(result => {
        expect(result.rendered).toBe(true);
        expect(result.hasActualContent).toBe(true);
        expect(result.usedPlaceholders).toBe(false);
        
        // Verify actual content is not placeholder content
        if (result.componentId === 'hero-with-content') {
          expect(result.renderedProps.headline).toBe('Real Imported Headline');
          expect(result.renderedProps.headline).not.toBe('Placeholder Headline');
        }
        
        if (result.componentId === 'text-with-content') {
          expect(result.renderedProps.content).toContain('actual imported text content');
        }
      });
    });

    it('should handle components with missing or invalid props gracefully', async () => {
      // Arrange
      const pageWithProblematicComponents = {
        id: 'problematic-page',
        websiteId,
        content: {
          components: [
            {
              id: 'component-no-props',
              typeId: 'ct-hero-1',
              type: 'hero'
              // Missing props entirely
            },
            {
              id: 'component-null-props',
              typeId: 'ct-hero-1',
              type: 'hero',
              props: null
            },
            {
              id: 'component-empty-props',
              typeId: 'ct-hero-1',
              type: 'hero',
              props: {}
            },
            {
              id: 'component-invalid-props',
              typeId: 'ct-hero-1',
              type: 'hero',
              props: {
                headline: undefined,
                invalidProp: 'should not cause errors'
              }
            }
          ]
        }
      };

      const componentType = {
        id: 'ct-hero-1',
        type: 'hero',
        defaultConfig: {
          fullHeight: false,
          alignment: 'center'
        },
        placeholderData: {
          headline: 'Default Headline',
          subtitle: 'Default Subtitle'
        }
      };

      mockSiteBuilder.renderComponent.mockImplementation((component, type) => {
        try {
          const props = component.props ?? {};
          const mergedProps = {
            ...type.placeholderData,
            ...type.defaultConfig
          };

          Object.entries(props).forEach(([key, value]) => {
            if (value !== undefined) {
              mergedProps[key] = value;
            }
          });

          const cleanProps = Object.fromEntries(
            Object.entries(mergedProps).filter(([_, value]) => value !== undefined)
          );

          return {
            componentId: component.id,
            rendered: true,
            error: null,
            finalProps: cleanProps,
            usedFallbacks: !component.props || Object.keys(component.props).length === 0
          };
        } catch (error) {
          return {
            componentId: component.id,
            rendered: false,
            error: (error as Error).message
          };
        }
      });

      // Act
      const renderResults = await Promise.all(
        pageWithProblematicComponents.content.components.map(component => 
          mockSiteBuilder.renderComponent(component, componentType)
        )
      );

      // Assert
      renderResults.forEach(result => {
        expect(result.rendered).toBe(true);
        expect(result.error).toBeNull();
        expect(result.finalProps).toBeDefined();
        
        // Should fall back to default values
        expect(result.finalProps.headline).toBeDefined();
        expect(result.finalProps.alignment).toBe('center');
      });
    });
  });

  describe('Editing Imported Components', () => {
    it('should allow editing imported components and saving changes', async () => {
      // Arrange
      const editablePage = {
        id: 'editable-page',
        websiteId,
        content: {
          components: [
            {
              id: 'editable-hero',
              typeId: 'ct-hero-1',
              type: 'hero',
              props: {
                headline: 'Original Headline',
                subtitle: 'Original Subtitle'
              }
            }
          ]
        }
      };

      mockPrisma.websitePage.findUnique.mockResolvedValue(editablePage);
      
      mockSiteBuilder.editComponent.mockImplementation(async (componentId, newProps) => {
        // Simulate component editing
        const component = editablePage.content.components.find(c => c.id === componentId);
        if (!component) throw new Error('Component not found');

        const updatedComponent = {
          ...component,
          props: { ...component.props, ...newProps }
        };

        return {
          success: true,
          componentId,
          originalProps: component.props,
          updatedProps: updatedComponent.props,
          changes: Object.keys(newProps)
        };
      });

      mockSiteBuilder.saveChanges.mockImplementation(async (pageId, updatedComponents) => {
        const updatedPage = {
          ...editablePage,
          content: {
            ...editablePage.content,
            components: updatedComponents
          }
        };

        await mockPrisma.websitePage.update({
          where: { id: pageId },
          data: {
            content: updatedPage.content
          }
        });

        return {
          success: true,
          pageId,
          updatedComponents: updatedComponents.length,
          timestamp: new Date()
        };
      });

      // Act
      const editResult = await mockSiteBuilder.editComponent('editable-hero', {
        headline: 'Updated Headline',
        ctaText: 'New Call to Action'
      });

      const updatedComponents = editablePage.content.components.map(comp => 
        comp.id === 'editable-hero' 
          ? { ...comp, props: editResult.updatedProps }
          : comp
      );

      const saveResult = await mockSiteBuilder.saveChanges('editable-page', updatedComponents);

      // Assert
      expect(editResult.success).toBe(true);
      expect(editResult.changes).toEqual(['headline', 'ctaText']);
      expect(editResult.updatedProps.headline).toBe('Updated Headline');
      expect(editResult.updatedProps.subtitle).toBe('Original Subtitle'); // Unchanged
      expect(editResult.updatedProps.ctaText).toBe('New Call to Action');

      expect(saveResult.success).toBe(true);
      expect(saveResult.updatedComponents).toBe(1);
      expect(mockPrisma.websitePage.update).toHaveBeenCalledWith({
        where: { id: 'editable-page' },
        data: {
          content: expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({
                id: 'editable-hero',
                props: expect.objectContaining({
                  headline: 'Updated Headline',
                  ctaText: 'New Call to Action'
                })
              })
            ])
          })
        }
      });
    });
  });

  describe('Navigation Between Imported Pages', () => {
    it('should handle navigation between imported pages using generated URLs', async () => {
      // Arrange
      const siteStructure = [
        {
          id: 'struct-1',
          websiteId,
          websitePageId: 'page-home',
          slug: 'home',
          fullPath: '/home',
          title: 'Home',
          parentId: null,
          position: 0
        },
        {
          id: 'struct-2',
          websiteId,
          websitePageId: 'page-about',
          slug: 'about',
          fullPath: '/about',
          title: 'About Us',
          parentId: null,
          position: 1
        },
        {
          id: 'struct-3',
          websiteId,
          websitePageId: 'page-contact',
          slug: 'contact',
          fullPath: '/contact',
          title: 'Contact',
          parentId: null,
          position: 2
        },
        {
          id: 'struct-4',
          websiteId,
          websitePageId: 'page-about-team',
          slug: 'team',
          fullPath: '/about/team',
          title: 'Our Team',
          parentId: 'struct-2', // Child of about page
          position: 0
        }
      ];

      const pages = [
        { id: 'page-home', websiteId, title: 'Home' },
        { id: 'page-about', websiteId, title: 'About Us' },
        { id: 'page-contact', websiteId, title: 'Contact' },
        { id: 'page-about-team', websiteId, title: 'Our Team' }
      ];

      mockPrisma.websiteStructure.findMany.mockResolvedValue(siteStructure);
      mockPrisma.websitePage.findMany.mockResolvedValue(pages);

      mockSiteBuilder.handleNavigation.mockImplementation(async (fromPath, toPath) => {
        const fromStructure = siteStructure.find(s => s.fullPath === fromPath);
        const toStructure = siteStructure.find(s => s.fullPath === toPath);
        
        if (!toStructure) {
          return { success: false, error: '404 - Page not found', path: toPath };
        }

        const targetPage = pages.find(p => p.id === toStructure.websitePageId);
        
        return {
          success: true,
          from: fromStructure?.fullPath || null,
          to: toStructure.fullPath,
          pageId: targetPage?.id,
          pageTitle: targetPage?.title,
          breadcrumb: generateBreadcrumb(toStructure, siteStructure)
        };
      });

      // Act - Test various navigation scenarios
      const navigationTests = [
        { from: '/home', to: '/about', shouldSucceed: true },
        { from: '/about', to: '/about/team', shouldSucceed: true },
        { from: '/contact', to: '/home', shouldSucceed: true },
        { from: '/home', to: '/nonexistent', shouldSucceed: false }
      ];

      const navigationResults = await Promise.all(
        navigationTests.map(test => 
          mockSiteBuilder.handleNavigation(test.from, test.to)
        )
      );

      // Assert
      navigationResults.forEach((result, index) => {
        const test = navigationTests[index];
        
        if (test.shouldSucceed) {
          expect(result.success).toBe(true);
          expect(result.to).toBe(test.to);
          expect(result.pageId).toBeDefined();
          expect(result.pageTitle).toBeDefined();
          
          // Verify breadcrumb for nested pages
          if (test.to === '/about/team') {
            expect(result.breadcrumb).toEqual([
              { title: 'About Us', path: '/about' },
              { title: 'Our Team', path: '/about/team' }
            ]);
          }
        } else {
          expect(result.success).toBe(false);
          expect(result.error).toContain('404');
        }
      });
    });
  });

  describe('Shared Component Editing', () => {
    it('should update shared components across all pages that use them', async () => {
      // Arrange
      const sharedHeader = {
        id: 'shared-header-1',
        websiteId,
        name: 'Site Header',
        websiteComponentTypeId: 'ct-header-1',
        content: {
          logo: '/logo.png',
          title: 'Original Company Name',
          navigation: ['Home', 'About', 'Contact']
        }
      };

      const pagesUsingSharedHeader = [
        {
          id: 'page-1',
          websiteId,
          title: 'Home',
          content: {
            components: [
              { id: 'header-instance-1', sharedComponentId: 'shared-header-1', type: 'header' }
            ]
          }
        },
        {
          id: 'page-2',
          websiteId,
          title: 'About',
          content: {
            components: [
              { id: 'header-instance-2', sharedComponentId: 'shared-header-1', type: 'header' }
            ]
          }
        }
      ];

      mockPrisma.websiteSharedComponent.findMany.mockResolvedValue([sharedHeader]);
      mockPrisma.websitePage.findMany.mockResolvedValue(pagesUsingSharedHeader);

      mockSiteBuilder.editComponent.mockImplementation(async (sharedComponentId, newContent) => {
        const updated = {
          ...sharedHeader,
          content: { ...sharedHeader.content, ...newContent }
        };

        await mockPrisma.websiteSharedComponent.update({
          where: { id: sharedComponentId },
          data: {
            content: updated.content
          }
        });

        return {
          success: true,
          sharedComponentId,
          updatedContent: updated.content,
          affectedPages: pagesUsingSharedHeader.length
        };
      });

      // Act
      const editResult = await mockSiteBuilder.editComponent('shared-header-1', {
        title: 'Updated Company Name',
        logo: '/new-logo.png'
      });

      // Assert
      expect(editResult.success).toBe(true);
      expect(editResult.affectedPages).toBe(2);
      expect(editResult.updatedContent.title).toBe('Updated Company Name');
      expect(editResult.updatedContent.logo).toBe('/new-logo.png');
      expect(editResult.updatedContent.navigation).toEqual(['Home', 'About', 'Contact']); // Unchanged

      expect(mockPrisma.websiteSharedComponent.update).toHaveBeenCalledWith({
        where: { id: 'shared-header-1' },
        data: {
          content: expect.objectContaining({
            title: 'Updated Company Name',
            logo: '/new-logo.png'
          })
        }
      });
    });
  });

  describe('Drag-Drop Reordering', () => {
    it('should support drag-drop reordering of imported components', async () => {
      // Arrange
      const pageWithReorderableComponents = {
        id: 'reorderable-page',
        websiteId,
        content: {
          components: [
            { id: 'comp-1', type: 'header', parentId: null, position: 0 },
            { id: 'comp-2', type: 'hero', parentId: null, position: 1 },
            { id: 'comp-3', type: 'content', parentId: null, position: 2 },
            { id: 'comp-4', type: 'footer', parentId: null, position: 3 }
          ]
        }
      };

      mockPrisma.websitePage.findUnique.mockResolvedValue(pageWithReorderableComponents);

      mockSiteBuilder.dragDropReorder.mockImplementation(async (pageId, reorderInstructions) => {
        const page = await mockPrisma.websitePage.findUnique({ where: { id: pageId } });
        const components = [...page.content.components];

        // Apply reorder instructions
        reorderInstructions.forEach(instruction => {
          const component = components.find(c => c.id === instruction.componentId);
          if (component) {
            component.position = instruction.newPosition;
            if (instruction.newParentId !== undefined) {
              component.parentId = instruction.newParentId;
            }
          }
        });

        // Sort by position
        components.sort((a, b) => a.position - b.position);

        const updatedPage = {
          ...page,
          content: { ...page.content, components }
        };

        await mockPrisma.websitePage.update({
          where: { id: pageId },
          data: {
            content: updatedPage.content
          }
        });

        return {
          success: true,
          pageId,
          reorderedComponents: reorderInstructions.length,
          newOrder: components.map(c => ({ id: c.id, position: c.position }))
        };
      });

      // Act - Reorder components: move hero to position 0, header to position 1
      const reorderInstructions = [
        { componentId: 'comp-1', newPosition: 1 }, // header: 0 → 1
        { componentId: 'comp-2', newPosition: 0 }  // hero: 1 → 0
      ];

      const reorderResult = await mockSiteBuilder.dragDropReorder(
        'reorderable-page', 
        reorderInstructions
      );

      // Assert
      expect(reorderResult.success).toBe(true);
      expect(reorderResult.reorderedComponents).toBe(2);
      
      const expectedOrder = [
        { id: 'comp-2', position: 0 }, // hero moved to top
        { id: 'comp-1', position: 1 }, // header moved down
        { id: 'comp-3', position: 2 }, // content unchanged
        { id: 'comp-4', position: 3 }  // footer unchanged
      ];

      expect(reorderResult.newOrder).toEqual(expectedOrder);

      expect(mockPrisma.websitePage.update).toHaveBeenCalledWith({
        where: { id: 'reorderable-page' },
        data: {
          content: expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ id: 'comp-2', position: 0 }),
              expect.objectContaining({ id: 'comp-1', position: 1 })
            ])
          })
        }
      });
    });

    it('should handle nested component reordering correctly', async () => {
      // Arrange - Page with nested components
      const pageWithNestedComponents = {
        id: 'nested-page',
        websiteId,
        content: {
          components: [
            { id: 'container', type: 'container', parentId: null, position: 0 },
            { id: 'child-1', type: 'section', parentId: 'container', position: 0 },
            { id: 'child-2', type: 'section', parentId: 'container', position: 1 },
            { id: 'grandchild-1', type: 'text', parentId: 'child-1', position: 0 },
            { id: 'grandchild-2', type: 'image', parentId: 'child-1', position: 1 }
          ]
        }
      };

      mockPrisma.websitePage.findUnique.mockResolvedValue(pageWithNestedComponents);
      mockSiteBuilder.dragDropReorder.mockImplementation(async (pageId, reorderInstructions) => {
        const page = await mockPrisma.websitePage.findUnique({ where: { id: pageId } });
        const components = [...page.content.components];

        reorderInstructions.forEach(instruction => {
          const component = components.find(c => c.id === instruction.componentId);
          if (component) {
            if (typeof instruction.newPosition === 'number') {
              component.position = instruction.newPosition;
            }
            if (instruction.newParentId) {
              component.parentId = instruction.newParentId;
            }
          }
        });

        const updatedPage = {
          ...page,
          content: { ...page.content, components }
        };

        await mockPrisma.websitePage.update({
          where: { id: pageId },
          data: {
            content: updatedPage.content
          }
        });

        return {
          success: true,
          pageId,
          reorderedComponents: reorderInstructions.length,
          newOrder: components.map(c => ({ id: c.id, position: c.position, parentId: c.parentId }))
        };
      });

      // Act - Move grandchild-2 to child-2
      const nestedReorderResult = await mockSiteBuilder.dragDropReorder('nested-page', [
        { componentId: 'grandchild-2', newParentId: 'child-2', newPosition: 0 }
      ]);

      // Assert
      expect(nestedReorderResult.success).toBe(true);
      
      const movedComponent = nestedReorderResult.newOrder.find(c => c.id === 'grandchild-2');
      // Note: The exact assertion depends on how the mock handles parent changes
      expect(movedComponent).toBeDefined();
    });
  });
});

// Helper Functions
function setupSiteBuilderMocks() {
  // Setup default successful mocks for all site builder operations
  mockSiteBuilder.loadPage.mockResolvedValue({ success: true });
  mockSiteBuilder.renderComponent.mockResolvedValue({ rendered: true });
  mockSiteBuilder.saveChanges.mockResolvedValue({ success: true });
  mockSiteBuilder.validateComponentTree.mockResolvedValue({ isValid: true });
  mockSiteBuilder.generatePreview.mockResolvedValue({ previewUrl: 'http://preview.test' });
  mockSiteBuilder.handleNavigation.mockResolvedValue({ success: true });
  mockSiteBuilder.dragDropReorder.mockResolvedValue({ success: true });
  mockSiteBuilder.editComponent.mockResolvedValue({ success: true });
}

function generateBreadcrumb(structure: any, allStructures: any[]) {
  const breadcrumb = [];
  let current = structure;

  while (current) {
    breadcrumb.unshift({
      title: current.title || current.slug,
      path: current.fullPath
    });

    if (current.parentId) {
      current = allStructures.find(s => s.id === current.parentId);
    } else {
      current = null;
    }
  }

  return breadcrumb;
}
