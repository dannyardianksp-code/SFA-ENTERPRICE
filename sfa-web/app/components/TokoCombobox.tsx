'use client'

import { useEffect, useRef, useState } from 'react'

// Combobox toko: klik kotaknya buka panel berisi kolom cari + daftar
// hasil filter -- bukan input cari terpisah di atas <select> biasa,
// supaya cari & pilihnya terasa satu aksi (bukan dua kontrol yang
// terasa tidak sinkron). Dipakai di form Visit Plan (create & edit).
export default function TokoCombobox({
    customers,
    value,
    onChange
}: {
    customers: any[]
    value: string
    onChange: (id: string) => void
}) {

    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const wrapRef = useRef<HTMLDivElement>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    const selected = customers.find((c: any) => String(c.id) === value)

    const filtered = customers.filter((c: any) =>
        c.name.toLowerCase().includes(search.toLowerCase())
    )

    useEffect(() => {

        const onClickOutside = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }

        document.addEventListener('mousedown', onClickOutside)
        return () => document.removeEventListener('mousedown', onClickOutside)

    }, [])

    const openPanel = () => {
        setSearch('')
        setOpen(true)
        setTimeout(() => searchRef.current?.focus(), 20)
    }

    return (

        <div className="relative" ref={wrapRef}>

            <button
                type="button"
                onClick={() => (open ? setOpen(false) : openPanel())}
                className="w-full border rounded-xl p-3 mt-2 flex items-center justify-between gap-2 text-left bg-white"
            >
                <span className={selected ? '' : 'text-slate-400'}>
                    {selected ? selected.name : 'Pilih toko'}
                </span>
                <span className="text-slate-400 text-xs">▼</span>
            </button>

            {open && (

                <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-lg overflow-hidden">

                    <div className="flex items-center gap-2 px-3 py-2 border-b">
                        <span className="text-slate-400 text-sm">🔍</span>
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Cari nama toko..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 outline-none text-sm"
                        />
                    </div>

                    <div className="max-h-56 overflow-y-auto p-1">

                        {filtered.length === 0 && (
                            <div className="px-3 py-4 text-center text-sm text-slate-400">
                                Tidak ada toko cocok
                            </div>
                        )}

                        {filtered.map((c: any) => (
                            <div
                                key={c.id}
                                onClick={() => { onChange(String(c.id)); setOpen(false) }}
                                className={`px-3 py-2 rounded-lg text-sm cursor-pointer flex items-center justify-between gap-2 hover:bg-blue-50 ${
                                    String(c.id) === value ? 'bg-blue-50 text-blue-600 font-semibold' : ''
                                }`}
                            >
                                <span>{c.name}</span>
                                {String(c.id) === value && <span className="text-blue-600 text-xs">✓</span>}
                            </div>
                        ))}

                    </div>

                </div>

            )}

        </div>

    )

}
