'use client'

import {
    useEffect,
    useState
} from 'react'
import { API_BASE_URL } from '@/app/utils/api-config'

export default function CustomerProductsPage() {

    const [customers, setCustomers] =
        useState<any[]>([])

    const [products, setProducts] =
        useState<any[]>([])

    const [customerId, setCustomerId] =
        useState('')

    const [selectedProducts, setSelectedProducts] =
        useState<number[]>([])

    // LOAD DATA
    const fetchData = async () => {

        const token =
            localStorage.getItem('token')

        // CUSTOMERS
        const cRes = await fetch(
            `${API_BASE_URL}/customers`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        )

        const cData = await cRes.json()

        setCustomers(cData)

        // PRODUCTS
        const pRes = await fetch(
            `${API_BASE_URL}/products`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        )

        const pData = await pRes.json()

        setProducts(pData)

    }

    useEffect(() => {

        fetchData()

    }, [])

    // CHECKBOX
    const handleCheck = (
        id: number
    ) => {

        if (
            selectedProducts.includes(id)
        ) {

            setSelectedProducts(

                selectedProducts.filter(
                    x => x !== id
                )

            )

        } else {

            setSelectedProducts([
                ...selectedProducts,
                id
            ])

        }

    }

    // SAVE
    const handleSave = async () => {

        const token =
            localStorage.getItem('token')

        await fetch(
            `${API_BASE_URL}/customer-products`,
            {

                method: 'POST',

                headers: {

                    'Content-Type': 'application/json',

                    Authorization: `Bearer ${token}`

                },

                body: JSON.stringify({

                    customer_id: customerId,

                    product_ids: selectedProducts

                })

            }
        )

        alert('Mapping saved')
        setCustomerId('')

        setSelectedProducts([])

    }

    return (

        <div style={{ padding: 20 }}>

            <h1>
                Customer Product Mapping
            </h1>

            <div>

                <label>
                    Pilih Toko
                </label>

                <br />

                <select
                    value={customerId}
                    onChange={(e) =>
                        setCustomerId(
                            e.target.value
                        )
                    }
                >

                    <option value="">
                        Pilih Toko
                    </option>

                    {customers.map((c: any) => (

                        <option
                            key={c.id}
                            value={c.id}
                        >
                            {c.name}
                        </option>

                    ))}

                </select>

            </div>

            <br />

            <div>

                <h3>
                    Product List
                </h3>

                {products.map((p: any) => (

                    <div key={p.id}>

                        <input
                            type="checkbox"
                            checked={
                                selectedProducts.includes(
                                    p.id
                                )
                            }
                            onChange={() =>
                                handleCheck(p.id)
                            }
                        />

                        {' '}

                        {p.name}

                    </div>

                ))}

            </div>

            <br />

            <button
                onClick={handleSave}
            >
                Save Mapping
            </button>

        </div>
    )

}