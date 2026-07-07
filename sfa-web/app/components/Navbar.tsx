'use client'

import { useRouter } from 'next/navigation'

import {

    useEffect,
    useState

} from 'react'

export default function Navbar() {

    const router =
        useRouter()

    const [name, setName] =
        useState('')

    useEffect(() => {

        const userName =

            localStorage.getItem(
                'name'
            )

        setName(
            userName || ''
        )

    }, [])

    const handleLogout = () => {

        localStorage.clear()

        router.push('/login')

    }

    return (

        <div style={{

            height: 60,

            background: '#eee',

            display: 'flex',

            justifyContent: 'space-between',

            alignItems: 'center',

            padding: '0 20px'

        }}>



            <h3>
                SFA Dashboard
            </h3>

            <div


                style={{

                    display: 'flex',

                    alignItems: 'center',

                    gap: 15

                }}>

                <span>

                    Welcome ,
                    <b>
                        {name}
                    </b>

                </span>

                <button
                    onClick={handleLogout}
                >

                    Logout

                </button>

            </div>

        </div>

    )

}