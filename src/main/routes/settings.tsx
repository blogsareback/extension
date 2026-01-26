import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemGroup,
  ItemSeparator,
} from '@/components/ui/item'
import { useSettings } from '@/popup/hooks/useSettings'

const FEED_CHECK_INTERVAL_OPTIONS = [
  { value: '0', label: 'Disabled' },
  { value: '5', label: '5 minutes' },
  { value: '10', label: '10 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
]

const REQUEST_TIMEOUT_OPTIONS = [
  { value: '15', label: '15 seconds' },
  { value: '30', label: '30 seconds' },
  { value: '45', label: '45 seconds' },
  { value: '60', label: '60 seconds' },
]

const MAX_CONCURRENT_OPTIONS = [
  { value: '1', label: '1 (sequential)' },
  { value: '3', label: '3 requests' },
  { value: '5', label: '5 requests' },
  { value: '10', label: '10 requests' },
  { value: '20', label: '20 requests' },
]

const REQUEST_DELAY_OPTIONS = [
  { value: '0', label: 'No delay' },
  { value: '100', label: '100ms' },
  { value: '250', label: '250ms' },
  { value: '500', label: '500ms' },
  { value: '1000', label: '1 second' },
]

export default function SettingsRoute() {
  const { settings, loading, updateSettings, clearData, resetSettings } =
    useSettings()
  const [clearing, setClearing] = useState<string | null>(null)

  const toggleAdvanced = () => {
    updateSettings({ advancedSettingsExpanded: !settings.advancedSettingsExpanded })
  }

  const handleClearData = async (dataType: 'queue' | 'stats' | 'all') => {
    setClearing(dataType)
    await clearData(dataType)
    setClearing(null)
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
        <h2 className="text-lg font-medium">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your Blogs Are Back extension
        </p>
      </div>

      {/* Feed Discovery Section */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Feed Discovery
        </h3>
        <ItemGroup className="rounded-lg border border-border">
          <Item>
            <ItemContent>
              <ItemTitle>Automatic feed discovery</ItemTitle>
              <ItemDescription>
                Detect RSS/Atom feeds on every page you visit
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                checked={settings.feedDiscoveryEnabled}
                onCheckedChange={(checked) =>
                  updateSettings({ feedDiscoveryEnabled: checked })
                }
              />
            </ItemActions>
          </Item>
          <ItemSeparator />
          <Item>
            <ItemContent>
              <ItemTitle>Show badge count</ItemTitle>
              <ItemDescription>
                Display number of feeds found on the extension icon
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                checked={settings.showBadgeCount}
                onCheckedChange={(checked) =>
                  updateSettings({ showBadgeCount: checked })
                }
                disabled={!settings.feedDiscoveryEnabled}
              />
            </ItemActions>
          </Item>
          <ItemSeparator />
          <Item>
            <ItemContent>
              <ItemTitle>Floating subscribe button</ItemTitle>
              <ItemDescription>
                Show a subscribe button on pages with RSS feeds
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                checked={settings.floatingButtonEnabled}
                onCheckedChange={(checked) =>
                  updateSettings({ floatingButtonEnabled: checked })
                }
                disabled={!settings.feedDiscoveryEnabled}
              />
            </ItemActions>
          </Item>
          <ItemSeparator />
          <Item>
            <ItemContent>
              <ItemTitle>Stricter feed recognition</ItemTitle>
              <ItemDescription>
                Only show floating button for feeds with "feed", "atom", or "rss" in the URL
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                checked={settings.stricterFeedRecognition}
                onCheckedChange={(checked) =>
                  updateSettings({ stricterFeedRecognition: checked })
                }
                disabled={!settings.feedDiscoveryEnabled || !settings.floatingButtonEnabled}
              />
            </ItemActions>
          </Item>
        </ItemGroup>
      </section>

      {/* Notifications Section */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Notifications
        </h3>
        <ItemGroup className="rounded-lg border border-border">
          <Item>
            <ItemContent>
              <ItemTitle>Subscription notifications</ItemTitle>
              <ItemDescription>
                Show a notification when you subscribe to a feed
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                checked={settings.notificationsEnabled}
                onCheckedChange={(checked) =>
                  updateSettings({ notificationsEnabled: checked })
                }
              />
            </ItemActions>
          </Item>
          <ItemSeparator />
          <Item>
            <ItemContent>
              <ItemTitle>Blog update notifications</ItemTitle>
              <ItemDescription>
                Get notified when followed blogs have new posts
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                checked={settings.blogUpdateNotificationsEnabled}
                onCheckedChange={(checked) =>
                  updateSettings({ blogUpdateNotificationsEnabled: checked })
                }
              />
            </ItemActions>
          </Item>
        </ItemGroup>
      </section>

      {/* Performance Section */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Performance
        </h3>
        <ItemGroup className="rounded-lg border border-border">
          <Item>
            <ItemContent>
              <ItemTitle>Prefetch feed content</ItemTitle>
              <ItemDescription>
                Download feed content when updates are detected for faster loading (uses more bandwidth)
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                checked={settings.prefetchOnUpdate}
                onCheckedChange={(checked) =>
                  updateSettings({ prefetchOnUpdate: checked })
                }
              />
            </ItemActions>
          </Item>
        </ItemGroup>
      </section>

      {/* Advanced Settings Section */}
      <section className="mb-6">
        <button
          type="button"
          onClick={toggleAdvanced}
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-3 hover:text-foreground transition-colors"
        >
          {settings.advancedSettingsExpanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          Advanced Settings
        </button>

        {settings.advancedSettingsExpanded && (
          <ItemGroup className="rounded-lg border border-border">
            <Item>
              <ItemContent>
                <ItemTitle>Feed check interval</ItemTitle>
                <ItemDescription>
                  How often to automatically check for blog updates
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Select
                  value={settings.feedCheckIntervalMinutes.toString()}
                  onValueChange={(value) =>
                    updateSettings({ feedCheckIntervalMinutes: parseInt(value, 10) })
                  }
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEED_CHECK_INTERVAL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ItemActions>
            </Item>
            <ItemSeparator />
            <Item>
              <ItemContent>
                <ItemTitle>Request timeout</ItemTitle>
                <ItemDescription>
                  How long to wait for a feed to respond
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Select
                  value={settings.requestTimeoutSeconds.toString()}
                  onValueChange={(value) =>
                    updateSettings({ requestTimeoutSeconds: parseInt(value, 10) })
                  }
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_TIMEOUT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ItemActions>
            </Item>
            <ItemSeparator />
            <Item>
              <ItemContent>
                <ItemTitle>Concurrent requests</ItemTitle>
                <ItemDescription>
                  Number of feeds to check at the same time
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Select
                  value={settings.maxConcurrentRequests.toString()}
                  onValueChange={(value) =>
                    updateSettings({ maxConcurrentRequests: parseInt(value, 10) })
                  }
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAX_CONCURRENT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ItemActions>
            </Item>
            <ItemSeparator />
            <Item>
              <ItemContent>
                <ItemTitle>Request delay</ItemTitle>
                <ItemDescription>
                  Delay between consecutive requests (throttling)
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Select
                  value={settings.requestDelayMs.toString()}
                  onValueChange={(value) =>
                    updateSettings({ requestDelayMs: parseInt(value, 10) })
                  }
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_DELAY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ItemActions>
            </Item>
          </ItemGroup>
        )}
      </section>

      <Separator className="my-6" />

      {/* Data Management Section */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Data Management
        </h3>
        <ItemGroup className="rounded-lg border border-border">
          <Item>
            <ItemContent>
              <ItemTitle>Clear subscription queue</ItemTitle>
              <ItemDescription>
                Remove all pending feed subscriptions
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClearData('queue')}
                disabled={clearing !== null}
              >
                {clearing === 'queue' ? (
                  <Spinner className="size-4" />
                ) : (
                  'Clear'
                )}
              </Button>
            </ItemActions>
          </Item>
          <ItemSeparator />
          <Item>
            <ItemContent>
              <ItemTitle>Clear statistics</ItemTitle>
              <ItemDescription>
                Reset fetch counts and error statistics
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClearData('stats')}
                disabled={clearing !== null}
              >
                {clearing === 'stats' ? (
                  <Spinner className="size-4" />
                ) : (
                  'Clear'
                )}
              </Button>
            </ItemActions>
          </Item>
        </ItemGroup>
      </section>

      <Separator className="my-6" />

      {/* Reset Section */}
      <section>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Reset
        </h3>
        <ItemGroup className="rounded-lg border border-border">
          <Item>
            <ItemContent>
              <ItemTitle>Reset all settings</ItemTitle>
              <ItemDescription>
                Restore all settings to their default values
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button variant="outline" size="sm" onClick={resetSettings}>
                Reset
              </Button>
            </ItemActions>
          </Item>
          <ItemSeparator />
          <Item>
            <ItemContent>
              <ItemTitle className="text-destructive">
                Clear all extension data
              </ItemTitle>
              <ItemDescription>
                Remove all data including queue, statistics, and settings
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleClearData('all')}
                disabled={clearing !== null}
              >
                {clearing === 'all' ? (
                  <Spinner className="size-4" />
                ) : (
                  'Clear All'
                )}
              </Button>
            </ItemActions>
          </Item>
        </ItemGroup>
      </section>
    </>
  )
}
