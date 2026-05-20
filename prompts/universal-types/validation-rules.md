# Universal Type Validation Rules

## Overview

This document defines the validation rules for Universal Content Types. All content types must pass validation before being applied to the system.

## Validation Levels

### 1. Critical Validations (Blocking)
These validations must pass or the type will be rejected:

- **Category Validation**: Must be 'page' or 'component'
- **Name Validation**: Must exist and follow PascalCase
- **Field Uniqueness**: No duplicate field names
- **Field Type Validation**: Must use valid universal types

### 2. Important Validations (High Impact)
These affect confidence score significantly:

- **Required Fields for Pages**: Pages should have title and slug
- **Component Complexity**: Components should have ≤8 fields
- **Field Naming Convention**: Should use camelCase

### 3. Recommended Validations (Best Practices)
These are suggestions that improve quality:

- **Metadata Completeness**: Include description and version
- **SEO Fields for Pages**: Include meta fields
- **Validation Rules on Required Fields**: Add appropriate validators

## Validation Rule Definitions

### Content Type Level Validations

#### CT001: Valid Category
```typescript
{
  rule: 'CT001',
  name: 'Valid Category',
  severity: 'critical',
  check: (type) => ['page', 'component'].includes(type.category),
  message: 'Category must be either "page" or "component"',
  impact: -30 // Confidence score impact
}
```

#### CT002: Valid Name Format
```typescript
{
  rule: 'CT002',
  name: 'Valid Name Format',
  severity: 'critical',
  check: (type) => /^[A-Z][a-zA-Z0-9]*$/.test(type.name),
  message: 'Type name must use PascalCase (e.g., BlogPost)',
  impact: -20
}
```

#### CT003: Name Length
```typescript
{
  rule: 'CT003',
  name: 'Name Length',
  severity: 'important',
  check: (type) => type.name.length >= 3 && type.name.length <= 50,
  message: 'Type name should be between 3 and 50 characters',
  impact: -5
}
```

#### CT004: Has Fields
```typescript
{
  rule: 'CT004',
  name: 'Has Fields',
  severity: 'critical',
  check: (type) => type.fields && type.fields.length > 0,
  message: 'Content type must have at least one field',
  impact: -25
}
```

### Field Level Validations

#### FLD001: Valid Field Name
```typescript
{
  rule: 'FLD001',
  name: 'Valid Field Name',
  severity: 'important',
  check: (field) => /^[a-z][a-zA-Z0-9]*$/.test(field.name),
  message: 'Field name should use camelCase (e.g., pageTitle)',
  impact: -5
}
```

#### FLD002: Valid Field Type
```typescript
{
  rule: 'FLD002',
  name: 'Valid Field Type',
  severity: 'critical',
  check: (field) => VALID_FIELD_TYPES.includes(field.type),
  message: 'Field type must be a valid universal type',
  impact: -15
}

const VALID_FIELD_TYPES = [
  'Text', 'LongText', 'Number', 'Decimal', 'Boolean',
  'Date', 'DateTime', 'Media', 'ContentReference',
  'ContentArea', 'JSON', 'URL', 'Email', 'Phone',
  'Select', 'MultiSelect'
];
```

#### FLD003: Field Uniqueness
```typescript
{
  rule: 'FLD003',
  name: 'Field Uniqueness',
  severity: 'critical',
  check: (fields) => {
    const names = fields.map(f => f.name);
    return names.length === new Set(names).size;
  },
  message: 'Field names must be unique within the content type',
  impact: -10
}
```

#### FLD004: Required Field Has Validation
```typescript
{
  rule: 'FLD004',
  name: 'Required Field Validation',
  severity: 'recommended',
  check: (field) => !field.required || field.validation?.length > 0,
  message: 'Required fields should have validation rules',
  impact: -3
}
```

### Category-Specific Validations

#### PAGE001: Page Has Title
```typescript
{
  rule: 'PAGE001',
  name: 'Page Has Title',
  severity: 'important',
  appliesTo: 'page',
  check: (type) => type.fields.some(f => f.name === 'title'),
  message: 'Page types should have a "title" field',
  impact: -5
}
```

#### PAGE002: Page Has Slug
```typescript
{
  rule: 'PAGE002',
  name: 'Page Has Slug',
  severity: 'important',
  appliesTo: 'page',
  check: (type) => type.fields.some(f => f.name === 'slug'),
  message: 'Page types should have a "slug" field for routing',
  impact: -5
}
```

#### PAGE003: No URL Fields in Pages
```typescript
{
  rule: 'PAGE003',
  name: 'No URL Fields in Pages',
  severity: 'important',
  appliesTo: 'page',
  check: (type) => !type.fields.some(f => 
    f.name.toLowerCase().includes('url') && f.name !== 'canonicalUrl'
  ),
  message: 'Pages should not have URL fields (pages ARE the URL)',
  impact: -5
}
```

#### COMP001: Component Field Limit
```typescript
{
  rule: 'COMP001',
  name: 'Component Field Limit',
  severity: 'recommended',
  appliesTo: 'component',
  check: (type) => type.fields.length <= 8,
  message: 'Components should have 8 or fewer fields for reusability',
  impact: -5
}
```

#### COMP002: No SEO in Components
```typescript
{
  rule: 'COMP002',
  name: 'No SEO in Components',
  severity: 'important',
  appliesTo: 'component',
  check: (type) => !type.fields.some(f => 
    f.name.startsWith('meta') || f.name === 'seoTitle'
  ),
  message: 'Components should not have SEO fields',
  impact: -5
}
```

#### COMP003: No Routing in Components
```typescript
{
  rule: 'COMP003',
  name: 'No Routing in Components',
  severity: 'critical',
  appliesTo: 'component',
  check: (type) => !type.fields.some(f => f.name === 'slug'),
  message: 'Components cannot have routing fields (slug)',
  impact: -10
}
```

## Validation Process

### Step 1: Pre-Validation
```typescript
function preValidate(type: UniversalContentType): ValidationResult {
  // Check if type object exists
  if (!type) {
    return { valid: false, errors: ['Type definition is required'] };
  }

  // Check minimum structure
  if (!type.name || !type.category || !type.fields) {
    return { valid: false, errors: ['Missing required properties'] };
  }

  return { valid: true, errors: [] };
}
```

### Step 2: Core Validation
```typescript
function validateCore(type: UniversalContentType): ValidationResult {
  const errors = [];
  const warnings = [];
  let confidence = 100;

  // Apply all validation rules
  for (const rule of VALIDATION_RULES) {
    if (rule.appliesTo && rule.appliesTo !== type.category) {
      continue; // Skip non-applicable rules
    }

    const passes = rule.check(type);
    if (!passes) {
      if (rule.severity === 'critical') {
        errors.push({
          rule: rule.rule,
          message: rule.message,
          severity: rule.severity
        });
      } else {
        warnings.push({
          rule: rule.rule,
          message: rule.message,
          severity: rule.severity
        });
      }
      confidence += rule.impact;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    confidence: Math.max(0, confidence)
  };
}
```

### Step 3: Field Validation
```typescript
function validateFields(type: UniversalContentType): ValidationResult {
  const errors = [];
  const warnings = [];
  let confidence = 100;

  for (const field of type.fields) {
    // Validate field name
    if (!isValidFieldName(field.name)) {
      warnings.push({
        field: field.name,
        message: 'Field name should use camelCase'
      });
      confidence -= 2;
    }

    // Validate field type
    if (!isValidFieldType(field.type)) {
      errors.push({
        field: field.name,
        message: `Invalid field type: ${field.type}`
      });
      confidence -= 10;
    }

    // Validate field-specific rules
    if (field.type === 'Select' || field.type === 'MultiSelect') {
      if (!field.metadata?.options || field.metadata.options.length === 0) {
        warnings.push({
          field: field.name,
          message: 'Select fields should define options'
        });
        confidence -= 3;
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings, confidence };
}
```

### Step 4: Confidence Calculation
```typescript
function calculateConfidence(type: UniversalContentType, validationResult: ValidationResult): number {
  let confidence = 100;

  // Base deductions
  confidence += validationResult.confidence || 0;

  // Additional factors
  if (!type.metadata?.description) {
    confidence -= 2; // Minor deduction for missing description
  }

  if (type.category === 'page' && type.fields.length < 3) {
    confidence -= 5; // Pages typically need more fields
  }

  if (type.category === 'component' && type.fields.length > 10) {
    confidence -= 10; // Components should be simple
  }

  // Ensure confidence is within bounds
  confidence = Math.max(0, Math.min(100, confidence));

  return confidence;
}
```

## Validation Response Format

### Success Response
```json
{
  "valid": true,
  "confidence": 95,
  "warnings": [
    {
      "rule": "FLD001",
      "field": "PageTitle",
      "message": "Field name should use camelCase",
      "severity": "recommended"
    }
  ],
  "suggestions": [
    "Consider adding metaDescription for SEO",
    "Add validation rules to required fields"
  ],
  "threshold": "automatic"
}
```

### Failure Response
```json
{
  "valid": false,
  "confidence": 35,
  "errors": [
    {
      "rule": "CT001",
      "message": "Category must be either 'page' or 'component'",
      "severity": "critical"
    },
    {
      "rule": "FLD003",
      "field": "title",
      "message": "Duplicate field name detected",
      "severity": "critical"
    }
  ],
  "warnings": [
    {
      "rule": "PAGE001",
      "message": "Page types should have a 'title' field",
      "severity": "important"
    }
  ],
  "threshold": "rejected",
  "remediation": [
    "Set category to 'page' or 'component'",
    "Remove duplicate field names",
    "Add a 'title' field for page types"
  ]
}
```

## Confidence Thresholds

### Automatic (>70%)
- Type can be automatically applied
- Minor warnings may be present
- No critical errors

### Review (50-70%)
- Manual review required
- Important warnings present
- May have non-critical errors

### Manual (<50%)
- Significant issues detected
- Multiple critical errors
- Requires substantial fixes

### Rejected (<30%)
- Fundamental problems
- Does not meet minimum requirements
- Should be regenerated

## Custom Validation Rules

### Adding Custom Validators
```typescript
interface CustomValidator {
  name: string;
  check: (type: UniversalContentType) => boolean;
  message: string;
  severity: 'critical' | 'important' | 'recommended';
  impact: number;
}

// Example: Ensure blog posts have author
const blogPostValidator: CustomValidator = {
  name: 'BlogPostAuthor',
  check: (type) => {
    if (type.name !== 'BlogPost') return true;
    return type.fields.some(f => f.name === 'author');
  },
  message: 'BlogPost must have an author field',
  severity: 'important',
  impact: -10
};
```

### Project-Specific Rules
```typescript
// Add to project configuration
{
  "validation": {
    "customRules": [
      {
        "pattern": ".*Page$",
        "requiredFields": ["title", "slug", "metaTitle"],
        "message": "All pages must have SEO fields"
      },
      {
        "pattern": ".*Component$",
        "maxFields": 6,
        "message": "Components should be simple and focused"
      }
    ]
  }
}
```

## Validation Error Messages

### User-Friendly Messages
```typescript
const ERROR_MESSAGES = {
  'CT001': 'Please specify whether this is a page (routable content) or a component (reusable block)',
  'CT002': 'Type names should start with a capital letter and use PascalCase (e.g., "BlogPost" not "blog-post")',
  'FLD001': 'Field names should start with a lowercase letter and use camelCase (e.g., "pageTitle" not "PageTitle")',
  'FLD002': 'This field type is not recognized. Please use one of the standard types like Text, Number, or Date',
  'FLD003': 'You have two fields with the same name. Each field must have a unique name',
  'PAGE001': 'Pages typically need a title field for the page heading',
  'PAGE002': 'Pages need a slug field to determine their URL path',
  'COMP001': 'This component has many fields. Consider breaking it into smaller, more focused components'
};
```

## Testing Validation

### Unit Test Example
```typescript
describe('Content Type Validation', () => {
  it('should validate a well-formed page type', () => {
    const pageType = {
      name: 'ArticlePage',
      category: 'page',
      fields: [
        { name: 'title', type: 'Text', required: true },
        { name: 'slug', type: 'Text', required: true },
        { name: 'content', type: 'LongText', required: true }
      ]
    };

    const result = validate(pageType);
    expect(result.valid).toBe(true);
    expect(result.confidence).toBeGreaterThan(90);
  });

  it('should reject type with invalid category', () => {
    const invalidType = {
      name: 'MyType',
      category: 'widget',
      fields: [{ name: 'title', type: 'Text', required: true }]
    };

    const result = validate(invalidType);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ rule: 'CT001' })
    );
  });
});
```

## Validation Best Practices

1. **Validate Early**: Check types before transformation
2. **Provide Clear Feedback**: Use user-friendly error messages
3. **Suggest Fixes**: Include remediation steps
4. **Log Validation Results**: Track patterns and common issues
5. **Allow Overrides**: Support manual approval for edge cases
6. **Version Validation Rules**: Track changes to validation logic
7. **Test Thoroughly**: Cover all validation scenarios
8. **Document Exceptions**: Explain why certain rules exist
9. **Monitor Confidence Scores**: Track average scores over time
10. **Iterate on Rules**: Refine based on real-world usage