/**
 * Bonus TIDAK all-or-nothing: di bawah ambang_minimal (% dari target)
 * bonus-nya Rp 0. Begitu tercapai ambang, bonus dihitung PROPORSIONAL
 * terhadap persentase pencapaian, dibatasi maksimal 100% (kunjungan
 * melebihi target tidak melipatgandakan bonus).
 *
 * SATU-SATUNYA tempat rumus ini boleh dihitung -- endpoint progress
 * insentif dan endpoint ringkasan pendapatan berdua memanggil fungsi
 * ini, supaya angkanya tidak pernah dihitung dua cara berbeda.
 *
 * @param {number} visited jumlah tercapai (kunjungan/activity)
 * @param {{target:number, bonus:number|string, ambang_minimal:number}} rule
 */
const hitungBonus = (visited, rule) => {

    const target = Number(rule.target) || 0

    const pct =
        target === 0
            ? 0
            : Math.min(100, Math.round((visited / target) * 100))

    const ambang = rule.ambang_minimal ?? 80

    const dapatBonus = pct >= ambang

    const bonus =
        dapatBonus
            ? Math.round(Number(rule.bonus) * (pct / 100))
            : 0

    return {
        pct,
        dapatBonus,
        bonus,
        penuh: pct >= 100,
    }

}

module.exports = {
    hitungBonus,
}
