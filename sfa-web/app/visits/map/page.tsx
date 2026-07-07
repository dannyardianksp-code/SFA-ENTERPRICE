'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// 🔥 WAJIB BIAR NGGAK ERROR
const VisitMap = dynamic(() => import('../../components/VisitMap'), {
    ssr: false
})

export default function VisitMapPage() {
    const [visits, setVisits] = useState<any[]>([])

    useEffect(() => {
        const token = localStorage.getItem('token')

        fetch('http://localhost:1000/api/visits', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
            .then(res => res.json())
            .then(data => setVisits(data))
    }, [])

    return (
        <div>
            <h1>Visit Map</h1>

            <VisitMap visits={visits} />
        </div>
    )
}