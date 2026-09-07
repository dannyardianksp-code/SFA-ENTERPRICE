import { API_BASE_URL } from '@/app/utils/api-config'

const BASE_URL = API_BASE_URL

export const fetchOrders = async (token: string) => {
    const res = await fetch(`${BASE_URL}/orders`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    })
    return res.json()
}

export const loginApi = async (email: string, password: string) => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, platform: 'web' })
    })
    return res.json()
}