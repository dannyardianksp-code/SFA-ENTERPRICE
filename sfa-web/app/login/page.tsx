'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginApi } from '../services/api'
import { setToken } from '../utils/auth'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const router = useRouter()

    const handleLogin = async () => {
        const data =
            await loginApi(
                email,
                password
            )

        if (data.token) {

            setToken(data.token)

            localStorage.setItem(
                'name',
                data.user.name
            )
            localStorage.setItem(
                'role',
                data.user.role
            )


            if (

                data.user.role ===
                'ADMINISTRATOR'

                ||

                data.user.role ===
                'MANAGER'

            ) {

                router.push(
                    '/.'
                )

            }

            else if (

                data.user.role ===
                'SUPERVISOR'

            ) {

                router.push(
                    '/visit-plans'
                )

            }

            else if (

                data.user.role ===
                'SPG'

            ) {

                router.push(
                    '/.'
                )

            }

            else {

                router.push(
                    '/'
                )

            }

        } else {

            alert('Login gagal')

        }
    }




    return (

        <div
            className="
            min-h-screen
            flex
            items-center
            justify-center
            bg-gradient-to-br
            from-blue-900
            via-slate-900
            to-black
            p-6
        "
        >

            <div
                className="
                w-full
                max-w-6xl
                bg-white
                rounded-3xl
                overflow-hidden
                shadow-2xl
                grid
                lg:grid-cols-2
            "
            >

                {/* LEFT SIDE */}

                <div
                    className="
                    hidden
                    lg:flex
                    flex-col
                    justify-center
                    bg-gradient-to-br
                    from-blue-600
                    to-indigo-700
                    text-white
                    p-12
                "
                >

                    <h1
                        className="
                        text-5xl
                        font-bold
                        mb-6
                    "
                    >

                        SALES FORCE
                        <br />


                    </h1>

                    <p
                        className="
                        text-lg
                        opacity-90
                        leading-8
                    "
                    >

                        Kelola kunjungan,
                        aktivitas lapangan,
                        monitoring

                    </p>

                    <div
                        className="
                        mt-10
                        space-y-4
                        text-lg
                    "
                    >

                        <div>
                            📍 Visit Tracking
                        </div>

                        <div>
                            📊 Sales Monitoring
                        </div>

                        <div>
                            🏪 Customer Management
                        </div>

                        <div>
                            🚀 Route Optimization
                        </div>

                    </div>

                </div>

                {/* RIGHT SIDE */}

                <div
                    className="
                    p-8
                    lg:p-12
                    flex
                    flex-col
                    justify-center
                "
                >

                    <div
                        className="
                        mb-10
                    "
                    >

                        <h2
                            className="
                            text-4xl
                            font-bold
                            text-slate-800
                        "
                        >

                            Welcome Back 👋

                        </h2>

                        <p
                            className="
                            text-slate-500
                            mt-2
                        "
                        >

                            Login untuk melanjutkan aktivitas

                        </p>

                    </div>

                    <div
                        className="
                        space-y-5
                    "
                    >

                        <div>

                            <label
                                className="
                                text-sm
                                font-semibold
                                text-slate-600
                            "
                            >

                                Email

                            </label>

                            <input

                                type="email"

                                value={email}

                                onChange={(e) =>
                                    setEmail(
                                        e.target.value
                                    )
                                }

                                placeholder="Masukkan email"

                                className="
                                w-full
                                mt-2
                                px-4
                                py-3
                                border
                                border-slate-300
                                rounded-xl
                                focus:outline-none
                                focus:ring-2
                                focus:ring-blue-500
                            "

                            />

                        </div>

                        <div>

                            <label
                                className="
                                text-sm
                                font-semibold
                                text-slate-600
                            "
                            >

                                Password

                            </label>

                            <input

                                type="password"

                                value={password}

                                onChange={(e) =>
                                    setPassword(
                                        e.target.value
                                    )
                                }

                                placeholder="Masukkan password"

                                className="
                                w-full
                                mt-2
                                px-4
                                py-3
                                border
                                border-slate-300
                                rounded-xl
                                focus:outline-none
                                focus:ring-2
                                focus:ring-blue-500
                            "

                            />

                        </div>

                        <button

                            onClick={handleLogin}

                            className="
                            w-full
                            bg-blue-600
                            hover:bg-blue-700
                            text-white
                            py-3
                            rounded-xl
                            font-semibold
                            transition
                        "

                        >

                            Login

                        </button>

                    </div>

                    <div
                        className="
                        mt-8
                        text-center
                        text-sm
                        text-slate-400
                    "
                    >

                        SFA v1.0

                    </div>

                </div>

            </div>

        </div>

    )


}