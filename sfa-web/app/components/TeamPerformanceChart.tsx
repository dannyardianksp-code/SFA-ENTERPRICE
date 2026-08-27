'use client'

import {

    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend

} from 'chart.js'

import { Bar } from 'react-chartjs-2'

ChartJS.register(

    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend

)

type AnggotaTim = {

    id: number
    name: string
    targetVisit: number
    visited: number
    remaining: number
    progress: number | string

}

export default function TeamPerformanceChart({

    team

}: {

    team: AnggotaTim[]

}) {

    if (!team || team.length === 0) {

        return null

    }

    const data = {

        labels: team.map(a => a.name),

        datasets: [

            {

                label: 'Target',

                data: team.map(a => a.targetVisit),

                backgroundColor: '#cbd5e1',

                borderRadius: 6,

                barPercentage: 0.6,

                categoryPercentage: 0.6

            },

            {

                label: 'Tercapai',

                data: team.map(a => a.visited),

                backgroundColor: '#2563eb',

                borderRadius: 6,

                barPercentage: 0.6,

                categoryPercentage: 0.6

            }

        ]

    }

    const options = {

        responsive: true,

        maintainAspectRatio: false,

        plugins: {

            legend: {

                position: 'top' as const,

                labels: {

                    usePointStyle: true,

                    boxWidth: 8,

                    font: { size: 13 }

                }

            },

            title: { display: false },

            tooltip: {

                backgroundColor: '#111827',

                padding: 10,

                cornerRadius: 8

            }

        },

        scales: {

            x: {

                grid: { display: false },

                ticks: { font: { size: 13 } }

            },

            y: {

                beginAtZero: true,

                ticks: { precision: 0 as const },

                grid: { color: '#f1f5f9' }

            }

        }

    }

    return (

        <div

            style={{

                background: '#fff',

                borderRadius: 20,

                padding: 20,

                boxShadow: '0 10px 25px rgba(0,0,0,.08)',

                marginBottom: 25

            }}

        >

            <h2 style={{ marginTop: 0 }}>

                📊 Performance Tim Hari Ini

            </h2>

            <div style={{ height: 320 }}>

                <Bar data={data} options={options} />

            </div>

        </div>

    )

}
