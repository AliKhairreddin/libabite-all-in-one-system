import { DEFAULT_RESTAURANT_SETTINGS, MINUTE_MS, WEBSITE_DEFAULT_FULFILLMENT } from "../shared/constants.js";
export const seedState = {
    currentUserId: "",
    activeView: "dashboard",
    activeStation: "All",
    orderFilter: "All",
    orderDraft: [],
    receiptOrderId: "",
    restaurantSettings: structuredClone(DEFAULT_RESTAURANT_SETTINGS),
    users: [
        {
            id: "owner-admin",
            name: "Aline Owner",
            email: "owner@libabite.nl",
            role: "owner_admin",
            password: "admin123",
            status: "Active"
        },
        {
            id: "manager-demo",
            name: "Mila Manager",
            email: "manager@libabite.nl",
            role: "manager",
            password: "demo123",
            status: "Active"
        },
        {
            id: "yusuf",
            name: "Yusuf Cashier",
            email: "waiter@libabite.nl",
            role: "waiter_cashier",
            password: "demo123",
            status: "Active"
        },
        {
            id: "amina",
            name: "Amina Kitchen",
            email: "kitchen@libabite.nl",
            role: "kitchen_staff",
            password: "demo123",
            status: "Active"
        },
        {
            id: "samir",
            name: "Samir Driver",
            email: "driver@libabite.nl",
            role: "driver",
            password: "demo123",
            status: "Active"
        }
    ],
    tables: [
        { id: "table-1", name: "Table 1", capacity: 2, zone: "Window" },
        { id: "table-2", name: "Table 2", capacity: 2, zone: "Window" },
        { id: "table-3", name: "Table 3", capacity: 4, zone: "Dining room" },
        { id: "table-4", name: "Table 4", capacity: 4, zone: "Dining room" },
        { id: "table-5", name: "Table 5", capacity: 6, zone: "Banquette" },
        { id: "table-6", name: "Table 6", capacity: 8, zone: "Family corner" }
    ],
    tableQrCodes: [
        { id: "qr-table-1", tableId: "table-1", area: "Window", token: "libabite-table-1", status: "Active", createdAt: "09:00", regeneratedAt: "" },
        { id: "qr-table-2", tableId: "table-2", area: "Window", token: "libabite-table-2", status: "Active", createdAt: "09:00", regeneratedAt: "" },
        { id: "qr-table-3", tableId: "table-3", area: "Dining room", token: "libabite-table-3", status: "Active", createdAt: "09:00", regeneratedAt: "" },
        { id: "qr-table-4", tableId: "table-4", area: "Dining room", token: "libabite-table-4", status: "Active", createdAt: "09:00", regeneratedAt: "" },
        { id: "qr-table-5", tableId: "table-5", area: "Banquette", token: "libabite-table-5", status: "Active", createdAt: "09:00", regeneratedAt: "" },
        { id: "qr-table-6", tableId: "table-6", area: "Family corner", token: "libabite-table-6", status: "Active", createdAt: "09:00", regeneratedAt: "" }
    ],
    customerCart: [],
    customerLastOrderId: "",
    websiteCart: [],
    websiteLastOrderId: "",
    websiteFulfillment: WEBSITE_DEFAULT_FULFILLMENT,
    customers: [
        {
            id: "customer-nour-family",
            name: "Nour Family",
            phone: "+31 6 1234 8801",
            email: "",
            addresses: ["Stationsplein 4, Roermond"],
            notes: "Prefers mild spice for the children.",
            createdAt: "10:05",
            updatedAt: "10:05"
        },
        {
            id: "customer-van-dijk",
            name: "Van Dijk",
            phone: "+31 6 8765 1102",
            email: "",
            addresses: ["Markt 12, Roermond", "Kasteel Hillenraedtlaan 8, Swalmen"],
            notes: "Usually asks for extra garlic sauce.",
            createdAt: "10:20",
            updatedAt: "10:20"
        }
    ],
    supplierOrders: [],
    customInventoryLocations: [],
    inventoryHistory: [
        {
            id: "INV-SEED-1",
            ingredientId: "kefta",
            ingredientName: "Kefta",
            type: "add",
            quantity: 30,
            fromLocation: "",
            toLocation: "Fridge",
            resultingStock: 30,
            time: "09:30",
            detail: "Opening stock entered for Kefta."
        }
    ],
    wasteRecords: [],
    productRecipeDraft: [],
    nextOrderNumber: 101,
    products: [
        {
            id: "kefta-plate",
            name: "Kefta Plate",
            code: "KP-001",
            category: "Kefta",
            station: "Grill station",
            price: 14.5,
            vatSetting: "standard",
            active: true,
            availability: {
                dineIn: true,
                qrOrdering: true,
                takeaway: true,
                delivery: true,
                websiteOrdering: true,
                externalDeliveryApps: true
            },
            targetMargin: 68,
            minMargin: 58,
            recipe: [
                { ingredientId: "kefta", grams: 200, wastePercent: 0, station: "Grill station", notes: "200g kefta per plate." }
            ]
        },
        {
            id: "kefta-mix-batch",
            name: "Kefta Mix Batch",
            code: "PREP-KEFTA-10KG",
            category: "Kefta",
            station: "Main kitchen",
            price: 0,
            vatSetting: "zero",
            active: false,
            availability: {
                dineIn: false,
                qrOrdering: false,
                takeaway: false,
                delivery: false,
                websiteOrdering: false,
                externalDeliveryApps: false
            },
            targetMargin: 0,
            minMargin: 0,
            batchOutput: {
                ingredientId: "kefta",
                quantity: 10,
                unitType: "kilograms",
                location: "Fridge"
            },
            recipe: [
                { ingredientId: "minced-beef", grams: 8500, wastePercent: 0, station: "Main kitchen", notes: "Combine chilled beef in the mixer." },
                { ingredientId: "onion-herb-mix", grams: 1200, wastePercent: 0, station: "Main kitchen", notes: "Fold in onion and parsley mix." },
                { ingredientId: "kefta-spice-blend", grams: 300, wastePercent: 0, station: "Main kitchen", notes: "Add spice blend and mix until even." }
            ]
        },
        {
            id: "libabite-burger",
            name: "Libabite Burger",
            code: "BG-001",
            category: "Burgers",
            station: "Burger station",
            price: 12.5,
            vatSetting: "standard",
            active: true,
            availability: {
                dineIn: true,
                qrOrdering: true,
                takeaway: true,
                delivery: true,
                websiteOrdering: true,
                externalDeliveryApps: true
            },
            targetMargin: 66,
            minMargin: 55,
            recipe: [
                { ingredientId: "burger-patty", units: 1, wastePercent: 0, station: "Burger station", notes: "One patty per burger." },
                { ingredientId: "burger-bun", units: 1, wastePercent: 0, station: "Burger station", notes: "Toast before assembly." }
            ]
        },
        {
            id: "cold-mezza",
            name: "Cold Mezza",
            code: "CM-001",
            category: "Cold Mezza",
            station: "Cold mezza station",
            price: 8.75,
            vatSetting: "standard",
            active: true,
            availability: {
                dineIn: true,
                qrOrdering: true,
                takeaway: true,
                delivery: true,
                websiteOrdering: true,
                externalDeliveryApps: true
            },
            targetMargin: 70,
            minMargin: 58,
            recipe: [
                { ingredientId: "cold-mezza-portion", units: 1, wastePercent: 0, station: "Cold mezza station", notes: "Plate chilled mezza portion." }
            ]
        },
        {
            id: "dessert",
            name: "Dessert",
            code: "SW-001",
            category: "Sweets",
            station: "Sweets station",
            price: 6,
            vatSetting: "standard",
            active: true,
            availability: {
                dineIn: true,
                qrOrdering: true,
                takeaway: true,
                delivery: true,
                websiteOrdering: true,
                externalDeliveryApps: true
            },
            targetMargin: 72,
            minMargin: 60,
            recipe: [
                { ingredientId: "dessert-portion", units: 1, wastePercent: 0, station: "Sweets station", notes: "Finish with syrup garnish." }
            ]
        },
        {
            id: "mint-lemonade",
            name: "Mint Lemonade",
            code: "DR-001",
            category: "Drinks",
            station: "Drinks station",
            price: 4.5,
            vatSetting: "standard",
            active: true,
            availability: {
                dineIn: true,
                qrOrdering: true,
                takeaway: true,
                delivery: true,
                websiteOrdering: true,
                externalDeliveryApps: true
            },
            targetMargin: 74,
            minMargin: 62,
            recipe: [
                { ingredientId: "lemonade-base", milliliters: 250, wastePercent: 0, station: "Drinks station", notes: "Serve cold with mint." }
            ]
        },
        {
            id: "takeaway-packaging",
            name: "Takeaway Packaging",
            code: "PK-001",
            category: "Packaging",
            station: "Packaging station",
            price: 0.5,
            vatSetting: "standard",
            active: true,
            availability: {
                dineIn: false,
                qrOrdering: false,
                takeaway: true,
                delivery: true,
                websiteOrdering: true,
                externalDeliveryApps: true
            },
            targetMargin: 50,
            minMargin: 35,
            recipe: [
                { ingredientId: "packaging-box", units: 1, wastePercent: 0, station: "Packaging station", notes: "Bag, napkin, and sauce cup." }
            ]
        }
    ],
    ingredients: [
        {
            id: "kefta",
            name: "Kefta",
            unitType: "kilograms",
            unit: "kg",
            stock: 30,
            min: 5,
            max: 50,
            purchasePrice: 9.4,
            location: "Fridge",
            locationStock: { "Fridge": 30 },
            supplier: "Halal Butcher Limburg",
            active: true,
            expiryDate: "",
            barcode: ""
        },
        {
            id: "minced-beef",
            name: "Minced Beef",
            unitType: "kilograms",
            unit: "kg",
            stock: 25,
            min: 5,
            max: 60,
            purchasePrice: 8.2,
            location: "Fridge",
            locationStock: { "Fridge": 25 },
            supplier: "Halal Butcher Limburg",
            active: true,
            expiryDate: "",
            barcode: ""
        },
        {
            id: "onion-herb-mix",
            name: "Onion Herb Mix",
            unitType: "kilograms",
            unit: "kg",
            stock: 6,
            min: 1,
            max: 12,
            purchasePrice: 2.4,
            location: "Fridge 1",
            locationStock: { "Fridge 1": 6 },
            supplier: "Libabite Prep Kitchen",
            active: true,
            expiryDate: "",
            barcode: ""
        },
        {
            id: "kefta-spice-blend",
            name: "Kefta Spice Blend",
            unitType: "kilograms",
            unit: "kg",
            stock: 2,
            min: 0.5,
            max: 5,
            purchasePrice: 12,
            location: "Dry storage",
            locationStock: { "Dry storage": 2 },
            supplier: "Spice Market NL",
            active: true,
            expiryDate: "",
            barcode: ""
        },
        {
            id: "burger-patty",
            name: "Burger Patty",
            unitType: "pieces",
            unit: "pcs",
            stock: 40,
            min: 8,
            max: 80,
            purchasePrice: 2.9,
            location: "Fridge",
            locationStock: { "Fridge": 40 },
            supplier: "Halal Butcher Limburg",
            active: true,
            expiryDate: "",
            barcode: ""
        },
        {
            id: "burger-bun",
            name: "Burger Bun",
            unitType: "pieces",
            unit: "pcs",
            stock: 48,
            min: 12,
            max: 96,
            purchasePrice: 0.55,
            location: "Dry storage",
            locationStock: { "Dry storage": 48 },
            supplier: "Roermond Bakery",
            active: true,
            expiryDate: "",
            barcode: ""
        },
        {
            id: "cold-mezza-portion",
            name: "Cold Mezza Portion",
            unitType: "pieces",
            unit: "pcs",
            stock: 24,
            min: 6,
            max: 48,
            purchasePrice: 1.85,
            location: "Fridge 1",
            locationStock: { "Fridge 1": 24 },
            supplier: "Libabite Prep Kitchen",
            active: true,
            expiryDate: "",
            barcode: ""
        },
        {
            id: "dessert-portion",
            name: "Dessert Portion",
            unitType: "pieces",
            unit: "pcs",
            stock: 18,
            min: 5,
            max: 36,
            purchasePrice: 1.25,
            location: "Fridge 2",
            locationStock: { "Fridge 2": 18 },
            supplier: "Libabite Sweets",
            active: true,
            expiryDate: "",
            barcode: ""
        },
        {
            id: "lemonade-base",
            name: "Lemonade Base",
            unitType: "liters",
            unit: "l",
            stock: 12,
            min: 2,
            max: 20,
            purchasePrice: 1.4,
            location: "Bar storage",
            locationStock: { "Bar storage": 12 },
            supplier: "Beverage Partner Limburg",
            active: true,
            expiryDate: "",
            barcode: ""
        },
        {
            id: "packaging-box",
            name: "Packaging Box",
            unitType: "pieces",
            unit: "pcs",
            stock: 80,
            min: 20,
            max: 150,
            purchasePrice: 0.18,
            location: "Dry storage",
            locationStock: { "Dry storage": 80 },
            supplier: "Eco Packaging NL",
            active: true,
            expiryDate: "",
            barcode: ""
        }
    ],
    orders: [],
    tickets: [],
    procedures: [
        {
            id: "closing-procedure",
            title: "Closing procedure",
            department: "Front of house",
            language: "nl",
            steps: [
                "Close open tables and mark every unpaid order for manager review.",
                "Count the cash drawer and record the payment totals.",
                "Clean the counter, door handles, payment terminal, and customer area.",
                "Switch off signs, lights, and non-essential equipment before locking."
            ],
            requiredTools: ["Cash drawer key", "Closing sheet"],
            requiredProducts: ["Surface cleaner", "Disposable cloths"],
            media: [],
            frequency: "Daily",
            assignedRole: "Front",
            active: true
        },
        {
            id: "opening-procedure",
            title: "Opening procedure",
            department: "Front of house",
            language: "nl",
            steps: [
                "Check reservation list and prepare table layout.",
                "Turn on POS, receipt printer, and payment terminal.",
                "Restock napkins, cutlery, takeaway bags, and order pads.",
                "Confirm opening cash and report any difference to the manager."
            ],
            requiredTools: ["POS login", "Reservation list"],
            requiredProducts: ["Napkins", "Cutlery packs", "Takeaway bags"],
            media: [],
            frequency: "Daily",
            assignedRole: "Front",
            active: true
        },
        {
            id: "kitchen-cleaning",
            title: "Kitchen cleaning",
            department: "Kitchen",
            language: "ar",
            steps: [
                "Clear all prep surfaces and remove food containers.",
                "Wash and sanitize cutting boards, knives, and prep tables.",
                "Clean grill, fryer edge, and hot holding area after cooling.",
                "Sweep and mop the kitchen floor before the final manager check."
            ],
            requiredTools: ["Brush", "Mop", "Sanitizer bucket"],
            requiredProducts: ["Degreaser", "Food-safe sanitizer"],
            media: [],
            frequency: "Daily",
            assignedRole: "Kitchen",
            active: true
        },
        {
            id: "fridge-cleaning",
            title: "Fridge cleaning",
            department: "Food safety",
            language: "tr",
            steps: [
                "Move products to the backup fridge shelf by shelf.",
                "Check labels, dates, and expired items before cleaning.",
                "Clean seals, handles, and internal shelves with food-safe sanitizer.",
                "Return products by storage zone and record the fridge temperature."
            ],
            requiredTools: ["Thermometer", "Date labels"],
            requiredProducts: ["Food-safe sanitizer", "Disposable cloths"],
            media: [],
            frequency: "Weekly",
            assignedRole: "Kitchen",
            active: true
        },
        {
            id: "food-prep-checklist",
            title: "Food prep checklist",
            department: "Kitchen",
            language: "nl",
            steps: [
                "Wash hands and sanitize the prep station.",
                "Prepare cold mezza, burger garnish, sauces, and drink garnish.",
                "Label every opened product with date and initials.",
                "Update prep quantities when a batch is finished."
            ],
            requiredTools: ["Prep containers", "Date labels", "Scale"],
            requiredProducts: ["Gloves", "Sanitizer"],
            media: [],
            frequency: "Per shift",
            assignedRole: "Kitchen",
            active: true
        },
        {
            id: "driver-closing-checklist",
            title: "Driver closing checklist",
            department: "Delivery",
            language: "tr",
            steps: [
                "Confirm all delivery orders are delivered or returned.",
                "Clean delivery bags and return receipts to the manager.",
                "Charge the work phone and thermal bag battery if used.",
                "Report delays, complaints, or cash collected during the shift."
            ],
            requiredTools: ["Delivery phone", "Thermal bags"],
            requiredProducts: ["Sanitizer wipes"],
            media: [],
            frequency: "Daily",
            assignedRole: "Driver",
            active: true
        },
        {
            id: "cashier-closing-checklist",
            title: "Cashier closing checklist",
            department: "Cashier",
            language: "ar",
            steps: [
                "Print payment summary and compare cash, card, and online totals.",
                "Place cash and signed receipts in the closing envelope.",
                "Mark open pay-later orders for manager follow-up.",
                "Sign the closing sheet before handing over the drawer."
            ],
            requiredTools: ["Receipt printer", "Closing envelope"],
            requiredProducts: ["Cash bands", "Pen"],
            media: [],
            frequency: "Daily",
            assignedRole: "Cashier",
            active: true
        },
        {
            id: "hygiene-checklist",
            title: "Hygiene checklist",
            department: "Food safety",
            language: "nl",
            steps: [
                "Wash hands before handling food, cash, or delivery packaging.",
                "Wear gloves for ready-to-eat food and replace them between tasks.",
                "Keep raw, cooked, and ready-to-eat products separated.",
                "Report spills, broken equipment, or temperature issues immediately."
            ],
            requiredTools: ["Handwash sink", "Thermometer"],
            requiredProducts: ["Soap", "Gloves", "Food-safe sanitizer"],
            media: [],
            frequency: "Per shift",
            assignedRole: "All staff",
            active: true
        }
    ],
    procedureCompletions: [
        {
            id: "PROC-CMP-SEED-1",
            procedureId: "kitchen-cleaning",
            status: "Done",
            completedById: "amina",
            completedByName: "Amina Kitchen",
            assignedRole: "Kitchen",
            completedAtMs: Date.now() - (45 * MINUTE_MS),
            completedAt: "10:45",
            checkedSteps: [0, 1, 2, 3],
            notes: "No issues during the kitchen clean."
        }
    ],
    procedureProgress: {},
    staff: [
        { id: "amina", name: "Amina", role: "Kitchen", planned: "10:00-17:00", clocked: "10:02", status: "On shift" },
        { id: "yusuf", name: "Yusuf", role: "Front", planned: "12:00-21:00", clocked: "11:58", status: "On shift" },
        { id: "samir", name: "Samir", role: "Driver", planned: "16:00-22:00", clocked: "15:57", status: "On shift" },
        { id: "lina", name: "Lina", role: "Sweets", planned: "15:00-22:00", clocked: "-", status: "Starts soon" }
    ],
    drivers: [
        { id: "samir", name: "Samir", status: "Available", eta: "-", orderId: null, location: "Restaurant" },
        { id: "omar", name: "Omar", status: "Available", eta: "-", orderId: null, location: "Restaurant" }
    ],
    reservations: [
        { id: "RES-1", name: "Van Dijk", guests: 5, time: "18:45", tableId: "table-5", source: "Google link", status: "Confirmed" },
        { id: "RES-2", name: "Nour Family", guests: 4, time: "19:30", tableId: "table-3", source: "Phone", status: "Confirmed" }
    ],
    productionLog: [
        { id: "LOG-1", text: "Kefta Plate recipe ready: 200g Kefta per plate from Fridge stock.", time: "09:35" }
    ],
    productionBatches: []
};
export function getFreshSeedState() {
    return structuredClone(seedState);
}
//# sourceMappingURL=seed.js.map