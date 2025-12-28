import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import type { ExtensionMode } from '@/utils/types'

interface ModeSelectorProps {
  mode: ExtensionMode
  loading: boolean
  onChange: (mode: ExtensionMode) => void
}

export function ModeSelector({ mode, loading, onChange }: ModeSelectorProps) {
  const isFeatured = mode === 'featured'

  const handleChange = (checked: boolean) => {
    onChange(checked ? 'featured' : 'basic')
  }

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {isFeatured ? 'Featured' : 'Basic'} Mode
        </span>
        {isFeatured && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            Updates enabled
          </Badge>
        )}
      </div>
      <Switch
        checked={isFeatured}
        onCheckedChange={handleChange}
        disabled={loading}
        aria-label="Toggle extension mode"
      />
    </div>
  )
}
