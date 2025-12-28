import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import ThemeToggle from '@/components/theme-toggle'

const navItems = [
  { to: '/queue', label: 'Queue' },
  { to: '/settings', label: 'Settings' },
]

export function Navigation() {
  return (
    <header>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Blogs Are Back</h1>
          <p className="text-muted-foreground mt-1">Extension Options</p>
        </div>
        <ThemeToggle />
      </div>

      <nav className="flex gap-1 border-b border-border">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'px-4 py-2 text-sm font-medium transition-colors -mb-px',
                isActive
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
