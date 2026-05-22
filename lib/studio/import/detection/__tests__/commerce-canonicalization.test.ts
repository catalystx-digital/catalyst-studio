import { parseDetectionResponse } from "@/lib/studio/import/detection/response-parser"
import type { ComponentPattern } from "@/lib/studio/import/detection/types"
import type { PageCatalogSummary, PageCatalogTemplateSummary } from "@/lib/studio/ai/page-catalog"
import { PageTemplateCategory } from "@/lib/studio/pages/_core/types"
import { ComponentType } from "@/lib/studio/components/cms/_core/types"

describe("commerce product detail canonicalization", () => {
  it("does not add hero and feature list when detection only returns map data", () => {
    const productTemplate: PageCatalogTemplateSummary = {
      templateKey: "commerce/product-detail",
      name: "Product Detail",
      category: PageTemplateCategory.Commerce,
      isHomeEligible: false,
      description: "Product detail layout with required hero and content regions.",
      requiredRegions: [
        { region: "header", allowedComponents: [ComponentType.NavBar], min: 1 },
        {
          region: "hero",
          allowedComponents: [
            ComponentType.HeroWithImage,
            ComponentType.HeroSplit,
            ComponentType.HeroCarousel,
            ComponentType.HeroVideo
          ],
          min: 1
        },
        {
          region: "main",
          allowedComponents: [ComponentType.FeatureList, ComponentType.FeatureGrid, ComponentType.CardGrid],
          min: 1
        }
      ],
      optionalRegions: [],
      propsMeta: undefined,
      aiMetadata: {
        keywords: ["product detail"],
        layoutGuidelines: [],
        contentGuidelines: [],
        recommendedComponents: [],
        discouragedComponents: [],
        exampleUseCases: [],
        routeHints: ["/products/"]
      },
      canonical: [
        {
          region: 'hero',
          enforce: true,
          preferredCanonical: ComponentType.HeroWithImage,
          allowedCanonicals: [
            ComponentType.HeroWithImage,
            ComponentType.HeroSplit,
            ComponentType.HeroCarousel,
            ComponentType.HeroVideo
          ],
          metadata: { variant: 'commerce-store' },
          hints: ['Always synthesize a hero summarizing store name and centre.']
        },
        {
          region: 'main',
          enforce: true,
          preferredCanonical: ComponentType.FeatureList,
          allowedCanonicals: [
            ComponentType.FeatureList,
            ComponentType.FeatureGrid,
            ComponentType.CardGrid
          ],
          metadata: { variant: 'commerce-store' },
          hints: ['Collapse map/contact fragments into feature-list items.']
        }
      ]
    }

    const productSummary: PageCatalogSummary = {
      total: 1,
      generatedAt: "2024-07-01T00:00:00.000Z",
      templates: [productTemplate],
      categories: [{ category: PageTemplateCategory.Commerce, templates: [productTemplate] }],
      homeEligibleTemplates: []
    }

    const productPatterns: ComponentPattern[] = [
      { type: "navbar", confidence: 0.9 },
      { type: "hero-with-image", confidence: 0.9 },
      { type: "feature-list", confidence: 0.9 },
      { type: "location-map", confidence: 0.8 },
      { type: "contact-info", confidence: 0.75 }
    ]

    const rawResponse = JSON.stringify({
      pageTemplate: {
        templateKey: "commerce/product-detail",
        confidence: 0.58,
        reason: "URL matches store detail route; only map detected."
      },
      pageMetadata: {
        title: "Connor",
        description: "Men's outfitter located within Bathurst City Centre.",
        pageType: "store-detail",
        contactInfo: { phone: "02 1234 5678" }
      },
      components: [
        {
          component: "location-map",
          confidence: 0.82,
          content: {
            region: "main",
            markerTitle: "Connor Bathurst",
            infoWindow: { description: "Level 2, near centre stage." }
          }
        }
      ]
    })

    const result = parseDetectionResponse({
      rawResponse,
      availableComponents: productPatterns,
      pageSummary: productSummary,
      url: "https://bathurstcitycentre.qicre.com/stores/retail-stores/connor",
      confidenceThreshold: 0.1
    })

    const hero = result.components.find(component => component.component === "hero-with-image")
    const featureList = result.components.find(component => component.component === "feature-list")
    const nav = result.components.find(component => component.component === "navbar")

    expect(nav).toBeFalsy()
    expect(hero).toBeFalsy()
    expect(featureList).toBeFalsy()
    expect(result.components.map(component => component.component)).toEqual(["location-map"])
  })
})
