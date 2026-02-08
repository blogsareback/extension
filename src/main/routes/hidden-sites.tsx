import { useState } from 'react'
import { Trash2, Save } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemActions,
  ItemGroup,
} from '@/components/ui/item'
import { useHiddenSites } from '@/popup/hooks/useHiddenSites'

export default function HiddenSitesRoute() {
  const { sites, loading, updateSites, removeSite, clearAllSites } = useHiddenSites()
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)

  const handleStartEdit = () => {
    setEditText(sites.join('\n'))
    setIsEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const newSites = editText
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    await updateSites(newSites)
    setSaving(false)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditText('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-6" />
      </div>
    )
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-medium">Hidden Sites</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sites where the floating subscribe button won't appear
        </p>
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="sites-textarea" className="text-sm text-muted-foreground block mb-2">
              Enter one domain per line (e.g., example.com)
            </label>
            <textarea
              id="sites-textarea"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full h-64 p-3 text-sm font-mono bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              placeholder="example.com&#10;blog.example.org&#10;news.site.com"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Spinner className="size-4" /> : <Save className="size-4" />}
              Save
            </Button>
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          {sites.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">
                  {sites.length} site{sites.length !== 1 ? 's' : ''} hidden
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleStartEdit}>
                    Edit List
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearAllSites}>
                    Clear All
                  </Button>
                </div>
              </div>
              <ItemGroup className="rounded-lg border border-border">
                {sites.map((site) => (
                  <Item
                    key={site}
                  >
                    <ItemContent>
                      <ItemTitle className="font-mono text-sm">{site}</ItemTitle>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSite(site)}
                        title="Remove site"
                      >
                        <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
              <p className="mt-6 text-sm text-muted-foreground text-center">
                To hide the button on a site, click the X on the floating button when visiting that site.
              </p>
            </>
          ) : (
            <Empty className="py-16 border border-dashed rounded-lg">
              <EmptyHeader>
                <EmptyTitle>No hidden sites</EmptyTitle>
                <EmptyDescription>
                  When you dismiss the floating subscribe button on a site, it will
                  appear here. You can also click "Edit List" to add sites manually.
                </EmptyDescription>
              </EmptyHeader>
              <Button variant="outline" size="sm" onClick={handleStartEdit} className="mt-4">
                Edit List
              </Button>
            </Empty>
          )}
        </>
      )}
    </>
  )
}
