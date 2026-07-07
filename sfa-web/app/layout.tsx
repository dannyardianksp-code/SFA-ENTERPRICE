import './globals.css'
import SidebarWrapper from './components/SidebarWrapper'
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

        <div
          style={{
            display: 'flex'
          }}
        >

          <SidebarWrapper />

          <main

            className="text-slate-900"

            style={{

              flex: 1,

              marginLeft: 260,

              minHeight: '100vh',

              transition:
                'all .3s ease'

            }}

          >

            <div
              style={{
                padding: 24
              }}
            >

              {children}

            </div>

          </main>

        </div>

      </body>

    </html>

  )

}