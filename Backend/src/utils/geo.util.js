const geolib = require('geolib')


/**
 * latitude/longitude di tabel customers bertipe STRING, dan query
 * string selalu datang sebagai string. Number("") = 0, jadi string
 * kosong harus ditolak lebih dulu supaya tidak dianggap koordinat 0.
 *
 * @returns {number|null} null kalau bukan angka yang terpakai
 */
const parseCoordinate = (value) => {

    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
    ) {
        return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed)
        ? parsed
        : null;

};


const isValidLatitude = (value) =>
    value !== null &&
    value >= -90 &&
    value <= 90;


const isValidLongitude = (value) =>
    value !== null &&
    value >= -180 &&
    value <= 180;


/**
 * Hitung jarak setiap customer dari origin, buang yang di luar
 * radius, lalu urutkan dari terdekat.
 *
 * Customer tanpa koordinat valid dikeluarkan dari hasil — tanpa
 * koordinat, jaraknya tidak bisa dihitung sehingga tidak bisa
 * diklaim "terdekat".
 *
 * @param {object[]} customers  hasil .toJSON() dari Sequelize
 * @param {{latitude:number, longitude:number}} origin
 * @param {number} radiusKm
 * @returns {object[]} customer + field `distance` (km), terurut ASC
 */
const withDistanceWithinRadius = (
    customers,
    origin,
    radiusKm
) => {

    return customers

        .map(customer => {

            const latitude =
                parseCoordinate(customer.latitude);

            const longitude =
                parseCoordinate(customer.longitude);


            if (
                !isValidLatitude(latitude) ||
                !isValidLongitude(longitude)
            ) {
                return null;
            }


            const meters =
                geolib.getDistance(

                    origin,

                    {
                        latitude,
                        longitude
                    }

                );


            return {

                ...customer,

                // km, dibulatkan ke 2 desimal (presisi 10 m)
                distance:
                    Math.round(
                        (meters / 1000) * 100
                    ) / 100

            };

        })

        .filter(customer =>
            customer !== null &&
            customer.distance <= radiusKm
        )

        .sort((a, b) =>
            a.distance - b.distance
        );

};


module.exports = {
    parseCoordinate,
    isValidLatitude,
    isValidLongitude,
    withDistanceWithinRadius,
};
