'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { API_BASE_URL } from '@/app/utils/api-config'

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

  const fetchDashboard =
    async () => {

      const token =
        localStorage.getItem(
          'token'
        )

      const res =
        await fetch(

          `${API_BASE_URL}/dashboard/spg`,

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

  // Hanya data-condition, BUKAN role check -- SUPERVISOR kadang masih
  // pegang visit plan sendiri, jadi kartu personal tampil kalau
  // targetVisit-nya hari ini > 0, siapa pun rolenya.
  const hasPersonalTarget = dashboard.today.targetVisit > 0

  const hasTeam =
    Array.isArray(dashboard.team) && dashboard.team.length > 0

  const progressColor = (p: number) => {
    if (p >= 70) return '#16a34a'
    if (p >= 40) return '#d97706'
    return '#dc2626'
  }

  const formatRupiah = (value: number) => {

    if (value >= 1_000_000) {
      return `Rp ${(value / 1_000_000).toFixed(1).replace('.', ',')} jt`
    }

    if (value >= 1_000) {
      return `Rp ${(value / 1_000).toFixed(0)} rb`
    }

    return `Rp ${value}`

  }

  const belumBerkunjung = hasTeam
    ? dashboard.team.filter((m: any) => m.visited === 0)
    : []

  const progressRendah = hasTeam
    ? dashboard.team.filter((m: any) => Number(m.progress) < 50)
    : []

  return (




    <div
      style={{
        width: '100%',
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '24px'
      }}
    >

      {/* GREETING -- selalu tampil, generik buat siapa pun yang login */}

      <div style={{ ...cardStyle, marginBottom: 20 }}>

        <h1 style={{ margin: 0, fontSize: 26, color: '#0f172a' }}>

          👋 Selamat {greeting}, {userName}

        </h1>

        <p style={{ color: '#64748b', marginTop: 6 }}>

          {todayDate}
          {hasTeam ? ' -- ringkasan tim Anda hari ini' : ''}

        </p>

      </div>

      {/* PERSONAL -- kondisional berdasarkan DATA (targetVisit > 0),
          bukan role */}

      {hasPersonalTarget && (

        <div

          style={{

            background: 'linear-gradient(135deg,#2563eb,#7c3aed)',

            color: '#fff',

            padding: '22px 26px',

            borderRadius: 20,

            marginBottom: 20,

            boxShadow: '0 15px 30px rgba(37,99,235,.2)',

            display: 'flex',

            alignItems: 'center',

            justifyContent: 'space-between',

            flexWrap: 'wrap',

            gap: 20

          }}

        >

          <div>

            <div style={{ fontSize: 12, fontWeight: 700, opacity: .85, textTransform: 'uppercase' }}>

              Visit Plan Anda Sendiri

            </div>

            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>

              {dashboard.today.visited} / {dashboard.today.targetVisit}{' '}

              <span style={{ fontSize: 14, fontWeight: 400, opacity: .85 }}>

                kunjungan hari ini

              </span>

            </div>

          </div>

          <div style={{ minWidth: 220 }}>

            <div style={{ width: '100%', height: 14, background: 'rgba(255,255,255,.25)', borderRadius: 30 }}>

              <div

                style={{

                  width: `${dashboard.today.progress}%`,

                  height: 14,

                  background: 'linear-gradient(90deg,#22c55e,#4ade80)',

                  borderRadius: 30

                }}

              />

            </div>

            <div style={{ fontSize: 12, marginTop: 6, opacity: .9 }}>

              {dashboard.today.progress}% -- {dashboard.today.remaining} toko lagi

            </div>

          </div>

        </div>

      )}

      {/* ATTENTION -- cuma relevan buat yang punya tim */}

      {hasTeam && (belumBerkunjung.length > 0 || progressRendah.length > 0) && (

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>

          {belumBerkunjung.length > 0 && (

            <div

              style={{

                display: 'flex',

                alignItems: 'center',

                gap: 12,

                background: '#fef2f2',

                border: '1px solid #fecaca',

                borderRadius: 14,

                padding: '14px 18px'

              }}

            >

              <div style={{ fontSize: 20 }}>⚠️</div>

              <div style={{ fontSize: 14, fontWeight: 600, color: '#b91c1c' }}>

                {belumBerkunjung.length} sales belum ada kunjungan sama sekali hari ini --{' '}
                {belumBerkunjung.map((m: any) => m.name).join(', ')}

              </div>

            </div>

          )}

          {progressRendah.length > 0 && (

            <div

              style={{

                display: 'flex',

                alignItems: 'center',

                gap: 12,

                background: '#fffbeb',

                border: '1px solid #fde68a',

                borderRadius: 14,

                padding: '14px 18px'

              }}

            >

              <div style={{ fontSize: 20 }}>📉</div>

              <div style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>

                {progressRendah.length} sales progress kunjungan di bawah 50% hari ini

              </div>

            </div>

          )}

        </div>

      )}

      {/* KPI GRID -- cuma relevan buat yang punya tim */}

      {hasTeam && (

        <div

          style={{

            display: 'grid',

            gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',

            gap: 16,

            marginBottom: 20

          }}

        >

          <div style={cardStyle}>

            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>

              🕐 Absen Hari Ini

            </div>

            <div style={{ fontSize: 30, fontWeight: 700, color: '#0f172a', marginTop: 6 }}>

              {dashboard.attendanceToday?.present ?? 0}
              <span style={{ fontSize: 16, color: '#94a3b8' }}>
                {' '}/ {(dashboard.attendanceToday?.present ?? 0) + (dashboard.attendanceToday?.absent ?? 0)}
              </span>

            </div>

            <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>

              {dashboard.attendanceToday?.absent ?? 0} belum absen

            </div>

          </div>

          <div style={cardStyle}>

            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>

              🛒 Orders Hari Ini

            </div>

            <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginTop: 6 }}>

              {formatRupiah(dashboard.ordersToday?.total ?? 0)}

            </div>

            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>

              {dashboard.ordersToday?.count ?? 0} order

            </div>

          </div>

          <div style={cardStyle}>

            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>

              📦 Orders Bulan Ini

            </div>

            <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginTop: 6 }}>

              {formatRupiah(dashboard.ordersMonth?.total ?? 0)}

            </div>

            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>

              {dashboard.ordersMonth?.count ?? 0} order

            </div>

          </div>

          <div style={cardStyle}>

            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>

              🗺️ Aktif di Lapangan

            </div>

            <div style={{ fontSize: 30, fontWeight: 700, color: '#0f172a', marginTop: 6 }}>

              {dashboard.activeInField ?? 0}

            </div>

            <a

              onClick={() => router.push('/live-tracking')}

              style={{

                display: 'inline-block',

                fontSize: 12,

                fontWeight: 600,

                color: '#2563eb',

                marginTop: 4,

                cursor: 'pointer'

              }}

            >

              Lihat Live Tracking →

            </a>

          </div>

          <div style={cardStyle}>

            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>

              🏪 Customer

            </div>

            <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a', marginTop: 6 }}>

              {dashboard.customerSummary?.active ?? 0} aktif

            </div>

            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>

              {dashboard.customerSummary?.inactive ?? 0} nonaktif

            </div>

          </div>

        </div>

      )}

      {/* BULAN */}

      <div

        style={{

          ...cardStyle,

          marginBottom: 20

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

      {/* TEAM PERFORMANCE */}

      {hasTeam && (

        <div style={{ ...cardStyle, marginBottom: 20 }}>

          <h2 style={{ marginTop: 0, fontSize: 18, color: '#0f172a' }}>

            👥 Team Performance -- Kunjungan Hari Ini

          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>

            {dashboard.team.map((member: any) => (

              <div

                key={member.id}

                style={{

                  display: 'grid',

                  gridTemplateColumns: '160px 1fr 60px',

                  alignItems: 'center',

                  gap: 16,

                  padding: '12px 8px',

                  borderBottom: '1px solid #f1f5f9'

                }}

              >

                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>

                  {member.name}

                </div>

                <div style={{ width: '100%', height: 10, background: '#e5e7eb', borderRadius: 30 }}>

                  <div

                    style={{

                      width: `${member.progress}%`,

                      height: 10,

                      borderRadius: 30,

                      background: progressColor(Number(member.progress))

                    }}

                  />

                </div>

                <div

                  style={{

                    fontSize: 13,

                    fontWeight: 700,

                    textAlign: 'right',

                    color: progressColor(Number(member.progress))

                  }}

                >

                  {member.progress}%

                </div>

              </div>

            ))}

          </div>

        </div>

      )}

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
