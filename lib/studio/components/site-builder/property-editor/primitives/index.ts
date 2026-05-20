/**
 * Primitive Editors - Barrel Export
 *
 * All atomic field editors for the composable property editor system.
 */

// Types
export * from './types'

// Base component and utilities
export {
  PrimitiveEditor,
  CharacterCount,
  useDebouncedCallback,
  useFieldId,
} from './PrimitiveEditor'

// Text primitives
export { StringEditor } from './StringEditor'
export { TextEditor } from './TextEditor'
export { RichTextEditor } from './RichTextEditor'
export { MarkdownEditor } from './MarkdownEditor'
export { SlugEditor } from './SlugEditor'
export { CodeEditor } from './CodeEditor'

// Numeric primitives
export { NumberEditor } from './NumberEditor'

// Boolean primitives
export { BooleanEditor, CheckboxEditor } from './BooleanEditor'

// Selection primitives
export { SelectEditor } from './SelectEditor'
export { RadioEditor } from './RadioEditor'
export { MultiSelectEditor } from './MultiSelectEditor'
export { TagsEditor } from './TagsEditor'

// Date/Time primitives
export { DateEditor } from './DateEditor'
export { DateTimeEditor } from './DateTimeEditor'
export { TimeEditor } from './TimeEditor'

// Color primitive
export { ColorEditor } from './ColorEditor'

// Link primitives
export { ExternalUrlEditor } from './ExternalUrlEditor'
export { InternalLinkEditor } from './InternalLinkEditor'
export { EmailEditor } from './EmailEditor'
export { PhoneEditor } from './PhoneEditor'
export { LinkEditor } from './LinkEditor'

// Media primitives
export { ImageEditor } from './ImageEditor'
export { ExternalImageEditor } from './ExternalImageEditor'
export { FileEditor } from './FileEditor'
export { VideoEditor } from './VideoEditor'

// Reference primitives
export { ContentReferenceEditor } from './ContentReferenceEditor'
export { MediaReferenceEditor } from './MediaReferenceEditor'

// Special primitives
export { IconEditor } from './IconEditor'
export { GeopointEditor } from './GeopointEditor'
export { JsonEditor } from './JsonEditor'
