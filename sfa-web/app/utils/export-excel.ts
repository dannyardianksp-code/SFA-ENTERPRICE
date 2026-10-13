import ExcelJS from 'exceljs'

/**
 * Setiap object di `rows` jadi satu baris -- key dari object PERTAMA
 * dipakai sebagai urutan & judul kolom, jadi semua object di `rows`
 * harus punya key yang sama (susunan yang dipakai tiap halaman Report
 * di project ini: map array hasil filter jadi array object polos
 * sebelum manggil fungsi ini).
 */
export async function exportToExcel(

    filename: string,
    sheetName: string,
    rows: Record<string, string | number | null>[]

) {

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet(sheetName)

    if (rows.length === 0) {

        sheet.addRow(['Tidak ada data untuk diekspor'])

    } else {

        const kolom = Object.keys(rows[0])

        // Lebar kolom dari ISI DATA juga, bukan cuma panjang judulnya --
        // sebelumnya "Catatan"/"Customer" yang judulnya pendek tapi
        // isinya panjang selalu kepotong, harus di-resize manual tiap
        // buka file. Link (hyperlink) dihitung dari teks tampilannya
        // ("Buka Link"), bukan dari panjang URL aslinya -- URL bisa
        // sangat panjang padahal yang kelihatan di sel cuma label pendek.
        sheet.columns = kolom.map((key) => {

            const panjangData = rows.map((r) => {
                const nilai = r[key]
                if (typeof nilai === 'string' && /^https?:\/\//.test(nilai)) {
                    return 'Buka Link'.length
                }
                return String(nilai ?? '').length
            })

            const lebarKonten = Math.max(key.length, ...panjangData)

            return {
                header: key,
                key,
                width: Math.min(Math.max(lebarKonten + 2, 12), 45)
            }

        })

        sheet.getRow(1).font = { bold: true }

        // Dropdown filter bawaan Excel di baris header -- penerima file
        // bisa filter/sort langsung tanpa format ulang sendiri.
        sheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: kolom.length }
        }

        // Nilai berupa URL (mis. link foto activity) dijadikan hyperlink
        // beneran yang bisa diklik -- bukan cuma teks biasa yang
        // kelihatan kayak link. ExcelJS TIDAK auto-deteksi ini sendiri;
        // nilai string polos tetap jadi teks mati walau isinya "http...".
        rows.forEach((row) => {

            const excelRow = sheet.addRow(row)

            kolom.forEach((key, i) => {
                const nilai = row[key]

                if (typeof nilai === 'string' && /^https?:\/\//.test(nilai)) {
                    const cell = excelRow.getCell(i + 1)
                    cell.value = { text: 'Buka Link', hyperlink: nilai }
                    cell.font = { color: { argb: 'FF2563EB' }, underline: true }
                }

            })

        })

    }

    const buffer = await workbook.xlsx.writeBuffer()

    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })

    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`

    document.body.appendChild(a)
    a.click()
    a.remove()

    URL.revokeObjectURL(url)

}
