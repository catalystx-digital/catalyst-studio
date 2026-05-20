# Universal Type Generation Rules

## Core Principles

1. **Always Use Three-Layer Type System**
   - Universal types are platform-agnostic
   - Never assume specific CMS capabilities
   - Focus on content structure, not implementation

2. **Category Classification is Mandatory**
   - Every content type MUST have a `category` field
   - Only two valid values: `'page'` or `'component'`
   - This determines routing and reusability

3. **Naming Conventions**
   - Content type names: PascalCase (e.g., `BlogPost`, `HeroSection`)
   - Field names: camelCase (e.g., `pageTitle`, `publishDate`)
   - No spaces or special characters in names

## Content Type Categories

### Category: 'page'
- **Definition**: Content that is directly routable with its own URL
- **Required Fields**:
  - `title` (Text): Page title for display
  - `slug` (Text): URL segment for routing
- **Recommended Fields**:
  - `metaTitle` (Text): SEO title
  - `metaDescription` (Text): SEO description
  - `publishDate` (DateTime): Publication date
- **Restrictions**:
  - Should NOT have URL fields (pages ARE the URL)
  - Can include complex nested structures
  - No limit on field count (but keep reasonable)

### Category: 'component'
- **Definition**: Reusable content blocks embedded in pages
- **Characteristics**:
  - Focused and single-purpose
  - Maximum 8 fields recommended
  - Should be composable with other components
- **Restrictions**:
  - Should NOT include SEO fields
  - Should NOT include routing fields (slug, URL)
  - Keep complexity minimal for reusability

## Field Type Selection

### Primitive Types Available

```typescript
type UniversalFieldType = 
  | 'Text'           // Short text (max 255 chars)
  | 'LongText'       // Rich text content
  | 'Number'         // Integer values
  | 'Decimal'        // Floating-point values
  | 'Boolean'        // True/false values
  | 'Date'           // Date only (no time)
  | 'DateTime'       // Date with time
  | 'Media'          // Images, videos, files
  | 'ContentReference' // Reference to other content
  | 'ContentArea'    // Flexible content blocks
  | 'JSON'           // Structured data
  | 'URL'            // Web addresses
  | 'Email'          // Email addresses
  | 'Phone'          // Phone numbers
  | 'Select'         // Predefined options
  | 'MultiSelect';   // Multiple selections
```

### Field Type Guidelines

1. **Text vs LongText**
   - Use `Text` for titles, names, short descriptions (≤255 chars)
   - Use `LongText` for body content, articles, rich descriptions

2. **Number vs Decimal**
   - Use `Number` for counts, IDs, whole numbers
   - Use `Decimal` for prices, percentages, measurements

3. **Date vs DateTime**
   - Use `Date` for birthdays, event dates (day precision)
   - Use `DateTime` for timestamps, publish times (minute precision)

4. **Media Types**
   - Use `Media` for any file upload (images, PDFs, videos)
   - Platform will handle specific media type validation

5. **References**
   - Use `ContentReference` for linking to other content
   - Use `ContentArea` for flexible content composition

## Validation Rules

### Required Field Validation

```typescript
{
  name: 'email',
  type: 'Email',
  required: true,
  validation: [
    { type: 'required', message: 'Email is required' },
    { type: 'email', message: 'Must be a valid email' }
  ]
}
```

### Common Validation Patterns

1. **Text Length**
   ```typescript
   { type: 'minLength', value: 3, message: 'Minimum 3 characters' }
   { type: 'maxLength', value: 100, message: 'Maximum 100 characters' }
   ```

2. **Number Ranges**
   ```typescript
   { type: 'min', value: 0, message: 'Must be positive' }
   { type: 'max', value: 100, message: 'Maximum 100' }
   ```

3. **Pattern Matching**
   ```typescript
   { type: 'pattern', value: '^[A-Z]', message: 'Must start with capital letter' }
   ```

4. **Custom Rules**
   ```typescript
   { type: 'custom', validator: 'uniqueSlug', message: 'Slug must be unique' }
   ```

## Confidence Scoring Rules

### Score Calculation (0-100%)

1. **Base Score: 100%**

2. **Deductions**:
   - Missing required field: -20%
   - Invalid field type: -15%
   - Wrong naming convention: -5%
   - Missing category: -30%
   - Invalid category value: -25%
   - Duplicate field names: -10%
   - Too many fields in component (>8): -5%

3. **Thresholds**:
   - **>70%**: Automatic application
   - **50-70%**: Manual review required
   - **<50%**: Rejection

### Score Examples

```typescript
// High Confidence (95%)
{
  name: 'BlogPost',        // ✓ PascalCase
  category: 'page',        // ✓ Valid category
  fields: [
    { name: 'title', type: 'Text', required: true },      // ✓ Required field
    { name: 'slug', type: 'Text', required: true },       // ✓ Page has slug
    { name: 'content', type: 'LongText', required: true } // ✓ Proper type
  ]
}

// Low Confidence (40%)
{
  name: 'blog-post',       // ✗ Wrong case (-5%)
  category: 'article',     // ✗ Invalid category (-25%)
  fields: [
    { name: 'Title', type: 'String', required: true },    // ✗ Wrong case & type (-20%)
    { name: 'Title', type: 'Text', required: false }      // ✗ Duplicate name (-10%)
  ]
}
```

## Generation Guidelines

### Step-by-Step Process

1. **Analyze Request**
   - Identify if content is routable (page) or reusable (component)
   - Extract key fields from description
   - Determine relationships with other content

2. **Check Existing Types**
   - Search for similar existing types
   - Prefer reuse over creation
   - Suggest extensions if 80% match exists

3. **Generate Structure**
   ```typescript
   {
     name: DetermineName(),         // PascalCase, descriptive
     category: DetermineCategory(),  // 'page' or 'component'
     fields: GenerateFields(),       // Based on requirements
     metadata: {
       description: '',              // Clear purpose description
       version: '1.0.0'             // Start with 1.0.0
     }
   }
   ```

4. **Apply Validation**
   - Check all rules above
   - Calculate confidence score
   - Return with recommendations

## Platform Transformation Rules

### Fallback Strategies

When a platform doesn't support a field type:

1. **Direct Mapping** (Preferred)
   ```
   Universal 'Text' → Platform 'String'
   ```

2. **Safe Fallback** (When needed)
   ```
   Universal 'Email' → Platform 'String' + validation
   Universal 'Phone' → Platform 'String' + pattern
   ```

3. **Complex Fallback** (Last resort)
   ```
   Universal 'ContentArea' → Platform 'JSON' + custom handler
   ```

### Platform-Specific Mappings

#### Optimizely
```javascript
{
  'Text': 'String',
  'LongText': 'XhtmlString',
  'Number': 'Int',
  'Decimal': 'Double',
  'Boolean': 'Boolean',
  'Date': 'DateTime',
  'DateTime': 'DateTime',
  'Media': 'ContentReference',
  'ContentReference': 'ContentReference',
  'ContentArea': 'ContentArea',
  'JSON': 'String',  // Serialized
  'URL': 'Url',
  'Email': 'String',
  'Phone': 'String',
  'Select': 'String',
  'MultiSelect': 'String'  // Comma-separated
}
```

#### Contentful
```javascript
{
  'Text': 'Symbol',
  'LongText': 'RichText',
  'Number': 'Integer',
  'Decimal': 'Number',
  'Boolean': 'Boolean',
  'Date': 'Date',
  'DateTime': 'Date',
  'Media': 'Asset',
  'ContentReference': 'Link',
  'ContentArea': 'Array',
  'JSON': 'Object',
  'URL': 'Symbol',
  'Email': 'Symbol',
  'Phone': 'Symbol',
  'Select': 'Symbol',
  'MultiSelect': 'Array'
}
```

## Anti-Patterns to Avoid

### ❌ DON'T DO THIS

1. **Platform-Specific Assumptions**
   ```typescript
   // Wrong: Assumes Optimizely
   { name: 'content', type: 'XhtmlString' }
   
   // Correct: Use universal type
   { name: 'content', type: 'LongText' }
   ```

2. **Missing Category**
   ```typescript
   // Wrong: No category
   { name: 'BlogPost', fields: [...] }
   
   // Correct: Always include category
   { name: 'BlogPost', category: 'page', fields: [...] }
   ```

3. **Wrong Category Assignment**
   ```typescript
   // Wrong: Component with slug
   { 
     name: 'HeroSection', 
     category: 'component',
     fields: [{ name: 'slug', type: 'Text' }]  // Components don't have URLs!
   }
   ```

4. **Overcomplicated Components**
   ```typescript
   // Wrong: Component with 15 fields
   { 
     name: 'SuperComponent', 
     category: 'component',
     fields: [/* 15 different fields */]  // Too complex!
   }
   ```

### ✅ DO THIS INSTEAD

1. **Use Universal Types**
2. **Always Specify Category**
3. **Follow Naming Conventions**
4. **Keep Components Simple**
5. **Validate Before Generation**
6. **Check for Existing Types**
7. **Document Purpose Clearly**
8. **Include Required Fields for Pages**
9. **Use Appropriate Field Types**
10. **Calculate Confidence Scores**

## Examples of Well-Formed Types

### Page Example
```typescript
{
  name: 'ArticlePage',
  category: 'page',
  fields: [
    { name: 'title', type: 'Text', required: true },
    { name: 'slug', type: 'Text', required: true },
    { name: 'author', type: 'Text', required: true },
    { name: 'publishDate', type: 'DateTime', required: true },
    { name: 'featuredImage', type: 'Media', required: false },
    { name: 'summary', type: 'Text', required: true },
    { name: 'content', type: 'LongText', required: true },
    { name: 'tags', type: 'MultiSelect', required: false },
    { name: 'metaTitle', type: 'Text', required: false },
    { name: 'metaDescription', type: 'Text', required: false }
  ],
  metadata: {
    description: 'Article page for blog content',
    version: '1.0.0'
  }
}
// Confidence: 100%
```

### Component Example
```typescript
{
  name: 'CallToAction',
  category: 'component',
  fields: [
    { name: 'heading', type: 'Text', required: true },
    { name: 'description', type: 'Text', required: false },
    { name: 'buttonText', type: 'Text', required: true },
    { name: 'buttonUrl', type: 'URL', required: true },
    { name: 'backgroundImage', type: 'Media', required: false },
    { name: 'alignment', type: 'Select', required: false }
  ],
  metadata: {
    description: 'Reusable CTA component for marketing sections',
    version: '1.0.0'
  }
}
// Confidence: 100%
```

## Integration with AI

When AI generates content types:

1. **Always enforce these rules**
2. **Validate before returning**
3. **Provide confidence score**
4. **Suggest improvements if <70%**
5. **Explain deductions if rejected**