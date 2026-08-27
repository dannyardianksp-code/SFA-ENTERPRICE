'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TeamPerformanceChart from './components/TeamPerformanceChart'
// import DashboardMap from './components/DashboardMap'
export default function Dashboard() {

  const router =
    useRouter()

  const [dashboard, setDashboard] =
    useState<any>(null)

  const [userName, setUserName] =
    useState('')



  const cardStyle = {

    background: '#fff',

    borderRadius: 20,

    padding: 20,

    boxShadow:
      '0 10px 25px rgba(0,0,0,.08)'

  }



  const kpiCard = {

    background: '#fff',

    borderRadius: 20,

    padding: 20,

    textAlign: 'center' as const,

    boxShadow:
      '0 10px 25px rgba(0,0,0,.08)'

  }

  const fetchDashboard =
    async () => {

      const token =
        localStorage.getItem(
          'token'
        )

      const res =
        await fetch(

          'http://localhost:1000/api/dashboard/spg',

          {

            headers: {

              Authorization:
                `Bearer ${token}`

            }

          }

        )

      const data =
        await res.json()

      setDashboard(data)

    }



  useEffect(() => {

    const token =
      localStorage.getItem(
        'token'
      )

    if (!token) {

      router.push('/login')

      return

    }

    const name =

      localStorage.getItem(
        'name'
      )

    setUserName(
      name || ''
    )

    fetchDashboard()

  }, [])





  if (!dashboard) {

    return (

      <div
        style={{
          padding: 30
        }}
      >

        Loading...

      </div>

    )



  }

  const hour =
    new Date().getHours()

  const greeting =

    hour < 11

      ? 'Pagi'

      : hour < 15

        ? 'Siang'

        : hour < 18

          ? 'Sore'

          : 'Malam'

  const todayDate =
    new Date().toLocaleDateString(

      'id-ID',

      {

        weekday: 'long',

        day: 'numeric',

        month: 'long',

        year: 'numeric'

      }

    )

  return (




    <div
      style={{
        width: '100%',
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '24px'
      }}
    >

      <div

        style={{

          display: 'grid',

          gridTemplateColumns:
            'repeat(auto-fit,minmax(350px,1fr))',

          gap: 20,

          marginBottom: 25

        }}

      >

        {/* QUICK ACTION */}

        <div

          onClick={() =>

            router.push('/visit-plans')

          }

          style={{

            background:
              'linear-gradient(135deg,#10b981,#059669)',

            color: '#fff',

            borderRadius: 20,

            padding: 25,

            cursor: 'pointer',

            boxShadow:
              '0 10px 25px rgba(16,185,129,.25)'

          }}

        >

          <h2>

            🚀 Mulai Kunjungan

          </h2>

          <p>

            Klik untuk memulai aktivitas visit hari ini

          </p>

        </div>

        {/* NEXT STORE */}

        <div

          style={{

            background: '#fff',

            borderRadius: 20,

            padding: 25,

            boxShadow:
              '0 10px 25px rgba(0,0,0,.08)'

          }}

        >

          <h2>

            📍 Kunjungan Berikutnya

          </h2>

          {

            dashboard.pendingStores.length > 0

              ?

              (

                <>

                  <h3>

                    {

                      dashboard.pendingStores[0]

                        ?.Customer?.name

                    }

                  </h3>

                  <p>

                    Belum Dikunjungi

                  </p>

                </>

              )

              :

              (

                <h3>

                  🎉 Semua toko selesai dikunjungi

                </h3>

              )

          }

        </div>

      </div>

      {/* HERO */}

      <div

        style={{

          background:
            'linear-gradient(135deg,#2563eb,#7c3aed)',

          color: '#fff',

          padding: 35,

          borderRadius: 24,

          marginBottom: 25,

          boxShadow:
            '0 20px 40px rgba(37,99,235,.25)'

        }}

      >

        <h1

          style={{

            margin: 0,

            fontSize: 34

          }}

        >

          👋 Selamat {greeting},

          {' '}

          {userName}

        </h1>

        <p

          style={{

            opacity: .9,

            marginTop: 8

          }}

        >

          {todayDate}

        </p>

        <div

          style={{

            marginTop: 25

          }}

        >

          <h2

            style={{

              fontSize: 42,

              margin: 0

            }}

          >

            {

              dashboard.today.visited

            }

            /

            {

              dashboard.today.targetVisit

            }

          </h2>

          <p>

            Today Visited

          </p>

        </div>

        <div

          style={{

            marginTop: 20

          }}

        >

          <div

            style={{

              width: '100%',

              height: 18,

              background:
                'rgba(255,255,255,.25)',

              borderRadius: 30

            }}

          >

            <div

              style={{

                width:

                  `${dashboard.today.progress}%`,

                height: 18,

                background:

                  'linear-gradient(90deg,#22c55e,#4ade80)',

                borderRadius: 30

              }}

            />

          </div>

        </div>

        <div

          style={{

            display: 'flex',

            gap: 30,

            marginTop: 20

          }}

        >

          <div>

            <strong>

              Progress

            </strong>

            <br />

            {

              dashboard.today.progress

            }%

          </div>

          <div>

            <strong>

              Remaining

            </strong>

            <br />

            {

              dashboard.today.remaining

            }

          </div>

          <div>

            <strong>

              Activity

            </strong>

            <br />

            {

              dashboard.activitiesToday

            }

          </div>

        </div>

      </div>





      {/* BULAN */}

      <div

        style={{

          ...cardStyle,

          marginBottom: 25

        }}

      >

        <h2>

          📅 MONTHLY PROGRESS

        </h2>

        <p>

          Target :

          {' '}

          {

            dashboard.month.targetVisit

          }

        </p>

        <p>

          Actual :

          {' '}

          {

            dashboard.month.visited

          }

        </p>

        <p>

          Remaining :

          {' '}

          {

            dashboard.month.remaining

          }

        </p>

        <h1>

          {

            dashboard.month.progress

          }

          %

        </h1>

        <div

          style={{

            width: '100%',

            height: 16,

            background:
              '#e5e7eb',

            borderRadius: 30

          }}

        >

          <div

            style={{

              width:

                `${dashboard.month.progress}%`,

              height: 16,

              background:
                '#2563eb',

              borderRadius: 30

            }}

          />

        </div>

      </div>

      <TeamPerformanceChart team={dashboard.team} />

      {/* STORE */}

      <div

        style={{

          display: 'grid',

          gridTemplateColumns:
            'repeat(auto-fit,minmax(450px,1fr))',

          gap: 20

        }}

      >

        {/* VISITED */}

        <div style={cardStyle}>

          <h2>

            ✅ TODAY'S STORE VISITED

          </h2>

          {

            dashboard.visitedStores.length === 0

              ?

              (

                <p>

                  NULL STORE

                </p>

              )

              :

              (

                dashboard.visitedStores.map(

                  (v: any) => (

                    <div

                      key={v.id}

                      style={{

                        padding: 15,

                        marginBottom: 10,

                        background:
                          '#ecfdf5',

                        borderRadius: 12

                      }}

                    >

                      <strong>

                        {

                          v.Customer?.name

                        }

                      </strong>

                      <br />

                      <small>

                        Check In :

                        {' '}

                        {

                          new Date(

                            v.checkin_time

                          ).toLocaleString(

                            'id-ID'

                          )

                        }

                      </small>

                    </div>

                  )

                )

              )

          }

        </div>

        {/* PENDING */}

        <div style={cardStyle}>

          <h2>

            ⏳ TODAY'S STORE PENDING

          </h2>

          {

            dashboard.pendingStores.length === 0

              ?

              (

                <p>

                  Semua toko sudah dikunjungi

                </p>

              )

              :

              (

                dashboard.pendingStores.map(

                  (v: any) => (

                    <div

                      key={v.id}

                      style={{

                        padding: 15,

                        marginBottom: 10,

                        background:
                          '#fffbeb',

                        borderRadius: 12

                      }}

                    >

                      <strong>

                        {

                          v.Customer?.name

                        }

                      </strong>

                    </div>

                  )

                )

              )

          }

        </div>

      </div>

    </div>

  )

}