
const { Op } = require('sequelize')

const {
    parseCoordinate,
    isValidLatitude,
    isValidLongitude,
    withDistanceWithinRadius,
} = require('../utils/geo.util')

const {
    sendError,
    sendServerError,
} = require('../utils/response.util')

const {
    resolveAccessibleAreaIds,
} = require('../utils/area.util')

const {
    assertAreaChannelAccess,
} = require('../utils/access.util')

const {
    formatCustomerCode,
    isValidCodeSegment,
} = require('../utils/customer-code.util')

const db = require('../config/database')

const { QueryTypes } = require('sequelize')

const Customer =
    require('../models/customer.model')

const Area =
    require('../models/area.model')

const Channel =
    require('../models/channel.model')

const User =
    require('../models/user.model')

const CustomerGroup =
    require('../models/customerGroup.model')

const Class =
    require('../models/class.model')

/**
 * Relasi yang selalu disertakan pada respons satu customer.
 *
 * Dipakai bersama oleh getById, create, dan kedua endpoint update
 * supaya keempatnya mengembalikan bentuk identik — mobile bisa
 * memasukkan hasilnya langsung ke state tanpa memeriksa apa saja
 * yang ada.
 *
 * attributes UpdatedBy dibatasi dengan sengaja: tabel users punya
 * kolom password.
 */
const CUSTOMER_RELATIONS = [
    { model: Area, attributes: ['id', 'code', 'name'] },
    { model: Channel, attributes: ['id', 'code', 'name'] },
    { model: CustomerGroup, attributes: ['id', 'code', 'name'] },
    { model: Class, attributes: ['id', 'code', 'name'] },
    { model: User, as: 'UpdatedBy', attributes: ['id', 'name'] },
]

const findCustomerWithRelations = (id) =>
    Customer.findByPk(id, { include: CUSTOMER_RELATIONS })

// ======================
// GET ALL CUSTOMER
// ======================

exports.getAll =
    async (req, res) => {

        try {

            const user =
                await User.findByPk(

                    req.user.id,

                    {
                        include: [
                            {
                                model: Area,
                                as: 'AssignedAreas',
                                attributes: ['id'],
                                through: { attributes: [] }
                            }
                        ]
                    }

                )

            if (!user) {

                return sendError(
                    res,
                    404,
                    'User tidak ditemukan.'
                )

            }

            let whereCondition = {}

            // ROLE YANG DIBATASI
            const restrictedRoles = [

                'SPG',

                'SUPERVISOR'

            ]

            if (

                restrictedRoles.includes(
                    user.role
                )

            ) {

                const areaIds =
                    resolveAccessibleAreaIds(user)

                // Tidak punya area sama sekali -> tidak berhak
                // melihat customer mana pun.
                if (areaIds.length === 0) {

                    return res.json([])

                }

                whereCondition = {

                    area_id: {
                        [Op.in]: areaIds
                    },

                    channel_id:
                        user.channel_id

                }

            }

            const data =
                await Customer.findAll({

                    where:
                        whereCondition,

                    include: [

                        {
                            model: Area
                        },

                        {
                            model: Channel
                        },

                        {
                            model: CustomerGroup,
                            attributes: ['id', 'code', 'name']
                        },

                        {
                            model: Class,
                            attributes: ['id', 'code', 'name']
                        }

                    ]

                })

            res.json(data)

        }

        catch (err) {

            return sendServerError(
                res,
                err,
                'GET ALL CUSTOMER'
            )

        }

    }

// ======================
// CREATE CUSTOMER
// ======================

const MAX_CODE_ATTEMPTS = 3

/**
 * Nomor urut tertinggi untuk tahun tertentu, satu deret global.
 *
 * SUBSTRING_INDEX(code,'-',-1) mengambil segmen setelah tanda hubung
 * terakhir. Kode lama (C001, TEST001) tidak punya tanda hubung sehingga
 * mengembalikan kode utuh, tidak cocok pola '26%', dan otomatis
 * terabaikan tanpa aturan khusus.
 */
const nextSequenceForYear = async (year) => {

    const yy = String(year).padStart(2, '0')

    const rows = await db.query(
        `SELECT MAX(CAST(RIGHT(SUBSTRING_INDEX(code, '-', -1), 4) AS UNSIGNED)) AS maxSeq
           FROM customers
          WHERE SUBSTRING_INDEX(code, '-', -1) LIKE :pattern`,
        {
            replacements: { pattern: `${yy}%` },
            type: QueryTypes.SELECT,
        }
    )

    return Number(rows[0]?.maxSeq || 0) + 1

}

exports.create =
async (req, res) => {

    try {

        const { errors, values } = validateCreatePayload(req.body)

        if (errors.length > 0) {
            return sendError(res, 400, errors[0])
        }


        const user = await findUserWithAreas(req.user.id);

        if (!user) {
            return sendError(res, 404, 'User tidak ditemukan.')
        }


        // Hak akses — aturan yang sama dipakai kedua endpoint update.
        const ditolak = assertAreaChannelAccess(
            user,
            values.areaId,
            values.channelId
        )

        if (ditolak) {
            return sendError(res, ditolak.status, ditolak.message)
        }


        // Referensi harus ada — tidak ada foreign key constraint di DB,
        // jadi id yang salah akan tersimpan dan menghasilkan customer
        // yatim yang tidak muncul di daftar siapa pun.
        const [group, area, channel, kelas] = await Promise.all([
            CustomerGroup.findByPk(values.customerGroupId),
            Area.findByPk(values.areaId),
            Channel.findByPk(values.channelId),
            // classId opsional -- findByPk(null) sengaja dibiarkan
            // mengembalikan null, bukan dilewati, supaya baris di bawah
            // cuma perlu satu pemeriksaan ("dikirim tapi tidak
            // ditemukan"), bukan dua jalur terpisah.
            values.classId ? Class.findByPk(values.classId) : Promise.resolve(null),
        ])

        if (!group) return sendError(res, 400, 'Customer group tidak ditemukan.')
        if (!area) return sendError(res, 400, 'Area tidak ditemukan.')
        if (!channel) return sendError(res, 400, 'Channel tidak ditemukan.')
        if (values.classId && !kelas) return sendError(res, 400, 'Class tidak ditemukan.')

        if (!group.code) {
            return sendError(
                res,
                400,
                `Customer group "${group.name}" belum punya kode.`
            )
        }

        // formatCustomerCode melempar bila kode bukan huruf A-Z murni.
        // Ia dipanggil di dalam loop retry, di luar try-nya, sehingga
        // lemparannya akan lolos jadi 500 opaque. Diperiksa di sini
        // supaya sales dapat 400 yang menyebut kode mana yang salah.
        const kodeTidakValid = [
            ['Customer group', group.name, group.code],
            ['Area', area.name, area.code],
            ['Channel', channel.name, channel.code],
        ].find(([, , code]) => !isValidCodeSegment(code))

        if (kodeTidakValid) {
            const [label, nama, code] = kodeTidakValid

            return sendError(
                res,
                400,
                `Kode ${label} "${nama}" tidak valid (${JSON.stringify(code)}). ` +
                `Kode hanya boleh huruf A-Z. Hubungi administrator.`
            )
        }


        const year = new Date().getFullYear() % 100

        let created = null
        let lastError = null

        for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {

            const sequence = await nextSequenceForYear(year)

            const code = formatCustomerCode({
                groupCode: group.code,
                areaCode: area.code,
                channelCode: channel.code,
                year,
                sequence,
            })

            try {

                created = await Customer.create({
                    code,
                    name: values.name,
                    address: values.address,
                    owner_name: values.ownerName,
                    phone: values.phone,
                    latitude: String(values.latitude),
                    longitude: String(values.longitude),
                    location_accuracy: values.locationAccuracy,
                    customer_group_id: values.customerGroupId,
                    area_id: values.areaId,
                    channel_id: values.channelId,
                    class_id: values.classId,
                    // kolom `channel` (string legacy) sengaja dibiarkan NULL
                })

                break

            } catch (err) {

                lastError = err

                // Dua sales menyimpan bersamaan menghitung nomor sama;
                // unique index menolak yang kedua, lalu kita ulang.
                if (err?.name !== 'SequelizeUniqueConstraintError') {
                    throw err
                }

            }

        }


        if (!created) {

            console.error('[CREATE CUSTOMER] gagal kode unik', lastError)

            return sendError(
                res,
                409,
                'Gagal membuat kode customer. Silakan coba simpan lagi.'
            )

        }


        const full = await findCustomerWithRelations(created.id)

        res.status(201).json(full)


    } catch (err) {

        return sendServerError(res, err, 'CREATE CUSTOMER')

    }

};

   // ======================
// GET CUSTOMER ID
// ======================

exports.getById = async (req, res) => {

    try {

        // Bentuk respons dipakai bersama create dan kedua endpoint
        // update — lihat CUSTOMER_RELATIONS di atas.
        const customer = await findCustomerWithRelations(req.params.id);

        if (!customer) {

            return sendError(
                res,
                404,
                "Customer tidak ditemukan."
            );

        }

        return res.json(customer);

    } catch (error) {

        return sendServerError(
            res,
            error,
            'GET CUSTOMER BY ID'
        );

    }

};


// ======================
// UPDATE CUSTOMER (field teks)
// ======================

/**
 * Mengambil user beserta area yang di-assign, bentuk yang dibutuhkan
 * assertAreaChannelAccess. Dipakai create dan kedua endpoint update.
 */
const findUserWithAreas = (id) =>
    User.findByPk(id, {
        include: [
            {
                model: Area,
                as: 'AssignedAreas',
                attributes: ['id'],
                through: { attributes: [] },
            },
        ],
    })


exports.update = async (req, res) => {

    try {

        const customer = await Customer.findByPk(req.params.id)

        if (!customer) {
            return sendError(res, 404, 'Customer tidak ditemukan.')
        }

        const user = await findUserWithAreas(req.user.id)

        if (!user) {
            return sendError(res, 404, 'User tidak ditemukan.')
        }

        // Hak akses diperiksa SEBELUM validasi: user yang tidak berhak
        // tidak perlu diberi tahu field mana yang salah formatnya.
        //
        // Yang diperiksa adalah area dan channel milik customer yang
        // TERSIMPAN, bukan dari body — keduanya memang tidak bisa
        // diubah.
        const ditolak = assertAreaChannelAccess(
            user,
            customer.area_id,
            customer.channel_id
        )

        if (ditolak) {
            return sendError(res, ditolak.status, ditolak.message)
        }

        const { errors, values } = validateUpdatePayload(req.body, customer)

        if (errors.length > 0) {
            return sendError(res, 400, errors[0])
        }

        if (values.classId) {
            const kelas = await Class.findByPk(values.classId)

            if (!kelas) {
                return sendError(res, 400, 'Class tidak ditemukan.')
            }
        }

        await customer.update({
            name: values.name,
            address: values.address,
            owner_name: values.ownerName,
            phone: values.phone,
            class_id: values.classId,
            updated_at: new Date(),
            updated_by: req.user.id,
        })

        res.json(await findCustomerWithRelations(customer.id))

    } catch (err) {

        return sendServerError(res, err, 'UPDATE CUSTOMER')

    }

}


// ======================
// UPDATE LOKASI CUSTOMER
// ======================

/**
 * Terpisah dari update field teks karena aturan akurasi hanya berlaku
 * di sini. Digabung, validatornya harus bercabang "kalau lokasi ada
 * maka…", dan jadi mungkin mengirim teks + lokasi sekaligus — yang
 * justru dilarang oleh desainnya.
 */
exports.updateLocation = async (req, res) => {

    try {

        const customer = await Customer.findByPk(req.params.id)

        if (!customer) {
            return sendError(res, 404, 'Customer tidak ditemukan.')
        }

        const user = await findUserWithAreas(req.user.id)

        if (!user) {
            return sendError(res, 404, 'User tidak ditemukan.')
        }

        const ditolak = assertAreaChannelAccess(
            user,
            customer.area_id,
            customer.channel_id
        )

        if (ditolak) {
            return sendError(res, ditolak.status, ditolak.message)
        }

        const { errors, values } = validateLocationPayload(req.body)

        if (errors.length > 0) {
            return sendError(res, 400, errors[0])
        }

        // Koordinat disimpan sebagai varchar di skema ini — String()
        // eksplisit supaya Sequelize tidak mengirim angka.
        await customer.update({
            latitude: String(values.latitude),
            longitude: String(values.longitude),
            location_accuracy: values.locationAccuracy,
            updated_at: new Date(),
            updated_by: req.user.id,
        })

        res.json(await findCustomerWithRelations(customer.id))

    } catch (err) {

        return sendServerError(res, err, 'UPDATE CUSTOMER LOCATION')

    }

}


// ======================
// GET NEARBY CUSTOMER
// ======================

const DEFAULT_RADIUS_KM = 10;


exports.getNearbyCustomers =
async (req, res) => {

    try {

        const latitude =
            parseCoordinate(req.query.latitude);

        const longitude =
            parseCoordinate(req.query.longitude);


        if (
            latitude === null ||
            longitude === null
        ) {

            return sendError(
                res,
                400,
                "Parameter latitude dan longitude wajib diisi berupa angka."
            );

        }


        if (
            !isValidLatitude(latitude) ||
            !isValidLongitude(longitude)
        ) {

            return sendError(
                res,
                400,
                "Koordinat berada di luar rentang yang valid."
            );

        }


        const requestedRadius =
            parseCoordinate(req.query.radius);

        const radiusKm =
            requestedRadius === null
                ? DEFAULT_RADIUS_KM
                : requestedRadius;


        if (radiusKm <= 0) {

            return sendError(
                res,
                400,
                "Parameter radius harus lebih besar dari 0."
            );

        }


        const user =
            await User.findByPk(

                req.user.id,

                {
                    include:[
                        {
                            model:Area,
                            as:"AssignedAreas",
                            attributes:[
                                "id",
                                "code",
                                "name",

                            ],

                            through:{
                                attributes:[]
                            }
                        }
                    ]

                }

            );


        if (!user) {

            return sendError(
                res,
                404,
                "User tidak ditemukan."
            );

        }


        // Helper yang sama dipakai getAll, supaya hak akses area
        // tidak pernah dihitung dengan dua cara berbeda.
        const areaIds =
            resolveAccessibleAreaIds(user);


        // Selalu balas array telanjang. Sebelumnya cabang ini
        // mengembalikan { success, message, data } sehingga bentuk
        // responsnya berbeda dari cabang sukses dan memecahkan client.
        if (areaIds.length === 0) {

            return res.json([]);

        }


        const customers =
            await Customer.findAll({

                where:{
                    area_id:{
                        [Op.in]: areaIds
                    }
                },


                include:[
                    {
                        model:Area,
                        attributes:[
                            "id",
                            "code",
                            "name"
                        ]
                    },

                    {
                        model:Channel,
                        attributes:[
                            "id",
                            "code",
                            "name"
                        ]
                    }
                ]

            });


        const nearby =
            withDistanceWithinRadius(

                customers.map(
                    customer => customer.toJSON()
                ),

                {
                    latitude,
                    longitude
                },

                radiusKm

            );


        res.json(nearby);



    } catch(error){


        return sendServerError(
            res,
            error,
            'GET NEARBY CUSTOMER'
        );


    }

};


// ======================
// FORM OPTIONS
// ======================

/**
 * Pilihan dropdown untuk form tambah customer, SUDAH tersaring sesuai
 * hak akses pemanggil.
 *
 * Sengaja server yang menyaring: aturan hak akses area ada di
 * resolveAccessibleAreaIds (termasuk fallback ke kolom area_id). Bila
 * client menyusun daftarnya sendiri, aturan itu terduplikasi dan bisa
 * menyimpang, sehingga dropdown menawarkan area yang lalu ditolak 403
 * oleh POST-nya sendiri.
 */
exports.getFormOptions =
async (req, res) => {

    try {

        const user =
            await User.findByPk(

                req.user.id,

                {
                    include: [
                        {
                            model: Area,
                            as: 'AssignedAreas',
                            attributes: ['id'],
                            through: { attributes: [] }
                        }
                    ]
                }

            );


        if (!user) {

            return sendError(
                res,
                404,
                'User tidak ditemukan.'
            );

        }


        const isRestricted =
            ['SPG', 'SUPERVISOR'].includes(user.role);


        const areaWhere =
            isRestricted
                ? { id: { [Op.in]: resolveAccessibleAreaIds(user) } }
                : {};

        // Fail-closed, simetris dengan areaWhere: role terbatas tanpa
        // channel_id mendapat 0 channel, bukan semuanya. Kalau semuanya
        // dikirim, setiap pilihan sales akan ditolak 403 oleh POST dan
        // form jadi jalan buntu.
        const channelWhere =
            isRestricted
                ? { id: user.channel_id ?? -1 }
                : {};


        const [areas, channels, classes, customerGroups] =
            await Promise.all([

                Area.findAll({
                    where: areaWhere,
                    attributes: ['id', 'code', 'name'],
                    order: [['name', 'ASC']]
                }),

                Channel.findAll({
                    where: channelWhere,
                    attributes: ['id', 'code', 'name'],
                    order: [['name', 'ASC']]
                }),

                // Class BUKAN dibatasi hak akses area/channel -- semua
                // role melihat daftar lengkap, sama seperti CustomerGroup.
                Class.findAll({
                    attributes: ['id', 'code', 'name'],
                    order: [['name', 'ASC']]
                }),

                // Hanya group yang punya code. Tanpa code, kode
                // customer tidak bisa dibentuk dan POST akan menolak
                // dengan 400 — menawarkannya di dropdown berarti
                // menjanjikan pilihan yang pasti gagal.
                //
                // Op.not, BUKAN Op.ne: Op.ne menghasilkan `code != NULL`
                // yang di SQL selalu false.
                CustomerGroup.findAll({
                    where: { code: { [Op.not]: null } },
                    attributes: ['id', 'code', 'name'],
                    order: [['name', 'ASC']]
                }),

            ]);

        // Kode yang bukan huruf A-Z murni (mis. "99") membuat
        // formatCustomerCode melempar dan POST menolak dengan 400 —
        // menawarkannya di dropdown berarti menjanjikan pilihan yang
        // pasti gagal, kelas bug yang sama dengan group tanpa code.
        //
        // Disaring di JS, bukan di SQL: MySQL tidak punya operator
        // regex portabel yang enak dipakai di WHERE (REGEXP ada tapi
        // perilakunya berbeda antar versi/collation), dan daftar
        // customer group kecil sehingga menyaring di JS setelah query
        // jauh lebih sederhana dan jelas dibaca.
        const validCustomerGroups = customerGroups.filter(
            (g) => isValidCodeSegment(g.code)
        )

        res.json({
            areas,
            channels,
            customerGroups: validCustomerGroups,
            classes,
        });


    } catch (error) {

        return sendServerError(
            res,
            error,
            'GET CUSTOMER FORM OPTIONS'
        );

    }

};

// ======================
// CREATE — VALIDASI
// ======================

const MAX_LOCATION_ACCURACY_METERS = 50

const FIELD_MAX_LENGTH = {
    name: { max: 100, label: 'Nama toko' },
    owner_name: { max: 100, label: 'Nama pemilik' },
    phone: { max: 30, label: 'Nomor telepon' },
}

const parsePositiveInt = (value) => {
    if (value === undefined || value === null || String(value).trim() === '') {
        return null
    }

    const n = Number(value)

    return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * Validasi koordinat + akurasi.
 *
 * Dipakai bersama oleh validateCreatePayload dan endpoint perbaiki
 * lokasi, supaya ambang MAX_LOCATION_ACCURACY_METERS hanya hidup di
 * satu tempat. Kalau disalin, dua jalur bisa lama-lama berbeda
 * ambangnya tanpa ada yang sadar.
 */
const validateLocationPayload = (body = {}) => {

    const errors = []

    const latitude = parseCoordinate(body.latitude)
    const longitude = parseCoordinate(body.longitude)

    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
        errors.push('Koordinat lokasi tidak valid.')
    }

    const locationAccuracy = parseCoordinate(body.location_accuracy)

    if (locationAccuracy === null) {
        errors.push('Akurasi lokasi wajib dikirim.')
    } else if (locationAccuracy < 0) {
        errors.push('Akurasi lokasi tidak valid. Ambil ulang lokasi.')
    } else if (locationAccuracy > MAX_LOCATION_ACCURACY_METERS) {
        errors.push(
            `Akurasi lokasi ±${locationAccuracy} m terlalu rendah ` +
            `(maksimal ${MAX_LOCATION_ACCURACY_METERS} m).`
        )
    }

    return {
        errors,
        values: { latitude, longitude, locationAccuracy },
    }

}


/**
 * Diekspor agar cabang validasinya bisa diuji tanpa database.
 * Mengembalikan daftar pesan error (kosong = valid) dan nilai
 * yang sudah diparse untuk dipakai controller.
 */
const validateCreatePayload = (body = {}) => {

    const errors = []

    const name = typeof body.name === 'string' ? body.name.trim() : ''

    if (!name) {
        errors.push('Nama toko wajib diisi.')
    }

    for (const [field, { max, label }] of Object.entries(FIELD_MAX_LENGTH)) {
        const value = body[field]

        if (typeof value === 'string' && value.trim().length > max) {
            errors.push(`${label} maksimal ${max} karakter.`)
        }
    }

    const customerGroupId = parsePositiveInt(body.customer_group_id)
    const areaId = parsePositiveInt(body.area_id)
    const channelId = parsePositiveInt(body.channel_id)

    // classId OPSIONAL -- beda dari group/area/channel, tidak dipakai
    // formatCustomerCode, jadi tidak wajib dipilih saat create.
    const classId = parsePositiveInt(body.class_id)

    if (customerGroupId === null) errors.push('Customer group wajib dipilih.')
    if (areaId === null) errors.push('Area wajib dipilih.')
    if (channelId === null) errors.push('Channel wajib dipilih.')

    const lokasi = validateLocationPayload(body)

    errors.push(...lokasi.errors)

    return {
        errors,
        values: {
            name,
            customerGroupId,
            areaId,
            channelId,
            classId,
            latitude: lokasi.values.latitude,
            longitude: lokasi.values.longitude,
            locationAccuracy: lokasi.values.locationAccuracy,
            // ?. hanya menjaga null/undefined, bukan tipe. Tanpa penjagaan
            // typeof, nilai non-string melempar TypeError. Lihat
            // tests/unit/customer-create.test.js untuk contoh.
            address:
                typeof body.address === 'string'
                    ? body.address.trim() || null
                    : null,
            ownerName:
                typeof body.owner_name === 'string'
                    ? body.owner_name.trim() || null
                    : null,
            phone:
                typeof body.phone === 'string'
                    ? body.phone.trim() || null
                    : null,
        },
    }

}

/**
 * Field yang tidak bisa diubah karena kode customer dibentuk darinya.
 *
 * Dikirim dengan nilai SAMA -> dilewati; klien yang mengirim balik
 * seluruh objek customer tidak perlu dihukum. Dikirim BERBEDA -> 400
 * yang menyebut field mana.
 *
 * Mengabaikannya diam-diam adalah pilihan yang lebih buruk: klien
 * menerima 200 dan menyangka perubahannya tersimpan.
 */
const LOCKED_FIELDS = [
    {
        key: 'customer_group_id',
        numeric: true,
        message: 'Customer group tidak bisa diubah karena kode customer dibentuk darinya.',
    },
    {
        key: 'area_id',
        numeric: true,
        message: 'Area tidak bisa diubah karena kode customer dibentuk darinya.',
    },
    {
        key: 'channel_id',
        numeric: true,
        message: 'Channel tidak bisa diubah karena kode customer dibentuk darinya.',
    },
    {
        key: 'code',
        numeric: false,
        message: 'Kode customer tidak bisa diubah.',
    },
]


/**
 * Validasi body PUT /api/customers/:id.
 *
 * PUT berarti ganti seluruhnya: field opsional yang tidak dikirim
 * DIKOSONGKAN. Klien mobile selalu mengirim keempat field teks, jadi
 * ini aman untuknya — tapi integrasi lain yang mengirim hanya { name }
 * akan menghapus alamat. Disengaja, dan diuji.
 *
 * @param {object} body req.body
 * @param {object} current baris customer yang tersimpan, pembanding
 *                 field terkunci
 */
const validateUpdatePayload = (body = {}, current = {}) => {

    const errors = []

    const name = typeof body.name === 'string' ? body.name.trim() : ''

    if (!name) {
        errors.push('Nama toko wajib diisi.')
    }

    for (const [field, { max, label }] of Object.entries(FIELD_MAX_LENGTH)) {
        const value = body[field]

        if (typeof value === 'string' && value.trim().length > max) {
            errors.push(`${label} maksimal ${max} karakter.`)
        }
    }

    for (const { key, numeric, message } of LOCKED_FIELDS) {

        if (body[key] === undefined || body[key] === null) {
            continue
        }

        const dikirim = numeric
            ? parsePositiveInt(body[key])
            : String(body[key]).trim()

        const nilaiTersimpan = numeric
            ? parsePositiveInt(current[key])
            : String(current[key] ?? '').trim()

        if (dikirim !== nilaiTersimpan) {
            errors.push(message)
        }

    }

    return {
        errors,
        values: {
            name,
            // typeof, bukan ?. — lihat komentar di validateCreatePayload.
            address:
                typeof body.address === 'string'
                    ? body.address.trim() || null
                    : null,
            ownerName:
                typeof body.owner_name === 'string'
                    ? body.owner_name.trim() || null
                    : null,
            phone:
                typeof body.phone === 'string'
                    ? body.phone.trim() || null
                    : null,
            // classId BUKAN di LOCKED_FIELDS -- tidak dipakai
            // formatCustomerCode, jadi boleh dikoreksi lewat update.
            // Tidak dikirim -> null, sama seperti address/ownerName/phone
            // di atas (PUT mengganti seluruhnya).
            classId: parsePositiveInt(body.class_id),
        },
    }

}


exports.validateCreatePayload = validateCreatePayload
exports.validateUpdatePayload = validateUpdatePayload
exports.validateLocationPayload = validateLocationPayload
exports.LOCKED_FIELDS = LOCKED_FIELDS
exports.MAX_LOCATION_ACCURACY_METERS = MAX_LOCATION_ACCURACY_METERS