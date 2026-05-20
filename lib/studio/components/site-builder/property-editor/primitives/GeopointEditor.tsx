'use client'

/**
 * GeopointEditor - Latitude/Longitude coordinates editor
 *
 * Features:
 * - Lat/lng input fields
 * - Coordinate validation
 * - Optional bounds constraints
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PrimitiveEditor, useFieldId } from './PrimitiveEditor'
import type { EditorProps } from './types'
import type { GeopointValue } from '../schema/types'

function isValidLatitude(lat: number): boolean {
  return lat >= -90 && lat <= 90
}

function isValidLongitude(lng: number): boolean {
  return lng >= -180 && lng <= 180
}

export function GeopointEditor({
  value,
  onChange,
  schema,
  error,
  disabled,
  className,
  id: providedId,
}: EditorProps<GeopointValue | null>) {
  const id = useFieldId(schema, providedId)
  const [localLat, setLocalLat] = React.useState(
    value?.lat !== undefined ? String(value.lat) : ''
  )
  const [localLng, setLocalLng] = React.useState(
    value?.lng !== undefined ? String(value.lng) : ''
  )
  const [localError, setLocalError] = React.useState<string | undefined>(error)

  const isDisabled = disabled || (typeof schema.readOnly === 'boolean' && schema.readOnly)

  // Sync with external value
  React.useEffect(() => {
    setLocalLat(value?.lat !== undefined ? String(value.lat) : '')
    setLocalLng(value?.lng !== undefined ? String(value.lng) : '')
  }, [value])

  // Sync with external error
  React.useEffect(() => {
    setLocalError(error)
  }, [error])

  // Handle latitude change
  const handleLatChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setLocalLat(val)

      if (localError && !error) {
        setLocalError(undefined)
      }
    },
    [localError, error]
  )

  // Handle longitude change
  const handleLngChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setLocalLng(val)

      if (localError && !error) {
        setLocalError(undefined)
      }
    },
    [localError, error]
  )

  // Handle blur - validate and update
  const handleBlur = React.useCallback(() => {
    const lat = parseFloat(localLat)
    const lng = parseFloat(localLng)

    // If both empty, clear value
    if (!localLat && !localLng) {
      onChange(null)
      return
    }

    // Validate
    if (localLat && isNaN(lat)) {
      setLocalError('Invalid latitude')
      return
    }
    if (localLng && isNaN(lng)) {
      setLocalError('Invalid longitude')
      return
    }
    if (localLat && !isValidLatitude(lat)) {
      setLocalError('Latitude must be between -90 and 90')
      return
    }
    if (localLng && !isValidLongitude(lng)) {
      setLocalError('Longitude must be between -180 and 180')
      return
    }

    // Update value if both are valid
    if (localLat && localLng && !isNaN(lat) && !isNaN(lng)) {
      onChange({ lat, lng })
    }
  }, [localLat, localLng, onChange])

  const displayError = localError || error

  return (
    <PrimitiveEditor
      schema={schema}
      error={displayError}
      className={className}
      htmlFor={id}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span className="text-xs">Enter coordinates</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Latitude */}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-lat`} className="text-xs">
              Latitude
            </Label>
            <Input
              id={`${id}-lat`}
              type="number"
              value={localLat}
              onChange={handleLatChange}
              onBlur={handleBlur}
              disabled={isDisabled}
              placeholder="-90 to 90"
              min={-90}
              max={90}
              step="any"
              className={cn(
                displayError && 'border-destructive'
              )}
            />
          </div>

          {/* Longitude */}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-lng`} className="text-xs">
              Longitude
            </Label>
            <Input
              id={`${id}-lng`}
              type="number"
              value={localLng}
              onChange={handleLngChange}
              onBlur={handleBlur}
              disabled={isDisabled}
              placeholder="-180 to 180"
              min={-180}
              max={180}
              step="any"
              className={cn(
                displayError && 'border-destructive'
              )}
            />
          </div>
        </div>

        {/* Coordinate preview */}
        {value && (
          <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
          </div>
        )}
      </div>
    </PrimitiveEditor>
  )
}
