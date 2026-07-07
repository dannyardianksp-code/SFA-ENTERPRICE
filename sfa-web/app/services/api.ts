const BASE_URL = 'http://localhost:1000/api'

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
        body: JSON.stringify({ email, password })
    })
    return res.json()
}