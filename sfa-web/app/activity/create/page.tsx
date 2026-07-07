'use client'

import { useEffect, useState } from 'react'

export default function MasterActivitiesPage() {

    const [activities, setActivities] = useState<any[]>([])
    const [search, setSearch] = useState('')

    const [form, setForm] = useState({
        code: '',
        name: ''
    })

    const [editId, setEditId] = useState<number | null>(null)

    // ======================
    // FETCH
    // ======================
    const fetchData = async () => {

        const token = localStorage.getItem('token')

        const res = await fetch('http://localhost:1000/api/activities', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        const data = await res.json()
        setActivities(Array.isArray(data) ? data : [])
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleChange = (e: any) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        })
    }

    // ======================
    // SAVE
    // ======================
    const handleSubmit = async (e: any) => {
        e.preventDefault()

        const token = localStorage.getItem('token')

        const url = editId
            ? `http://localhost:1000/api/activities/${editId}`
            : `http://localhost:1000/api/activities`

        const method = editId ? 'PUT' : 'POST'

        await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(form)
        })

        setForm({ code: '', name: '' })
        setEditId(null)
        fetchData()
    }

    const handleEdit = (a: any) => {
        setEditId(a.id)
        setForm({
            code: a.code,
            name: a.name
        })
    }

    const handleDelete = async (id: number) => {
        const ok = confirm('Delete activity?')
        if (!ok) return

        const token = localStorage.getItem('token')

        await fetch(`http://localhost:1000/api/activities/${id}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        fetchData()
    }

    const filtered = activities.filter((a) =>
        a.name?.toLowerCase().includes(search.toLowerCase()) ||
        a.code?.toLowerCase().includes(search.toLowerCase())
    )

    return (

        <div style={{
            padding: 25,
            background: '#f4f6fb',
            minHeight: '100vh',
            fontFamily: 'sans-serif'
        }}>

            {/* HEADER */}
            <div style={{
                background: 'linear-gradient(135deg,#4f46e5,#06b6d4)',
                color: 'white',
                padding: 25,
                borderRadius: 20,
                marginBottom: 20
            }}>
                <h1 style={{ margin: 0 }}>📌 Activity Dashboard</h1>
                <p style={{ margin: 0, opacity: 0.8 }}>
                    Manage master activity for visit system
                </p>
            </div>

            {/* STATS */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3,1fr)',
                gap: 15,
                marginBottom: 20
            }}>

                <div style={cardStyle}>
                    <h3>Total</h3>
                    <h1>{activities.length}</h1>
                </div>

                <div style={cardStyle}>
                    <h3>Filtered</h3>
                    <h1>{filtered.length}</h1>
                </div>

                <div style={cardStyle}>
                    <h3>Mode</h3>
                    <h1>{editId ? 'EDIT' : 'CREATE'}</h1>
                </div>

            </div>

            {/* SEARCH */}
            <input
                placeholder="🔍 Search activity..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={searchStyle}
            />

            {/* FORM CARD */}
            <div style={formCard}>

                <h2 style={{ marginBottom: 15 }}>
                    {editId ? '✏ Edit Activity' : '➕ Create Activity'}
                </h2>

                <form onSubmit={handleSubmit} style={{
                    display: 'flex',
                    gap: 10
                }}>

                    <input
                        name="code"
                        placeholder="Code"
                        value={form.code}
                        onChange={handleChange}
                        style={inputStyle}
                    />

                    <input
                        name="name"
                        placeholder="Activity Name"
                        value={form.name}
                        onChange={handleChange}
                        style={inputStyle}
                    />

                    <button style={btnPrimary}>
                        {editId ? 'Update' : 'Save'}
                    </button>

                </form>

            </div>

            {/* LIST */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))',
                gap: 15
            }}>

                {
                    filtered.map((a) => (

                        <div key={a.id} style={cardItem}>

                            <div>
                                <h3 style={{ margin: 0 }}>{a.name}</h3>
                                <p style={{ margin: 0, opacity: 0.6 }}>
                                    {a.code}
                                </p>
                            </div>

                            <div style={{
                                display: 'flex',
                                gap: 10,
                                marginTop: 15
                            }}>

                                <button
                                    onClick={() => handleEdit(a)}
                                    style={btnEdit}
                                >
                                    Edit
                                </button>

                                {/* <button
                                    onClick={() => handleDelete(a.id)}
                                    style={btnDelete}
                                >
                                    Delete
                                </button> */}

                            </div>

                        </div>

                    ))
                }

            </div>

        </div>
    )
}

// ======================
// STYLES
// ======================

const cardStyle = {
    background: 'white',
    padding: 15,
    borderRadius: 15,
    boxShadow: '0 5px 15px rgba(0,0,0,0.05)'
}

const formCard = {
    background: 'white',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    boxShadow: '0 10px 25px rgba(0,0,0,0.08)'
}

const cardItem = {
    background: 'white',
    padding: 15,
    borderRadius: 15,
    transition: '0.2s',
    boxShadow: '0 5px 15px rgba(0,0,0,0.05)'
}

const inputStyle = {
    padding: 12,
    borderRadius: 10,
    border: '1px solid #ddd',
    flex: 1
}

const searchStyle = {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    border: '1px solid #ddd',
    marginBottom: 15
}

const btnPrimary = {
    background: '#4f46e5',
    color: 'white',
    border: 'none',
    padding: '12px 18px',
    borderRadius: 10,
    cursor: 'pointer'
}

const btnEdit = {
    background: '#10b981',
    color: 'white',
    border: 'none',
    padding: '8px 12px',
    borderRadius: 8
}

const btnDelete = {
    background: '#ef4444',
    color: 'white',
    border: 'none',
    padding: '8px 12px',
    borderRadius: 8
}