'use client'

import React from 'react'
import { Input } from '@/components/ui/input'

export interface ReferencePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

// MVP: accept a text id; future: search/browse
export const ReferencePicker: React.FC<ReferencePickerProps> = ({ value, onChange, placeholder }) => {
  return (
    <Input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder || 'Enter reference id'} />
  )
}

