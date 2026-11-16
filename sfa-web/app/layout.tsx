import './globals.css'
import AppShell from './components/AppShell'
import 'leaflet/dist/leaflet.css'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'SFA',
  description: 'Sales Force Automation',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#222222',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (

    <html>

      <body
        className="bg-slate-100"
        style={{
          margin: 0
        }}
      >

        <AppShell>
          {children}
        </AppShell>

      </body>

    </html>

  )

}