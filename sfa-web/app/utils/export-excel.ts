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

        sheet.columns = kolom.map((key) => ({
            header: key,
            key,
            width: Math.min(Math.max(key.length + 4, 14), 40)
        }))

        sheet.getRow(1).font = { bold: true }

        rows.forEach((row) => sheet.addRow(row))

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
