interface Tab {
  id: string
  label: string
  dot?: boolean
}

interface TabBarProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              relative flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200
              ${isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
              }
            `}
          >
            {tab.label}
            {tab.dot && (
              <span className="absolute top-1 right-1.5 size-1.5 bg-primary rounded-full" />
            )}
          </button>
        )
      })}
    </div>
  )
}
