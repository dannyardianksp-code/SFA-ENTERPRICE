'use client'

import { useEffect, useRef, useState } from 'react'

export type MultiSelectOption = {
    id: number
    label: string
}

/**
 * Tombol filter + popover checklist -- model yang sama dengan filter
 * Area/Channel di menu Customer (tombol biru dengan jumlah terpilih,
 * "Hapus semua", daftar checkbox). Kosong = tidak memfilter apa pun.
 *
 * `searchable` menambah kotak cari di dalam popover, buat daftar
 * panjang seperti nama sales.
 */
export default function MultiSelectFilter({
    icon,
    label,
    options,
    selected,
    onChange,
    searchable = false,
    emptyText = 'Belum ada data.',
}: {
    icon: string
    label: string
    options: MultiSelectOption[]
    selected: number[]
    onChange: (ids: number[]) => void
    searchable?: boolean
    emptyText?: string
}) {

    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const ref = useRef<HTMLDivElement>(null)

    // Tutup kalau klik di luar popover.
    useEffect(() => {

        if (!open) return

        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }

        document.addEventListener('mousedown', handler)

        return () => document.removeEventListener('mousedown', handler)

    }, [open])

    const toggle = (id: number) =>
        onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

    const visible = options.filter((o) =>
        o.label.toLowerCase().includes(query.trim().toLowerCase())
    )

    return (

        <div className="relative" ref={ref}>

            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={`px-4 py-3 rounded-2xl shadow text-sm font-semibold whitespace-nowrap ${
                    selected.length > 0
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-700'
                }`}
            >
                {icon} {label}{selected.length > 0 ? ` (${selected.length})` : ''}
            </button>

            {open && (

                <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-lg border border-slate-200 p-3 z-20">

                    <div className="flex items-center justify-between mb-2">

                        <span className="text-xs font-bold text-slate-400 uppercase">
                            Filter {label}
                        </span>

                        {selected.length > 0 && (
                            <button
                                type="button"
                                onClick={() => onChange([])}
                                className="text-xs text-blue-600 font-semibold"
                            >
                                Hapus semua
                            </button>
                        )}

                    </div>

                    {searchable && (
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={`🔍 Cari ${label.toLowerCase()}...`}
                            className="w-full border rounded-xl px-3 py-2 text-sm mb-2"
                        />
                    )}

                    <div className="max-h-64 overflow-y-auto flex flex-col gap-1">

                        {visible.length === 0 && (
                            <p className="text-sm text-slate-400 px-1 py-2">
                                {options.length === 0 ? emptyText : 'Tidak ada yang cocok.'}
                            </p>
                        )}

                        {visible.map((o) => (
                            <label
                                key={o.id}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-sm text-slate-700"
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.includes(o.id)}
                                    onChange={() => toggle(o.id)}
                                />
                                {o.label}
                            </label>
                        ))}

                    </div>

                </div>

            )}

        </div>

    )

}
