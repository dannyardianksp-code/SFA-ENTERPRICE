'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { API_BASE_URL } from '@/app/utils/api-config'

// 🔥 WAJIB BIAR NGGAK ERROR
const VisitMap = dynamic(() => import('../../components/VisitMap'), {
    ssr: false
})

export default function VisitMapPage() {
    const [visits, setVisits] = useState<any[]>([])

    useEffect(() => {
        const token = localStorage.getItem('token')

        fetch(`${API_BASE_URL}/visits`, {
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