import './globals.css'
import AppShell from './components/AppShell'
import 'leaflet/dist/leaflet.css'

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