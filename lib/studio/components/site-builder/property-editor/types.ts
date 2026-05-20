export interface ValidationError {
  field: string
  message: string
  severity?: 'error' | 'warning'
}

export interface ValidationResult {
  valid: boolean
  message?: string
}

export interface PropertySchema {
  name: string
  type:
    | 'text'
    | 'textarea'
    | 'richText'
    | 'number'
    | 'image'
    | 'link'
    | 'color'
    | 'select'
    | 'checkbox'
    | 'radio'
    | 'reference'
    | 'array'
    | 'object'
  label: string
  required?: boolean
  placeholder?: string
  options?: Array<{ label: string; value: string }>
  validation?: {
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    pattern?: string
    custom?: (value: any) => ValidationResult
  }
  defaultValue?: any
  group?: string
  order?: number
  visible?: boolean | ((data: any) => boolean)
  disabled?: boolean | ((data: any) => boolean)
  allowedTypes?: string[]
  fields?: PropertySchema[]
  items?: {
    kind: 'primitive' | 'object' | 'component'
    type?: string
    options?: Array<{ label: string; value: string }>
    fields?: PropertySchema[]
    allowedTypes?: string[]
  }
}

export interface PropertyPanelState {
  isOpen: boolean
  selectedComponentId: string | null
  activeTab: string
  scrollPosition: number
  unsavedChanges: Record<string, any>
  validationErrors: ValidationError[]
}
