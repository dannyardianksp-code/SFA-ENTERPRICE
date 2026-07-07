'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function CreateOrderPage() {
    const params = useSearchParams()
    const router = useRouter()

    const customer_id = params.get('customer_id')

    const [products, setProducts] = useState<any[]>([])
    const [items, setItems] = useState<any[]>([])

    useEffect(() => {
        const token = localStorage.getItem('token')

        fetch('http://localhost:1000/api/products', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })
            .then(res => res.json())
            .then(data => setProducts(data))
    }, [])

    const addItem = (product: any) => {
        setItems([...items, { product_id: product.id, qty: 1 }])
    }

    const submitOrder = async () => {
        const token = localStorage.getItem('token')

        await fetch('http://localhost:1000/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                customer_id,
                items
            })
        })

        alert('Order berhasil')
        router.push('/orders')
    }

    return (
        <div>
            <h1>Create Order</h1>

            <h3>Customer ID: {customer_id}</h3>

            <h2>Products</h2>

            {products.map(p => (
                <div key={p.id}>
                    {p.name} - {p.price}
                    <button onClick={() => addItem(p)}>Add</button>
                </div>
            ))}

            <h2>Items</h2>
            {items.map((i, idx) => (
                <div key={idx}>
                    Product: {i.product_id} | Qty: {i.qty}
                </div>
            ))}

            <br />

            <button onClick={submitOrder}>Submit Order</button>
        </div>
    )
}