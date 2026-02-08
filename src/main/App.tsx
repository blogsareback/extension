import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provier'
import { Navigation } from './components/Navigation'
import QueueRoute from './routes/queue'
import SettingsRoute from './routes/settings'
import HiddenSitesRoute from './routes/hidden-sites'
import SavedPostsRoute from './routes/saved-posts'
import SavedPostReaderRoute from './routes/saved-post-reader'
import { EXTENSION_VERSION } from '@/utils/constants'
import { DASHBOARD_BASE_URL } from '@/background/utils/constants'

export default function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto p-6">
          <Navigation />

          <main className="mt-6">
            <Routes>
              <Route path="/" element={<Navigate to="/queue" replace />} />
              <Route path="/queue" element={<QueueRoute />} />
              <Route path="/hidden-sites" element={<HiddenSitesRoute />} />
              <Route path="/saved" element={<SavedPostsRoute />} />
              <Route path="/saved/:postId" element={<SavedPostReaderRoute />} />
              <Route path="/settings" element={<SettingsRoute />} />
            </Routes>
          </main>

          <footer className="mt-8 pt-6 border-t border-border flex items-center justify-between">
            <a
              href={DASHBOARD_BASE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Open Blogs Are Back
            </a>
            <span className="text-xs text-muted-foreground">
              Blogs Are Back Extension v{EXTENSION_VERSION}
            </span>
          </footer>
        </div>
      </div>
    </ThemeProvider>
  )
}
