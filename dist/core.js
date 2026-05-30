// @ts-nocheck
// This is the TypeScript port of the original static prototype.
// It intentionally keeps the domain/rendering code together for the first
// migration step so behavior stays identical while the app gains a typed build.
const STORAGE_KEY = "libabite-ops-state-v3";
const RESERVATION_TURNOVER_MINUTES = 90;
const MINUTE_MS = 60 * 1000;
const TICKET_STATUS_FLOW = ["Queued", "Accepted", "Preparing", "Ready", "Done"];
const TICKET_STATUSES = ["Queued", "Accepted", "Preparing", "Delayed", "Ready", "Done"];
const ORDER_STATUSES = ["New", "Sent to kitchen", "Preparing", "Delayed", "Ready", "Served", "Paid", "Cancelled"];
const ORDER_TYPE_OPTIONS = [
    { value: "Dine-in", label: "Dine-in", availabilityKey: "dineIn", fulfillment: "Kitchen", requiresTable: true },
    { value: "Takeaway", label: "Takeaway", availabilityKey: "takeaway", fulfillment: "Pickup", requiresTable: false },
    { value: "Delivery", label: "Delivery", availabilityKey: "delivery", fulfillment: "Delivery", requiresTable: false },
    { value: "Phone/message order", label: "Phone/message order", availabilityKey: "takeaway", fulfillment: "Pickup", requiresTable: false },
    { value: "QR table order", label: "QR table order", availabilityKey: "qrOrdering", fulfillment: "Kitchen", requiresTable: true },
    { value: "Website order", label: "Website order", availabilityKey: "websiteOrdering", fulfillment: "Pickup", requiresTable: false },
    { value: "External delivery app order", label: "External delivery app order", availabilityKey: "externalDeliveryApps", fulfillment: "Delivery", requiresTable: false }
];
const LEGACY_ORDER_TYPE_MAP = {
    QR: "QR table order",
    Website: "Website order",
    Phone: "Phone/message order",
    "Uber Eats": "External delivery app order"
};
const UNPAID_PAYMENT_METHOD = "Unpaid / pay later";
const DEFAULT_PAID_PAYMENT_METHOD = "Cash";
const PAYMENT_METHOD_OPTIONS = [
    { value: UNPAID_PAYMENT_METHOD, label: "Unpaid / pay later", paid: false },
    { value: "Cash", label: "Cash", paid: true },
    { value: "Card", label: "Card", paid: true },
    { value: "Online payment", label: "Online payment", paid: true },
    { value: "External delivery app payment", label: "External delivery app payment", paid: true }
];
const VAT_RATES = {
    standard: 0.21,
    reduced: 0.09,
    zero: 0
};
const LINE_MODIFIER_OPTIONS = ["No onion", "Extra sauce", "Spicy", "Cutlery", "Allergy check"];
const TICKET_SLA_MINUTES = {
    "Burger station": 12,
    "Cold mezza station": 8,
    "Sweets station": 10,
    "Drinks station": 6,
    "Grill station": 14,
    "Packaging station": 5,
    "Burger": 12,
    "Cold Mezza": 8,
    "Sweets": 10,
    "Grill": 14,
    default: 12
};
const SLA_WARNING_WINDOW_MINUTES = 3;
const KITCHEN_STATIONS = ["Burger station", "Cold mezza station", "Sweets station", "Drinks station", "Grill station", "Packaging station", "Main kitchen"];
const KITCHEN_STATION_ALIASES = {
    burger: "Burger station",
    "burger station": "Burger station",
    "cold mezza": "Cold mezza station",
    "cold mezza station": "Cold mezza station",
    mezza: "Cold mezza station",
    prep: "Cold mezza station",
    sweets: "Sweets station",
    sweet: "Sweets station",
    dessert: "Sweets station",
    desserts: "Sweets station",
    "sweets station": "Sweets station",
    drinks: "Drinks station",
    drink: "Drinks station",
    bar: "Drinks station",
    "drinks station": "Drinks station",
    grill: "Grill station",
    "grill station": "Grill station",
    packaging: "Packaging station",
    "packaging station": "Packaging station",
    kitchen: "Main kitchen",
    "main kitchen": "Main kitchen",
    "main kitchen station": "Main kitchen"
};
const PRODUCT_CATEGORIES = ["Kefta", "Sandwiches", "Burgers", "Cold Mezza", "Sweets", "Drinks", "Packaging", "Other"];
const VAT_OPTIONS = [
    { id: "standard", label: "Standard VAT" },
    { id: "reduced", label: "Reduced VAT" },
    { id: "zero", label: "Zero VAT" }
];
const AVAILABILITY_OPTIONS = [
    { id: "dineIn", label: "Dine-in" },
    { id: "qrOrdering", label: "QR ordering" },
    { id: "takeaway", label: "Takeaway" },
    { id: "delivery", label: "Delivery" },
    { id: "websiteOrdering", label: "Website ordering" },
    { id: "externalDeliveryApps", label: "External delivery apps" }
];
const DEFAULT_PRODUCT_AVAILABILITY = {
    dineIn: true,
    qrOrdering: true,
    takeaway: true,
    delivery: true,
    websiteOrdering: true,
    externalDeliveryApps: false
};
const UNIT_TYPES = [
    { id: "grams", label: "grams", shortLabel: "g", recipeMeasure: "grams" },
    { id: "kilograms", label: "kilograms", shortLabel: "kg", recipeMeasure: "grams" },
    { id: "milliliters", label: "milliliters", shortLabel: "ml", recipeMeasure: "milliliters" },
    { id: "liters", label: "liters", shortLabel: "l", recipeMeasure: "milliliters" },
    { id: "pieces", label: "pieces", shortLabel: "pcs", recipeMeasure: "units" },
    { id: "boxes", label: "boxes", shortLabel: "boxes", recipeMeasure: "units" },
    { id: "packages", label: "packages", shortLabel: "packages", recipeMeasure: "units" }
];
const DEFAULT_INVENTORY_LOCATIONS = [
    "Fridge",
    "Fridge 1",
    "Fridge 2",
    "Freezer",
    "Dry storage",
    "Kitchen station storage",
    "Bar storage",
    "No-cooling storage"
];
const INVENTORY_ACTIONS = [
    { id: "add", label: "Add stock" },
    { id: "remove", label: "Remove stock" },
    { id: "transfer", label: "Transfer stock" },
    { id: "waste", label: "Mark wasted" },
    { id: "correct", label: "Correct manually" }
];
const WASTE_REASONS = [
    { id: "Spoiled", label: "Spoiled" },
    { id: "Dropped", label: "Dropped" },
    { id: "Wrong preparation", label: "Wrong preparation" },
    { id: "Expired", label: "Expired" },
    { id: "Returned", label: "Returned" },
    { id: "Other", label: "Other" }
];
const RECIPE_APPLIES_OPTIONS = [
    { id: "all", label: "Every order" },
    { id: "takeawayDelivery", label: "Takeaway/delivery only" }
];
const DEFAULT_MARGIN_TARGET = 65;
const DEFAULT_MARGIN_MINIMUM = 55;
const DEFAULT_RECIPE_ORDER_CONTEXT = { channel: "Dine-in", fulfillment: "Kitchen" };
const TAKEAWAY_DELIVERY_RECIPE_CONTEXT = { channel: "Takeaway", fulfillment: "Delivery" };
const PHASE_11_SEED_INGREDIENT_IDS = ["minced-beef", "onion-herb-mix", "kefta-spice-blend"];
const PHASE_11_SEED_PRODUCT_IDS = ["kefta-mix-batch"];
const CUSTOMER_QR_CHANNEL = "QR table order";
const CUSTOMER_QR_ORDER_CONTEXT = { channel: CUSTOMER_QR_CHANNEL, fulfillment: "Kitchen" };
const QR_CODE_STATUSES = ["Active", "Disabled"];
const ROLE_ORDER = ["owner_admin", "manager", "waiter_cashier", "kitchen_staff", "driver"];
const ROLE_DEFINITIONS = {
    owner_admin: {
        label: "Owner/Admin",
        icon: "OA",
        homeView: "dashboard",
        views: ["dashboard", "orders", "kitchen", "inventory", "procedures", "team", "settings", "reservations"],
        canCreateUsers: true,
        canEditSettings: true,
        canResetDemo: true,
        canCreateOrders: true,
        canAdvanceTickets: true,
        canManageInventory: true,
        canRecordWaste: true,
        canManageProducts: true,
        canManageProcedures: true,
        canCreateProcedures: true,
        canReviewProcedures: true,
        canCompleteProcedures: true,
        canManageReservations: true,
        operationalRole: "Owner/Admin"
    },
    manager: {
        label: "Manager",
        icon: "MG",
        homeView: "dashboard",
        views: ["dashboard", "orders", "kitchen", "inventory", "procedures", "team", "settings", "reservations"],
        canEditSettings: true,
        canCreateOrders: true,
        canAdvanceTickets: true,
        canManageInventory: true,
        canRecordWaste: true,
        canManageProcedures: true,
        canReviewProcedures: true,
        canCompleteProcedures: true,
        canManageReservations: true,
        operationalRole: "Manager"
    },
    waiter_cashier: {
        label: "Waiter/Cashier",
        icon: "WC",
        homeView: "orders",
        views: ["dashboard", "orders", "procedures", "reservations"],
        canCreateOrders: true,
        canRecordWaste: true,
        canCompleteProcedures: true,
        canManageReservations: true,
        operationalRole: "Front"
    },
    kitchen_staff: {
        label: "Kitchen staff",
        icon: "KS",
        homeView: "kitchen",
        views: ["dashboard", "kitchen", "procedures"],
        canAdvanceTickets: true,
        canRecordWaste: true,
        canManageProcedures: true,
        canCompleteProcedures: true,
        operationalRole: "Kitchen"
    },
    driver: {
        label: "Driver",
        icon: "DR",
        homeView: "team",
        views: ["dashboard", "procedures", "team"],
        canCompleteProcedures: true,
        operationalRole: "Driver"
    }
};
const LANGUAGE_OPTIONS = [
    { id: "nl", label: "Dutch" },
    { id: "ar", label: "Arabic" },
    { id: "tr", label: "Turkish" },
    { id: "en", label: "English" }
];
const PROCEDURE_DEPARTMENTS = ["Kitchen", "Front of house", "Cashier", "Delivery", "Cleaning", "Food safety", "Management"];
const PROCEDURE_FREQUENCIES = ["Daily", "Weekly", "Monthly", "Per shift"];
const PROCEDURE_ASSIGNED_ROLES = ["All staff", "Owner/Admin", "Manager", "Kitchen", "Front", "Cashier", "Driver"];
const PROCEDURE_COMPLETION_STATUSES = ["Done", "Problem", "Skipped"];
const DEFAULT_RESTAURANT_SETTINGS = {
    restaurantName: "Libabite",
    location: "Roermond, Netherlands",
    currency: "EUR",
    currencyLabel: "Euro",
    opensAt: "11:00",
    closesAt: "22:00",
    defaultLanguage: "nl",
    supportedLanguages: ["nl", "ar", "tr", "en"]
};
const DATA_MODEL = [
    { name: "users", fields: "id, name, email, role, password, status" },
    { name: "roles", fields: "role id, label, visible views, permissions" },
    { name: "restaurant_settings", fields: "name, location, currency, hours, languages" },
    { name: "sellable_products", fields: "name, code/SKU, category, kitchen station, price, VAT, status, availability, margin settings, recipe links" },
    { name: "purchased_products", fields: "ingredient, supplier, purchase price, unit type, min/max, total stock, stock by location, expiry, barcode, status" },
    { name: "inventory_locations", fields: "default restaurant locations, custom locations, per-location quantities" },
    { name: "inventory_actions", fields: "add, remove, transfer, waste, manual correction, stock history" },
    { name: "waste_records", fields: "product, quantity, unit, reason, staff member, date/time, notes, cost" },
    { name: "recipes", fields: "sellable product, ingredient, quantity, unit, waste %, preparation station, notes, fulfillment rule" },
    { name: "orders", fields: "channel, customer, payment status/method, staff member, fulfillment, line items" },
    { name: "kitchen_tickets", fields: "order, product, station, status, priority, issue note, SLA times" },
    { name: "table_qr_codes", fields: "token, table, area, active/disabled status, customer order URL" },
    { name: "reservations", fields: "guest, time, table, source, status" },
    { name: "procedures", fields: "title, department, language, steps, required tools/products, media, frequency, assigned role" },
    { name: "procedure_completions", fields: "procedure, staff member, status, completed at, checked steps, notes/issues" }
];
const seedState = {
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
function getFreshSeedState() {
    return structuredClone(seedState);
}
let state = loadState();
const views = [
    { id: "dashboard", label: "Command", icon: "CM" },
    { id: "orders", label: "Orders", icon: "OR" },
    { id: "kitchen", label: "Kitchen", icon: "KT" },
    { id: "inventory", label: "Inventory", icon: "IN" },
    { id: "procedures", label: "Procedures", icon: "PR" },
    { id: "team", label: "Team", icon: "TM" },
    { id: "settings", label: "Settings", icon: "SE" },
    { id: "reservations", label: "Bookings", icon: "BK" }
];
function slugify(value, fallback = "item") {
    return String(value || fallback)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        || fallback;
}
function normalizeKitchenStation(value) {
    const cleaned = String(value || "").replace(/\s+/g, " ").trim();
    const mapped = KITCHEN_STATION_ALIASES[cleaned.toLowerCase()];
    return mapped || cleaned || "Main kitchen";
}
function unitTypeDefinition(unitType) {
    const legacyMap = {
        g: "grams",
        gram: "grams",
        grams: "grams",
        kg: "kilograms",
        kilogram: "kilograms",
        kilograms: "kilograms",
        ml: "milliliters",
        milliliter: "milliliters",
        milliliters: "milliliters",
        l: "liters",
        liter: "liters",
        liters: "liters",
        pcs: "pieces",
        piece: "pieces",
        pieces: "pieces",
        box: "boxes",
        boxes: "boxes",
        package: "packages",
        packages: "packages"
    };
    const id = legacyMap[String(unitType || "").toLowerCase()] || "pieces";
    return UNIT_TYPES.find((type) => type.id === id) || UNIT_TYPES.find((type) => type.id === "pieces");
}
function normalizeProductAvailability(availability) {
    const source = availability && typeof availability === "object" ? availability : {};
    return AVAILABILITY_OPTIONS.reduce((nextAvailability, option) => {
        nextAvailability[option.id] = source[option.id] === undefined
            ? DEFAULT_PRODUCT_AVAILABILITY[option.id]
            : Boolean(source[option.id]);
        return nextAvailability;
    }, {});
}
function normalizeMarginPercent(value, fallback = 0) {
    const percent = Number(value);
    return Number.isFinite(percent) ? Math.min(100, Math.max(0, Number(percent.toFixed(1)))) : fallback;
}
function normalizeRecipeWastePercent(value) {
    return normalizeMarginPercent(value, 0);
}
function normalizeRecipeAppliesTo(value) {
    return RECIPE_APPLIES_OPTIONS.some((option) => option.id === value) ? value : "all";
}
function normalizeRecipeLine(line, ingredientIds) {
    if (!line || !ingredientIds.has(line.ingredientId))
        return null;
    const base = {
        ingredientId: line.ingredientId,
        wastePercent: normalizeRecipeWastePercent(line.wastePercent),
        station: normalizeKitchenStation(line.station || line.preparationStation),
        notes: String(line.notes || "").trim(),
        appliesTo: normalizeRecipeAppliesTo(line.appliesTo || (line.onlyForTakeawayDelivery ? "takeawayDelivery" : "all"))
    };
    const grams = Number(line.grams);
    const milliliters = Number(line.milliliters);
    const units = Number(line.units);
    if (Number.isFinite(grams) && grams > 0)
        return { ...base, grams };
    if (Number.isFinite(milliliters) && milliliters > 0)
        return { ...base, milliliters };
    if (Number.isFinite(units) && units > 0)
        return { ...base, units };
    return null;
}
function normalizeRecipeLines(recipe, ingredientIds) {
    return Array.isArray(recipe)
        ? recipe.map((line) => normalizeRecipeLine(line, ingredientIds)).filter(Boolean)
        : [];
}
function normalizeBatchOutput(output, ingredientIds) {
    if (!output || typeof output !== "object")
        return null;
    const ingredientId = String(output.ingredientId || output.productId || "").trim();
    if (!ingredientIds.has(ingredientId))
        return null;
    const quantity = normalizeStockQuantity(output.quantity ?? output.outputQuantity);
    if (quantity <= 0)
        return null;
    return {
        ingredientId,
        quantity,
        unitType: unitTypeDefinition(output.unitType || output.unit || "kilograms").id,
        location: normalizeInventoryLocationName(output.location || output.toLocation, "Fridge")
    };
}
function normalizeStockQuantity(value) {
    const quantity = Number(value);
    return Number.isFinite(quantity) ? Math.max(0, Number(quantity.toFixed(3))) : 0;
}
function normalizeInventoryLocationName(value, fallback = "Dry storage") {
    const cleaned = String(value || "").replace(/\s+/g, " ").trim();
    return cleaned || fallback;
}
function isDefaultInventoryLocation(location) {
    return DEFAULT_INVENTORY_LOCATIONS.includes(location);
}
function sortInventoryLocations(locations) {
    const defaultOrder = new Map(DEFAULT_INVENTORY_LOCATIONS.map((location, index) => [location, index]));
    return [...new Set(locations.map((location) => normalizeInventoryLocationName(location, "")).filter(Boolean))]
        .sort((first, second) => {
        const firstIndex = defaultOrder.has(first) ? defaultOrder.get(first) : Number.MAX_SAFE_INTEGER;
        const secondIndex = defaultOrder.has(second) ? defaultOrder.get(second) : Number.MAX_SAFE_INTEGER;
        return firstIndex - secondIndex || first.localeCompare(second);
    });
}
function normalizeLocationStock(locationStock, fallbackLocation, fallbackStock) {
    const rows = [];
    if (Array.isArray(locationStock)) {
        locationStock.forEach((row) => {
            rows.push([row.location || row.name, row.quantity ?? row.stock]);
        });
    }
    else if (locationStock && typeof locationStock === "object") {
        Object.entries(locationStock).forEach(([location, quantity]) => rows.push([location, quantity]));
    }
    const nextLocationStock = {};
    rows.forEach(([location, quantity]) => {
        const normalizedLocation = normalizeInventoryLocationName(location, "");
        const normalizedQuantity = normalizeStockQuantity(quantity);
        if (!normalizedLocation || normalizedQuantity <= 0)
            return;
        nextLocationStock[normalizedLocation] = normalizeStockQuantity((nextLocationStock[normalizedLocation] || 0) + normalizedQuantity);
    });
    if (!Object.keys(nextLocationStock).length && normalizeStockQuantity(fallbackStock) > 0) {
        nextLocationStock[normalizeInventoryLocationName(fallbackLocation)] = normalizeStockQuantity(fallbackStock);
    }
    return Object.fromEntries(sortInventoryLocations(Object.keys(nextLocationStock)).map((location) => [location, nextLocationStock[location]]));
}
function getIngredientTotalStock(ingredient) {
    return normalizeStockQuantity(Object.values(ingredient?.locationStock || {}).reduce((sum, quantity) => sum + (Number(quantity) || 0), 0));
}
function getIngredientPrimaryLocation(ingredient) {
    const entries = Object.entries(ingredient?.locationStock || {}).filter(([, quantity]) => Number(quantity) > 0);
    if (!entries.length)
        return normalizeInventoryLocationName(ingredient?.location, "Dry storage");
    return entries.sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))[0][0];
}
function syncIngredientStock(ingredient) {
    const hasLocationStock = ingredient.locationStock && typeof ingredient.locationStock === "object";
    ingredient.locationStock = normalizeLocationStock(ingredient.locationStock, ingredient.location, hasLocationStock ? 0 : ingredient.stock);
    ingredient.stock = getIngredientTotalStock(ingredient);
    ingredient.location = getIngredientPrimaryLocation(ingredient);
    return ingredient.stock;
}
function normalizeCustomInventoryLocations(locations, ingredients = []) {
    const customLocations = Array.isArray(locations) ? locations : [];
    ingredients.forEach((ingredient) => {
        Object.keys(ingredient.locationStock || {}).forEach((location) => customLocations.push(location));
    });
    return sortInventoryLocations(customLocations).filter((location) => !isDefaultInventoryLocation(location));
}
function normalizeInventoryHistory(history, ingredientIds) {
    return (Array.isArray(history) ? history : [])
        .map((entry, index) => {
        const ingredientId = String(entry.ingredientId || "").trim();
        if (!ingredientIds.has(ingredientId))
            return null;
        const action = INVENTORY_ACTIONS.some((item) => item.id === entry.type) ? entry.type : "correct";
        return {
            id: entry.id || `INV-${Date.now()}-${index + 1}`,
            ingredientId,
            ingredientName: String(entry.ingredientName || "").trim(),
            type: action,
            quantity: normalizeStockQuantity(entry.quantity),
            fromLocation: normalizeInventoryLocationName(entry.fromLocation, ""),
            toLocation: normalizeInventoryLocationName(entry.toLocation, ""),
            resultingStock: normalizeStockQuantity(entry.resultingStock),
            time: entry.time || timeNow(),
            detail: String(entry.detail || "").trim()
        };
    })
        .filter(Boolean)
        .slice(-80);
}
function normalizeWasteReason(reason) {
    const candidate = String(reason || "").trim();
    return WASTE_REASONS.some((item) => item.id === candidate) ? candidate : "Other";
}
function getWasteUnitOptionsForIngredient(ingredient) {
    const unitType = unitTypeDefinition(ingredient?.unitType || ingredient?.unit);
    if (unitType.recipeMeasure === "grams") {
        return UNIT_TYPES.filter((option) => option.id === "grams" || option.id === "kilograms");
    }
    if (unitType.recipeMeasure === "milliliters") {
        return UNIT_TYPES.filter((option) => option.id === "milliliters" || option.id === "liters");
    }
    return UNIT_TYPES.filter((option) => option.id === unitType.id);
}
function normalizeWasteUnitType(unitType, ingredient) {
    const candidate = unitTypeDefinition(unitType).id;
    const allowedUnits = getWasteUnitOptionsForIngredient(ingredient).map((option) => option.id);
    return allowedUnits.includes(candidate) ? candidate : unitTypeDefinition(ingredient?.unitType || ingredient?.unit).id;
}
function convertWasteQuantityToStockUnits(ingredient, quantity, unitTypeId) {
    const amount = normalizeStockQuantity(quantity);
    const stockUnitType = unitTypeDefinition(ingredient?.unitType || ingredient?.unit);
    const wasteUnitType = unitTypeDefinition(unitTypeId);
    const stockMeasure = stockUnitType.recipeMeasure;
    const wasteMeasure = wasteUnitType.recipeMeasure;
    if (stockMeasure === "grams" && wasteMeasure === "grams") {
        const grams = wasteUnitType.id === "kilograms" ? amount * 1000 : amount;
        return normalizeStockQuantity(stockUnitType.id === "kilograms" ? grams / 1000 : grams);
    }
    if (stockMeasure === "milliliters" && wasteMeasure === "milliliters") {
        const milliliters = wasteUnitType.id === "liters" ? amount * 1000 : amount;
        return normalizeStockQuantity(stockUnitType.id === "liters" ? milliliters / 1000 : milliliters);
    }
    return amount;
}
function getWasteCost(ingredient, stockQuantity) {
    return Math.max(0, Number(((Number(stockQuantity) || 0) * (Number(ingredient?.purchasePrice) || 0)).toFixed(2)));
}
function normalizeWasteTimestamp(record) {
    const timestamp = normalizeOptionalTimestamp(record?.occurredAtMs)
        || normalizeOptionalTimestamp(record?.dateTimeMs)
        || Date.parse(record?.occurredAt || record?.dateTime || "");
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : normalizeTimestamp(record?.timeMs, record?.time);
}
function normalizeWasteRecords(records, ingredients, users) {
    const ingredientByIdLookup = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
    const userByIdLookup = new Map(users.map((user) => [user.id, user]));
    return (Array.isArray(records) ? records : [])
        .map((record, index) => {
        const ingredientId = String(record.ingredientId || record.productId || "").trim();
        const ingredient = ingredientByIdLookup.get(ingredientId);
        if (!ingredient)
            return null;
        const quantity = normalizeStockQuantity(record.quantity ?? record.displayQuantity ?? record.stockQuantity);
        const unitType = normalizeWasteUnitType(record.unitType || record.unit, ingredient);
        const stockQuantity = normalizeStockQuantity(record.stockQuantity ?? convertWasteQuantityToStockUnits(ingredient, quantity, unitType));
        if (stockQuantity <= 0)
            return null;
        const staffId = String(record.staffId || record.userId || "").trim();
        const staff = userByIdLookup.get(staffId);
        const occurredAtMs = normalizeWasteTimestamp(record);
        const cost = Number(record.cost);
        return {
            id: record.id || `WST-${Date.now()}-${index + 1}`,
            ingredientId,
            ingredientName: String(record.ingredientName || record.productName || ingredient.name).trim(),
            quantity,
            unitType,
            stockQuantity,
            stockUnit: ingredient.unit,
            reason: normalizeWasteReason(record.reason),
            staffId: staff?.id || "",
            staffName: String(record.staffName || record.staffMember || staff?.name || "Staff").trim(),
            occurredAtMs,
            notes: String(record.notes || "").trim(),
            fromLocation: normalizeInventoryLocationName(record.fromLocation || record.location, ""),
            cost: Number.isFinite(cost) ? Math.max(0, Number(cost.toFixed(2))) : getWasteCost(ingredient, stockQuantity)
        };
    })
        .filter(Boolean)
        .slice(-120);
}
function normalizeIngredients(ingredients) {
    const seenIds = new Set();
    return ingredients
        .map((ingredient, index) => {
        const name = String(ingredient.name || ingredient.ingredientName || "").trim();
        if (!name)
            return null;
        const id = slugify(ingredient.id || name, `ingredient-${index + 1}`);
        if (seenIds.has(id))
            return null;
        seenIds.add(id);
        const unitType = unitTypeDefinition(ingredient.unitType || ingredient.unit);
        const stock = normalizeStockQuantity(ingredient.stock ?? ingredient.currentStock);
        const min = Math.max(0, Number(ingredient.min ?? ingredient.minimumStock) || 0);
        const max = Math.max(min, Number(ingredient.max ?? ingredient.maximumStock) || Math.max(min, stock));
        const locationStock = normalizeLocationStock(ingredient.locationStock || ingredient.locations, ingredient.location || ingredient.storageLocation, stock);
        const normalizedIngredient = {
            id,
            name,
            supplier: String(ingredient.supplier || "Default supplier").trim(),
            purchasePrice: Math.max(0, Number(ingredient.purchasePrice) || 0),
            unitType: unitType.id,
            unit: unitType.shortLabel,
            stock,
            min,
            max,
            location: normalizeInventoryLocationName(ingredient.location || ingredient.storageLocation, "Dry storage"),
            locationStock,
            expiryDate: String(ingredient.expiryDate || "").trim(),
            barcode: String(ingredient.barcode || ingredient.qrCode || "").trim(),
            active: ingredient.active === undefined ? ingredient.status !== "Inactive" : Boolean(ingredient.active)
        };
        syncIngredientStock(normalizedIngredient);
        return normalizedIngredient;
    })
        .filter(Boolean);
}
function normalizeProducts(products, ingredientIds) {
    const seenIds = new Set();
    return products
        .map((product, index) => {
        const name = String(product.name || product.productName || "").trim();
        if (!name)
            return null;
        const id = slugify(product.id || name, `product-${index + 1}`);
        if (seenIds.has(id))
            return null;
        seenIds.add(id);
        const category = PRODUCT_CATEGORIES.includes(product.category)
            ? product.category
            : PRODUCT_CATEGORIES.includes(product.station)
                ? product.station
                : "Other";
        const station = normalizeKitchenStation(product.station || product.kitchenStation || "Main kitchen");
        const vatSetting = VAT_OPTIONS.some((option) => option.id === product.vatSetting) ? product.vatSetting : "standard";
        const targetMargin = normalizeMarginPercent(product.targetMargin, DEFAULT_MARGIN_TARGET);
        const minMargin = Math.min(targetMargin, normalizeMarginPercent(product.minMargin ?? product.minimumMargin, DEFAULT_MARGIN_MINIMUM));
        return {
            id,
            name,
            code: String(product.code || product.sku || product.SKU || "").trim() || id.toUpperCase(),
            category,
            station,
            price: Math.max(0, Number(product.price ?? product.sellingPrice) || 0),
            vatSetting,
            active: product.active === undefined ? product.status !== "Inactive" : Boolean(product.active),
            availability: normalizeProductAvailability(product.availability),
            targetMargin,
            minMargin,
            recipe: normalizeRecipeLines(product.recipe, ingredientIds)
                .map((line) => ({ ...line, station: normalizeKitchenStation(line.station || station) })),
            batchOutput: normalizeBatchOutput(product.batchOutput || product.output, ingredientIds),
            lastProductionCost: Math.max(0, Number(product.lastProductionCost) || 0),
            lastProductionPlannedCost: Math.max(0, Number(product.lastProductionPlannedCost) || 0),
            lastProductionMargin: product.lastProductionMargin === null || product.lastProductionMargin === undefined || product.lastProductionMargin === ""
                ? null
                : Number.isFinite(Number(product.lastProductionMargin)) ? Number(product.lastProductionMargin) : null,
            lastProductionCostDelta: Number.isFinite(Number(product.lastProductionCostDelta)) ? Number(product.lastProductionCostDelta) : 0,
            lastProductionAt: String(product.lastProductionAt || "").trim(),
            lastProductionAtMs: normalizeOptionalTimestamp(product.lastProductionAtMs)
        };
    })
        .filter(Boolean);
}
function normalizeProductionBatchLines(lines, ingredientIds) {
    return (Array.isArray(lines) ? lines : [])
        .map((line) => {
        const ingredientId = String(line.ingredientId || "").trim();
        if (!ingredientIds.has(ingredientId))
            return null;
        const measure = line.measure && typeof line.measure === "object"
            ? {
                key: ["grams", "milliliters", "units"].includes(line.measure.key) ? line.measure.key : "units",
                label: String(line.measure.label || "pieces"),
                shortLabel: String(line.measure.shortLabel || "pcs")
            }
            : { key: "units", label: "pieces", shortLabel: "pcs" };
        return {
            ingredientId,
            ingredientName: String(line.ingredientName || "").trim(),
            measure,
            plannedUsage: normalizeStockQuantity(line.plannedUsage),
            actualUsage: normalizeStockQuantity(line.actualUsage),
            plannedStockQuantity: normalizeStockQuantity(line.plannedStockQuantity),
            actualStockQuantity: normalizeStockQuantity(line.actualStockQuantity),
            plannedCost: Math.max(0, Number(line.plannedCost) || 0),
            actualCost: Math.max(0, Number(line.actualCost) || 0)
        };
    })
        .filter(Boolean);
}
function normalizeProductionBatches(records, productIds, ingredientIds, users) {
    const userByIdLookup = new Map(users.map((user) => [user.id, user]));
    return (Array.isArray(records) ? records : [])
        .map((record, index) => {
        const productId = String(record.productId || "").trim();
        if (!productIds.has(productId))
            return null;
        const outputIngredientId = String(record.outputIngredientId || "").trim();
        const completedById = String(record.completedById || record.userId || "").trim();
        const completedBy = userByIdLookup.get(completedById);
        const completedAt = record.completedAt || record.time || timeNow();
        return {
            id: record.id || `BAT-${Date.now()}-${index + 1}`,
            productId,
            productName: String(record.productName || "").trim(),
            completedById: completedBy?.id || completedById,
            completedByName: String(record.completedByName || record.staffName || completedBy?.name || "Staff").trim(),
            completedAt,
            completedAtMs: normalizeOptionalTimestamp(record.completedAtMs) || normalizeTimestamp(record.timeMs, completedAt),
            plannedCost: Math.max(0, Number(record.plannedCost) || 0),
            actualCost: Math.max(0, Number(record.actualCost) || 0),
            costDelta: Number.isFinite(Number(record.costDelta)) ? Number(record.costDelta) : 0,
            plannedMargin: record.plannedMargin === null || record.plannedMargin === undefined || record.plannedMargin === ""
                ? null
                : Number.isFinite(Number(record.plannedMargin)) ? Number(record.plannedMargin) : null,
            actualMargin: record.actualMargin === null || record.actualMargin === undefined || record.actualMargin === ""
                ? null
                : Number.isFinite(Number(record.actualMargin)) ? Number(record.actualMargin) : null,
            marginDelta: record.marginDelta === null || record.marginDelta === undefined || record.marginDelta === ""
                ? null
                : Number.isFinite(Number(record.marginDelta)) ? Number(record.marginDelta) : null,
            outputIngredientId: ingredientIds.has(outputIngredientId) ? outputIngredientId : "",
            outputIngredientName: String(record.outputIngredientName || "").trim(),
            outputQuantity: normalizeStockQuantity(record.outputQuantity),
            outputUnitType: unitTypeDefinition(record.outputUnitType || record.unitType).id,
            outputStockQuantity: normalizeStockQuantity(record.outputStockQuantity),
            outputUnitCost: Math.max(0, Number(record.outputUnitCost) || 0),
            outputLocation: normalizeInventoryLocationName(record.outputLocation, ""),
            lines: normalizeProductionBatchLines(record.lines, ingredientIds)
        };
    })
        .filter(Boolean)
        .slice(-80);
}
function normalizeRestaurantSettings(settings) {
    const source = settings && typeof settings === "object" ? settings : {};
    const supportedLanguageIds = new Set(LANGUAGE_OPTIONS.map((language) => language.id));
    const supportedLanguages = Array.isArray(source.supportedLanguages)
        ? source.supportedLanguages.filter((language) => supportedLanguageIds.has(language))
        : DEFAULT_RESTAURANT_SETTINGS.supportedLanguages;
    const defaultLanguage = supportedLanguageIds.has(source.defaultLanguage)
        ? source.defaultLanguage
        : DEFAULT_RESTAURANT_SETTINGS.defaultLanguage;
    if (!supportedLanguages.includes(defaultLanguage))
        supportedLanguages.unshift(defaultLanguage);
    return {
        restaurantName: source.restaurantName || DEFAULT_RESTAURANT_SETTINGS.restaurantName,
        location: source.location || DEFAULT_RESTAURANT_SETTINGS.location,
        currency: source.currency === "EUR" ? "EUR" : DEFAULT_RESTAURANT_SETTINGS.currency,
        currencyLabel: DEFAULT_RESTAURANT_SETTINGS.currencyLabel,
        opensAt: isReservationTime(source.opensAt) ? source.opensAt : DEFAULT_RESTAURANT_SETTINGS.opensAt,
        closesAt: isReservationTime(source.closesAt) ? source.closesAt : DEFAULT_RESTAURANT_SETTINGS.closesAt,
        defaultLanguage,
        supportedLanguages: supportedLanguages.length ? supportedLanguages : [...DEFAULT_RESTAURANT_SETTINGS.supportedLanguages]
    };
}
function normalizeUsers(users) {
    const seenEmails = new Set();
    return users
        .map((user, index) => {
        const email = String(user.email || "").trim().toLowerCase();
        const role = ROLE_DEFINITIONS[user.role] ? user.role : "waiter_cashier";
        if (!email || seenEmails.has(email))
            return null;
        seenEmails.add(email);
        return {
            id: user.id || `${slugify(email.split("@")[0], "user")}-${index + 1}`,
            name: user.name || email,
            email,
            role,
            password: String(user.password || "demo123"),
            status: user.status === "Inactive" ? "Inactive" : "Active"
        };
    })
        .filter(Boolean);
}
function normalizeProcedureLanguage(language) {
    const candidate = String(language || "").trim();
    return LANGUAGE_OPTIONS.some((option) => option.id === candidate) ? candidate : DEFAULT_RESTAURANT_SETTINGS.defaultLanguage;
}
function normalizeProcedureFrequency(frequency) {
    const candidate = String(frequency || "").trim();
    return PROCEDURE_FREQUENCIES.includes(candidate) ? candidate : "Daily";
}
function normalizeProcedureAssignedRole(role, fallbackDepartment = "") {
    const candidate = String(role || "").trim();
    if (PROCEDURE_ASSIGNED_ROLES.includes(candidate))
        return candidate;
    const department = String(fallbackDepartment || "").toLowerCase();
    if (department.includes("cashier"))
        return "Cashier";
    if (department.includes("driver") || department.includes("delivery"))
        return "Driver";
    if (department.includes("kitchen") || department.includes("food") || department.includes("clean"))
        return "Kitchen";
    if (department.includes("manager") || department.includes("management"))
        return "Manager";
    if (department.includes("front"))
        return "Front";
    return "All staff";
}
function normalizeProcedureDepartment(department) {
    const candidate = String(department || "").trim();
    return candidate || "Management";
}
function normalizeListInput(value) {
    const values = Array.isArray(value)
        ? value
        : String(value || "")
            .split(/\n|,/)
            .map((item) => item.trim());
    return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
}
function normalizeProcedureSteps(steps, fallbackText = "") {
    const normalizedSteps = normalizeListInput(Array.isArray(steps) ? steps : String(steps || "").split(/\n/));
    if (normalizedSteps.length)
        return normalizedSteps;
    const fallback = String(fallbackText || "").trim();
    return fallback ? [fallback] : [];
}
function normalizeProcedureMedia(media) {
    return normalizeListInput(media).filter((url) => /^https?:\/\//i.test(url));
}
function normalizeProcedureRecord(procedure, index = 0) {
    const title = String(procedure.title || procedure.name || procedure.text || "").trim() || `Procedure ${index + 1}`;
    const department = normalizeProcedureDepartment(procedure.department || procedure.owner);
    return {
        id: slugify(procedure.id || title, `procedure-${index + 1}`),
        title,
        department,
        language: normalizeProcedureLanguage(procedure.language),
        steps: normalizeProcedureSteps(procedure.steps, procedure.text),
        requiredTools: normalizeListInput(procedure.requiredTools || procedure.tools),
        requiredProducts: normalizeListInput(procedure.requiredProducts || procedure.products),
        media: normalizeProcedureMedia(procedure.media || procedure.mediaUrls || procedure.attachments),
        frequency: normalizeProcedureFrequency(procedure.frequency),
        assignedRole: normalizeProcedureAssignedRole(procedure.assignedRole || procedure.owner, department),
        active: procedure.active === undefined ? true : Boolean(procedure.active),
        createdById: String(procedure.createdById || "").trim(),
        createdByName: String(procedure.createdByName || "").trim(),
        createdAtMs: normalizeOptionalTimestamp(procedure.createdAtMs) || Date.now()
    };
}
function normalizeProcedures(procedures) {
    const seenIds = new Set();
    return (Array.isArray(procedures) ? procedures : [])
        .map((procedure, index) => normalizeProcedureRecord(procedure, index))
        .filter((procedure) => {
        if (!procedure.title || seenIds.has(procedure.id))
            return false;
        seenIds.add(procedure.id);
        return true;
    });
}
function isLegacyProcedureList(procedures) {
    return Array.isArray(procedures)
        && procedures.length > 0
        && procedures.every((procedure) => procedure && procedure.text && !procedure.title);
}
function mergeDefaultProcedures(procedures) {
    const byId = new Map(procedures.map((procedure) => [procedure.id, procedure]));
    normalizeProcedures(seedState.procedures).forEach((procedure) => {
        if (!byId.has(procedure.id))
            byId.set(procedure.id, procedure);
    });
    return [...byId.values()];
}
function normalizeProcedureCompletions(records, procedureIds, users) {
    const userById = new Map(users.map((user) => [user.id, user]));
    return (Array.isArray(records) ? records : [])
        .map((record, index) => {
        const procedureId = String(record.procedureId || "").trim();
        if (!procedureIds.has(procedureId))
            return null;
        const status = PROCEDURE_COMPLETION_STATUSES.includes(record.status) ? record.status : "Done";
        const completedById = String(record.completedById || record.userId || "").trim();
        const completedBy = userById.get(completedById);
        const completedAtMs = normalizeOptionalTimestamp(record.completedAtMs)
            || normalizeOptionalTimestamp(record.timeMs)
            || Date.parse(record.completedAt || record.time || "")
            || Date.now();
        return {
            id: record.id || `PROC-CMP-${Date.now()}-${index + 1}`,
            procedureId,
            status,
            completedById: completedBy?.id || completedById,
            completedByName: String(record.completedByName || record.staffName || completedBy?.name || "Staff").trim(),
            assignedRole: normalizeProcedureAssignedRole(record.assignedRole, completedBy ? roleDefinition(completedBy.role).operationalRole : ""),
            completedAtMs,
            completedAt: record.completedAt || timeNow(),
            checkedSteps: Array.isArray(record.checkedSteps)
                ? record.checkedSteps.map((step) => Math.max(0, Math.floor(Number(step) || 0)))
                : [],
            notes: String(record.notes || record.issue || record.reason || "").trim()
        };
    })
        .filter(Boolean)
        .slice(-180);
}
function normalizeProcedureProgress(progress, procedureIds, users) {
    if (!progress || typeof progress !== "object" || Array.isArray(progress))
        return {};
    const userIds = new Set(users.map((user) => user.id));
    return Object.entries(progress).reduce((nextProgress, [key, value]) => {
        const [userId, procedureId] = String(key).split(":");
        if (!userIds.has(userId) || !procedureIds.has(procedureId))
            return nextProgress;
        const steps = Array.isArray(value)
            ? [...new Set(value.map((step) => Math.max(0, Math.floor(Number(step) || 0))))]
            : [];
        if (steps.length)
            nextProgress[key] = steps;
        return nextProgress;
    }, {});
}
function normalizeOrderStatus(status, paymentStatus = "") {
    const legacyMap = {
        Queued: "Sent to kitchen",
        Done: "Served"
    };
    const candidate = legacyMap[status] || status;
    if (ORDER_STATUSES.includes(candidate))
        return candidate;
    if (paymentStatus === "Paid")
        return "Paid";
    return "New";
}
function normalizePaymentStatus(status) {
    return ["Paid", "Unpaid", "Pay later"].includes(status) ? status : "Unpaid";
}
function isPaidPaymentMethod(method) {
    return PAYMENT_METHOD_OPTIONS.some((option) => option.value === method && option.paid);
}
function normalizePaymentMethod(method, paymentStatus = "") {
    const candidate = String(method || "").trim();
    if (PAYMENT_METHOD_OPTIONS.some((option) => option.value === candidate))
        return candidate;
    if (["Unpaid", "Pay later"].includes(candidate))
        return UNPAID_PAYMENT_METHOD;
    if (candidate === "Paid" || paymentStatus === "Paid")
        return DEFAULT_PAID_PAYMENT_METHOD;
    return UNPAID_PAYMENT_METHOD;
}
function getPaymentStatusForMethod(method, fallbackStatus = "") {
    if (isPaidPaymentMethod(method))
        return "Paid";
    const normalizedFallback = normalizePaymentStatus(fallbackStatus);
    return normalizedFallback === "Paid" ? "Pay later" : normalizedFallback;
}
function normalizeLineModifiers(modifiers) {
    const source = Array.isArray(modifiers)
        ? modifiers
        : String(modifiers || "")
            .split(",")
            .map((modifier) => modifier.trim());
    return [...new Set(source.map((modifier) => String(modifier || "").trim()).filter(Boolean))];
}
function normalizeOrderLineItem(item, productIds) {
    const productId = item.productId;
    const quantity = Math.floor(Number(item.quantity) || 0);
    if (!productIds.has(productId) || quantity < 1)
        return null;
    return {
        productId,
        quantity,
        note: String(item.note || item.notes || "").trim(),
        modifiers: normalizeLineModifiers(item.modifiers)
    };
}
function normalizeState(candidate) {
    const source = candidate ? structuredClone(candidate) : {};
    const next = { ...getFreshSeedState(), ...source };
    const collectionKeys = [
        "products",
        "ingredients",
        "orders",
        "tickets",
        "tables",
        "tableQrCodes",
        "customerCart",
        "supplierOrders",
        "procedures",
        "procedureCompletions",
        "staff",
        "drivers",
        "reservations",
        "productionLog",
        "productionBatches",
        "users",
        "customInventoryLocations",
        "inventoryHistory",
        "wasteRecords",
        "productRecipeDraft"
    ];
    collectionKeys.forEach((key) => {
        if (!Array.isArray(next[key]))
            next[key] = structuredClone(seedState[key]);
    });
    next.restaurantSettings = normalizeRestaurantSettings(source.restaurantSettings);
    next.users = normalizeUsers(next.users);
    if (!next.users.some((user) => user.id === next.currentUserId))
        next.currentUserId = "";
    const rawProcedures = Array.isArray(source.procedures) ? source.procedures : seedState.procedures;
    next.procedures = mergeDefaultProcedures(normalizeProcedures(isLegacyProcedureList(rawProcedures) ? seedState.procedures : rawProcedures));
    const procedureIds = new Set(next.procedures.map((procedure) => procedure.id));
    next.procedureCompletions = normalizeProcedureCompletions(next.procedureCompletions, procedureIds, next.users);
    next.procedureProgress = normalizeProcedureProgress(source.procedureProgress, procedureIds, next.users);
    next.ingredients = normalizeIngredients(next.ingredients);
    const existingIngredientIds = new Set(next.ingredients.map((ingredient) => ingredient.id));
    normalizeIngredients(seedState.ingredients)
        .filter((ingredient) => PHASE_11_SEED_INGREDIENT_IDS.includes(ingredient.id) && !existingIngredientIds.has(ingredient.id))
        .forEach((ingredient) => {
        next.ingredients.push(ingredient);
        existingIngredientIds.add(ingredient.id);
    });
    const ingredientIds = new Set(next.ingredients.map((ingredient) => ingredient.id));
    next.customInventoryLocations = normalizeCustomInventoryLocations(next.customInventoryLocations, next.ingredients);
    next.inventoryHistory = normalizeInventoryHistory(next.inventoryHistory, ingredientIds);
    next.wasteRecords = normalizeWasteRecords(next.wasteRecords, next.ingredients, next.users);
    const existingProductIds = new Set((Array.isArray(next.products) ? next.products : []).map((product) => slugify(product.id || product.name || "", "")));
    seedState.products
        .filter((product) => PHASE_11_SEED_PRODUCT_IDS.includes(product.id) && !existingProductIds.has(product.id))
        .forEach((product) => next.products.push(structuredClone(product)));
    next.products = normalizeProducts(next.products, ingredientIds);
    const productIds = new Set(next.products.map((product) => product.id));
    next.productionBatches = normalizeProductionBatches(next.productionBatches, productIds, ingredientIds, next.users);
    next.orderDraft = Array.isArray(candidate?.orderDraft)
        ? candidate.orderDraft
            .map((item) => normalizeOrderLineItem(item, productIds))
            .filter(Boolean)
        : [];
    next.receiptOrderId = String(candidate?.receiptOrderId || "");
    next.productRecipeDraft = normalizeRecipeLines(candidate?.productRecipeDraft, ingredientIds);
    next.tables = next.tables
        .map((table, index) => ({
        id: table.id || `table-${index + 1}`,
        name: table.name || `Table ${index + 1}`,
        capacity: Math.max(1, Math.floor(Number(table.capacity) || 2)),
        zone: table.zone || "Dining room"
    }))
        .filter((table) => table.id);
    if (!next.tables.length)
        next.tables = structuredClone(seedState.tables);
    next.tableQrCodes = normalizeTableQrCodes(next.tableQrCodes, next.tables);
    next.customerCart = Array.isArray(candidate?.customerCart)
        ? candidate.customerCart
            .map((item) => normalizeOrderLineItem(item, productIds))
            .filter(Boolean)
        : [];
    const tableIds = new Set(next.tables.map((table) => table.id));
    const normalizedReservations = [];
    next.reservations.forEach((reservation, index) => {
        const id = reservation.id || `RES-${Date.now()}-${index + 1}`;
        const guests = Math.max(1, Math.floor(Number(reservation.guests) || 1));
        const time = isReservationTime(reservation.time) ? reservation.time : "19:00";
        const requestedTable = tableIds.has(reservation.tableId)
            ? next.tables.find((table) => table.id === reservation.tableId)
            : null;
        const assignedTable = requestedTable
            && requestedTable.capacity >= guests
            && !getReservationConflicts({ id, tableId: requestedTable.id, time }, normalizedReservations).length
            ? requestedTable
            : getAvailableReservationTable({ id, guests, time }, next.tables, normalizedReservations);
        normalizedReservations.push({
            id,
            name: reservation.name || "Guest",
            guests,
            time,
            tableId: assignedTable?.id || requestedTable?.id || next.tables[0]?.id || "",
            source: reservation.source || "Website",
            status: reservation.status || "Confirmed"
        });
    });
    next.reservations = normalizedReservations;
    next.supplierOrders = Array.isArray(candidate?.supplierOrders)
        ? candidate.supplierOrders
            .map((order) => ({
            id: order.id || `SUP-${Date.now()}`,
            supplier: order.supplier,
            status: order.status === "Ordered" ? "Ordered" : order.status === "Received" ? "Received" : "Draft",
            createdAt: order.createdAt || timeNow(),
            orderedAt: order.orderedAt || "",
            receivedAt: order.receivedAt || "",
            items: Array.isArray(order.items)
                ? order.items
                    .map((item) => ({ ingredientId: item.ingredientId, quantity: Number(item.quantity) }))
                    .filter((item) => ingredientIds.has(item.ingredientId) && item.quantity > 0)
                : []
        }))
            .filter((order) => order.supplier && order.items.length)
        : [];
    next.orders = next.orders
        .map((order) => {
        const channel = normalizeOrderType(order.orderType || order.channel);
        const typeDefinition = orderTypeDefinition(channel);
        const rawPaymentStatus = normalizePaymentStatus(order.status === "Paid" ? "Paid" : order.paymentStatus);
        let paymentMethod = normalizePaymentMethod(order.paymentMethod || order.paymentMethodName || order.payment || rawPaymentStatus, rawPaymentStatus);
        if (rawPaymentStatus === "Paid" && !isPaidPaymentMethod(paymentMethod))
            paymentMethod = DEFAULT_PAID_PAYMENT_METHOD;
        const paymentStatus = getPaymentStatusForMethod(paymentMethod, rawPaymentStatus);
        const createdAt = order.createdAt || timeNow();
        const items = Array.isArray(order.items)
            ? order.items.map((item) => normalizeOrderLineItem(item, productIds)).filter(Boolean)
            : [];
        const requestedTableId = String(order.tableId || "").trim();
        const tableId = tableIds.has(requestedTableId) ? requestedTableId : "";
        const staffIdCandidate = String(order.staffId || order.createdByUserId || order.userId || "").trim();
        const staffUser = next.users.find((user) => user.id === staffIdCandidate);
        const staffId = staffUser?.id || "";
        const staffName = String(order.staffName || order.staffMember || order.createdByName || staffUser?.name || "").trim();
        const paidByIdCandidate = String(order.paidByUserId || order.paidById || "").trim();
        const paidByUser = next.users.find((user) => user.id === paidByIdCandidate) || staffUser;
        return {
            ...order,
            orderType: channel,
            channel,
            tableId,
            customer: String(order.customer || (tableId ? next.tables.find((table) => table.id === tableId)?.name : "") || "Walk-in").trim(),
            paymentStatus,
            paymentMethod,
            fulfillment: order.fulfillment || typeDefinition.fulfillment,
            status: normalizeOrderStatus(order.status, paymentStatus),
            createdAt,
            createdAtMs: normalizeTimestamp(order.createdAtMs, createdAt),
            sentAt: order.sentAt || (order.status && order.status !== "New" ? createdAt : ""),
            paidAt: paymentStatus === "Paid" ? order.paidAt || createdAt : "",
            paidAtMs: paymentStatus === "Paid" ? normalizeTimestamp(order.paidAtMs, order.paidAt || createdAt) : "",
            staffId,
            staffName,
            paidByUserId: paymentStatus === "Paid" ? paidByUser?.id || "" : "",
            paidByName: paymentStatus === "Paid" ? String(order.paidByName || paidByUser?.name || staffName || "").trim() : "",
            inventoryDeducted: order.inventoryDeducted === undefined ? order.status && order.status !== "New" : Boolean(order.inventoryDeducted),
            notes: String(order.notes || "").trim(),
            items
        };
    })
        .filter((order) => order.id && order.items.length);
    if (!next.orders.some((order) => order.id === next.receiptOrderId))
        next.receiptOrderId = "";
    next.customerLastOrderId = String(candidate?.customerLastOrderId || "");
    if (next.customerLastOrderId && !next.orders.some((order) => order.id === next.customerLastOrderId))
        next.customerLastOrderId = "";
    const orderIds = new Set(next.orders.map((order) => order.id));
    next.tickets = next.tickets
        .map((ticket, index) => {
        const product = next.products.find((item) => item.id === ticket.productId);
        const order = next.orders.find((item) => item.id === ticket.orderId);
        const status = TICKET_STATUSES.includes(ticket.status) ? ticket.status : "Queued";
        const createdAt = ticket.createdAt || order?.createdAt || timeNow();
        const createdAtMs = normalizeTimestamp(ticket.createdAtMs, createdAt);
        const acceptedAtMs = normalizeOptionalTimestamp(ticket.acceptedAtMs)
            || (["Accepted", "Preparing", "Delayed", "Ready", "Done"].includes(status) ? createdAtMs : "");
        const startedAtMs = normalizeOptionalTimestamp(ticket.startedAtMs)
            || (["Preparing", "Delayed", "Ready", "Done"].includes(status) ? acceptedAtMs || createdAtMs : "");
        const delayedAtMs = normalizeOptionalTimestamp(ticket.delayedAtMs)
            || (status === "Delayed" ? Date.now() : "");
        const readyAtMs = normalizeOptionalTimestamp(ticket.readyAtMs)
            || ((status === "Ready" || status === "Done") ? Date.now() : "");
        const completedAtMs = normalizeOptionalTimestamp(ticket.completedAtMs)
            || (status === "Done" ? readyAtMs || Date.now() : "");
        return {
            id: ticket.id || `TCK-${order?.number || Date.now()}-${index + 1}`,
            orderId: ticket.orderId,
            productId: ticket.productId,
            quantity: Math.max(1, Math.floor(Number(ticket.quantity) || 1)),
            station: normalizeKitchenStation(ticket.station || product?.station || "Main kitchen"),
            status,
            createdAt,
            createdAtMs,
            acceptedAtMs,
            startedAtMs,
            delayedAtMs,
            readyAtMs,
            completedAtMs,
            notes: ticket.notes || "",
            issueNote: String(ticket.issueNote || ticket.delayReason || "").trim()
        };
    })
        .filter((ticket) => orderIds.has(ticket.orderId) && productIds.has(ticket.productId));
    const highestOrderNumber = next.orders.reduce((highest, order) => Math.max(highest, Number(order.number) || 0), 0);
    if (!Number.isFinite(next.nextOrderNumber) || next.nextOrderNumber <= highestOrderNumber) {
        next.nextOrderNumber = highestOrderNumber + 1;
    }
    return next;
}
function loadState() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return normalizeState(stored ? JSON.parse(stored) : getFreshSeedState());
    }
    catch {
        return normalizeState(getFreshSeedState());
    }
}
function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    catch {
        // The demo still runs in browser contexts where storage is disabled.
    }
}
function money(value) {
    return new Intl.NumberFormat("nl-NL", { style: "currency", currency: state?.restaurantSettings?.currency || "EUR" }).format(value);
}
const htmlEscapes = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
};
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => htmlEscapes[character]);
}
function qrCodeSvg(value, title = "QR code") {
    try {
        return buildQrCodeSvg(value, title);
    }
    catch {
        return buildFallbackQrSvg(value, title);
    }
}
function buildFallbackQrSvg(value, title) {
    const size = 29;
    const modules = [];
    let hash = 2166136261;
    String(value).split("").forEach((character) => {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    });
    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            const inFinder = (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
            const finderRing = inFinder && (x % (size - 7) === 0 || y % (size - 7) === 0 || x % (size - 7) === 6 || y % (size - 7) === 6);
            const finderCenter = inFinder && x % (size - 7) >= 2 && x % (size - 7) <= 4 && y % (size - 7) >= 2 && y % (size - 7) <= 4;
            if (finderRing || finderCenter || (!inFinder && ((Math.imul(hash ^ (x * 31 + y * 17), 1103515245) >>> 27) & 1))) {
                modules.push(`<rect x="${x + 2}" y="${y + 2}" width="1" height="1"/>`);
            }
        }
    }
    return `
    <svg class="qr-code-svg" viewBox="0 0 ${size + 4} ${size + 4}" role="img" aria-label="${escapeHtml(title)}" xmlns="http://www.w3.org/2000/svg">
      <title>${escapeHtml(title)}</title>
      <rect width="${size + 4}" height="${size + 4}" fill="#fff"/>
      <g fill="#173d36">${modules.join("")}</g>
    </svg>
  `;
}
function buildQrCodeSvg(value, title) {
    const version = 6;
    const size = version * 4 + 17;
    const dataCodewords = 136;
    const blockDataCodewords = 68;
    const eccCodewords = 18;
    const mask = 0;
    const bytes = [...new TextEncoder().encode(String(value))];
    if (bytes.length > dataCodewords - 3)
        return buildFallbackQrSvg(value, title);
    const data = qrEncodeByteData(bytes, dataCodewords);
    const divisor = qrReedSolomonDivisor(eccCodewords);
    const blocks = [
        data.slice(0, blockDataCodewords),
        data.slice(blockDataCodewords, blockDataCodewords * 2)
    ];
    const eccBlocks = blocks.map((block) => qrReedSolomonRemainder(block, divisor));
    const codewords = [];
    for (let i = 0; i < blockDataCodewords; i += 1) {
        blocks.forEach((block) => codewords.push(block[i]));
    }
    for (let i = 0; i < eccCodewords; i += 1) {
        eccBlocks.forEach((block) => codewords.push(block[i]));
    }
    const modules = Array.from({ length: size }, () => Array(size).fill(false));
    const functions = Array.from({ length: size }, () => Array(size).fill(false));
    const setFunction = (x, y, dark) => {
        if (x < 0 || x >= size || y < 0 || y >= size)
            return;
        modules[y][x] = dark;
        functions[y][x] = true;
    };
    drawQrFunctionPatterns(version, size, setFunction);
    drawQrFormatBits(size, mask, setFunction);
    drawQrCodewords(size, modules, functions, codewords, mask);
    const rects = [];
    modules.forEach((row, y) => {
        row.forEach((dark, x) => {
            if (dark)
                rects.push(`<rect x="${x + 4}" y="${y + 4}" width="1" height="1"/>`);
        });
    });
    return `
    <svg class="qr-code-svg" viewBox="0 0 ${size + 8} ${size + 8}" role="img" aria-label="${escapeHtml(title)}" xmlns="http://www.w3.org/2000/svg">
      <title>${escapeHtml(title)}</title>
      <rect width="${size + 8}" height="${size + 8}" fill="#fff"/>
      <g fill="#173d36">${rects.join("")}</g>
    </svg>
  `;
}
function qrEncodeByteData(bytes, dataCodewords) {
    const bits = [];
    const pushBits = (value, length) => {
        for (let i = length - 1; i >= 0; i -= 1)
            bits.push((value >>> i) & 1);
    };
    pushBits(0x4, 4);
    pushBits(bytes.length, 8);
    bytes.forEach((byte) => pushBits(byte, 8));
    const terminator = Math.min(4, dataCodewords * 8 - bits.length);
    pushBits(0, terminator);
    while (bits.length % 8)
        bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
        data.push(bits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
    }
    for (let pad = 0; data.length < dataCodewords; pad += 1) {
        data.push(pad % 2 ? 0x11 : 0xec);
    }
    return data;
}
function qrReedSolomonTables() {
    if (qrReedSolomonTables.cache)
        return qrReedSolomonTables.cache;
    const exp = Array(255).fill(0);
    const log = Array(256).fill(0);
    let value = 1;
    for (let i = 0; i < 255; i += 1) {
        exp[i] = value;
        log[value] = i;
        value <<= 1;
        if (value & 0x100)
            value ^= 0x11d;
    }
    qrReedSolomonTables.cache = { exp, log };
    return qrReedSolomonTables.cache;
}
function qrReedSolomonMultiply(first, second) {
    if (!first || !second)
        return 0;
    const { exp, log } = qrReedSolomonTables();
    return exp[(log[first] + log[second]) % 255];
}
function qrReedSolomonDivisor(degree) {
    const { exp } = qrReedSolomonTables();
    let result = [1];
    for (let i = 0; i < degree; i += 1) {
        const next = Array(result.length + 1).fill(0);
        result.forEach((coefficient, index) => {
            next[index] ^= qrReedSolomonMultiply(coefficient, exp[i]);
            next[index + 1] ^= coefficient;
        });
        result = next;
    }
    return result.slice(0, degree);
}
function qrReedSolomonRemainder(data, divisor) {
    const result = Array(divisor.length).fill(0);
    data.forEach((byte) => {
        const factor = byte ^ result.shift();
        result.push(0);
        divisor.forEach((coefficient, index) => {
            result[index] ^= qrReedSolomonMultiply(coefficient, factor);
        });
    });
    return result;
}
function drawQrFunctionPatterns(version, size, setFunction) {
    const drawFinder = (left, top) => {
        for (let y = -1; y <= 7; y += 1) {
            for (let x = -1; x <= 7; x += 1) {
                const xx = left + x;
                const yy = top + y;
                const dark = x >= 0 && x <= 6 && y >= 0 && y <= 6
                    && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
                setFunction(xx, yy, dark);
            }
        }
    };
    const drawAlignment = (centerX, centerY) => {
        for (let y = -2; y <= 2; y += 1) {
            for (let x = -2; x <= 2; x += 1) {
                setFunction(centerX + x, centerY + y, Math.max(Math.abs(x), Math.abs(y)) !== 1);
            }
        }
    };
    drawFinder(0, 0);
    drawFinder(size - 7, 0);
    drawFinder(0, size - 7);
    for (let i = 8; i < size - 8; i += 1) {
        setFunction(i, 6, i % 2 === 0);
        setFunction(6, i, i % 2 === 0);
    }
    drawAlignment(34, 34);
    setFunction(8, version * 4 + 9, true);
}
function qrFormatBits(mask) {
    let data = (1 << 3) | mask;
    let bits = data << 10;
    const generator = 0x537;
    for (let i = 14; i >= 10; i -= 1) {
        if ((bits >>> i) & 1)
            bits ^= generator << (i - 10);
    }
    return ((data << 10) | bits) ^ 0x5412;
}
function drawQrFormatBits(size, mask, setFunction) {
    const bits = qrFormatBits(mask);
    const getBit = (index) => Boolean((bits >>> index) & 1);
    for (let i = 0; i <= 5; i += 1)
        setFunction(8, i, getBit(i));
    setFunction(8, 7, getBit(6));
    setFunction(8, 8, getBit(7));
    setFunction(7, 8, getBit(8));
    for (let i = 9; i < 15; i += 1)
        setFunction(14 - i, 8, getBit(i));
    for (let i = 0; i < 8; i += 1)
        setFunction(size - 1 - i, 8, getBit(i));
    for (let i = 8; i < 15; i += 1)
        setFunction(8, size - 15 + i, getBit(i));
    setFunction(8, size - 8, true);
}
function qrMask(mask, x, y) {
    if (mask === 0)
        return (x + y) % 2 === 0;
    return false;
}
function drawQrCodewords(size, modules, functions, codewords, mask) {
    let bitIndex = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6)
            right -= 1;
        for (let vertical = 0; vertical < size; vertical += 1) {
            const upward = ((right + 1) & 2) === 0;
            const y = upward ? size - 1 - vertical : vertical;
            for (let j = 0; j < 2; j += 1) {
                const x = right - j;
                if (functions[y][x])
                    continue;
                let dark = false;
                if (bitIndex < codewords.length * 8) {
                    dark = Boolean((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1);
                    bitIndex += 1;
                }
                modules[y][x] = qrMask(mask, x, y) ? !dark : dark;
            }
        }
    }
}
function timeNow() {
    return new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}
function formatDateTime(timestamp, fallbackClockTime = "") {
    const resolvedTimestamp = normalizeOptionalTimestamp(timestamp) || parseClockTimeToTimestamp(fallbackClockTime) || Date.now();
    return new Intl.DateTimeFormat("nl-NL", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(new Date(resolvedTimestamp));
}
function parseClockTimeToTimestamp(time) {
    if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
        return null;
    const [hours, minutes] = time.split(":").map(Number);
    const now = new Date();
    const timestamp = new Date(now);
    timestamp.setHours(hours, minutes, 0, 0);
    if (timestamp.getTime() - now.getTime() > 5 * MINUTE_MS) {
        timestamp.setDate(timestamp.getDate() - 1);
    }
    return timestamp.getTime();
}
function normalizeOptionalTimestamp(value) {
    const timestamp = Number(value);
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : "";
}
function normalizeTimestamp(value, fallbackClockTime = "") {
    return normalizeOptionalTimestamp(value) || parseClockTimeToTimestamp(fallbackClockTime) || Date.now();
}
function formatDuration(minutes) {
    const safeMinutes = Math.max(0, Math.floor(Number(minutes) || 0));
    if (safeMinutes < 1)
        return "<1m";
    if (safeMinutes < 60)
        return `${safeMinutes}m`;
    const hours = Math.floor(safeMinutes / 60);
    const remainingMinutes = safeMinutes % 60;
    return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}
function productById(id) {
    return state.products.find((product) => product.id === id);
}
function ingredientById(id) {
    return state.ingredients.find((ingredient) => ingredient.id === id);
}
function getAllInventoryLocations() {
    const locations = [
        ...DEFAULT_INVENTORY_LOCATIONS,
        ...(state.customInventoryLocations || [])
    ];
    state.ingredients.forEach((ingredient) => {
        Object.keys(ingredient.locationStock || {}).forEach((location) => locations.push(location));
        if (ingredient.location)
            locations.push(ingredient.location);
    });
    return sortInventoryLocations(locations);
}
function getIngredientLocationRows(ingredient, includeEmpty = false) {
    const locations = includeEmpty ? getAllInventoryLocations() : Object.keys(ingredient.locationStock || {});
    return sortInventoryLocations(locations)
        .map((location) => ({
        location,
        quantity: normalizeStockQuantity(ingredient.locationStock?.[location] || 0)
    }))
        .filter((row) => includeEmpty || row.quantity > 0);
}
function formatLocationOptionLabel(ingredient, location) {
    const quantity = ingredient ? normalizeStockQuantity(ingredient.locationStock?.[location] || 0) : 0;
    return ingredient ? `${location} (${formatStockAmount(quantity, ingredient.unit)})` : location;
}
function inventoryActionLabel(type) {
    return INVENTORY_ACTIONS.find((action) => action.id === type)?.label || "Stock action";
}
function orderById(id) {
    return state.orders.find((order) => order.id === id);
}
function productAvailabilityLabel(product) {
    return AVAILABILITY_OPTIONS
        .filter((option) => product.availability?.[option.id])
        .map((option) => option.label)
        .join(", ") || "No channels";
}
function normalizeOrderType(value) {
    const candidate = LEGACY_ORDER_TYPE_MAP[value] || value || "Dine-in";
    return ORDER_TYPE_OPTIONS.some((option) => option.value === candidate) ? candidate : "Dine-in";
}
function orderTypeDefinition(value) {
    return ORDER_TYPE_OPTIONS.find((option) => option.value === normalizeOrderType(value)) || ORDER_TYPE_OPTIONS[0];
}
function getChannelAvailabilityKey(channel) {
    return orderTypeDefinition(channel).availabilityKey;
}
function productCanBeOrdered(product, channel) {
    if (!product || !product.active)
        return false;
    const availabilityKey = getChannelAvailabilityKey(channel);
    return Boolean(product.availability?.[availabilityKey]);
}
function getOrderableProducts(channel) {
    return state.products.filter((product) => productCanBeOrdered(product, channel));
}
function tableById(id) {
    return state.tables.find((table) => table.id === id);
}
function normalizeQrCodeStatus(status) {
    return QR_CODE_STATUSES.includes(status) ? status : "Active";
}
function createQrToken(tableId, existingTokens = new Set()) {
    const base = `${slugify(tableId, "table")}-${Date.now().toString(36).slice(-5)}-${Math.random().toString(36).slice(2, 7)}`;
    let token = base;
    let suffix = 2;
    while (existingTokens.has(token)) {
        token = `${base}-${suffix}`;
        suffix += 1;
    }
    existingTokens.add(token);
    return token;
}
function createDefaultTableQrCodes(tables) {
    return tables.map((table) => ({
        id: `qr-${table.id}`,
        tableId: table.id,
        area: table.zone || "Dining room",
        token: `libabite-${table.id}`,
        status: "Active",
        createdAt: "09:00",
        regeneratedAt: ""
    }));
}
function normalizeTableQrCodes(codes, tables) {
    const tableIds = new Set(tables.map((table) => table.id));
    const tokens = new Set();
    const source = Array.isArray(codes) && codes.length ? codes : createDefaultTableQrCodes(tables);
    const normalized = source
        .map((code, index) => {
        const fallbackTable = tables[index % Math.max(1, tables.length)];
        const tableId = tableIds.has(code.tableId) ? code.tableId : fallbackTable?.id || "";
        if (!tableId)
            return null;
        const rawToken = String(code.token || "").trim();
        const token = rawToken && !tokens.has(rawToken) ? rawToken : createQrToken(tableId, tokens);
        tokens.add(token);
        const table = tables.find((item) => item.id === tableId);
        return {
            id: code.id || `qr-${tableId}-${index + 1}`,
            tableId,
            area: String(code.area || table?.zone || "Dining room").trim(),
            token,
            status: normalizeQrCodeStatus(code.status),
            createdAt: code.createdAt || timeNow(),
            regeneratedAt: code.regeneratedAt || ""
        };
    })
        .filter(Boolean);
    tables.forEach((table) => {
        if (normalized.some((code) => code.tableId === table.id))
            return;
        const token = createQrToken(table.id, tokens);
        normalized.push({
            id: `qr-${table.id}`,
            tableId: table.id,
            area: table.zone || "Dining room",
            token,
            status: "Active",
            createdAt: timeNow(),
            regeneratedAt: ""
        });
    });
    return normalized;
}
function qrCodeById(id) {
    return state.tableQrCodes.find((code) => code.id === id);
}
function qrCodeByToken(token) {
    return state.tableQrCodes.find((code) => code.token === token);
}
function getActiveQrCodeForTable(tableId) {
    return state.tableQrCodes.find((code) => code.tableId === tableId && code.status === "Active") || null;
}
function getQrBaseUrl() {
    const base = `${window.location.origin}${window.location.pathname}`;
    return window.location.protocol === "file:" ? window.location.pathname : base;
}
function getQrOrderUrl(code) {
    const separator = getQrBaseUrl().includes("?") ? "&" : "?";
    return `${getQrBaseUrl()}${separator}qr=${encodeURIComponent(code.token)}`;
}
function getStaffUrl() {
    return getQrBaseUrl();
}
function getCustomerQrSession() {
    const params = new URLSearchParams(window.location.search);
    const token = String(params.get("qr") || "").trim();
    const tableParam = String(params.get("table") || "").trim();
    if (!token && !tableParam)
        return null;
    if (token) {
        const code = qrCodeByToken(token);
        if (!code)
            return { error: "This QR code is not recognized.", code: null, table: null };
        const table = tableById(code.tableId);
        if (!table)
            return { error: "This QR code is not assigned to a table.", code, table: null };
        if (code.status !== "Active")
            return { error: `${table.name} ordering is disabled.`, code, table };
        return { error: "", code, table };
    }
    const table = tableById(tableParam);
    if (!table)
        return { error: "This table link is not recognized.", code: null, table: null };
    const code = getActiveQrCodeForTable(table.id);
    if (!code)
        return { error: `${table.name} does not have an active QR code.`, code: null, table };
    return { error: "", code, table };
}
function isReservationTime(time) {
    return typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}
function getReservationMinutes(time) {
    if (!isReservationTime(time))
        return null;
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}
function formatReservationMinutes(totalMinutes) {
    const wrappedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
    const hours = Math.floor(wrappedMinutes / 60);
    const minutes = wrappedMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
function getReservationWindow(time) {
    const start = getReservationMinutes(time);
    return start === null ? null : { start, end: start + RESERVATION_TURNOVER_MINUTES };
}
function getReservationWindowLabel(time) {
    const window = getReservationWindow(time);
    return window ? `${formatReservationMinutes(window.start)}-${formatReservationMinutes(window.end)}` : "Time needed";
}
function reservationWindowsOverlap(firstWindow, secondWindow) {
    return firstWindow.start < secondWindow.end && secondWindow.start < firstWindow.end;
}
function getReservationConflicts(candidate, reservations = state.reservations) {
    const candidateWindow = getReservationWindow(candidate.time);
    if (!candidate.tableId || !candidateWindow)
        return [];
    return reservations.filter((reservation) => {
        if (reservation.id === candidate.id || reservation.tableId !== candidate.tableId || reservation.status === "Cancelled") {
            return false;
        }
        const reservationWindow = getReservationWindow(reservation.time);
        return reservationWindow && reservationWindowsOverlap(candidateWindow, reservationWindow);
    });
}
function getAvailableReservationTable(candidate, tables = state.tables, reservations = state.reservations) {
    const guests = Math.max(1, Math.floor(Number(candidate.guests) || 1));
    return tables
        .filter((table) => table.capacity >= guests)
        .slice()
        .sort((a, b) => a.capacity - b.capacity || a.name.localeCompare(b.name))
        .find((table) => !getReservationConflicts({ ...candidate, guests, tableId: table.id }, reservations).length) || null;
}
function getReservationIssues(reservation) {
    const issues = [];
    const table = tableById(reservation.tableId);
    if (!table) {
        issues.push("Missing table");
        return issues;
    }
    if (reservation.guests > table.capacity) {
        issues.push(`Over capacity by ${reservation.guests - table.capacity}`);
    }
    const conflicts = getReservationConflicts(reservation);
    if (conflicts.length) {
        issues.push(`Overlaps ${conflicts.map((conflict) => `${conflict.time} ${conflict.name}`).join(", ")}`);
    }
    return issues;
}
function getReservationValidation(candidate) {
    const guests = Math.max(1, Math.floor(Number(candidate.guests) || 1));
    const table = tableById(candidate.tableId);
    if (!table) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Blocked",
            title: "Select table",
            detail: "Choose a table before confirming this reservation."
        };
    }
    if (!isReservationTime(candidate.time)) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Blocked",
            title: table.name,
            detail: "Choose an arrival time before checking the table."
        };
    }
    if (guests > table.capacity) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Too small",
            title: table.name,
            detail: `${table.name} seats ${table.capacity}; choose a larger table for ${guests} guests.`
        };
    }
    const conflicts = getReservationConflicts({ ...candidate, guests });
    if (conflicts.length) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Collision",
            title: `${table.name} is already held`,
            detail: `Conflicts with ${conflicts.map((reservation) => `${reservation.time} ${reservation.name}`).join(", ")}. Holds last ${RESERVATION_TURNOVER_MINUTES} minutes.`
        };
    }
    return {
        ok: true,
        className: "",
        pillClass: "ok",
        pillText: "Available",
        title: `${table.name} available`,
        detail: `Seats ${table.capacity}; ${getReservationWindowLabel(candidate.time)} for ${guests} guests.`
    };
}
function getOrderTotal(order) {
    return getItemsTotal(order.items);
}
function getVatRate(product) {
    return VAT_RATES[product?.vatSetting] ?? VAT_RATES.standard;
}
function getVatLabel(vatSetting) {
    return VAT_OPTIONS.find((option) => option.id === vatSetting)?.label || "Standard VAT";
}
function getOrderSubtotalExcludingVat(order) {
    return normalizeOrderItems(order.items || []).reduce((sum, item) => {
        const product = productById(item.productId);
        if (!product)
            return sum;
        const lineTotal = product.price * item.quantity;
        return sum + (lineTotal / (1 + getVatRate(product)));
    }, 0);
}
function getOrderVatTotal(order) {
    return Math.max(0, getOrderTotal(order) - getOrderSubtotalExcludingVat(order));
}
function getOrderVatBreakdown(order) {
    const breakdown = new Map();
    normalizeOrderItems(order.items || []).forEach((item) => {
        const product = productById(item.productId);
        if (!product)
            return;
        const vatSetting = VAT_OPTIONS.some((option) => option.id === product.vatSetting) ? product.vatSetting : "standard";
        const rate = getVatRate(product);
        const lineTotal = product.price * item.quantity;
        const tax = lineTotal - (lineTotal / (1 + rate));
        const current = breakdown.get(vatSetting) || { vatSetting, rate, tax: 0 };
        current.tax += tax;
        breakdown.set(vatSetting, current);
    });
    return [...breakdown.values()];
}
function getCurrentOrderContext() {
    const form = document.querySelector("#orderForm");
    return {
        channel: form?.elements.channel.value || DEFAULT_RECIPE_ORDER_CONTEXT.channel,
        fulfillment: form?.elements.fulfillment.value || DEFAULT_RECIPE_ORDER_CONTEXT.fulfillment
    };
}
function isTakeawayDeliveryContext(orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
    const channel = String(orderContext.channel || "");
    const fulfillment = String(orderContext.fulfillment || "");
    return fulfillment === "Delivery"
        || fulfillment === "Pickup"
        || channel === "Takeaway"
        || channel === "Uber Eats";
}
function recipeLineAppliesToOrder(line, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
    if (line.appliesTo !== "takeawayDelivery")
        return true;
    return isTakeawayDeliveryContext(orderContext);
}
function getRecipeLineWasteMultiplier(line) {
    return 1 + (normalizeRecipeWastePercent(line.wastePercent) / 100);
}
function getLineCost(line, orderContext = null) {
    if (orderContext && !recipeLineAppliesToOrder(line, orderContext))
        return 0;
    const ingredient = ingredientById(line.ingredientId);
    if (!ingredient)
        return 0;
    return convertRecipeLineToStockUnits(line) * ingredient.purchasePrice;
}
function getProductCost(product, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
    return (product.recipe || []).reduce((sum, line) => sum + getLineCost(line, orderContext), 0);
}
function getProductGrossMargin(product, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
    return Math.max(0, (Number(product.price) || 0) - getProductCost(product, orderContext));
}
function getProductMargin(product, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
    if (!product.price)
        return 0;
    return ((product.price - getProductCost(product, orderContext)) / product.price) * 100;
}
function productHasConditionalRecipeLines(product) {
    return (product.recipe || []).some((line) => line.appliesTo === "takeawayDelivery");
}
function getProductMarginProfile(product) {
    const baseMargin = getProductMargin(product, DEFAULT_RECIPE_ORDER_CONTEXT);
    const takeawayMargin = getProductMargin(product, TAKEAWAY_DELIVERY_RECIPE_CONTEXT);
    const margin = productHasConditionalRecipeLines(product) ? Math.min(baseMargin, takeawayMargin) : baseMargin;
    const className = margin < product.minMargin ? "danger" : margin < product.targetMargin ? "warning" : "ok";
    const label = margin < product.minMargin ? "Below minimum" : margin < product.targetMargin ? "Below target" : "On target";
    return { baseMargin, takeawayMargin, margin, className, label };
}
function getRecipeUsageLabel(line) {
    const wasteLabel = line.wastePercent ? ` +${normalizeRecipeWastePercent(line.wastePercent)}% waste` : "";
    if (line.grams)
        return `${line.grams}g${wasteLabel}`;
    if (line.milliliters)
        return `${line.milliliters}ml${wasteLabel}`;
    return `${line.units} pcs${wasteLabel}`;
}
function getRecipeMeasure(line) {
    if (line.grams !== undefined)
        return { key: "grams", label: "grams", shortLabel: "g", step: 5 };
    if (line.milliliters !== undefined)
        return { key: "milliliters", label: "milliliters", shortLabel: "ml", step: 5 };
    return { key: "units", label: "pieces", shortLabel: "pcs", step: 1 };
}
function getRecipeLineQuantity(line) {
    const measure = getRecipeMeasure(line);
    return Number(line[measure.key]) || 0;
}
function getProductionFieldName(line, index) {
    return `actual-${index}-${line.ingredientId}`;
}
function formatActualUsageLabel(actualUsage, measure) {
    return measure.key === "units" ? `${actualUsage} ${measure.shortLabel}` : `${actualUsage}${measure.shortLabel}`;
}
function convertRecipeLineToStockUnits(line) {
    const ingredient = ingredientById(line.ingredientId);
    const unitType = unitTypeDefinition(ingredient?.unitType || ingredient?.unit);
    const multiplier = getRecipeLineWasteMultiplier(line);
    if (line.grams)
        return (unitType.id === "kilograms" ? line.grams / 1000 : line.grams) * multiplier;
    if (line.milliliters)
        return (unitType.id === "liters" ? line.milliliters / 1000 : line.milliliters) * multiplier;
    return (line.units || 0) * multiplier;
}
function convertActualUsageToStockUnits(line, actualUsage) {
    const measure = getRecipeMeasure(line);
    return convertRecipeLineToStockUnits({
        ingredientId: line.ingredientId,
        [measure.key]: actualUsage
    });
}
function roundMoneyValue(value) {
    return Number((Number(value) || 0).toFixed(2));
}
function formatSignedAmount(value, suffix = "") {
    const numericValue = Number(value) || 0;
    const sign = numericValue > 0 ? "+" : "";
    return `${sign}${numericValue.toFixed(1)}${suffix}`;
}
function getProductionProducts() {
    return state.products.filter((product) => product.recipe?.length);
}
function getDefaultProductionProductId(selectedProductId = "") {
    const products = getProductionProducts();
    if (products.some((product) => product.id === selectedProductId))
        return selectedProductId;
    return products.find((product) => product.batchOutput)?.id || products[0]?.id || "";
}
function getProductionOutputDefault(product) {
    return product?.batchOutput || {
        ingredientId: "",
        quantity: 0,
        unitType: "",
        location: ""
    };
}
function getProductionFormValue(form, name, fallback = "") {
    const field = form?.elements?.[name];
    return field ? field.value : fallback;
}
function getProductionOutputUnitType(ingredient, requestedUnitType, fallbackUnitType = "") {
    if (!ingredient)
        return "";
    const allowedUnits = getWasteUnitOptionsForIngredient(ingredient);
    const requested = unitTypeDefinition(requestedUnitType).id;
    if (allowedUnits.some((unit) => unit.id === requested))
        return requested;
    const fallback = unitTypeDefinition(fallbackUnitType || ingredient.unitType).id;
    if (allowedUnits.some((unit) => unit.id === fallback))
        return fallback;
    return allowedUnits[0]?.id || ingredient.unitType;
}
function getProductionStepCheckboxes(form = document.querySelector("#productionForm")) {
    return [...(form?.querySelectorAll("[data-production-step]") || [])];
}
function productionStepsComplete(form = document.querySelector("#productionForm")) {
    const steps = getProductionStepCheckboxes(form);
    return steps.length ? steps.every((step) => step.checked) : false;
}
function productionMarkedComplete(form = document.querySelector("#productionForm")) {
    return Boolean(form?.elements?.prepComplete?.checked);
}
function getProductionLineDraft(line, index, form) {
    const ingredient = ingredientById(line.ingredientId);
    if (!ingredient)
        return null;
    const measure = getRecipeMeasure(line);
    const plannedUsage = normalizeStockQuantity(getRecipeLineQuantity(line) * getRecipeLineWasteMultiplier(line));
    const actualFieldName = getProductionFieldName(line, index);
    const rawActualUsage = getProductionFormValue(form, actualFieldName, plannedUsage);
    const actualUsage = normalizeStockQuantity(rawActualUsage);
    const plannedStockQuantity = normalizeStockQuantity(convertRecipeLineToStockUnits(line));
    const actualStockQuantity = normalizeStockQuantity(convertActualUsageToStockUnits(line, actualUsage));
    const plannedCost = roundMoneyValue(plannedStockQuantity * ingredient.purchasePrice);
    const actualCost = roundMoneyValue(actualStockQuantity * ingredient.purchasePrice);
    const shortage = ingredient.active ? Math.max(0, actualStockQuantity - ingredient.stock) : actualStockQuantity;
    return {
        index,
        sourceLine: line,
        ingredient,
        measure,
        plannedUsage,
        actualUsage,
        plannedStockQuantity,
        actualStockQuantity,
        plannedCost,
        actualCost,
        shortage: normalizeStockQuantity(shortage)
    };
}
function getProductionExecutionDraft(form = document.querySelector("#productionForm")) {
    const product = productById(getProductionFormValue(form, "productId"));
    const outputDefault = getProductionOutputDefault(product);
    const lines = (product?.recipe || [])
        .map((line, index) => getProductionLineDraft(line, index, form))
        .filter(Boolean);
    const plannedCost = roundMoneyValue(lines.reduce((sum, line) => sum + line.plannedCost, 0));
    const actualCost = roundMoneyValue(lines.reduce((sum, line) => sum + line.actualCost, 0));
    const price = Number(product?.price) || 0;
    const plannedMargin = price ? ((price - plannedCost) / price) * 100 : null;
    const actualMargin = price ? ((price - actualCost) / price) * 100 : null;
    const outputIngredientId = getProductionFormValue(form, "outputIngredientId", outputDefault.ingredientId || "");
    const outputIngredient = ingredientById(outputIngredientId);
    const outputQuantity = outputIngredient
        ? normalizeStockQuantity(getProductionFormValue(form, "outputQuantity", outputDefault.quantity || ""))
        : 0;
    const outputUnitType = outputIngredient
        ? getProductionOutputUnitType(outputIngredient, getProductionFormValue(form, "outputUnitType", outputDefault.unitType), outputDefault.unitType)
        : "";
    const outputStockQuantity = outputIngredient && outputQuantity > 0
        ? convertWasteQuantityToStockUnits(outputIngredient, outputQuantity, outputUnitType)
        : 0;
    const outputUnitCost = outputStockQuantity > 0 ? roundMoneyValue(actualCost / outputStockQuantity) : 0;
    const outputLocation = outputIngredient
        ? normalizeInventoryLocationName(getProductionFormValue(form, "outputLocation", outputDefault.location || outputIngredient.location), outputIngredient.location)
        : "";
    return {
        product,
        lines,
        plannedCost,
        actualCost,
        costDelta: roundMoneyValue(actualCost - plannedCost),
        plannedMargin,
        actualMargin,
        marginDelta: plannedMargin === null || actualMargin === null ? null : actualMargin - plannedMargin,
        outputIngredient,
        outputQuantity,
        outputUnitType,
        outputStockQuantity,
        outputUnitCost,
        outputLocation
    };
}
function getProductionReadiness(draft, form = document.querySelector("#productionForm")) {
    const shortages = draft.lines.filter((line) => line.shortage > 0);
    const zeroActuals = draft.lines.filter((line) => line.actualUsage <= 0);
    const needsOutputQuantity = Boolean(draft.outputIngredient && draft.outputStockQuantity <= 0);
    const stepsDone = productionStepsComplete(form);
    const markedDone = productionMarkedComplete(form);
    if (!draft.product || !draft.lines.length)
        return { ok: false, className: "warning", label: "No recipe", detail: "Select a recipe with ingredients." };
    if (zeroActuals.length)
        return { ok: false, className: "warning", label: "Actuals needed", detail: "Enter actual quantity for each ingredient." };
    if (shortages.length)
        return { ok: false, className: "danger", label: "Missing stock", detail: shortages.map((line) => `${line.ingredient.name} ${formatStockAmount(line.shortage, line.ingredient.unit)}`).join(", ") };
    if (needsOutputQuantity)
        return { ok: false, className: "warning", label: "Yield needed", detail: "Enter the prepared batch quantity." };
    if (!stepsDone || !markedDone)
        return { ok: false, className: "warning", label: "Steps pending", detail: "Complete the preparation checklist." };
    return { ok: true, className: "ok", label: "Ready", detail: "Batch result can be saved." };
}
function formatStockAmount(value, unit) {
    const safeValue = Math.max(0, Number(value) || 0);
    const wholeUnit = ["pcs", "boxes", "packages"].includes(unit);
    const amount = wholeUnit ? Math.floor(safeValue) : safeValue.toFixed(safeValue >= 10 ? 1 : 2);
    return `${amount} ${unit}`;
}
function formatDateTimeLocalInput(timestamp = Date.now()) {
    const date = new Date(normalizeOptionalTimestamp(timestamp) || Date.now());
    const localTime = new Date(date.getTime() - date.getTimezoneOffset() * MINUTE_MS);
    return localTime.toISOString().slice(0, 16);
}
function wasteUnitLabel(unitTypeId) {
    const unitType = UNIT_TYPES.find((type) => type.id === unitTypeId) || unitTypeDefinition(unitTypeId);
    return unitType.shortLabel;
}
function formatWasteQuantity(record) {
    return `${formatStockAmount(record.quantity, wasteUnitLabel(record.unitType))}`;
}
function getWasteReportSummary() {
    const totalCost = state.wasteRecords.reduce((sum, record) => sum + (Number(record.cost) || 0), 0);
    const totalStockQuantity = state.wasteRecords.reduce((sum, record) => sum + (Number(record.stockQuantity) || 0), 0);
    const todayKey = new Date().toDateString();
    const todayRecords = state.wasteRecords.filter((record) => new Date(record.occurredAtMs).toDateString() === todayKey);
    const todayCost = todayRecords.reduce((sum, record) => sum + (Number(record.cost) || 0), 0);
    const reasonCounts = state.wasteRecords.reduce((counts, record) => {
        counts[record.reason] = (counts[record.reason] || 0) + 1;
        return counts;
    }, {});
    const topReason = Object.entries(reasonCounts)
        .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))[0]?.[0] || "No waste";
    return {
        totalCost,
        totalStockQuantity,
        todayCost,
        todayCount: todayRecords.length,
        topReason,
        count: state.wasteRecords.length
    };
}
function normalizeOrderItems(items) {
    const byProduct = new Map();
    items.forEach((item) => {
        const product = productById(item.productId);
        const quantity = Math.floor(Number(item.quantity) || 0);
        if (!product || quantity < 1)
            return;
        const note = String(item.note || item.notes || "").trim();
        const modifiers = normalizeLineModifiers(item.modifiers);
        const key = JSON.stringify([product.id, note, modifiers]);
        const current = byProduct.get(key);
        if (current) {
            current.quantity += quantity;
        }
        else {
            byProduct.set(key, { productId: product.id, quantity, note, modifiers });
        }
    });
    return [...byProduct.values()];
}
function getStockRequirementsForItems(items, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
    const requirements = new Map();
    normalizeOrderItems(items).forEach((item) => {
        const product = productById(item.productId);
        (product.recipe || []).forEach((line) => {
            if (!recipeLineAppliesToOrder(line, orderContext))
                return;
            const ingredient = ingredientById(line.ingredientId);
            if (!ingredient)
                return;
            const stockUnits = convertRecipeLineToStockUnits(line) * item.quantity;
            requirements.set(ingredient.id, (requirements.get(ingredient.id) || 0) + stockUnits);
        });
    });
    return requirements;
}
function getProductAvailability(product, reservedItems = state.orderDraft, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
    if (!product)
        return { maxQuantity: 0, limiting: null, details: [] };
    if (!product.active)
        return { maxQuantity: 0, limiting: null, details: [] };
    const reservedStock = getStockRequirementsForItems(reservedItems, orderContext);
    const details = (product.recipe || [])
        .filter((line) => recipeLineAppliesToOrder(line, orderContext))
        .map((line) => {
        const ingredient = ingredientById(line.ingredientId);
        if (!ingredient)
            return null;
        const perItem = convertRecipeLineToStockUnits(line);
        const reserved = reservedStock.get(ingredient.id) || 0;
        const remaining = ingredient.active ? Math.max(0, ingredient.stock - reserved) : 0;
        const maxQuantity = ingredient.active && perItem > 0 ? Math.floor((remaining + Number.EPSILON) / perItem) : 0;
        return { ingredient, remaining, maxQuantity };
    })
        .filter(Boolean);
    const maxQuantity = details.length ? Math.min(...details.map((detail) => detail.maxQuantity)) : 0;
    const limiting = details.slice().sort((a, b) => a.maxQuantity - b.maxQuantity)[0] || null;
    return { maxQuantity: Math.max(0, maxQuantity), limiting, details };
}
function getStockShortages(items, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
    return [...getStockRequirementsForItems(items, orderContext).entries()]
        .map(([ingredientId, required]) => {
        const ingredient = ingredientById(ingredientId);
        const shortage = ingredient?.active ? required - (ingredient.stock || 0) : required;
        return { ingredient, required, shortage };
    })
        .filter((item) => item.ingredient && item.shortage > 0.0001);
}
function getItemsTotal(items) {
    return normalizeOrderItems(items).reduce((sum, item) => {
        const product = productById(item.productId);
        if (!product)
            return sum;
        return sum + product.price * item.quantity;
    }, 0);
}
function getItemCount(items) {
    return normalizeOrderItems(items).reduce((sum, item) => sum + item.quantity, 0);
}
function getIngredientStatus(ingredient) {
    if (!ingredient.active)
        return "inactive";
    if (ingredient.stock <= ingredient.min)
        return "danger";
    if (ingredient.max > 0 && ingredient.stock > ingredient.max)
        return "over";
    if (ingredient.stock <= ingredient.min * 1.25)
        return "warning";
    return "ok";
}
function getLowStockIngredients() {
    return state.ingredients.filter((ingredient) => ingredient.active && ingredient.stock <= ingredient.min);
}
function getOverStockIngredients() {
    return state.ingredients.filter((ingredient) => ingredient.active && ingredient.max > 0 && ingredient.stock > ingredient.max);
}
function getSupplierKey(supplier) {
    return String(supplier || "supplier").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "supplier";
}
function getSupplierOrderQuantity(ingredient) {
    return Math.max(0, Number((ingredient.max - ingredient.stock).toFixed(3)));
}
function getActiveSupplierOrder(supplier) {
    return state.supplierOrders.find((order) => order.supplier === supplier && order.status !== "Received");
}
function getSupplierOrderTotal(order) {
    return order.items.reduce((sum, item) => {
        const ingredient = ingredientById(item.ingredientId);
        return sum + (ingredient ? ingredient.purchasePrice * item.quantity : 0);
    }, 0);
}
function getSupplierOrderDrafts() {
    const activeOrders = state.supplierOrders
        .filter((order) => order.status !== "Received")
        .map((order) => ({
        ...order,
        items: order.items.filter((item) => ingredientById(item.ingredientId))
    }))
        .filter((order) => order.items.length);
    const bySupplier = new Map(activeOrders.map((order) => [order.supplier, order]));
    getLowStockIngredients().forEach((ingredient) => {
        const existing = bySupplier.get(ingredient.supplier);
        if (existing?.status === "Ordered")
            return;
        const item = {
            ingredientId: ingredient.id,
            quantity: getSupplierOrderQuantity(ingredient)
        };
        if (existing) {
            const nextItems = existing.items.filter((line) => line.ingredientId !== ingredient.id);
            nextItems.push(item);
            existing.items = nextItems;
            return;
        }
        bySupplier.set(ingredient.supplier, {
            id: `SUP-${getSupplierKey(ingredient.supplier)}`,
            supplier: ingredient.supplier,
            status: "Draft",
            createdAt: timeNow(),
            orderedAt: "",
            receivedAt: "",
            items: [item]
        });
    });
    return [...bySupplier.values()].sort((a, b) => a.supplier.localeCompare(b.supplier));
}
function getStationNames() {
    const stations = new Set(KITCHEN_STATIONS);
    state.products.filter((product) => product.active).forEach((product) => stations.add(normalizeKitchenStation(product.station)));
    getOpenTickets().forEach((ticket) => stations.add(normalizeKitchenStation(ticket.station)));
    const knownStations = KITCHEN_STATIONS.filter((station) => stations.has(station));
    const customStations = [...stations]
        .filter((station) => !KITCHEN_STATIONS.includes(station))
        .sort((first, second) => first.localeCompare(second));
    return ["All", ...knownStations, ...customStations];
}
function getOpenTickets() {
    return state.tickets.filter((ticket) => ticket.status !== "Done");
}
function getTicketTargetMinutes(ticket) {
    return Number(ticket.slaMinutes) || TICKET_SLA_MINUTES[ticket.station] || TICKET_SLA_MINUTES.default;
}
function getTicketAgeMinutes(ticket, now = Date.now()) {
    const endTime = ticket.readyAtMs || ticket.completedAtMs || now;
    return Math.max(0, Math.floor((endTime - ticket.createdAtMs) / MINUTE_MS));
}
function getTicketOrderAgeMinutes(ticket, now = Date.now()) {
    const order = orderById(ticket.orderId);
    const startedAt = order?.createdAtMs || ticket.createdAtMs;
    const endTime = ticket.completedAtMs || now;
    return Math.max(0, Math.floor((endTime - startedAt) / MINUTE_MS));
}
function getTicketSla(ticket, now = Date.now()) {
    const targetMinutes = getTicketTargetMinutes(ticket);
    const ageMinutes = getTicketAgeMinutes(ticket, now);
    const remainingMinutes = targetMinutes - ageMinutes;
    const progress = Math.min(100, Math.max(4, Math.round((ageMinutes / targetMinutes) * 100)));
    if (ticket.status === "Delayed") {
        return {
            state: "delayed",
            label: "Delayed",
            pillClass: "danger",
            cardClass: "sla-delayed",
            detail: ticket.issueNote ? `Issue: ${ticket.issueNote}` : "Issue needs manager attention",
            ageMinutes,
            targetMinutes,
            progress: 100
        };
    }
    if (ticket.status === "Ready" || ticket.status === "Done") {
        return {
            state: "ready",
            label: "Ready",
            pillClass: "ok",
            cardClass: "sla-ready",
            detail: `Ready in ${formatDuration(ageMinutes)}`,
            ageMinutes,
            targetMinutes,
            progress
        };
    }
    if (remainingMinutes <= 0) {
        return {
            state: "escalated",
            label: "Escalated",
            pillClass: "danger",
            cardClass: "sla-escalated",
            detail: `${formatDuration(Math.abs(remainingMinutes))} over target`,
            ageMinutes,
            targetMinutes,
            progress: 100
        };
    }
    if (remainingMinutes <= SLA_WARNING_WINDOW_MINUTES) {
        return {
            state: "warning",
            label: "Warn",
            pillClass: "warning",
            cardClass: "sla-warning",
            detail: `${formatDuration(remainingMinutes)} to target`,
            ageMinutes,
            targetMinutes,
            progress
        };
    }
    return {
        state: "aging",
        label: "Aging",
        pillClass: "info",
        cardClass: "sla-aging",
        detail: `${formatDuration(remainingMinutes)} to target`,
        ageMinutes,
        targetMinutes,
        progress
    };
}
function getTicketPriority(ticket, now = Date.now()) {
    const order = orderById(ticket.orderId);
    const sla = getTicketSla(ticket, now);
    if (ticket.status === "Delayed" || sla.state === "escalated")
        return { label: "Urgent", className: "danger" };
    if (sla.state === "warning" || order?.fulfillment === "Delivery")
        return { label: "High", className: "warning" };
    if (order?.fulfillment === "Pickup" || normalizeOrderType(order?.channel) === "External delivery app order") {
        return { label: "High", className: "warning" };
    }
    return { label: "Normal", className: "info" };
}
function getTicketStatusLabel(status) {
    if (status === "Queued")
        return "New";
    if (status === "Done")
        return "Complete";
    return status;
}
function ticketStatusClass(status) {
    if (status === "Ready" || status === "Done")
        return "ok";
    if (status === "Preparing" || status === "Accepted")
        return "info";
    if (status === "Delayed")
        return "danger";
    return "warning";
}
function getKitchenSlaSummary(tickets = getOpenTickets(), now = Date.now()) {
    return tickets.reduce((summary, ticket) => {
        const sla = getTicketSla(ticket, now);
        summary.total += 1;
        summary[sla.state] = (summary[sla.state] || 0) + 1;
        return summary;
    }, { total: 0, aging: 0, warning: 0, escalated: 0, delayed: 0, ready: 0 });
}
function getSlaSummaryLabel(summary) {
    const issues = [];
    if (summary.delayed)
        issues.push(`${summary.delayed} delayed`);
    if (summary.escalated)
        issues.push(`${summary.escalated} escalated`);
    if (summary.warning)
        issues.push(`${summary.warning} warning`);
    if (issues.length)
        return issues.join(", ");
    if (summary.total)
        return "All within SLA";
    return "Kitchen clear";
}
function createNode(html) {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
}
function emptyState(text) {
    return `<div class="empty-state">${escapeHtml(text)}</div>`;
}
function roleDefinition(role) {
    return ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.waiter_cashier;
}
function currentUser() {
    return state.users.find((user) => user.id === state.currentUserId && user.status === "Active") || null;
}
function currentRoleKey() {
    return currentUser()?.role || "";
}
function currentRole() {
    return roleDefinition(currentRoleKey());
}
function can(permission) {
    const user = currentUser();
    return Boolean(user && currentRole()[permission]);
}
function visibleViews() {
    const user = currentUser();
    if (!user)
        return [];
    const allowedViews = new Set(currentRole().views);
    return views.filter((view) => allowedViews.has(view.id));
}
function canView(viewId) {
    return visibleViews().some((view) => view.id === viewId);
}
function ensureActiveViewAccess() {
    if (!currentUser())
        return;
    if (canView(state.activeView))
        return;
    state.activeView = currentRole().homeView;
    if (!canView(state.activeView))
        state.activeView = visibleViews()[0]?.id || "dashboard";
    saveState();
}
function renderAuthShell() {
    const user = currentUser();
    const customerSession = getCustomerQrSession();
    const loginScreen = document.querySelector("#loginScreen");
    const appShell = document.querySelector(".app-shell");
    const customerScreen = document.querySelector("#customerQrScreen");
    const loginForm = document.querySelector("#loginForm");
    const currentUserName = document.querySelector("#currentUserName");
    const currentUserRole = document.querySelector("#currentUserRole");
    const quickOrderButton = document.querySelector("#quickOrderBtn");
    const resetDemoButton = document.querySelector("#resetDemoBtn");
    renderDemoLogins();
    document.body.classList.toggle("is-authenticated", Boolean(user) && !customerSession);
    document.body.classList.toggle("is-customer-ordering", Boolean(customerSession));
    customerScreen.hidden = !customerSession;
    loginScreen.classList.toggle("is-hidden", Boolean(user) || Boolean(customerSession));
    appShell.classList.toggle("is-hidden", !user || Boolean(customerSession));
    if (loginForm && !user && !customerSession) {
        loginForm.elements.email.value = loginForm.elements.email.value || "owner@libabite.nl";
        loginForm.elements.password.value = loginForm.elements.password.value || "admin123";
    }
    if (!user || customerSession)
        return;
    currentUserName.textContent = user.name;
    currentUserRole.textContent = roleDefinition(user.role).label;
    quickOrderButton.hidden = !can("canCreateOrders");
    resetDemoButton.hidden = !can("canResetDemo");
}
function renderDemoLogins() {
    const container = document.querySelector("#demoLogins");
    if (!container)
        return;
    container.innerHTML = ROLE_ORDER
        .map((role) => {
        const user = state.users.find((account) => account.role === role && account.status === "Active");
        if (!user)
            return "";
        return `
        <button class="demo-login" type="button" data-demo-login="${escapeHtml(user.email)}" data-demo-password="${escapeHtml(user.password)}">
          <strong>${escapeHtml(roleDefinition(role).label)}</strong>
          <span>${escapeHtml(user.email)}</span>
        </button>
      `;
    })
        .join("");
}
function render() {
    renderAuthShell();
    if (getCustomerQrSession()) {
        renderCustomerQrScreen();
        return;
    }
    if (!currentUser())
        return;
    ensureActiveViewAccess();
    renderNav();
    renderProductsInSelects();
    renderOrderBuilder();
    renderMetrics();
    renderDashboard();
    renderOrders();
    renderKitchen();
    renderProductManagement();
    renderInventory();
    renderWasteTracking();
    renderProcedures();
    renderTeam();
    renderSettings();
    renderReservationPlanner();
    renderReservations();
    updateView();
}
function renderNav() {
    const navList = document.querySelector("#navList");
    const counts = {
        orders: state.orders.filter((order) => order.status !== "Paid" && order.status !== "Cancelled").length,
        kitchen: getOpenTickets().length,
        inventory: getLowStockIngredients().length,
        procedures: getCurrentUserProcedures().filter((procedure) => procedurePeriodStatus(procedure).status !== "Completed").length,
        team: state.drivers.filter((driver) => driver.status === "On route").length,
        reservations: state.reservations.length
    };
    navList.innerHTML = "";
    visibleViews().forEach((view) => {
        const button = createNode(`
      <button class="nav-item ${state.activeView === view.id ? "is-active" : ""}" type="button" data-view="${escapeHtml(view.id)}">
        <span class="nav-icon" aria-hidden="true">${escapeHtml(view.icon)}</span>
        <span>${escapeHtml(view.label)}</span>
        ${counts[view.id] ? `<span class="nav-count">${counts[view.id]}</span>` : ""}
      </button>
    `);
        navList.append(button);
    });
}
function renderProductsInSelects() {
    const productSelect = document.querySelector("#productSelect");
    const productionProduct = document.querySelector("#productionProduct");
    const orderForm = document.querySelector("#orderForm");
    const orderTypeSelect = document.querySelector("#orderTypeSelect");
    const orderTableSelect = document.querySelector("#orderTableSelect");
    const orderPaymentMethodSelect = document.querySelector("#orderPaymentMethod");
    const fulfillmentInput = document.querySelector("#orderFulfillment");
    const selectedOrderType = normalizeOrderType(orderForm?.elements.channel.value || "Dine-in");
    const orderType = orderTypeDefinition(selectedOrderType);
    const channel = orderType.value;
    if (orderTypeSelect) {
        orderTypeSelect.innerHTML = ORDER_TYPE_OPTIONS
            .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
            .join("");
        orderTypeSelect.value = channel;
    }
    if (orderTableSelect) {
        const selectedTable = orderTableSelect.value || state.tables[0]?.id || "";
        orderTableSelect.innerHTML = state.tables
            .map((table) => `<option value="${escapeHtml(table.id)}">${escapeHtml(table.name)} - ${table.capacity} seats - ${escapeHtml(table.zone)}</option>`)
            .join("");
        orderTableSelect.value = state.tables.some((table) => table.id === selectedTable) ? selectedTable : state.tables[0]?.id || "";
        orderTableSelect.disabled = !orderType.requiresTable;
    }
    if (fulfillmentInput)
        fulfillmentInput.value = orderType.fulfillment;
    if (orderPaymentMethodSelect) {
        const selectedPaymentMethod = normalizePaymentMethod(orderPaymentMethodSelect.value);
        orderPaymentMethodSelect.innerHTML = PAYMENT_METHOD_OPTIONS
            .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
            .join("");
        orderPaymentMethodSelect.value = selectedPaymentMethod;
    }
    const orderableProducts = getOrderableProducts(channel);
    const orderOptions = orderableProducts
        .map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} - ${escapeHtml(money(product.price))}</option>`)
        .join("");
    const productionProducts = getProductionProducts();
    const productionOptions = productionProducts
        .map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)}${product.batchOutput ? " - prepared batch" : ` - ${escapeHtml(money(product.price))}`}</option>`)
        .join("");
    const selectedProduct = productSelect?.value || orderableProducts[0]?.id;
    const selectedProductionProduct = getDefaultProductionProductId(productionProduct?.value);
    if (productSelect) {
        productSelect.innerHTML = orderOptions;
        productSelect.disabled = !orderableProducts.length || !can("canCreateOrders");
        productSelect.value = orderableProducts.some((product) => product.id === selectedProduct) ? selectedProduct : orderableProducts[0]?.id || "";
    }
    if (productionProduct) {
        productionProduct.innerHTML = productionOptions;
        productionProduct.value = getDefaultProductionProductId(selectedProductionProduct);
        productionProduct.disabled = !productionProducts.length || !can("canManageProcedures");
    }
    renderProductionRecipeFields();
}
function renderOrderBuilder() {
    const orderForm = document.querySelector("#orderForm");
    const productSelect = document.querySelector("#productSelect");
    const quantityInput = document.querySelector("#orderQuantity");
    const availabilityPanel = document.querySelector("#orderAvailability");
    const draftPanel = document.querySelector("#orderDraft");
    const addLineButton = document.querySelector("#addOrderLineBtn");
    const clearDraftButton = document.querySelector("#clearOrderDraftBtn");
    const sendOrderButton = document.querySelector("#sendOrderBtn");
    const saveOrderButton = document.querySelector("#saveOrderBtn");
    const modifierChecks = document.querySelector("#orderModifierChecks");
    const channel = normalizeOrderType(orderForm?.elements.channel.value || "Dine-in");
    const orderType = orderTypeDefinition(channel);
    if (orderForm?.elements.channel)
        orderForm.elements.channel.value = channel;
    if (orderForm?.elements.fulfillment)
        orderForm.elements.fulfillment.value = orderType.fulfillment;
    if (modifierChecks && !modifierChecks.children.length) {
        modifierChecks.innerHTML = LINE_MODIFIER_OPTIONS
            .map((modifier) => `
        <label class="modifier-chip">
          <input name="lineModifier" type="checkbox" value="${escapeHtml(modifier)}">
          <span>${escapeHtml(modifier)}</span>
        </label>
      `)
            .join("");
    }
    const orderContext = getCurrentOrderContext();
    state.orderDraft = normalizeOrderItems(state.orderDraft).filter((item) => productCanBeOrdered(productById(item.productId), channel));
    const product = productById(productSelect?.value);
    const requestedQuantity = Math.max(1, Math.floor(Number(quantityInput.value) || 1));
    const availability = getProductAvailability(product, state.orderDraft, orderContext);
    const canAddLine = Boolean(productCanBeOrdered(product, channel) && requestedQuantity <= availability.maxQuantity);
    const availabilityClass = availability.maxQuantity === 0 ? "danger" : requestedQuantity > availability.maxQuantity ? "warning" : "";
    const limiting = availability.limiting;
    const limitingText = limiting
        ? `${limiting.ingredient.name} limits this item; ${formatStockAmount(limiting.remaining, limiting.ingredient.unit)} left after basket.`
        : product
            ? `Route: ${orderType.fulfillment}. No stock rule is attached to this product.`
            : "No active sellable product is available for this channel.";
    availabilityPanel.className = `availability-card ${availabilityClass}`.trim();
    availabilityPanel.innerHTML = `
    <header>
      <strong>${escapeHtml(product?.name || "Select product")}</strong>
      <span class="pill ${availability.maxQuantity ? "ok" : "danger"}">${availability.maxQuantity} available</span>
    </header>
    <p>${escapeHtml(limiting ? `${limitingText} Route: ${orderType.fulfillment}.` : limitingText)}</p>
  `;
    const draftItems = state.orderDraft;
    const pendingItems = draftItems.length ? draftItems : product ? [{ productId: product.id, quantity: requestedQuantity }] : [];
    const shortages = getStockShortages(pendingItems, orderContext);
    const itemCount = getItemCount(pendingItems);
    const orderTotal = getItemsTotal(pendingItems);
    const selectedLineBlocked = !draftItems.length && (!productCanBeOrdered(product, channel) || requestedQuantity > availability.maxQuantity);
    addLineButton.disabled = !can("canCreateOrders") || !canAddLine;
    clearDraftButton.disabled = !draftItems.length;
    if (saveOrderButton)
        saveOrderButton.disabled = !can("canCreateOrders") || !itemCount || shortages.length > 0 || selectedLineBlocked;
    sendOrderButton.disabled = !can("canCreateOrders") || !itemCount || shortages.length > 0 || selectedLineBlocked;
    sendOrderButton.innerHTML = `<span aria-hidden="true">+</span>${itemCount > 1 ? `Send ${itemCount} Items` : "Send to Kitchen"} · ${escapeHtml(money(orderTotal))}`;
    if (!draftItems.length) {
        draftPanel.innerHTML = `<p class="draft-empty">Basket is empty.</p>`;
        return;
    }
    const shortageText = shortages.length
        ? `<p class="draft-empty">Missing ${escapeHtml(shortages.map((item) => formatStockAmount(item.shortage, item.ingredient.unit)).join(", "))} before this can be sent.</p>`
        : "";
    draftPanel.innerHTML = `
    <div class="draft-summary">
      <strong>Basket</strong>
      <span class="draft-meta">${getItemCount(draftItems)} items</span>
    </div>
    <div class="draft-lines">
      ${draftItems.map((item, index) => {
        const lineProduct = productById(item.productId);
        if (!lineProduct)
            return "";
        const lineDetails = [
            item.modifiers?.length ? `Modifiers: ${item.modifiers.join(", ")}` : "",
            item.note ? `Note: ${item.note}` : ""
        ].filter(Boolean).join(" · ");
        return `
          <div class="draft-line">
            <div>
              <strong>${item.quantity}x ${escapeHtml(lineProduct.name)}</strong>
              <p>${escapeHtml(lineProduct.station)} · ${escapeHtml(money(lineProduct.price * item.quantity))}</p>
              ${lineDetails ? `<p class="line-detail">${escapeHtml(lineDetails)}</p>` : ""}
            </div>
            <button class="mini-btn" type="button" data-remove-draft-index="${index}" aria-label="Remove ${escapeHtml(lineProduct.name)}">Remove</button>
          </div>
        `;
    }).join("")}
    </div>
    ${shortageText}
    <div class="draft-summary draft-total">
      <span>Total</span>
      <strong>${escapeHtml(money(getItemsTotal(draftItems)))}</strong>
    </div>
  `;
}
function getCustomerCartItems() {
    state.customerCart = normalizeOrderItems(state.customerCart || [])
        .filter((item) => productCanBeOrdered(productById(item.productId), CUSTOMER_QR_CHANNEL));
    return state.customerCart;
}
function getCustomerCartTotal() {
    return getItemsTotal(getCustomerCartItems());
}
function customerProductCard(product, cartItems) {
    const availability = getProductAvailability(product, cartItems, CUSTOMER_QR_ORDER_CONTEXT);
    const cartQuantity = cartItems
        .filter((item) => item.productId === product.id)
        .reduce((sum, item) => sum + item.quantity, 0);
    const disabled = availability.maxQuantity < 1;
    const stockLabel = disabled
        ? "Unavailable"
        : cartQuantity
            ? `${cartQuantity} in cart`
            : `${availability.maxQuantity} available`;
    const stockClass = disabled ? "danger" : cartQuantity ? "info" : "ok";
    return `
    <article class="customer-product-card">
      <div>
        <span class="customer-product-kicker">${escapeHtml(product.category)}</span>
        <strong>${escapeHtml(product.name)}</strong>
        <p>${escapeHtml(product.station)} · ${escapeHtml(money(product.price))}</p>
      </div>
      <div class="customer-product-actions">
        <span class="pill ${stockClass}">${escapeHtml(stockLabel)}</span>
        <button class="icon-btn customer-add-btn" type="button" data-customer-add="${escapeHtml(product.id)}" aria-label="Add ${escapeHtml(product.name)}" ${disabled ? "disabled" : ""}>+</button>
      </div>
    </article>
  `;
}
function customerCartLine(item, index) {
    const product = productById(item.productId);
    if (!product)
        return "";
    return `
    <div class="customer-cart-line">
      <div>
        <strong>${item.quantity}x ${escapeHtml(product.name)}</strong>
        <span>${escapeHtml(money(product.price * item.quantity))}</span>
      </div>
      <div class="customer-quantity-controls">
        <button class="mini-btn" type="button" data-customer-decrease="${index}" aria-label="Decrease ${escapeHtml(product.name)}">-</button>
        <button class="mini-btn" type="button" data-customer-increase="${index}" aria-label="Increase ${escapeHtml(product.name)}">+</button>
        <button class="mini-btn danger-action" type="button" data-customer-remove="${index}">Remove</button>
      </div>
    </div>
  `;
}
function customerCartHtml(cartItems) {
    const total = getItemsTotal(cartItems);
    const itemCount = getItemCount(cartItems);
    const shortages = getStockShortages(cartItems, CUSTOMER_QR_ORDER_CONTEXT);
    const blocked = !cartItems.length || shortages.length > 0;
    const shortageText = shortages.length
        ? `<p class="customer-cart-note">Missing ${escapeHtml(shortages.map((item) => `${formatStockAmount(item.shortage, item.ingredient.unit)} ${item.ingredient.name}`).join(", "))}.</p>`
        : "";
    return `
    <form id="customerOrderForm" class="customer-cart-panel">
      <div class="panel-header compact">
        <div>
          <p class="eyebrow">Cart</p>
          <h2>${itemCount ? `${itemCount} item${itemCount === 1 ? "" : "s"}` : "Your order"}</h2>
        </div>
      </div>
      <div class="customer-cart-lines">
        ${cartItems.length ? cartItems.map(customerCartLine).join("") : emptyState("Choose items from the menu.")}
      </div>
      ${shortageText}
      <label>
        Notes
        <textarea name="notes" rows="3" placeholder="Allergy, no onion, extra sauce"></textarea>
      </label>
      <fieldset class="customer-payment-options">
        <legend>Payment</legend>
        <label class="check-row">
          <input name="paymentOption" type="radio" value="online" checked>
          <span>Pay online now</span>
        </label>
        <label class="check-row">
          <input name="paymentOption" type="radio" value="later">
          <span>Order now, pay later</span>
        </label>
      </fieldset>
      <div class="customer-cart-total">
        <span>Total</span>
        <strong>${escapeHtml(money(total))}</strong>
      </div>
      <button class="primary-btn" type="submit" ${blocked ? "disabled" : ""}>Place Order · ${escapeHtml(money(total))}</button>
    </form>
  `;
}
function renderCustomerQrScreen() {
    const screen = document.querySelector("#customerQrScreen");
    const session = getCustomerQrSession();
    if (!screen || !session)
        return;
    if (session.error) {
        screen.innerHTML = `
      <main class="customer-shell customer-error-shell">
        <section class="customer-error-card">
          <div class="brand">
            <span class="brand-mark" aria-hidden="true">L</span>
            <div>
              <strong>Libabite</strong>
              <span>QR ordering</span>
            </div>
          </div>
          <h1>QR ordering unavailable</h1>
          <p>${escapeHtml(session.error)}</p>
          <a class="ghost-btn" href="${escapeHtml(getStaffUrl())}">Staff Login</a>
        </section>
      </main>
    `;
        return;
    }
    const table = session.table;
    const code = session.code;
    const cartItems = getCustomerCartItems();
    const products = getOrderableProducts(CUSTOMER_QR_CHANNEL);
    const productsByCategory = PRODUCT_CATEGORIES
        .map((category) => ({
        category,
        products: products.filter((product) => product.category === category)
    }))
        .filter((group) => group.products.length);
    const lastOrder = orderById(state.customerLastOrderId);
    const confirmation = lastOrder ? `
    <section class="customer-confirmation">
      <div>
        <p class="eyebrow">Sent to kitchen</p>
        <h2>Order #${escapeHtml(lastOrder.number)} received</h2>
        <p>${escapeHtml(orderLocationLabel(lastOrder))} · ${escapeHtml(getOrderPaymentSummary(lastOrder).statusLabel)} · ${escapeHtml(money(getOrderTotal(lastOrder)))}</p>
      </div>
      <button class="ghost-btn" type="button" data-customer-new-order>New Order</button>
    </section>
  ` : "";
    screen.innerHTML = `
    <header class="customer-topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">L</span>
        <div>
          <strong>${escapeHtml(state.restaurantSettings.restaurantName)}</strong>
          <span>${escapeHtml(state.restaurantSettings.location)}</span>
        </div>
      </div>
      <div class="customer-table-badge">
        <span>${escapeHtml(code.area || table.zone)}</span>
        <strong>${escapeHtml(table.name)}</strong>
      </div>
    </header>
    <main class="customer-shell">
      ${confirmation}
      <section class="customer-menu-panel">
        <div class="panel-header compact">
          <div>
            <p class="eyebrow">Menu</p>
            <h1>${escapeHtml(table.name)} ordering</h1>
          </div>
        </div>
        <div class="customer-menu-groups">
          ${productsByCategory.length ? productsByCategory.map((group) => `
            <section class="customer-menu-group">
              <h2>${escapeHtml(group.category)}</h2>
              <div class="customer-product-grid">
                ${group.products.map((product) => customerProductCard(product, cartItems)).join("")}
              </div>
            </section>
          `).join("") : emptyState("No QR menu items are active.")}
        </div>
      </section>
      ${customerCartHtml(cartItems)}
    </main>
  `;
}
function renderMetrics() {
    const revenue = state.orders.reduce((sum, order) => sum + getOrderTotal(order), 0);
    const activeDrivers = state.drivers.filter((driver) => driver.status !== "Available").length;
    const kitchenSla = getKitchenSlaSummary();
    const metrics = [
        { label: "Today orders", value: state.orders.length, note: "Across POS, QR, web, phone" },
        { label: "Kitchen tickets", value: getOpenTickets().length, note: getSlaSummaryLabel(kitchenSla) },
        { label: "Revenue", value: money(revenue), note: "Demo day total" },
        { label: "Low stock", value: getLowStockIngredients().length, note: `${activeDrivers} driver on route` }
    ];
    document.querySelector("#metricGrid").innerHTML = metrics
        .map((metric) => `
      <article class="metric">
        <span>${escapeHtml(metric.label)}</span>
        <strong>${escapeHtml(metric.value)}</strong>
        <small>${escapeHtml(metric.note)}</small>
      </article>
    `)
        .join("");
}
function renderDashboard() {
    renderKeftaLoopProof();
    const recentOrders = state.orders.slice(-4).reverse();
    document.querySelector("#dashboardOrderStream").innerHTML = recentOrders.length
        ? recentOrders.map(orderCard).join("")
        : emptyState("No orders yet.");
    const stationStats = getStationNames().filter((station) => station !== "All").map((station) => {
        const stationTickets = state.tickets.filter((ticket) => ticket.station === station);
        const openTickets = stationTickets.filter((ticket) => ticket.status !== "Done");
        const open = openTickets.length;
        const slaSummary = getKitchenSlaSummary(openTickets);
        const load = Math.min(100, open * 34);
        const stationState = slaSummary.delayed || slaSummary.escalated ? "sla-escalated" : slaSummary.warning ? "sla-warning" : "";
        const pillClass = slaSummary.delayed || slaSummary.escalated ? "danger" : slaSummary.warning ? "warning" : open ? "info" : "ok";
        const pillText = slaSummary.delayed
            ? `${slaSummary.delayed} delayed`
            : slaSummary.escalated
                ? `${slaSummary.escalated} late`
                : slaSummary.warning
                    ? `${slaSummary.warning} warn`
                    : `${open} open`;
        return `
      <article class="station-card ${stationState}">
        <div class="card-title">
          <strong>${escapeHtml(station)}</strong>
          <span class="pill ${pillClass}">${escapeHtml(pillText)}</span>
        </div>
        <div class="progress-track"><div class="progress-bar" style="--value: ${load}%"></div></div>
      </article>
    `;
    });
    document.querySelector("#dashboardStations").innerHTML = stationStats.join("");
    const alerts = getLowStockIngredients();
    document.querySelector("#dashboardAlerts").innerHTML = alerts.length
        ? alerts.map(alertCard).join("")
        : emptyState("No reorder alerts.");
}
function getOrderQuantityForProduct(order, productId) {
    return normalizeOrderItems(order.items || [])
        .filter((item) => item.productId === productId)
        .reduce((sum, item) => sum + item.quantity, 0);
}
function getLatestOrderForProduct(productId) {
    return state.orders
        .slice()
        .reverse()
        .find((order) => getOrderQuantityForProduct(order, productId) > 0);
}
function renderKeftaLoopProof() {
    const container = document.querySelector("#keftaLoopProof");
    if (!container)
        return;
    const ingredient = ingredientById("kefta");
    const product = productById("kefta-plate");
    if (!ingredient || !product) {
        container.innerHTML = emptyState("Kefta loop is waiting for setup.");
        return;
    }
    const demoQuantity = 10;
    const orderContext = DEFAULT_RECIPE_ORDER_CONTEXT;
    const demoUsage = normalizeStockQuantity(getStockRequirementsForItems([{ productId: product.id, quantity: demoQuantity }], orderContext).get(ingredient.id) || 0);
    const latestOrder = getLatestOrderForProduct(product.id);
    const latestQuantity = latestOrder ? getOrderQuantityForProduct(latestOrder, product.id) : 0;
    const latestUsage = latestOrder
        ? normalizeStockQuantity(getStockRequirementsForItems(latestOrder.items, {
            channel: latestOrder.channel,
            fulfillment: latestOrder.fulfillment
        }).get(ingredient.id) || 0)
        : 0;
    const previousStock = latestOrder ? normalizeStockQuantity(ingredient.stock + latestUsage) : ingredient.stock;
    const projectedStock = normalizeStockQuantity(ingredient.stock - demoUsage);
    const recipeLine = product.recipe.find((line) => line.ingredientId === ingredient.id);
    const marginProfile = getProductMarginProfile(product);
    const stockStatus = getIngredientStatus(ingredient);
    const stockClass = stockStatus === "danger" ? "danger" : stockStatus === "warning" ? "warning" : "ok";
    const stockLabel = stockStatus === "danger" ? "Low stock" : stockStatus === "warning" ? "Watch" : "Healthy";
    const proofText = latestOrder
        ? `Order #${latestOrder.number}: ${latestQuantity} Kefta Plates used ${formatStockAmount(latestUsage, ingredient.unit)}.`
        : `${demoQuantity} Kefta Plates use ${formatStockAmount(demoUsage, ingredient.unit)}.`;
    const stockTrail = latestOrder
        ? `${formatStockAmount(previousStock, ingredient.unit)} -> ${formatStockAmount(ingredient.stock, ingredient.unit)}`
        : `${formatStockAmount(ingredient.stock, ingredient.unit)} -> ${formatStockAmount(projectedStock, ingredient.unit)}`;
    container.className = `phase-loop-card ${stockClass === "danger" ? "danger" : ""}`;
    container.innerHTML = `
    <header>
      <div>
        <p class="eyebrow">Phase 5 test product</p>
        <h3>Kefta Plate loop</h3>
      </div>
      <div class="ticket-pills">
        <span class="pill ${stockClass}">${escapeHtml(stockLabel)}</span>
        <span class="pill ${marginProfile.className}">${marginProfile.margin.toFixed(1)}% margin</span>
      </div>
    </header>
    <p>${escapeHtml(proofText)}</p>
    <div class="phase-loop-grid">
      <div class="phase-loop-metric">
        <span>Purchased product</span>
        <strong>${escapeHtml(ingredient.name)}</strong>
        <small>${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))} in ${escapeHtml(ingredient.location)}</small>
      </div>
      <div class="phase-loop-metric">
        <span>Recipe</span>
        <strong>${escapeHtml(recipeLine ? getRecipeUsageLabel(recipeLine) : "No recipe")}</strong>
        <small>per Kefta Plate</small>
      </div>
      <div class="phase-loop-metric">
        <span>10-plate stock move</span>
        <strong>${escapeHtml(formatStockAmount(demoUsage, ingredient.unit))}</strong>
        <small>${escapeHtml(stockTrail)}</small>
      </div>
      <div class="phase-loop-metric">
        <span>Cost and margin</span>
        <strong>${escapeHtml(money(getProductCost(product, orderContext)))}</strong>
        <small>${marginProfile.baseMargin.toFixed(1)}% at ${escapeHtml(money(product.price))}</small>
      </div>
    </div>
  `;
}
function orderStatusClass(status) {
    if (status === "Paid" || status === "Served")
        return "ok";
    if (status === "Cancelled" || status === "Delayed")
        return "danger";
    if (status === "New")
        return "warning";
    return "info";
}
function orderTypeLabel(order) {
    return orderTypeDefinition(order.orderType || order.channel).label;
}
function orderLocationLabel(order) {
    const table = tableById(order.tableId);
    if (table)
        return table.name;
    return order.customer || "Walk-in";
}
function userNameById(userId) {
    return state.users.find((user) => user.id === userId)?.name || "";
}
function getOrderStaffName(order) {
    return userNameById(order.staffId) || order.staffName || "Staff";
}
function getOrderPaidByName(order) {
    return userNameById(order.paidByUserId) || order.paidByName || getOrderStaffName(order);
}
function isOrderPaid(order) {
    return order.paymentStatus === "Paid" || isPaidPaymentMethod(order.paymentMethod);
}
function getOrderPaymentSummary(order) {
    const paid = isOrderPaid(order);
    const paymentMethod = normalizePaymentMethod(order.paymentMethod, order.paymentStatus);
    return {
        paid,
        method: paid ? paymentMethod : UNPAID_PAYMENT_METHOD,
        statusLabel: paid ? "Paid" : "Unpaid",
        className: paid ? "ok" : "warning"
    };
}
function paymentMethodOptionsHtml(selectedMethod = DEFAULT_PAID_PAYMENT_METHOD, paidOnly = false) {
    const options = paidOnly ? PAYMENT_METHOD_OPTIONS.filter((option) => option.paid) : PAYMENT_METHOD_OPTIONS;
    const normalizedMethod = normalizePaymentMethod(selectedMethod);
    const selected = paidOnly && !isPaidPaymentMethod(normalizedMethod) ? DEFAULT_PAID_PAYMENT_METHOD : normalizedMethod;
    return options
        .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
        .join("");
}
function paymentCaptureHtml(order) {
    return `
    <span class="payment-capture">
      <select class="mini-select" data-payment-method-select="${escapeHtml(order.id)}" aria-label="Payment method for order #${escapeHtml(order.number)}">
        ${paymentMethodOptionsHtml(order.paymentMethod, true)}
      </select>
      <button class="mini-btn" type="button" data-mark-paid="${escapeHtml(order.id)}">Mark Paid</button>
    </span>
  `;
}
function getSelectedPaymentMethodFromAction(action) {
    const select = action.closest(".payment-capture")?.querySelector("[data-payment-method-select]");
    return normalizePaymentMethod(select?.value || DEFAULT_PAID_PAYMENT_METHOD);
}
function orderItemDetailText(item) {
    const details = [
        item.modifiers?.length ? item.modifiers.join(", ") : "",
        item.note || ""
    ].filter(Boolean);
    return details.join(" · ");
}
function orderCard(order) {
    const productLines = order.items.map((item) => {
        const product = productById(item.productId);
        if (!product)
            return null;
        const detail = orderItemDetailText(item);
        return `${item.quantity}x ${product.name}${detail ? ` (${detail})` : ""}`;
    }).filter(Boolean).join(", ");
    const statusClass = orderStatusClass(order.status);
    const paymentSummary = getOrderPaymentSummary(order);
    const canFrontUpdate = can("canCreateOrders") && order.status !== "Paid" && order.status !== "Cancelled";
    const canKitchenUpdate = can("canAdvanceTickets") && ["Sent to kitchen", "Preparing", "Delayed"].includes(order.status);
    const kitchenSummary = getOrderProgressSummary(order);
    return `
    <article class="order-card">
      <div>
        <div class="card-title">
          <strong>#${order.number} ${escapeHtml(productLines)}</strong>
          <span class="pill ${statusClass}">${escapeHtml(order.status)}</span>
          <span class="pill ${paymentSummary.className}">${escapeHtml(paymentSummary.statusLabel)}</span>
        </div>
        <div class="meta-line">
          <span>${escapeHtml(orderTypeLabel(order))}</span>
          <span>${escapeHtml(orderLocationLabel(order))}</span>
          <span>${escapeHtml(order.fulfillment)}</span>
          <span>${escapeHtml(money(getOrderTotal(order)))}</span>
          <span>Payment: ${escapeHtml(paymentSummary.method)}</span>
          <span>Staff: ${escapeHtml(getOrderStaffName(order))}</span>
        </div>
        ${kitchenSummary.total ? `
          <div class="order-progress-mini">
            <div class="progress-track"><div class="progress-bar" style="--value: ${kitchenSummary.percent}%"></div></div>
            <span>${kitchenSummary.finished}/${kitchenSummary.total} kitchen tasks ready</span>
          </div>
        ` : ""}
      </div>
      <div class="mini-actions">
        ${order.status === "New" && canFrontUpdate ? `<button class="mini-btn" type="button" data-send-kitchen="${escapeHtml(order.id)}">Send</button>` : ""}
        ${canKitchenUpdate ? `<button class="mini-btn" type="button" data-next-order="${escapeHtml(order.id)}">Next</button>` : ""}
        ${order.status === "Ready" && canFrontUpdate ? `<button class="mini-btn" type="button" data-mark-served="${escapeHtml(order.id)}">Served</button>` : ""}
        ${!paymentSummary.paid && canFrontUpdate ? paymentCaptureHtml(order) : ""}
        ${order.status === "New" && canFrontUpdate ? `<button class="mini-btn danger-action" type="button" data-cancel-order="${escapeHtml(order.id)}">Cancel</button>` : ""}
        <button class="mini-btn" type="button" data-show-receipt="${escapeHtml(order.id)}">Receipt</button>
        <button class="mini-btn" type="button" data-print-receipt="${escapeHtml(order.id)}">Print</button>
      </div>
    </article>
  `;
}
function alertCard(ingredient) {
    const reorderQuantity = getSupplierOrderQuantity(ingredient);
    const cls = ingredient.stock <= ingredient.min ? "danger" : "";
    const activeSupplierOrder = getActiveSupplierOrder(ingredient.supplier);
    const isAwaitingReceipt = activeSupplierOrder?.status === "Ordered"
        && activeSupplierOrder.items.some((item) => item.ingredientId === ingredient.id);
    const supplierText = isAwaitingReceipt
        ? `Ordered from ${ingredient.supplier}; waiting to receive ${formatStockAmount(reorderQuantity, ingredient.unit)}.`
        : `Suggested reorder ${formatStockAmount(reorderQuantity, ingredient.unit)} from ${ingredient.supplier}.`;
    return `
    <article class="alert-card ${cls}">
      <div class="card-title">
        <strong>${escapeHtml(ingredient.name)}</strong>
        <span class="pill danger">${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))}</span>
      </div>
      <p>At or below ${ingredient.min} ${escapeHtml(ingredient.unit)}. ${escapeHtml(supplierText)}</p>
    </article>
  `;
}
function renderOrders() {
    const filtered = state.orderFilter === "All"
        ? state.orders
        : state.orderFilter === "Dine-in"
            ? state.orders.filter((order) => orderTypeDefinition(order.channel).requiresTable)
            : state.orderFilter === "Kitchen"
                ? state.orders.filter((order) => ["Sent to kitchen", "Preparing", "Delayed", "Ready"].includes(order.status))
                : state.orderFilter === "Paid"
                    ? state.orders.filter((order) => isOrderPaid(order))
                    : state.orderFilter === "Unpaid"
                        ? state.orders.filter((order) => !isOrderPaid(order) && order.status !== "Cancelled")
                        : state.orders.filter((order) => order.fulfillment === state.orderFilter);
    document.querySelector("#orderList").innerHTML = filtered.length
        ? filtered.slice().reverse().map(orderCard).join("")
        : emptyState("No orders match this filter.");
    document.querySelectorAll("[data-order-filter]").forEach((button) => {
        button.classList.toggle("is-selected", button.dataset.orderFilter === state.orderFilter);
    });
    renderReceipt();
}
function receiptLineHtml(item) {
    const product = productById(item.productId);
    if (!product)
        return "";
    const detail = orderItemDetailText(item);
    return `
    <div class="receipt-line">
      <div>
        <strong>${escapeHtml(product.name)}</strong>
        <span>Qty ${item.quantity} x ${escapeHtml(money(product.price))}</span>
        ${detail ? `<span>${escapeHtml(detail)}</span>` : ""}
      </div>
      <span>${escapeHtml(money(product.price * item.quantity))}</span>
    </div>
  `;
}
function renderReceipt() {
    const container = document.querySelector("#receiptPreview");
    if (!container)
        return;
    const order = orderById(state.receiptOrderId) || state.orders[state.orders.length - 1];
    if (!order) {
        container.innerHTML = emptyState("Select an order to show a receipt.");
        return;
    }
    const settings = state.restaurantSettings;
    const paymentSummary = getOrderPaymentSummary(order);
    const vatBreakdown = getOrderVatBreakdown(order);
    state.receiptOrderId = order.id;
    container.innerHTML = `
    <article class="receipt-card">
      <header>
        <div>
          <strong>${escapeHtml(settings.restaurantName)}</strong>
          <span>${escapeHtml(settings.location)}</span>
        </div>
        <div class="ticket-pills">
          <span class="pill ${orderStatusClass(order.status)}">${escapeHtml(order.status)}</span>
          <span class="pill ${paymentSummary.className}">${escapeHtml(paymentSummary.statusLabel)}</span>
        </div>
      </header>
      <div class="receipt-meta">
        <span>Order #${escapeHtml(order.number)}</span>
        <span>${escapeHtml(formatDateTime(order.createdAtMs, order.createdAt))}</span>
        <span>${escapeHtml(orderTypeLabel(order))}</span>
        <span>${escapeHtml(orderLocationLabel(order))}</span>
        <span>Staff: ${escapeHtml(getOrderStaffName(order))}</span>
      </div>
      <div class="receipt-lines">
        ${order.items.map(receiptLineHtml).join("")}
      </div>
      ${order.notes ? `<p class="receipt-note">Order note: ${escapeHtml(order.notes)}</p>` : ""}
      <div class="receipt-totals">
        <div class="receipt-total receipt-subtotal">
          <span>Subtotal excl. VAT</span>
          <strong>${escapeHtml(money(getOrderSubtotalExcludingVat(order)))}</strong>
        </div>
        ${vatBreakdown.map((row) => `
          <div class="receipt-total receipt-tax">
            <span>${escapeHtml(getVatLabel(row.vatSetting))} (${Math.round(row.rate * 100)}%)</span>
            <strong>${escapeHtml(money(row.tax))}</strong>
          </div>
        `).join("")}
        <div class="receipt-total">
          <span>Total</span>
          <strong>${escapeHtml(money(getOrderTotal(order)))}</strong>
        </div>
      </div>
      <div class="receipt-meta">
        <span>Payment method: ${escapeHtml(paymentSummary.method)}</span>
        ${paymentSummary.paid && order.paidAt ? `<span>Paid ${escapeHtml(formatDateTime(order.paidAtMs, order.paidAt))}</span>` : ""}
        ${paymentSummary.paid ? `<span>Paid by: ${escapeHtml(getOrderPaidByName(order))}</span>` : ""}
      </div>
      <div class="mini-actions receipt-actions">
        ${can("canCreateOrders") && !paymentSummary.paid && order.status !== "Cancelled" ? paymentCaptureHtml(order) : ""}
        <button class="mini-btn" type="button" data-print-receipt="${escapeHtml(order.id)}">Print Receipt</button>
      </div>
    </article>
  `;
}
function renderKitchen() {
    const tabs = document.querySelector("#stationTabs");
    const stationSummary = document.querySelector("#kitchenStationSummary");
    const activeStation = getStationNames().includes(state.activeStation) ? state.activeStation : "All";
    state.activeStation = activeStation;
    tabs.innerHTML = getStationNames()
        .map((station) => {
        const count = station === "All"
            ? getOpenTickets().length
            : getOpenTickets().filter((ticket) => ticket.station === station).length;
        return `
        <button type="button" class="${state.activeStation === station ? "is-selected" : ""}" data-station="${escapeHtml(station)}">
          ${escapeHtml(station)}
          ${count ? `<span class="tab-count">${count}</span>` : ""}
        </button>
      `;
    })
        .join("");
    const tickets = state.activeStation === "All"
        ? getOpenTickets()
        : getOpenTickets().filter((ticket) => ticket.station === state.activeStation);
    const sortedTickets = sortKitchenTickets(tickets);
    if (stationSummary) {
        stationSummary.innerHTML = kitchenStationSummaryCards(tickets, state.activeStation);
    }
    document.querySelector("#ticketBoard").innerHTML = tickets.length
        ? sortedTickets.map(ticketCard).join("")
        : emptyState("This screen is clear.");
    renderKitchenOrderProgress();
}
function sortKitchenTickets(tickets) {
    const statusRank = {
        Delayed: 0,
        Queued: 1,
        Accepted: 2,
        Preparing: 3,
        Ready: 4,
        Done: 5
    };
    return tickets.slice().sort((first, second) => {
        const priorityRank = getTicketPriority(first).label === "Urgent" ? 0 : getTicketPriority(first).label === "High" ? 1 : 2;
        const nextPriorityRank = getTicketPriority(second).label === "Urgent" ? 0 : getTicketPriority(second).label === "High" ? 1 : 2;
        return priorityRank - nextPriorityRank
            || (statusRank[first.status] ?? 9) - (statusRank[second.status] ?? 9)
            || first.createdAtMs - second.createdAtMs;
    });
}
function kitchenStationSummaryCards(tickets, station) {
    const stationLabel = station === "All" ? "All stations" : station;
    const counts = tickets.reduce((summary, ticket) => {
        summary[ticket.status] = (summary[ticket.status] || 0) + 1;
        return summary;
    }, {});
    const ready = (counts.Ready || 0);
    const active = (counts.Accepted || 0) + (counts.Preparing || 0) + (counts.Delayed || 0);
    const newCount = counts.Queued || 0;
    return [
        { label: "Screen", value: stationLabel, note: `${tickets.length} open station ${tickets.length === 1 ? "task" : "tasks"}`, className: "info" },
        { label: "New orders", value: newCount, note: "Waiting for accept", className: newCount ? "warning" : "ok" },
        { label: "Active", value: active, note: `${counts.Delayed || 0} delayed`, className: counts.Delayed ? "danger" : active ? "info" : "ok" },
        { label: "Ready", value: ready, note: "Awaiting completion", className: ready ? "ok" : "info" }
    ].map((card) => `
    <article class="kds-summary-card">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <small class="${escapeHtml(card.className)}">${escapeHtml(card.note)}</small>
    </article>
  `).join("");
}
function ticketActionButtons(ticket) {
    if (!can("canAdvanceTickets"))
        return "";
    const done = ticket.status === "Done";
    const ready = ticket.status === "Ready";
    return `
    <div class="mini-actions kds-actions">
      ${ticket.status === "Queued" ? `<button class="mini-btn" type="button" data-ticket-id="${escapeHtml(ticket.id)}" data-ticket-status="Accepted">Accept order</button>` : ""}
      ${!["Preparing", "Ready", "Done"].includes(ticket.status) ? `<button class="mini-btn" type="button" data-ticket-id="${escapeHtml(ticket.id)}" data-ticket-status="Preparing">Preparing</button>` : ""}
      ${!ready && !done ? `<button class="mini-btn" type="button" data-ticket-id="${escapeHtml(ticket.id)}" data-ticket-status="Ready">Ready</button>` : ""}
      ${!["Delayed", "Ready", "Done"].includes(ticket.status) ? `<button class="mini-btn danger-action" type="button" data-delay-ticket="${escapeHtml(ticket.id)}">Delayed</button>` : ""}
      ${!done ? `<button class="mini-btn" type="button" data-issue-ticket="${escapeHtml(ticket.id)}">Issue note</button>` : ""}
      ${ready ? `<button class="mini-btn" type="button" data-ticket-id="${escapeHtml(ticket.id)}" data-ticket-status="Done">Complete task</button>` : ""}
    </div>
  `;
}
function ticketCard(ticket) {
    const product = productById(ticket.productId);
    const order = orderById(ticket.orderId);
    const sla = getTicketSla(ticket);
    const priority = getTicketPriority(ticket);
    const statusClass = ticketStatusClass(ticket.status);
    const orderAge = getTicketOrderAgeMinutes(ticket);
    const orderLabel = order ? `#${order.number} ${orderLocationLabel(order)}` : ticket.orderId;
    const notes = ticket.notes || "No notes or modifiers";
    return `
    <article class="ticket-card ${sla.cardClass} status-${escapeHtml(slugify(ticket.status))}">
      <header>
        <div>
          <span class="ticket-kicker">${escapeHtml(ticket.station)}</span>
          <strong>${escapeHtml(orderLabel)}</strong>
          <p>${ticket.quantity}x ${escapeHtml(product?.name || "Unknown item")}</p>
        </div>
        <div class="ticket-pills">
          <span class="pill ${statusClass}">${escapeHtml(getTicketStatusLabel(ticket.status))}</span>
          <span class="pill ${priority.className}">${escapeHtml(priority.label)}</span>
          <span class="pill ${sla.pillClass}">${escapeHtml(sla.label)}</span>
        </div>
      </header>
      <div class="ticket-notes">
        <span>Notes/modifiers</span>
        <p>${escapeHtml(notes)}</p>
      </div>
      ${ticket.issueNote ? `
        <div class="ticket-issue">
          <span>Issue</span>
          <p>${escapeHtml(ticket.issueNote)}</p>
        </div>
      ` : ""}
      <div class="ticket-timing">
        <div class="meta-line">
          <span>Placed ${escapeHtml(formatDuration(orderAge))} ago</span>
          <span>Kitchen ${escapeHtml(formatDuration(sla.ageMinutes))}</span>
          <span>Target ${sla.targetMinutes}m</span>
          <span>${escapeHtml(sla.detail)}</span>
        </div>
        <div class="sla-meter ${sla.state}" aria-label="${escapeHtml(`${sla.label}: age ${formatDuration(sla.ageMinutes)} of ${sla.targetMinutes} minutes`)}">
          <div class="progress-bar" style="--value: ${sla.progress}%"></div>
        </div>
      </div>
      ${ticketActionButtons(ticket)}
    </article>
  `;
}
function getOrderProgressSummary(order) {
    const tickets = state.tickets.filter((ticket) => ticket.orderId === order.id);
    const finished = tickets.filter((ticket) => ticket.status === "Ready" || ticket.status === "Done").length;
    const completed = tickets.filter((ticket) => ticket.status === "Done").length;
    const delayed = tickets.filter((ticket) => ticket.status === "Delayed").length;
    const preparing = tickets.filter((ticket) => ticket.status === "Preparing").length;
    const accepted = tickets.filter((ticket) => ticket.status === "Accepted").length;
    const total = tickets.length;
    const percent = total ? Math.round((finished / total) * 100) : 0;
    let status = order.status;
    if (delayed)
        status = "Delayed";
    else if (total && completed === total)
        status = "Complete";
    else if (total && finished === total)
        status = "Ready";
    else if (preparing)
        status = "Preparing";
    else if (accepted)
        status = "Accepted";
    else if (finished)
        status = "In progress";
    else if (total)
        status = "New";
    const className = status === "Delayed" ? "danger" : status === "Ready" || status === "Complete" ? "ok" : status === "New" ? "warning" : "info";
    return { tickets, finished, completed, delayed, preparing, accepted, total, percent, status, className };
}
function getStationProgressRows(order) {
    const tickets = state.tickets.filter((ticket) => ticket.orderId === order.id);
    const byStation = new Map();
    tickets.forEach((ticket) => {
        const rows = byStation.get(ticket.station) || [];
        rows.push(ticket);
        byStation.set(ticket.station, rows);
    });
    return [...byStation.entries()].map(([station, stationTickets]) => {
        const summary = getKitchenSlaSummary(stationTickets.filter((ticket) => ticket.status !== "Done"));
        const ready = stationTickets.filter((ticket) => ticket.status === "Ready" || ticket.status === "Done").length;
        const completed = stationTickets.filter((ticket) => ticket.status === "Done").length;
        const status = stationTickets.some((ticket) => ticket.status === "Delayed")
            ? "Delayed"
            : completed === stationTickets.length
                ? "Complete"
                : ready === stationTickets.length
                    ? "Ready"
                    : stationTickets.some((ticket) => ticket.status === "Preparing")
                        ? "Preparing"
                        : stationTickets.some((ticket) => ticket.status === "Accepted")
                            ? "Accepted"
                            : "New";
        const className = status === "Delayed" || summary.escalated ? "danger" : status === "Ready" || status === "Complete" ? "ok" : status === "New" ? "warning" : "info";
        return { station, status, className, ready, total: stationTickets.length };
    });
}
function orderProgressCard(order) {
    const summary = getOrderProgressSummary(order);
    const stationRows = getStationProgressRows(order);
    return `
    <article class="order-progress-card">
      <header>
        <div>
          <strong>#${order.number} ${escapeHtml(orderLocationLabel(order))}</strong>
          <p>${summary.finished}/${summary.total} station ${summary.total === 1 ? "task" : "tasks"} ready · ${escapeHtml(orderTypeLabel(order))}</p>
        </div>
        <span class="pill ${summary.className}">${escapeHtml(summary.status)}</span>
      </header>
      <div class="progress-track"><div class="progress-bar" style="--value: ${summary.percent}%"></div></div>
      <div class="station-progress-list">
        ${stationRows.map((row) => `
          <div class="station-progress-row">
            <span>${escapeHtml(row.station)}</span>
            <strong>${row.ready}/${row.total} · ${escapeHtml(row.status)}</strong>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}
function renderKitchenOrderProgress() {
    const container = document.querySelector("#kitchenOrderProgress");
    if (!container)
        return;
    const kitchenOrders = state.orders
        .filter((order) => ["Sent to kitchen", "Preparing", "Delayed", "Ready", "Served"].includes(order.status))
        .filter((order) => state.tickets.some((ticket) => ticket.orderId === order.id))
        .slice()
        .sort((first, second) => (second.createdAtMs || 0) - (first.createdAtMs || 0));
    container.innerHTML = kitchenOrders.length
        ? kitchenOrders.map(orderProgressCard).join("")
        : emptyState("No kitchen progress to show.");
}
function getRecipeMeasureOptionsForIngredient(ingredient) {
    const measure = unitTypeDefinition(ingredient?.unitType).recipeMeasure;
    if (measure === "grams")
        return [{ id: "grams", label: "grams" }];
    if (measure === "milliliters")
        return [{ id: "milliliters", label: "milliliters" }];
    return [{ id: "units", label: unitTypeDefinition(ingredient?.unitType).label }];
}
function buildRecipeLine(ingredientId, quantity, measureKey, station, wastePercent = 0, appliesTo = "all", notes = "") {
    const amount = Math.max(0, Number(quantity) || 0);
    const base = {
        ingredientId,
        wastePercent: normalizeRecipeWastePercent(wastePercent),
        station: normalizeKitchenStation(station || "Main kitchen"),
        appliesTo: normalizeRecipeAppliesTo(appliesTo),
        notes: String(notes || "").trim()
    };
    if (measureKey === "grams")
        return { ...base, grams: amount };
    if (measureKey === "milliliters")
        return { ...base, milliliters: amount };
    return { ...base, units: amount };
}
function renderProductManagement() {
    document.querySelectorAll(".admin-product-only").forEach((panel) => {
        panel.hidden = !can("canManageProducts");
    });
    renderSellableProductForm();
    renderPurchasedProductForm();
}
function renderSellableRecipeCostPreview() {
    const form = document.querySelector("#sellableProductForm");
    const summary = document.querySelector("#sellableRecipeSummary");
    if (!form || !summary)
        return;
    const price = Math.max(0, Number(form.elements.price.value) || 0);
    const targetMargin = normalizeMarginPercent(form.elements.targetMargin?.value, DEFAULT_MARGIN_TARGET);
    const minMargin = Math.min(targetMargin, normalizeMarginPercent(form.elements.minMargin?.value, DEFAULT_MARGIN_MINIMUM));
    const draftProduct = {
        price,
        targetMargin,
        minMargin,
        recipe: state.productRecipeDraft
    };
    const baseCost = getProductCost(draftProduct, DEFAULT_RECIPE_ORDER_CONTEXT);
    const takeawayCost = getProductCost(draftProduct, TAKEAWAY_DELIVERY_RECIPE_CONTEXT);
    const baseMargin = price ? getProductMargin(draftProduct, DEFAULT_RECIPE_ORDER_CONTEXT) : 0;
    const takeawayMargin = price ? getProductMargin(draftProduct, TAKEAWAY_DELIVERY_RECIPE_CONTEXT) : 0;
    const hasConditionalLines = productHasConditionalRecipeLines(draftProduct);
    const worstMargin = hasConditionalLines ? Math.min(baseMargin, takeawayMargin) : baseMargin;
    const pillClass = !price || !state.productRecipeDraft.length
        ? "info"
        : worstMargin < minMargin
            ? "danger"
            : worstMargin < targetMargin
                ? "warning"
                : "ok";
    const pillText = !price || !state.productRecipeDraft.length
        ? "Waiting"
        : worstMargin < minMargin
            ? "Below minimum"
            : worstMargin < targetMargin
                ? "Below target"
                : "On target";
    summary.innerHTML = `
    <div class="cost-preview-title">
      <strong>Recipe cost preview</strong>
      <span class="pill ${pillClass}">${escapeHtml(pillText)}</span>
    </div>
    <div class="cost-grid">
      <span>Base cost</span><strong>${escapeHtml(money(baseCost))}</strong>
      <span>Gross margin</span><strong>${escapeHtml(money(Math.max(0, price - baseCost)))}</strong>
      <span>Margin %</span><strong>${baseMargin.toFixed(1)}%</strong>
      ${hasConditionalLines ? `
        <span>Takeaway/delivery cost</span><strong>${escapeHtml(money(takeawayCost))}</strong>
        <span>Takeaway/delivery margin</span><strong>${takeawayMargin.toFixed(1)}%</strong>
      ` : ""}
    </div>
  `;
}
function renderSellableProductForm() {
    const form = document.querySelector("#sellableProductForm");
    const categorySelect = document.querySelector("#sellableCategory");
    const stationSelect = document.querySelector("#sellableStation");
    const vatSelect = document.querySelector("#sellableVat");
    const availabilityChecks = document.querySelector("#sellableAvailabilityChecks");
    const ingredientSelect = document.querySelector("#sellableRecipeIngredient");
    const measureSelect = document.querySelector("#sellableRecipeMeasure");
    const recipeStationSelect = document.querySelector("#sellableRecipeStation");
    const appliesSelect = document.querySelector("#sellableRecipeAppliesTo");
    const draftPanel = document.querySelector("#sellableRecipeDraft");
    const addRecipeButton = document.querySelector("#addRecipeLineBtn");
    const createButton = document.querySelector("#createSellableProductBtn");
    if (!form || !categorySelect || !stationSelect || !vatSelect || !availabilityChecks || !ingredientSelect || !measureSelect || !recipeStationSelect || !appliesSelect || !draftPanel || !addRecipeButton || !createButton)
        return;
    const editable = can("canManageProducts");
    const selectedCategory = categorySelect.value || PRODUCT_CATEGORIES[0];
    categorySelect.innerHTML = PRODUCT_CATEGORIES
        .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
        .join("");
    categorySelect.value = PRODUCT_CATEGORIES.includes(selectedCategory) ? selectedCategory : PRODUCT_CATEGORIES[0];
    const stations = [...new Set([...KITCHEN_STATIONS, ...state.products.map((product) => normalizeKitchenStation(product.station)).filter(Boolean)])];
    const selectedStation = normalizeKitchenStation(stationSelect.value || stations[0]);
    stationSelect.innerHTML = stations
        .map((station) => `<option value="${escapeHtml(station)}">${escapeHtml(station)}</option>`)
        .join("");
    stationSelect.value = stations.includes(selectedStation) ? selectedStation : stations[0];
    const selectedRecipeStation = normalizeKitchenStation(recipeStationSelect.value || stationSelect.value || stations[0]);
    recipeStationSelect.innerHTML = stations
        .map((station) => `<option value="${escapeHtml(station)}">${escapeHtml(station)}</option>`)
        .join("");
    recipeStationSelect.value = stations.includes(selectedRecipeStation) ? selectedRecipeStation : stationSelect.value || stations[0];
    const selectedVat = vatSelect.value || VAT_OPTIONS[0].id;
    vatSelect.innerHTML = VAT_OPTIONS
        .map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`)
        .join("");
    vatSelect.value = VAT_OPTIONS.some((option) => option.id === selectedVat) ? selectedVat : VAT_OPTIONS[0].id;
    const previousChecks = [...availabilityChecks.querySelectorAll("input[name='availability']:checked")].map((input) => input.value);
    const selectedAvailability = new Set(previousChecks.length ? previousChecks : AVAILABILITY_OPTIONS
        .filter((option) => DEFAULT_PRODUCT_AVAILABILITY[option.id])
        .map((option) => option.id));
    availabilityChecks.innerHTML = AVAILABILITY_OPTIONS
        .map((option) => `
      <label class="check-row">
        <input name="availability" type="checkbox" value="${escapeHtml(option.id)}" ${selectedAvailability.has(option.id) ? "checked" : ""}>
        <span>${escapeHtml(option.label)}</span>
      </label>
    `)
        .join("");
    const activeIngredients = state.ingredients.filter((ingredient) => ingredient.active);
    const selectedIngredient = ingredientSelect.value || activeIngredients[0]?.id || "";
    ingredientSelect.innerHTML = activeIngredients
        .map((ingredient) => `<option value="${escapeHtml(ingredient.id)}">${escapeHtml(ingredient.name)} - ${escapeHtml(ingredient.supplier)}</option>`)
        .join("");
    ingredientSelect.value = activeIngredients.some((ingredient) => ingredient.id === selectedIngredient) ? selectedIngredient : activeIngredients[0]?.id || "";
    const selectedIngredientRecord = ingredientById(ingredientSelect.value);
    const measureOptions = getRecipeMeasureOptionsForIngredient(selectedIngredientRecord);
    const selectedMeasure = measureSelect.value || measureOptions[0]?.id || "units";
    measureSelect.innerHTML = measureOptions
        .map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`)
        .join("");
    measureSelect.value = measureOptions.some((option) => option.id === selectedMeasure) ? selectedMeasure : measureOptions[0]?.id || "units";
    const selectedAppliesTo = appliesSelect.value || "all";
    appliesSelect.innerHTML = RECIPE_APPLIES_OPTIONS
        .map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`)
        .join("");
    appliesSelect.value = RECIPE_APPLIES_OPTIONS.some((option) => option.id === selectedAppliesTo) ? selectedAppliesTo : "all";
    draftPanel.innerHTML = state.productRecipeDraft.length
        ? `
      <div class="draft-summary">
        <strong>Recipe links</strong>
        <span class="draft-meta">${state.productRecipeDraft.length} lines</span>
      </div>
      <div class="draft-lines">
        ${state.productRecipeDraft.map((line, index) => {
            const ingredient = ingredientById(line.ingredientId);
            if (!ingredient)
                return "";
            return `
            <div class="draft-line">
              <div>
                <strong>${escapeHtml(ingredient.name)}</strong>
                <p>${escapeHtml(getRecipeUsageLabel(line))} · ${escapeHtml(money(getLineCost(line)))} cost</p>
                <p class="line-detail">${escapeHtml(line.station || "Main kitchen")} · ${escapeHtml(RECIPE_APPLIES_OPTIONS.find((option) => option.id === line.appliesTo)?.label || "Every order")}${line.notes ? ` · ${escapeHtml(line.notes)}` : ""}</p>
              </div>
              <button class="mini-btn" type="button" data-remove-recipe-line="${index}" aria-label="Remove ${escapeHtml(ingredient.name)}">Remove</button>
            </div>
          `;
        }).join("")}
      </div>
    `
        : `<p class="draft-empty">No purchased products linked yet.</p>`;
    form.querySelectorAll("input, select, button").forEach((element) => {
        element.disabled = !editable;
    });
    ingredientSelect.disabled = !editable || !activeIngredients.length;
    measureSelect.disabled = !editable || !activeIngredients.length;
    recipeStationSelect.disabled = !editable || !activeIngredients.length;
    appliesSelect.disabled = !editable || !activeIngredients.length;
    addRecipeButton.disabled = !editable || !activeIngredients.length;
    createButton.disabled = !editable || !state.productRecipeDraft.length;
    renderSellableRecipeCostPreview();
}
function renderPurchasedProductForm() {
    const form = document.querySelector("#purchasedProductForm");
    const unitSelect = document.querySelector("#purchasedUnitType");
    const locationSelect = document.querySelector("#purchasedLocation");
    if (!form || !unitSelect || !locationSelect)
        return;
    const selectedUnit = unitSelect.value || "kilograms";
    unitSelect.innerHTML = UNIT_TYPES
        .map((unitType) => `<option value="${escapeHtml(unitType.id)}">${escapeHtml(unitType.label)}</option>`)
        .join("");
    unitSelect.value = UNIT_TYPES.some((unitType) => unitType.id === selectedUnit) ? selectedUnit : "kilograms";
    const selectedLocation = locationSelect.value || "Fridge";
    const locations = getAllInventoryLocations();
    locationSelect.innerHTML = locations
        .map((location) => `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`)
        .join("");
    locationSelect.value = locations.includes(selectedLocation) ? selectedLocation : locations[0] || "Dry storage";
    form.querySelectorAll("input, select, button").forEach((element) => {
        element.disabled = !can("canManageProducts");
    });
}
function getLocationSummaryText(ingredient) {
    const rows = getIngredientLocationRows(ingredient);
    return rows.length
        ? rows.map((row) => `${formatStockAmount(row.quantity, ingredient.unit)} ${row.location}`).join(", ")
        : "No stock recorded";
}
function locationStockHtml(ingredient) {
    const rows = getIngredientLocationRows(ingredient);
    if (!rows.length)
        return `<span class="table-subtext">No stock recorded</span>`;
    return `
    <div class="location-stack">
      ${rows.map((row) => `
        <div class="location-line">
          <span>${escapeHtml(row.location)}</span>
          <strong>${escapeHtml(formatStockAmount(row.quantity, ingredient.unit))}</strong>
        </div>
      `).join("")}
    </div>
  `;
}
function overStockCard(ingredient) {
    const overage = normalizeStockQuantity(ingredient.stock - ingredient.max);
    return `
    <article class="alert-card warning">
      <div class="card-title">
        <strong>${escapeHtml(ingredient.name)}</strong>
        <span class="pill warning">${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))}</span>
      </div>
      <p>Above ${ingredient.max} ${escapeHtml(ingredient.unit)} by ${escapeHtml(formatStockAmount(overage, ingredient.unit))}. ${escapeHtml(getLocationSummaryText(ingredient))}.</p>
    </article>
  `;
}
function inventoryHistoryCard(entry) {
    const ingredient = ingredientById(entry.ingredientId);
    const unit = ingredient?.unit || "";
    const route = entry.fromLocation && entry.toLocation
        ? `${entry.fromLocation} to ${entry.toLocation}`
        : entry.fromLocation || entry.toLocation || "Stock";
    return `
    <article class="log-card">
      <div class="card-title">
        <strong>${escapeHtml(entry.ingredientName || ingredient?.name || "Purchased product")}</strong>
        <span class="pill info">${escapeHtml(inventoryActionLabel(entry.type))}</span>
      </div>
      <p><strong>${escapeHtml(entry.time)}</strong> ${escapeHtml(formatStockAmount(entry.quantity, unit))} | ${escapeHtml(route)} | Total ${escapeHtml(formatStockAmount(entry.resultingStock, unit))}</p>
      ${entry.detail ? `<p>${escapeHtml(entry.detail)}</p>` : ""}
    </article>
  `;
}
function wasteReasonOptionsHtml(selectedReason = "Spoiled") {
    const selected = normalizeWasteReason(selectedReason || "Spoiled");
    return WASTE_REASONS
        .map((reason) => `<option value="${escapeHtml(reason.id)}" ${reason.id === selected ? "selected" : ""}>${escapeHtml(reason.label)}</option>`)
        .join("");
}
function wasteStaffOptionsHtml(selectedStaffId = "") {
    const currentStaff = currentUser();
    const staffOptions = can("canManageInventory")
        ? state.users.filter((user) => user.status === "Active")
        : [currentStaff].filter(Boolean);
    const selected = staffOptions.some((user) => user.id === selectedStaffId) ? selectedStaffId : currentStaff?.id || staffOptions[0]?.id || "";
    return staffOptions
        .map((user) => `<option value="${escapeHtml(user.id)}" ${user.id === selected ? "selected" : ""}>${escapeHtml(user.name)}</option>`)
        .join("");
}
function getWastePreviewHtml(ingredient, quantity, unitType) {
    if (!ingredient)
        return emptyState("Create a purchased product before recording waste.");
    const stockQuantity = convertWasteQuantityToStockUnits(ingredient, quantity, unitType);
    const cost = getWasteCost(ingredient, stockQuantity);
    const remaining = normalizeStockQuantity(ingredient.stock - stockQuantity);
    const className = stockQuantity > ingredient.stock ? "danger" : stockQuantity > 0 ? "" : "warning";
    const statusText = stockQuantity > ingredient.stock
        ? `Only ${formatStockAmount(ingredient.stock, ingredient.unit)} available`
        : `${formatStockAmount(Math.max(0, remaining), ingredient.unit)} after waste`;
    return `
    <div class="availability-card ${className}">
      <header>
        <strong>${escapeHtml(ingredient.name)}</strong>
        <span class="pill ${className === "danger" ? "danger" : "info"}">${escapeHtml(money(cost))}</span>
      </header>
      <p>${escapeHtml(formatStockAmount(stockQuantity, ingredient.unit))} will leave inventory. ${escapeHtml(statusText)}.</p>
    </div>
  `;
}
function renderWasteForms() {
    document.querySelectorAll(".staff-waste-panel").forEach((panel) => {
        panel.hidden = !can("canRecordWaste");
    });
    document.querySelectorAll("[data-waste-form]").forEach((form) => {
        const productSelect = form.querySelector("[data-waste-product]");
        const unitSelect = form.querySelector("[data-waste-unit]");
        const reasonSelect = form.querySelector("[data-waste-reason]");
        const staffSelect = form.querySelector("[data-waste-staff]");
        const dateTimeInput = form.querySelector("[data-waste-datetime]");
        const preview = form.querySelector("[data-waste-preview]");
        const quantityInput = form.querySelector("[name='quantity']");
        if (!productSelect || !unitSelect || !reasonSelect || !staffSelect || !dateTimeInput || !preview || !quantityInput)
            return;
        const products = state.ingredients.filter((ingredient) => ingredient.active);
        const selectedProductId = productSelect.value || (products.some((ingredient) => ingredient.id === "kefta") ? "kefta" : products[0]?.id || "");
        productSelect.innerHTML = products
            .map((ingredient) => `<option value="${escapeHtml(ingredient.id)}">${escapeHtml(ingredient.name)} - ${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))}</option>`)
            .join("");
        productSelect.value = products.some((ingredient) => ingredient.id === selectedProductId) ? selectedProductId : products[0]?.id || "";
        const ingredient = ingredientById(productSelect.value);
        const unitOptions = getWasteUnitOptionsForIngredient(ingredient);
        const selectedUnit = normalizeWasteUnitType(unitSelect.value, ingredient);
        unitSelect.innerHTML = unitOptions
            .map((unitType) => `<option value="${escapeHtml(unitType.id)}">${escapeHtml(unitType.label)}</option>`)
            .join("");
        unitSelect.value = unitOptions.some((unitType) => unitType.id === selectedUnit) ? selectedUnit : unitOptions[0]?.id || "";
        reasonSelect.innerHTML = wasteReasonOptionsHtml(reasonSelect.value);
        staffSelect.innerHTML = wasteStaffOptionsHtml(staffSelect.value);
        if (!dateTimeInput.value)
            dateTimeInput.value = formatDateTimeLocalInput();
        preview.innerHTML = getWastePreviewHtml(ingredient, quantityInput.value, unitSelect.value);
        form.querySelectorAll("input, select, textarea, button").forEach((element) => {
            element.disabled = !can("canRecordWaste") || !products.length;
        });
    });
}
function wasteRecordCard(record) {
    const ingredient = ingredientById(record.ingredientId);
    const stockUnit = ingredient?.unit || record.stockUnit || "";
    return `
    <article class="log-card waste-card">
      <div class="card-title">
        <strong>${escapeHtml(record.ingredientName || ingredient?.name || "Product")}</strong>
        <span class="pill danger">${escapeHtml(record.reason)}</span>
        <span class="pill info">${escapeHtml(money(record.cost))}</span>
      </div>
      <div class="meta-line">
        <span>${escapeHtml(formatDateTime(record.occurredAtMs))}</span>
        <span>${escapeHtml(formatWasteQuantity(record))}</span>
        <span>${escapeHtml(formatStockAmount(record.stockQuantity, stockUnit))} inventory</span>
        <span>${escapeHtml(record.staffName || "Staff")}</span>
      </div>
      ${record.notes ? `<p>${escapeHtml(record.notes)}</p>` : ""}
    </article>
  `;
}
function renderWasteReport() {
    document.querySelectorAll(".admin-waste-only").forEach((panel) => {
        panel.hidden = !can("canManageInventory");
    });
    const summaryContainer = document.querySelector("#wasteReportSummary");
    const historyContainer = document.querySelector("#wasteHistory");
    if (!summaryContainer || !historyContainer)
        return;
    const summary = getWasteReportSummary();
    summaryContainer.innerHTML = `
    <article class="waste-summary-card">
      <span>Total cost</span>
      <strong>${escapeHtml(money(summary.totalCost))}</strong>
      <small>${summary.count} ${summary.count === 1 ? "record" : "records"}</small>
    </article>
    <article class="waste-summary-card">
      <span>Today</span>
      <strong>${escapeHtml(money(summary.todayCost))}</strong>
      <small>${summary.todayCount} ${summary.todayCount === 1 ? "item" : "items"}</small>
    </article>
    <article class="waste-summary-card">
      <span>Top reason</span>
      <strong>${escapeHtml(summary.topReason)}</strong>
      <small>${summary.count} ${summary.count === 1 ? "waste record" : "waste records"}</small>
    </article>
  `;
    historyContainer.innerHTML = state.wasteRecords.length
        ? state.wasteRecords.slice().reverse().map(wasteRecordCard).join("")
        : emptyState("No waste recorded yet.");
}
function renderWasteTracking() {
    renderWasteForms();
    renderWasteReport();
}
function renderInventoryActionForm() {
    const form = document.querySelector("#inventoryActionForm");
    const ingredientSelect = document.querySelector("#inventoryActionIngredient");
    const actionSelect = document.querySelector("#inventoryActionType");
    const quantityInput = document.querySelector("#inventoryActionQuantity");
    const fromSelect = document.querySelector("#inventoryFromLocation");
    const toSelect = document.querySelector("#inventoryToLocation");
    const fromLabel = document.querySelector("#inventoryFromLocationLabel");
    const toLabel = document.querySelector("#inventoryToLocationLabel");
    const customLabel = document.querySelector("#inventoryCustomLocationLabel");
    if (!form || !ingredientSelect || !actionSelect || !fromSelect || !toSelect || !fromLabel || !toLabel || !customLabel)
        return;
    const selectedIngredientId = ingredientSelect.value || state.ingredients[0]?.id || "";
    const selectedAction = actionSelect.value || "add";
    const selectedFrom = fromSelect.value;
    const selectedTo = toSelect.value;
    ingredientSelect.innerHTML = state.ingredients
        .map((ingredient) => `<option value="${escapeHtml(ingredient.id)}">${escapeHtml(ingredient.name)} - ${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))}</option>`)
        .join("");
    ingredientSelect.value = state.ingredients.some((ingredient) => ingredient.id === selectedIngredientId) ? selectedIngredientId : state.ingredients[0]?.id || "";
    actionSelect.innerHTML = INVENTORY_ACTIONS
        .filter((action) => action.id !== "waste")
        .map((action) => `<option value="${escapeHtml(action.id)}">${escapeHtml(action.label)}</option>`)
        .join("");
    actionSelect.value = INVENTORY_ACTIONS.some((action) => action.id === selectedAction && action.id !== "waste") ? selectedAction : "add";
    const ingredient = ingredientById(ingredientSelect.value);
    const locations = getAllInventoryLocations();
    fromSelect.innerHTML = locations
        .map((location) => `<option value="${escapeHtml(location)}">${escapeHtml(formatLocationOptionLabel(ingredient, location))}</option>`)
        .join("");
    toSelect.innerHTML = locations
        .map((location) => `<option value="${escapeHtml(location)}">${escapeHtml(formatLocationOptionLabel(ingredient, location))}</option>`)
        .join("");
    fromSelect.value = locations.includes(selectedFrom) ? selectedFrom : getIngredientPrimaryLocation(ingredient);
    toSelect.value = locations.includes(selectedTo) ? selectedTo : getIngredientPrimaryLocation(ingredient);
    const action = actionSelect.value;
    fromLabel.hidden = action === "add" || action === "correct";
    toLabel.hidden = action === "remove" || action === "waste";
    customLabel.hidden = action === "remove" || action === "waste";
    quantityInput.min = action === "correct" ? "0" : "0.01";
    form.querySelectorAll("input, select, button").forEach((element) => {
        element.disabled = !can("canManageInventory") || !state.ingredients.length;
    });
}
function supplierOrderCard(order) {
    const statusClass = order.status === "Ordered" ? "info" : "warning";
    const itemCount = order.items.length;
    const total = getSupplierOrderTotal(order);
    return `
    <article class="supplier-card ${order.status === "Ordered" ? "is-ordered" : ""}">
      <header>
        <div>
          <strong>${escapeHtml(order.supplier)}</strong>
          <p>${itemCount} ${itemCount === 1 ? "line" : "lines"} · ${escapeHtml(money(total))} estimated</p>
        </div>
        <span class="pill ${statusClass}">${escapeHtml(order.status)}</span>
      </header>
      <div class="supplier-lines">
        ${order.items.map((item) => {
        const ingredient = ingredientById(item.ingredientId);
        if (!ingredient)
            return "";
        return `
            <div class="supplier-line">
              <div>
                <strong>${escapeHtml(ingredient.name)}</strong>
                <p>${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))} on hand · ${escapeHtml(getLocationSummaryText(ingredient))}</p>
              </div>
              <span>${escapeHtml(formatStockAmount(item.quantity, ingredient.unit))}</span>
            </div>
          `;
    }).join("")}
      </div>
      <div class="supplier-total">
        <span>${escapeHtml(order.status === "Ordered" ? `Ordered ${order.orderedAt}` : "Ready to send")}</span>
        <div class="mini-actions">
          ${order.status === "Ordered"
        ? `<button class="mini-btn" type="button" data-supplier-received="${escapeHtml(order.supplier)}">Received</button>`
        : `<button class="mini-btn" type="button" data-supplier-ordered="${escapeHtml(order.supplier)}">Ordered</button>`}
        </div>
      </div>
    </article>
  `;
}
function renderInventory() {
    renderInventoryActionForm();
    const inventoryAlerts = [
        ...getLowStockIngredients().map(alertCard),
        ...getOverStockIngredients().map(overStockCard)
    ];
    document.querySelector("#inventoryLowStockDashboard").innerHTML = inventoryAlerts.length
        ? inventoryAlerts.join("")
        : emptyState("No low-stock or over-stock alerts.");
    document.querySelector("#inventoryHistory").innerHTML = state.inventoryHistory.length
        ? state.inventoryHistory.slice().reverse().map(inventoryHistoryCard).join("")
        : emptyState("No stock actions yet.");
    document.querySelector("#ingredientRows").innerHTML = state.ingredients.map((ingredient) => {
        const status = getIngredientStatus(ingredient);
        const percent = Math.max(4, Math.min(100, ingredient.max ? (ingredient.stock / ingredient.max) * 100 : 4));
        const statusLabel = status === "inactive" ? "Inactive" : status === "danger" ? "Low stock" : status === "over" ? "Over stock" : status === "warning" ? "Watch" : "OK";
        const statusClass = status === "inactive" ? "warning" : status === "danger" ? "danger" : status === "over" || status === "warning" ? "warning" : "ok";
        const expiryText = ingredient.expiryDate || "No expiry";
        const barcodeText = ingredient.barcode || "No code";
        return `
      <tr class="inventory-row ${status}">
        <td>
          <strong>${escapeHtml(ingredient.name)}</strong>
          <span class="table-subtext">${escapeHtml(unitTypeDefinition(ingredient.unitType).label)}</span>
        </td>
        <td>
          <div class="stock-meter ${status}">
            <span>${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))}</span>
            <div class="progress-track"><div class="progress-bar" style="--value: ${percent}%"></div></div>
          </div>
        </td>
        <td>${ingredient.min} / ${ingredient.max} ${escapeHtml(ingredient.unit)}</td>
        <td>${locationStockHtml(ingredient)}</td>
        <td>${escapeHtml(ingredient.supplier)}</td>
        <td>
          ${can("canManageProducts") ? `
            <div class="price-editor">
              <input data-purchase-price-input="${escapeHtml(ingredient.id)}" type="number" min="0.01" step="0.01" value="${ingredient.purchasePrice.toFixed(2)}" aria-label="Purchase price for ${escapeHtml(ingredient.name)}">
              <button class="mini-btn" type="button" data-update-purchase-price="${escapeHtml(ingredient.id)}">Update</button>
            </div>
            <span class="table-subtext">per ${escapeHtml(ingredient.unit)}</span>
          ` : `${escapeHtml(money(ingredient.purchasePrice))} / ${escapeHtml(ingredient.unit)}`}
        </td>
        <td>
          <span>${escapeHtml(expiryText)}</span>
          <span class="table-subtext">${escapeHtml(barcodeText)}</span>
        </td>
        <td><span class="pill ${statusClass}">${statusLabel}</span></td>
        <td>
          ${can("canManageProducts") ? `<button class="mini-btn" type="button" data-toggle-purchased="${escapeHtml(ingredient.id)}">${ingredient.active ? "Deactivate" : "Activate"}</button>` : ""}
        </td>
      </tr>
    `;
    }).join("");
    document.querySelector("#recipeList").innerHTML = state.products.map((product) => {
        const baseCost = getProductCost(product, DEFAULT_RECIPE_ORDER_CONTEXT);
        const takeawayCost = getProductCost(product, TAKEAWAY_DELIVERY_RECIPE_CONTEXT);
        const hasConditionalLines = productHasConditionalRecipeLines(product);
        const marginProfile = getProductMarginProfile(product);
        const vatLabel = VAT_OPTIONS.find((option) => option.id === product.vatSetting)?.label || "Standard VAT";
        return `
      <article class="recipe-card ${product.active ? "" : "is-inactive"} ${marginProfile.className === "danger" ? "is-low-margin" : ""}">
        <header>
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <p>${escapeHtml(product.category)} | SKU ${escapeHtml(product.code)} | ${escapeHtml(product.station)}</p>
          </div>
          <div class="ticket-pills">
            <span class="pill ${product.active ? "ok" : "warning"}">${product.active ? "Active" : "Inactive"}</span>
            <span class="pill ${marginProfile.className}">${marginProfile.margin.toFixed(1)}%</span>
          </div>
        </header>
        <div class="recipe-cost-grid">
          <span>Selling price</span><strong>${escapeHtml(money(product.price))}</strong>
          <span>Base product cost</span><strong>${escapeHtml(money(baseCost))}</strong>
          <span>Gross margin</span><strong>${escapeHtml(money(getProductGrossMargin(product, DEFAULT_RECIPE_ORDER_CONTEXT)))}</strong>
          <span>Margin</span><strong>${marginProfile.baseMargin.toFixed(1)}%</strong>
          ${hasConditionalLines ? `
            <span>Takeaway/delivery cost</span><strong>${escapeHtml(money(takeawayCost))}</strong>
            <span>Takeaway/delivery margin</span><strong>${marginProfile.takeawayMargin.toFixed(1)}%</strong>
          ` : ""}
        </div>
        ${product.lastProductionAt ? `
          <p class="line-detail">Last batch actual cost ${escapeHtml(money(product.lastProductionCost))} (${escapeHtml(money(product.lastProductionCostDelta))} vs planned)${product.lastProductionMargin === null ? "" : ` · margin ${product.lastProductionMargin.toFixed(1)}%`} · ${escapeHtml(product.lastProductionAt)}</p>
        ` : ""}
        <p>Target ${product.targetMargin}% | Minimum ${product.minMargin}% | ${escapeHtml(marginProfile.label)} | ${escapeHtml(vatLabel)}</p>
        <p>${escapeHtml(productAvailabilityLabel(product))}</p>
        <div class="recipe-lines">
          ${(product.recipe || []).map((line) => {
            const ingredient = ingredientById(line.ingredientId);
            if (!ingredient)
                return "";
            const appliesLabel = RECIPE_APPLIES_OPTIONS.find((option) => option.id === line.appliesTo)?.label || "Every order";
            return `
              <div class="recipe-line">
                <span>
                  <strong>${escapeHtml(ingredient.name)}</strong>
                  <small>${escapeHtml(line.station || "Main kitchen")} · ${escapeHtml(appliesLabel)}${line.notes ? ` · ${escapeHtml(line.notes)}` : ""}</small>
                </span>
                <strong>${escapeHtml(getRecipeUsageLabel(line))} · ${escapeHtml(money(getLineCost(line)))}</strong>
              </div>
            `;
        }).join("")}
        </div>
        ${can("canManageProducts") ? `
          <div class="mini-actions">
            <button class="mini-btn" type="button" data-toggle-sellable="${escapeHtml(product.id)}">${product.active ? "Deactivate" : "Activate"}</button>
          </div>
        ` : ""}
      </article>
    `;
    }).join("");
    const supplierOrders = getSupplierOrderDrafts();
    document.querySelector("#supplierOrders").innerHTML = supplierOrders.length
        ? supplierOrders.map(supplierOrderCard).join("")
        : emptyState("No supplier order needed.");
}
function procedureById(id) {
    return state.procedures.find((procedure) => procedure.id === id);
}
function languageLabel(languageId) {
    return LANGUAGE_OPTIONS.find((language) => language.id === languageId)?.label || "Language";
}
function procedureStatusClass(status) {
    if (status === "Done" || status === "Completed")
        return "ok";
    if (status === "Problem")
        return "danger";
    if (status === "Skipped" || status === "Missed")
        return "warning";
    return "info";
}
function procedureFrequencyWindowMs(frequency) {
    if (frequency === "Weekly")
        return 7 * 24 * 60 * MINUTE_MS;
    if (frequency === "Monthly")
        return 31 * 24 * 60 * MINUTE_MS;
    if (frequency === "Per shift")
        return 12 * 60 * MINUTE_MS;
    return 24 * 60 * MINUTE_MS;
}
function getProcedureCompletions(procedureId, statuses = PROCEDURE_COMPLETION_STATUSES) {
    return state.procedureCompletions
        .filter((completion) => completion.procedureId === procedureId && statuses.includes(completion.status))
        .slice()
        .sort((first, second) => (second.completedAtMs || 0) - (first.completedAtMs || 0));
}
function latestProcedureCompletion(procedure, statuses = PROCEDURE_COMPLETION_STATUSES) {
    return getProcedureCompletions(procedure.id, statuses)[0] || null;
}
function procedurePeriodStatus(procedure) {
    const cutoff = Date.now() - procedureFrequencyWindowMs(procedure.frequency);
    const recentDone = getProcedureCompletions(procedure.id, ["Done"]).find((completion) => completion.completedAtMs >= cutoff);
    if (recentDone) {
        return {
            status: "Completed",
            label: "Completed",
            className: "ok",
            detail: `${recentDone.completedByName} at ${formatDateTime(recentDone.completedAtMs, recentDone.completedAt)}`
        };
    }
    const recentIssue = getProcedureCompletions(procedure.id, ["Problem", "Skipped"]).find((completion) => completion.completedAtMs >= cutoff);
    if (recentIssue) {
        return {
            status: recentIssue.status,
            label: recentIssue.status,
            className: procedureStatusClass(recentIssue.status),
            detail: `${recentIssue.completedByName}: ${recentIssue.notes || "No note"}`
        };
    }
    return {
        status: "Missed",
        label: "Due now",
        className: "warning",
        detail: `${procedure.frequency} procedure has no completion in the current window.`
    };
}
function isSameLocalDay(timestamp) {
    return new Date(timestamp).toDateString() === new Date().toDateString();
}
function procedureAssignmentAliases(user = currentUser()) {
    const aliases = new Set(["All staff"]);
    if (!user)
        return aliases;
    const roleInfo = roleDefinition(user.role);
    aliases.add(roleInfo.operationalRole);
    aliases.add(roleInfo.label);
    if (user.role === "owner_admin")
        aliases.add("Owner/Admin");
    if (user.role === "manager")
        aliases.add("Manager");
    if (user.role === "waiter_cashier") {
        aliases.add("Front");
        aliases.add("Cashier");
    }
    if (user.role === "kitchen_staff")
        aliases.add("Kitchen");
    if (user.role === "driver")
        aliases.add("Driver");
    return aliases;
}
function procedureAssignedToUser(procedure, user = currentUser()) {
    if (!user)
        return false;
    if (can("canReviewProcedures"))
        return true;
    return procedureAssignmentAliases(user).has(procedure.assignedRole);
}
function getCurrentUserProcedures() {
    const user = currentUser();
    return state.procedures
        .filter((procedure) => procedure.active && procedureAssignedToUser(procedure, user))
        .sort((first, second) => {
        const firstStatus = procedurePeriodStatus(first);
        const secondStatus = procedurePeriodStatus(second);
        const firstRank = firstStatus.status === "Completed" ? 1 : 0;
        const secondRank = secondStatus.status === "Completed" ? 1 : 0;
        return firstRank - secondRank || first.department.localeCompare(second.department) || first.title.localeCompare(second.title);
    });
}
function procedureProgressKey(procedureId, userId = currentUser()?.id || "") {
    return `${userId}:${procedureId}`;
}
function getProcedureStepProgress(procedureId, userId = currentUser()?.id || "") {
    const key = procedureProgressKey(procedureId, userId);
    return new Set(state.procedureProgress?.[key] || []);
}
function procedureStepsComplete(procedure, userId = currentUser()?.id || "") {
    if (!procedure.steps.length)
        return true;
    const checkedSteps = getProcedureStepProgress(procedure.id, userId);
    return procedure.steps.every((_, index) => checkedSteps.has(index));
}
function listText(items, fallback = "None") {
    return items?.length ? items.join(", ") : fallback;
}
function procedureRequirementHtml(label, items) {
    return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(listText(items))}</strong>
    </div>
  `;
}
function procedureMediaHtml(media) {
    if (!media?.length)
        return "";
    return `
    <div class="procedure-media">
      ${media.map((url, index) => `
        <a class="mini-btn" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Media ${index + 1}</a>
      `).join("")}
    </div>
  `;
}
function procedureSummaryCards(procedures) {
    const due = procedures.filter((procedure) => procedurePeriodStatus(procedure).status !== "Completed").length;
    const completedToday = state.procedureCompletions.filter((completion) => completion.status === "Done" && isSameLocalDay(completion.completedAtMs)).length;
    const issuesToday = state.procedureCompletions.filter((completion) => completion.status !== "Done" && isSameLocalDay(completion.completedAtMs)).length;
    const languages = new Set(procedures.map((procedure) => procedure.language)).size;
    return [
        { label: "Assigned", value: procedures.length, note: "Visible to this role", className: "info" },
        { label: "Due", value: due, note: "Needs staff action", className: due ? "warning" : "ok" },
        { label: "Completed today", value: completedToday, note: "All roles", className: "ok" },
        { label: "Issues today", value: issuesToday, note: "Problems and skips", className: issuesToday ? "danger" : "info" },
        { label: "Languages", value: languages, note: "Arabic, Dutch, Turkish, English supported", className: "info" }
    ].map((card) => `
    <article class="procedure-summary-card">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <small class="${escapeHtml(card.className)}">${escapeHtml(card.note)}</small>
    </article>
  `).join("");
}
function procedureCard(procedure) {
    const periodStatus = procedurePeriodStatus(procedure);
    const checkedSteps = getProcedureStepProgress(procedure.id);
    const canComplete = can("canCompleteProcedures") && procedureAssignedToUser(procedure);
    const doneDisabled = !canComplete || !procedureStepsComplete(procedure);
    const latestCompletion = latestProcedureCompletion(procedure);
    const progressText = `${checkedSteps.size}/${procedure.steps.length} steps checked`;
    return `
    <article class="procedure-card procedure-sop-card status-${escapeHtml(slugify(periodStatus.status))}">
      <header>
        <div>
          <span class="procedure-kicker">${escapeHtml(procedure.department)} · ${escapeHtml(languageLabel(procedure.language))}</span>
          <strong>${escapeHtml(procedure.title)}</strong>
          <p>${escapeHtml(procedure.frequency)} · Assigned to ${escapeHtml(procedure.assignedRole)} · ${escapeHtml(progressText)}</p>
        </div>
        <span class="pill ${escapeHtml(periodStatus.className)}">${escapeHtml(periodStatus.label)}</span>
      </header>
      <div class="procedure-step-list">
        ${procedure.steps.map((step, index) => `
          <label class="procedure-step">
            <input
              type="checkbox"
              ${checkedSteps.has(index) ? "checked" : ""}
              ${canComplete ? "" : "disabled"}
              data-procedure-step="${escapeHtml(procedure.id)}"
              data-step-index="${index}"
            >
            <span>${escapeHtml(step)}</span>
          </label>
        `).join("")}
      </div>
      <div class="procedure-detail-grid">
        ${procedureRequirementHtml("Tools", procedure.requiredTools)}
        ${procedureRequirementHtml("Products", procedure.requiredProducts)}
      </div>
      ${procedureMediaHtml(procedure.media)}
      ${latestCompletion ? `
        <p class="procedure-last-run">Last activity: ${escapeHtml(latestCompletion.status)} by ${escapeHtml(latestCompletion.completedByName)} at ${escapeHtml(formatDateTime(latestCompletion.completedAtMs, latestCompletion.completedAt))}</p>
      ` : `<p class="procedure-last-run">${escapeHtml(periodStatus.detail)}</p>`}
      <div class="mini-actions procedure-actions">
        <button class="mini-btn" type="button" ${doneDisabled ? "disabled" : ""} data-procedure-done="${escapeHtml(procedure.id)}">Done</button>
        <button class="mini-btn danger-action" type="button" ${canComplete ? "" : "disabled"} data-procedure-problem="${escapeHtml(procedure.id)}">Problem</button>
        <button class="mini-btn" type="button" ${canComplete ? "" : "disabled"} data-procedure-skip="${escapeHtml(procedure.id)}">Skip with reason</button>
      </div>
    </article>
  `;
}
function procedureHistoryCard(completion) {
    const procedure = procedureById(completion.procedureId);
    const stepCount = procedure?.steps?.length || 0;
    const checkedCount = completion.checkedSteps?.length || 0;
    return `
    <article class="log-card procedure-history-card">
      <div class="card-title">
        <strong>${escapeHtml(procedure?.title || "Procedure")}</strong>
        <span class="pill ${escapeHtml(procedureStatusClass(completion.status))}">${escapeHtml(completion.status)}</span>
      </div>
      <div class="meta-line">
        <span>${escapeHtml(completion.completedByName)}</span>
        <span>${escapeHtml(completion.assignedRole)}</span>
        <span>${escapeHtml(formatDateTime(completion.completedAtMs, completion.completedAt))}</span>
        <span>${checkedCount}/${stepCount} steps</span>
      </div>
      ${completion.notes ? `<p>${escapeHtml(completion.notes)}</p>` : ""}
    </article>
  `;
}
function productionBatchCard(batch) {
    const product = productById(batch.productId);
    const outputIngredient = ingredientById(batch.outputIngredientId);
    const costDeltaClass = batch.costDelta > 0 ? "warning" : batch.costDelta < 0 ? "ok" : "info";
    const marginClass = batch.marginDelta === null ? "info" : batch.marginDelta < -0.1 ? "danger" : batch.marginDelta < 0 ? "warning" : "ok";
    const marginText = batch.actualMargin === null
        ? (batch.outputUnitCost ? `${money(batch.outputUnitCost)} / ${outputIngredient?.unit || unitTypeDefinition(batch.outputUnitType).shortLabel}` : "No margin")
        : `${batch.actualMargin.toFixed(1)}% (${formatSignedAmount(batch.marginDelta, " pts")})`;
    return `
    <article class="log-card production-batch-card">
      <div class="card-title">
        <strong>${escapeHtml(batch.productName || product?.name || "Batch")}</strong>
        <span class="pill ${escapeHtml(batch.outputIngredientId ? "ok" : "info")}">${escapeHtml(batch.outputIngredientId ? "Prepared stock" : "Assembly")}</span>
      </div>
      <div class="recipe-cost-grid">
        <span>Actual cost</span><strong>${escapeHtml(money(batch.actualCost))}</strong>
        <span>Variance</span><strong><span class="inline-status ${escapeHtml(costDeltaClass)}">${escapeHtml(money(batch.costDelta))}</span></strong>
        <span>${batch.actualMargin === null ? "Unit cost" : "Margin impact"}</span><strong><span class="inline-status ${escapeHtml(marginClass)}">${escapeHtml(marginText)}</span></strong>
        ${outputIngredient ? `<span>Added to inventory</span><strong>${escapeHtml(formatStockAmount(batch.outputStockQuantity, outputIngredient.unit))} ${escapeHtml(outputIngredient.name)}</strong>` : ""}
      </div>
      <div class="production-usage-list">
        ${batch.lines.map((line) => `
          <div class="production-usage-row">
            <span>${escapeHtml(line.ingredientName || ingredientById(line.ingredientId)?.name || "Ingredient")}</span>
            <strong>${escapeHtml(formatActualUsageLabel(line.actualUsage, line.measure))} · ${escapeHtml(money(line.actualCost))}</strong>
          </div>
        `).join("")}
      </div>
      <p><strong>${escapeHtml(batch.completedAt)}</strong> ${escapeHtml(batch.completedByName)} saved this batch.</p>
    </article>
  `;
}
function missedProcedureCard(procedure) {
    const status = procedurePeriodStatus(procedure);
    const latestCompletion = latestProcedureCompletion(procedure);
    return `
    <article class="alert-card warning">
      <div class="card-title">
        <strong>${escapeHtml(procedure.title)}</strong>
        <span class="pill ${escapeHtml(status.className)}">${escapeHtml(status.label)}</span>
      </div>
      <p>${escapeHtml(procedure.department)} · ${escapeHtml(procedure.frequency)} · Assigned to ${escapeHtml(procedure.assignedRole)}</p>
      <p>${escapeHtml(latestCompletion ? `Last activity ${latestCompletion.status} by ${latestCompletion.completedByName}` : "No completion recorded yet.")}</p>
    </article>
  `;
}
function renderProcedureFormControls() {
    const form = document.querySelector("#procedureForm");
    if (!form)
        return;
    const departmentSelect = document.querySelector("#procedureDepartment");
    const languageSelect = document.querySelector("#procedureLanguage");
    const frequencySelect = document.querySelector("#procedureFrequency");
    const assignedRoleSelect = document.querySelector("#procedureAssignedRole");
    const editable = can("canCreateProcedures");
    if (departmentSelect) {
        const selected = departmentSelect.value || "Front of house";
        departmentSelect.innerHTML = PROCEDURE_DEPARTMENTS
            .map((department) => `<option value="${escapeHtml(department)}">${escapeHtml(department)}</option>`)
            .join("");
        departmentSelect.value = PROCEDURE_DEPARTMENTS.includes(selected) ? selected : "Front of house";
    }
    if (languageSelect) {
        const selected = languageSelect.value || state.restaurantSettings.defaultLanguage;
        languageSelect.innerHTML = LANGUAGE_OPTIONS
            .map((language) => `<option value="${escapeHtml(language.id)}">${escapeHtml(language.label)}</option>`)
            .join("");
        languageSelect.value = LANGUAGE_OPTIONS.some((language) => language.id === selected) ? selected : state.restaurantSettings.defaultLanguage;
    }
    if (frequencySelect) {
        const selected = frequencySelect.value || "Daily";
        frequencySelect.innerHTML = PROCEDURE_FREQUENCIES
            .map((frequency) => `<option value="${escapeHtml(frequency)}">${escapeHtml(frequency)}</option>`)
            .join("");
        frequencySelect.value = PROCEDURE_FREQUENCIES.includes(selected) ? selected : "Daily";
    }
    if (assignedRoleSelect) {
        const selected = assignedRoleSelect.value || "Front";
        assignedRoleSelect.innerHTML = PROCEDURE_ASSIGNED_ROLES
            .map((role) => `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`)
            .join("");
        assignedRoleSelect.value = PROCEDURE_ASSIGNED_ROLES.includes(selected) ? selected : "Front";
    }
    form.querySelectorAll("input, select, textarea, button").forEach((element) => {
        element.disabled = !editable;
    });
}
function renderProcedureManagerView() {
    const managerPanel = document.querySelector("#procedureManagerPanel");
    const managerSummary = document.querySelector("#procedureManagerSummary");
    const missedList = document.querySelector("#missedProcedureList");
    const history = document.querySelector("#procedureHistory");
    if (!managerPanel || !managerSummary || !missedList || !history)
        return;
    const canReview = can("canReviewProcedures");
    managerPanel.hidden = !canReview;
    if (!canReview)
        return;
    const completed = state.procedureCompletions.filter((completion) => completion.status === "Done");
    const issues = state.procedureCompletions.filter((completion) => completion.status !== "Done");
    const missed = state.procedures.filter((procedure) => procedure.active && procedurePeriodStatus(procedure).status !== "Completed");
    managerSummary.innerHTML = [
        { label: "Completed", value: completed.length, note: "All completion records", className: "ok" },
        { label: "Missed", value: missed.length, note: "No completion in current window", className: missed.length ? "warning" : "ok" },
        { label: "Notes/issues", value: issues.length, note: "Problems and skips", className: issues.length ? "danger" : "info" }
    ].map((card) => `
    <article class="procedure-summary-card">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <small class="${escapeHtml(card.className)}">${escapeHtml(card.note)}</small>
    </article>
  `).join("");
    missedList.innerHTML = missed.length
        ? missed.map(missedProcedureCard).join("")
        : emptyState("No missed procedures in the current window.");
    history.innerHTML = state.procedureCompletions.length
        ? state.procedureCompletions
            .slice()
            .sort((first, second) => (second.completedAtMs || 0) - (first.completedAtMs || 0))
            .slice(0, 30)
            .map(procedureHistoryCard)
            .join("")
        : emptyState("No procedure completion history yet.");
}
function renderProcedures() {
    document.querySelectorAll(".admin-procedure-only").forEach((panel) => {
        panel.hidden = !can("canCreateProcedures");
    });
    document.querySelectorAll(".manager-procedure-only").forEach((panel) => {
        panel.hidden = !can("canReviewProcedures");
    });
    renderProcedureFormControls();
    const visibleProcedures = getCurrentUserProcedures();
    const summaryGrid = document.querySelector("#procedureSummaryGrid");
    if (summaryGrid)
        summaryGrid.innerHTML = procedureSummaryCards(visibleProcedures);
    const procedureList = document.querySelector("#procedureList");
    if (procedureList) {
        procedureList.innerHTML = visibleProcedures.length
            ? visibleProcedures.map(procedureCard).join("")
            : emptyState("No procedures are assigned to this role.");
    }
    renderProcedureManagerView();
    const productionPanel = document.querySelector("#procedureProductionPanel");
    if (productionPanel)
        productionPanel.hidden = !can("canManageProcedures");
    const batchCards = state.productionBatches
        .slice()
        .reverse()
        .map(productionBatchCard);
    const productionLogCards = state.productionLog.slice().reverse().map((log) => `
      <article class="log-card">
        <p><strong>${escapeHtml(log.time)}</strong> ${escapeHtml(log.text)}</p>
      </article>
    `);
    document.querySelector("#productionLog").innerHTML = batchCards.length || productionLogCards.length
        ? [...batchCards, ...productionLogCards].join("")
        : emptyState("No production changes yet.");
    document.querySelectorAll("#productionForm input, #productionForm select, #productionForm button").forEach((element) => {
        if (!can("canManageProcedures"))
            element.disabled = true;
    });
    updateProductionCostPreview();
}
function renderProductionRecipeFields(options = {}) {
    const form = document.querySelector("#productionForm");
    const container = document.querySelector("#productionRecipeFields");
    const stepList = document.querySelector("#productionStepList");
    const productionProduct = document.querySelector("#productionProduct");
    const outputIngredientSelect = document.querySelector("#productionOutputIngredient");
    const outputQuantityInput = document.querySelector("#productionOutputQuantity");
    const outputUnitSelect = document.querySelector("#productionOutputUnit");
    const outputLocationSelect = document.querySelector("#productionOutputLocation");
    const product = productionProduct ? productById(productionProduct.value) : null;
    if (!container)
        return;
    const previousActuals = new Map([...container.querySelectorAll("input[name^='actual-']")]
        .map((input) => [input.name, input.value]));
    const previousStepChecks = new Set([...(stepList?.querySelectorAll("[data-production-step]") || [])]
        .filter((input) => input.checked)
        .map((input) => input.dataset.productionStep));
    container.innerHTML = product?.recipe?.length
        ? product.recipe.map((line, index) => {
            const ingredient = ingredientById(line.ingredientId);
            if (!ingredient)
                return "";
            const measure = getRecipeMeasure(line);
            const plannedUsage = Number((getRecipeLineQuantity(line) * getRecipeLineWasteMultiplier(line)).toFixed(3));
            const fieldName = getProductionFieldName(line, index);
            const actualValue = options.reset ? plannedUsage : previousActuals.get(fieldName) ?? plannedUsage;
            const plannedCost = getLineCost(line);
            return `
        <label class="production-ingredient-line">
          <span>
            <strong>${escapeHtml(ingredient.name)}</strong>
            <small>Required ${escapeHtml(getRecipeUsageLabel(line))} · ${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))} on hand · planned ${escapeHtml(money(plannedCost))}</small>
          </span>
          <input
            name="${escapeHtml(fieldName)}"
            type="number"
            min="0"
            step="${measure.step}"
            value="${escapeHtml(actualValue)}"
            aria-label="Actual ${escapeHtml(ingredient.name)} used"
          >
        </label>
      `;
        }).join("")
        : emptyState("No recipe lines are attached to this product.");
    if (stepList) {
        stepList.innerHTML = product?.recipe?.length
            ? product.recipe.map((line, index) => {
                const ingredient = ingredientById(line.ingredientId);
                const note = String(line.notes || "").trim();
                const stepText = note || `Prepare ${getRecipeUsageLabel(line)} ${ingredient?.name || "ingredient"}.`;
                return `
          <label class="procedure-step production-step">
            <input type="checkbox" data-production-step="${index}" ${!options.reset && previousStepChecks.has(String(index)) ? "checked" : ""}>
            <span>${escapeHtml(stepText)}</span>
          </label>
        `;
            }).join("")
            : emptyState("No preparation steps are attached to this recipe.");
    }
    if (outputIngredientSelect && outputQuantityInput && outputUnitSelect && outputLocationSelect) {
        const outputDefault = getProductionOutputDefault(product);
        const selectedOutputIngredient = options.reset
            ? outputDefault.ingredientId || ""
            : outputIngredientSelect.value || outputDefault.ingredientId || "";
        outputIngredientSelect.innerHTML = [
            `<option value="">No inventory output</option>`,
            ...state.ingredients
                .filter((ingredient) => ingredient.active)
                .map((ingredient) => `<option value="${escapeHtml(ingredient.id)}">${escapeHtml(ingredient.name)} - ${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))}</option>`)
        ].join("");
        outputIngredientSelect.value = ingredientById(selectedOutputIngredient) ? selectedOutputIngredient : "";
        const outputIngredient = ingredientById(outputIngredientSelect.value);
        const outputQuantity = options.reset
            ? outputDefault.quantity || ""
            : outputQuantityInput.value || outputDefault.quantity || "";
        outputQuantityInput.value = outputQuantity;
        outputQuantityInput.disabled = !outputIngredient || !can("canManageProcedures");
        if (outputIngredient) {
            const allowedUnits = getWasteUnitOptionsForIngredient(outputIngredient);
            const selectedUnit = getProductionOutputUnitType(outputIngredient, options.reset ? outputDefault.unitType : outputUnitSelect.value, outputDefault.unitType);
            outputUnitSelect.innerHTML = allowedUnits
                .map((unit) => `<option value="${escapeHtml(unit.id)}">${escapeHtml(unit.label)}</option>`)
                .join("");
            outputUnitSelect.value = selectedUnit;
        }
        else {
            outputUnitSelect.innerHTML = `<option value="">No output</option>`;
            outputUnitSelect.value = "";
        }
        outputUnitSelect.disabled = !outputIngredient || !can("canManageProcedures");
        const locations = getAllInventoryLocations();
        const selectedLocation = options.reset
            ? outputDefault.location || outputIngredient?.location || "Fridge"
            : outputLocationSelect.value || outputDefault.location || outputIngredient?.location || "Fridge";
        outputLocationSelect.innerHTML = locations
            .map((location) => `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`)
            .join("");
        outputLocationSelect.value = locations.includes(selectedLocation) ? selectedLocation : locations[0] || "Dry storage";
        outputLocationSelect.disabled = !outputIngredient || !can("canManageProcedures");
    }
    document.querySelectorAll("#productionForm input, #productionForm select").forEach((element) => {
        if (!can("canManageProcedures"))
            element.disabled = true;
    });
    updateProductionCostPreview();
}
function updateProductionCostPreview() {
    const form = document.querySelector("#productionForm");
    const preview = document.querySelector("#productionCostPreview");
    const submitButton = document.querySelector("#saveProductionBatchBtn");
    if (!form || !preview)
        return;
    const draft = getProductionExecutionDraft(form);
    const readiness = getProductionReadiness(draft, form);
    const costDeltaClass = draft.costDelta > 0 ? "warning" : draft.costDelta < 0 ? "ok" : "info";
    const marginClass = draft.marginDelta === null ? "info" : draft.marginDelta < -0.1 ? "danger" : draft.marginDelta < 0 ? "warning" : "ok";
    preview.innerHTML = draft.product ? `
    <div class="cost-preview-title">
      <strong>Batch result preview</strong>
      <span class="pill ${escapeHtml(readiness.className)}">${escapeHtml(readiness.label)}</span>
    </div>
    <div class="cost-grid">
      <span>Planned cost</span><strong>${escapeHtml(money(draft.plannedCost))}</strong>
      <span>Actual cost</span><strong>${escapeHtml(money(draft.actualCost))}</strong>
      <span>Cost variance</span><strong><span class="inline-status ${escapeHtml(costDeltaClass)}">${escapeHtml(money(draft.costDelta))}</span></strong>
      ${draft.actualMargin === null ? `
        <span>Batch unit cost</span><strong>${draft.outputIngredient ? `${escapeHtml(money(draft.outputUnitCost))} / ${escapeHtml(draft.outputIngredient.unit)}` : "Output not set"}</strong>
      ` : `
        <span>Actual margin</span><strong><span class="inline-status ${escapeHtml(marginClass)}">${draft.actualMargin.toFixed(1)}%</span></strong>
      `}
      ${draft.outputIngredient ? `
        <span>Prepared output</span><strong>${escapeHtml(formatStockAmount(draft.outputStockQuantity, draft.outputIngredient.unit))}</strong>
      ` : ""}
    </div>
    <div class="production-usage-list">
      ${draft.lines.map((line) => {
        const lineClass = line.shortage > 0 ? "danger" : line.actualCost > line.plannedCost ? "warning" : "ok";
        return `
          <div class="production-usage-row ${lineClass}">
            <span>${escapeHtml(line.ingredient.name)}</span>
            <strong>${escapeHtml(formatActualUsageLabel(line.actualUsage, line.measure))} · ${escapeHtml(money(line.actualCost))}</strong>
          </div>
        `;
    }).join("")}
    </div>
    <p class="production-preview-note">${escapeHtml(readiness.detail)}</p>
  ` : emptyState("Select a recipe before saving a batch result.");
    if (submitButton)
        submitButton.disabled = !can("canManageProcedures") || !readiness.ok;
}
function renderTeam() {
    const isDriverRole = currentRoleKey() === "driver";
    const user = currentUser();
    const schedulePanel = document.querySelector("#schedulePanel");
    const staffRoleSelect = document.querySelector("#staffRoleSelect");
    const userList = document.querySelector("#userList");
    document.querySelectorAll(".admin-only").forEach((panel) => {
        panel.hidden = !can("canCreateUsers");
    });
    if (schedulePanel)
        schedulePanel.hidden = isDriverRole;
    if (staffRoleSelect) {
        staffRoleSelect.innerHTML = ROLE_ORDER
            .filter((role) => role !== "owner_admin")
            .map((role) => `<option value="${escapeHtml(role)}">${escapeHtml(roleDefinition(role).label)}</option>`)
            .join("");
    }
    if (userList) {
        userList.innerHTML = state.users
            .map((account) => `
        <article class="user-card">
          <div>
            <strong>${escapeHtml(account.name)}</strong>
            <p>${escapeHtml(account.email)}</p>
          </div>
          <span class="pill ${account.status === "Active" ? "ok" : "warning"}">${escapeHtml(roleDefinition(account.role).label)}</span>
        </article>
      `)
            .join("");
    }
    const staffToShow = isDriverRole ? [] : state.staff;
    document.querySelector("#staffList").innerHTML = staffToShow.length
        ? staffToShow.map((person) => {
            const late = person.clocked !== "-" && person.clocked > person.planned.slice(0, 5);
            return `
      <article class="staff-card">
        <header>
          <div>
            <strong>${escapeHtml(person.name)}</strong>
            <p>${escapeHtml(person.role)} | Planned ${escapeHtml(person.planned)}</p>
          </div>
          <span class="pill ${late ? "warning" : "ok"}">${escapeHtml(person.status)}</span>
        </header>
        <p>Clocked: ${escapeHtml(person.clocked)}</p>
      </article>
    `;
        }).join("")
        : emptyState("No staff schedule is visible for this role.");
    const driversToShow = isDriverRole
        ? state.drivers.filter((driver) => driver.id === user.id || driver.name.split(" ")[0] === user.name.split(" ")[0])
        : state.drivers;
    document.querySelector("#driverList").innerHTML = driversToShow.length
        ? driversToShow.map((driver) => {
            const order = driver.orderId ? orderById(driver.orderId) : null;
            return `
      <article class="driver-card">
        <header>
          <div>
            <strong>${escapeHtml(driver.name)}</strong>
            <p>${escapeHtml(driver.location)}</p>
          </div>
          <span class="pill ${driver.status === "Available" ? "ok" : "info"}">${escapeHtml(driver.status)}</span>
        </header>
        <p>${escapeHtml(order ? `Order #${order.number} | ETA ${driver.eta}` : "Ready for next delivery.")}</p>
      </article>
    `;
        }).join("")
        : emptyState("No driver profile found for this account.");
}
function renderSettings() {
    const form = document.querySelector("#settingsForm");
    const defaultLanguageSelect = document.querySelector("#defaultLanguageSelect");
    const languageChecks = document.querySelector("#supportedLanguageChecks");
    const schemaGrid = document.querySelector("#schemaGrid");
    if (!form || !defaultLanguageSelect || !languageChecks || !schemaGrid)
        return;
    const settings = state.restaurantSettings;
    const editable = can("canEditSettings");
    form.elements.restaurantName.value = settings.restaurantName;
    form.elements.location.value = settings.location;
    form.elements.currency.value = settings.currency;
    form.elements.opensAt.value = settings.opensAt;
    form.elements.closesAt.value = settings.closesAt;
    defaultLanguageSelect.innerHTML = LANGUAGE_OPTIONS
        .map((language) => `<option value="${escapeHtml(language.id)}">${escapeHtml(language.label)}</option>`)
        .join("");
    defaultLanguageSelect.value = settings.defaultLanguage;
    languageChecks.innerHTML = LANGUAGE_OPTIONS
        .map((language) => `
      <label class="check-row">
        <input name="supportedLanguages" type="checkbox" value="${escapeHtml(language.id)}" ${settings.supportedLanguages.includes(language.id) ? "checked" : ""}>
        <span>${escapeHtml(language.label)}</span>
      </label>
    `)
        .join("");
    form.querySelectorAll("input, select, button").forEach((element) => {
        element.disabled = !editable;
    });
    const counts = {
        users: state.users.length,
        roles: ROLE_ORDER.length,
        restaurant_settings: 1,
        sellable_products: state.products.length,
        purchased_products: state.ingredients.length,
        orders: state.orders.length,
        kitchen_tickets: state.tickets.length,
        table_qr_codes: state.tableQrCodes.length,
        reservations: state.reservations.length,
        procedures: state.procedures.length,
        procedure_completions: state.procedureCompletions.length,
        recipes: state.products.reduce((sum, product) => sum + (product.recipe?.length || 0), 0)
    };
    schemaGrid.innerHTML = DATA_MODEL
        .map((collection) => `
      <article class="schema-card">
        <header>
          <strong>${escapeHtml(collection.name)}</strong>
          <span class="pill info">${counts[collection.name] || 0}</span>
        </header>
        <p>${escapeHtml(collection.fields)}</p>
      </article>
    `)
        .join("");
    renderQrCodeManagement();
}
function tableOptionsHtml(selectedTableId) {
    return state.tables
        .map((table) => `<option value="${escapeHtml(table.id)}" ${table.id === selectedTableId ? "selected" : ""}>${escapeHtml(table.name)} - ${escapeHtml(table.zone)}</option>`)
        .join("");
}
function renderQrCodeManagement() {
    const form = document.querySelector("#qrCodeForm");
    const tableSelect = document.querySelector("#qrTableSelect");
    const areaInput = document.querySelector("#qrAreaInput");
    const list = document.querySelector("#qrCodeList");
    if (!form || !tableSelect || !areaInput || !list)
        return;
    const editable = can("canEditSettings");
    const selectedTable = tableById(tableSelect.value) || state.tables[0];
    tableSelect.innerHTML = tableOptionsHtml(selectedTable?.id || "");
    tableSelect.value = selectedTable?.id || "";
    if (!areaInput.value && selectedTable)
        areaInput.value = selectedTable.zone;
    form.querySelectorAll("input, select, button").forEach((element) => {
        element.disabled = !editable;
    });
    const sortedCodes = state.tableQrCodes.slice().sort((first, second) => {
        const firstTable = tableById(first.tableId)?.name || "";
        const secondTable = tableById(second.tableId)?.name || "";
        return firstTable.localeCompare(secondTable) || first.createdAt.localeCompare(second.createdAt);
    });
    list.innerHTML = sortedCodes.length
        ? sortedCodes.map((code) => {
            const table = tableById(code.tableId);
            const url = getQrOrderUrl(code);
            const disabled = code.status !== "Active";
            return `
        <article class="qr-admin-card ${disabled ? "is-disabled" : ""}">
          <header>
            <div>
              <strong>${escapeHtml(table?.name || "Unassigned table")}</strong>
              <p>${escapeHtml(code.area || table?.zone || "Dining room")} · ${escapeHtml(code.token)}</p>
            </div>
            <span class="pill ${disabled ? "warning" : "ok"}">${escapeHtml(code.status)}</span>
          </header>
          <div class="qr-admin-body">
            <div class="qr-code-box">
              ${qrCodeSvg(url, `${table?.name || "Table"} QR order code`)}
            </div>
            <div class="qr-admin-controls">
              <div class="form-row">
                <label>
                  Table
                  <select data-qr-table="${escapeHtml(code.id)}" ${!editable ? "disabled" : ""}>
                    ${tableOptionsHtml(code.tableId)}
                  </select>
                </label>
                <label>
                  Area
                  <input data-qr-area="${escapeHtml(code.id)}" type="text" value="${escapeHtml(code.area || table?.zone || "")}" ${!editable ? "disabled" : ""}>
                </label>
              </div>
              <label>
                Customer URL
                <input type="text" value="${escapeHtml(url)}" readonly>
              </label>
              <div class="mini-actions qr-actions">
                <button class="mini-btn" type="button" data-open-qr="${escapeHtml(code.id)}">Open</button>
                <button class="mini-btn" type="button" data-assign-qr="${escapeHtml(code.id)}" ${!editable ? "disabled" : ""}>Assign</button>
                <button class="mini-btn" type="button" data-regenerate-qr="${escapeHtml(code.id)}" ${!editable ? "disabled" : ""}>Regenerate</button>
                <button class="mini-btn ${disabled ? "" : "danger-action"}" type="button" data-toggle-qr="${escapeHtml(code.id)}" ${!editable ? "disabled" : ""}>${disabled ? "Enable" : "Disable"}</button>
              </div>
            </div>
          </div>
        </article>
      `;
        }).join("")
        : emptyState("Create table QR codes to enable customer ordering.");
}
function renderReservationPlanner() {
    const form = document.querySelector("#reservationForm");
    const tableSelect = document.querySelector("#reservationTable");
    const availabilityPanel = document.querySelector("#reservationAvailability");
    const submitButton = document.querySelector("#bookReservationBtn");
    if (!form || !tableSelect || !availabilityPanel || !submitButton)
        return;
    const guests = Math.max(1, Math.floor(Number(form.elements.guests.value) || 1));
    const time = form.elements.time.value || "";
    const currentTable = tableById(tableSelect.value);
    const preferredTable = currentTable || getAvailableReservationTable({ guests, time }) || state.tables[0];
    tableSelect.innerHTML = state.tables
        .map((table) => `<option value="${escapeHtml(table.id)}">${escapeHtml(table.name)} - ${table.capacity} seats - ${escapeHtml(table.zone)}</option>`)
        .join("");
    tableSelect.value = preferredTable?.id || "";
    const validation = getReservationValidation({ guests, time, tableId: tableSelect.value });
    availabilityPanel.className = `availability-card ${validation.className}`.trim();
    availabilityPanel.innerHTML = `
    <header>
      <strong>${escapeHtml(validation.title)}</strong>
      <span class="pill ${validation.pillClass}">${escapeHtml(validation.pillText)}</span>
    </header>
    <p>${escapeHtml(validation.detail)}</p>
  `;
    submitButton.disabled = !can("canManageReservations") || !validation.ok;
}
function renderReservations() {
    const tableSummary = document.querySelector("#tableCapacityGrid");
    if (tableSummary) {
        tableSummary.innerHTML = state.tables.map((table) => {
            const reservations = state.reservations.filter((reservation) => reservation.tableId === table.id);
            const nextReservation = reservations.slice().sort((a, b) => a.time.localeCompare(b.time))[0];
            return `
        <article class="table-capacity-card">
          <strong>${escapeHtml(table.name)}</strong>
          <span>${table.capacity} seats</span>
          <p>${escapeHtml(nextReservation ? `${reservations.length} tonight, next ${nextReservation.time}` : "Open tonight")}</p>
        </article>
      `;
        }).join("");
    }
    document.querySelector("#reservationList").innerHTML = state.reservations
        .slice()
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((reservation) => {
        const table = tableById(reservation.tableId);
        const issues = getReservationIssues(reservation);
        const statusClass = issues.length ? "danger" : "ok";
        const statusText = issues.length ? "Review" : reservation.status;
        return `
        <article class="reservation-card ${issues.length ? "is-conflict" : ""}">
          <header>
            <div>
              <strong>${escapeHtml(reservation.time)} ${escapeHtml(reservation.name)}</strong>
              <p>${reservation.guests} guests | ${escapeHtml(table ? table.name : "Unassigned")} | ${escapeHtml(reservation.source)}</p>
            </div>
            <span class="pill ${statusClass}">${escapeHtml(statusText)}</span>
          </header>
          <p>${escapeHtml(issues.length ? issues.join(" | ") : `${getReservationWindowLabel(reservation.time)} hold, seats up to ${table?.capacity || 0}.`)}</p>
        </article>
      `;
    }).join("");
}
function updateView() {
    document.querySelectorAll(".view").forEach((view) => {
        view.classList.toggle("is-active", view.id === `view-${state.activeView}`);
    });
    const currentView = document.querySelector(`#view-${state.activeView}`);
    document.querySelector("#viewTitle").textContent = currentView?.dataset.title || "Dashboard";
    document.querySelectorAll(".nav-item").forEach((item) => {
        item.classList.toggle("is-active", item.dataset.view === state.activeView);
    });
}
function showToast(message) {
    const toast = document.querySelector("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
}
function login(formData) {
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const user = state.users.find((account) => account.email === email && account.status === "Active");
    if (!user || user.password !== password) {
        showToast("Email or password is not correct.");
        return;
    }
    state.currentUserId = user.id;
    state.activeView = roleDefinition(user.role).homeView;
    saveState();
    render();
    showToast(`Logged in as ${roleDefinition(user.role).label}.`);
}
function logout() {
    state.currentUserId = "";
    saveState();
    render();
    showToast("Signed out.");
}
function uniqueRecordId(base, collections) {
    let nextId = slugify(base, "user");
    let suffix = 2;
    const exists = (id) => collections.some((collection) => collection.some((item) => item.id === id));
    while (exists(nextId)) {
        nextId = `${slugify(base, "user")}-${suffix}`;
        suffix += 1;
    }
    return nextId;
}
function addSellableRecipeLine(ingredientId, quantity, measureKey, station, wastePercent, appliesTo, notes) {
    if (!can("canManageProducts")) {
        showToast("Only Owner/Admin can manage products.");
        return;
    }
    const ingredient = ingredientById(ingredientId);
    const amount = Math.max(0, Number(quantity) || 0);
    if (!ingredient || !ingredient.active || amount <= 0) {
        showToast("Choose an active purchased product and a usage amount.");
        return;
    }
    const line = buildRecipeLine(ingredient.id, amount, measureKey, station, wastePercent, appliesTo, notes);
    const normalizedLine = normalizeRecipeLine(line, new Set(state.ingredients.map((item) => item.id)));
    if (!normalizedLine) {
        showToast("Choose a valid recipe amount.");
        return;
    }
    const measure = getRecipeMeasure(normalizedLine);
    const existing = state.productRecipeDraft.find((draftLine) => {
        return draftLine.ingredientId === normalizedLine.ingredientId
            && getRecipeMeasure(draftLine).key === measure.key
            && draftLine.appliesTo === normalizedLine.appliesTo
            && draftLine.station === normalizedLine.station
            && normalizeRecipeWastePercent(draftLine.wastePercent) === normalizeRecipeWastePercent(normalizedLine.wastePercent)
            && String(draftLine.notes || "") === String(normalizedLine.notes || "");
    });
    if (existing) {
        existing[measure.key] = Number((getRecipeLineQuantity(existing) + getRecipeLineQuantity(normalizedLine)).toFixed(3));
    }
    else {
        state.productRecipeDraft.push(normalizedLine);
    }
    saveState();
    render();
    showToast(`${ingredient.name} linked to the recipe.`);
}
function removeSellableRecipeLine(index) {
    if (!can("canManageProducts"))
        return;
    state.productRecipeDraft.splice(Number(index), 1);
    saveState();
    render();
}
function createSellableProduct(formData) {
    if (!can("canManageProducts")) {
        showToast("Only Owner/Admin can create products.");
        return;
    }
    const name = String(formData.get("name") || "").trim();
    const code = String(formData.get("code") || "").trim();
    const category = String(formData.get("category") || "Other");
    const station = normalizeKitchenStation(formData.get("station") || "Main kitchen");
    const price = Math.max(0, Number(formData.get("price")) || 0);
    const vatSetting = String(formData.get("vatSetting") || "standard");
    const active = formData.get("active") === "true";
    const targetMargin = normalizeMarginPercent(formData.get("targetMargin"), DEFAULT_MARGIN_TARGET);
    const minMargin = Math.min(targetMargin, normalizeMarginPercent(formData.get("minMargin"), DEFAULT_MARGIN_MINIMUM));
    const selectedAvailability = new Set(formData.getAll("availability"));
    const recipe = normalizeRecipeLines(state.productRecipeDraft, new Set(state.ingredients.map((ingredient) => ingredient.id)));
    if (!name || !code || !station || price <= 0) {
        showToast("Add product name, SKU, station, and selling price.");
        return;
    }
    if (state.products.some((product) => product.code.toLowerCase() === code.toLowerCase())) {
        showToast("A sellable product with that SKU already exists.");
        return;
    }
    if (!selectedAvailability.size) {
        showToast("Select at least one ordering channel.");
        return;
    }
    if (!recipe.length) {
        showToast("Link at least one purchased product to the recipe.");
        return;
    }
    const availability = AVAILABILITY_OPTIONS.reduce((nextAvailability, option) => {
        nextAvailability[option.id] = selectedAvailability.has(option.id);
        return nextAvailability;
    }, {});
    state.products.push({
        id: uniqueRecordId(name, [state.products, state.ingredients]),
        name,
        code,
        category: PRODUCT_CATEGORIES.includes(category) ? category : "Other",
        station,
        price,
        vatSetting: VAT_OPTIONS.some((option) => option.id === vatSetting) ? vatSetting : "standard",
        active,
        availability,
        targetMargin,
        minMargin,
        recipe
    });
    state.productRecipeDraft = [];
    saveState();
    render();
    showToast(`${name} added to sellable products.`);
}
function createPurchasedProduct(formData) {
    if (!can("canManageProducts")) {
        showToast("Only Owner/Admin can create purchased products.");
        return;
    }
    const name = String(formData.get("name") || "").trim();
    const supplier = String(formData.get("supplier") || "").trim();
    const purchasePrice = Math.max(0, Number(formData.get("purchasePrice")) || 0);
    const unitType = unitTypeDefinition(formData.get("unitType"));
    const stock = Math.max(0, Number(formData.get("stock")) || 0);
    const min = Math.max(0, Number(formData.get("min")) || 0);
    const requestedMax = Math.max(0, Number(formData.get("max")) || 0);
    const max = requestedMax;
    const location = getSelectedInventoryLocation(formData, "location", "customLocation");
    const expiryDate = String(formData.get("expiryDate") || "").trim();
    const barcode = String(formData.get("barcode") || "").trim();
    const active = formData.get("active") === "true";
    if (!name || !supplier || !location || purchasePrice <= 0 || requestedMax <= 0) {
        showToast("Add ingredient name, supplier, purchase price, stock limits, and storage location.");
        return;
    }
    if (min > requestedMax) {
        showToast("Minimum stock cannot be higher than maximum stock.");
        return;
    }
    state.ingredients.push({
        id: uniqueRecordId(name, [state.ingredients, state.products]),
        name,
        supplier,
        purchasePrice,
        unitType: unitType.id,
        unit: unitType.shortLabel,
        stock,
        min,
        max,
        location,
        locationStock: { [rememberInventoryLocation(location)]: stock },
        expiryDate,
        barcode,
        active
    });
    pushInventoryHistory({
        ingredient: state.ingredients[state.ingredients.length - 1],
        type: "add",
        quantity: stock,
        toLocation: location,
        detail: `Opening stock entered for ${name}.`
    });
    saveState();
    render();
    showToast(`${name} added to purchased products.`);
}
function toggleSellableProduct(productId) {
    if (!can("canManageProducts")) {
        showToast("Only Owner/Admin can manage products.");
        return;
    }
    const product = productById(productId);
    if (!product)
        return;
    product.active = !product.active;
    if (!product.active)
        state.orderDraft = state.orderDraft.filter((item) => item.productId !== product.id);
    saveState();
    render();
    showToast(`${product.name} marked ${product.active ? "active" : "inactive"}.`);
}
function togglePurchasedProduct(ingredientId) {
    if (!can("canManageProducts")) {
        showToast("Only Owner/Admin can manage products.");
        return;
    }
    const ingredient = ingredientById(ingredientId);
    if (!ingredient)
        return;
    ingredient.active = !ingredient.active;
    if (!ingredient.active)
        state.productRecipeDraft = state.productRecipeDraft.filter((line) => line.ingredientId !== ingredient.id);
    saveState();
    render();
    showToast(`${ingredient.name} marked ${ingredient.active ? "active" : "inactive"}.`);
}
function updateIngredientPurchasePrice(ingredientId, value) {
    if (!can("canManageProducts")) {
        showToast("Only Owner/Admin can update purchase prices.");
        return;
    }
    const ingredient = ingredientById(ingredientId);
    const purchasePrice = Math.max(0, Number(value) || 0);
    if (!ingredient || purchasePrice <= 0) {
        showToast("Enter a purchase price above zero.");
        return;
    }
    ingredient.purchasePrice = Number(purchasePrice.toFixed(2));
    saveState();
    render();
    showToast(`${ingredient.name} price updated; product costs recalculated.`);
}
function getSelectedInventoryLocation(formData, selectName, customName = "") {
    const customLocation = customName ? normalizeInventoryLocationName(formData.get(customName), "") : "";
    return customLocation || normalizeInventoryLocationName(formData.get(selectName), "");
}
function getFormDateTimeTimestamp(value) {
    const timestamp = Date.parse(String(value || ""));
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
}
function pushWasteRecord({ ingredient, quantity, unitType, stockQuantity, reason, staffId, occurredAtMs, notes = "", fromLocation = "" }) {
    const staff = state.users.find((user) => user.id === staffId) || currentUser();
    const normalizedUnitType = normalizeWasteUnitType(unitType, ingredient);
    const normalizedQuantity = normalizeStockQuantity(quantity);
    const normalizedStockQuantity = normalizeStockQuantity(stockQuantity);
    const cost = getWasteCost(ingredient, normalizedStockQuantity);
    const record = {
        id: `WST-${Date.now()}-${state.wasteRecords.length + 1}`,
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        quantity: normalizedQuantity,
        unitType: normalizedUnitType,
        stockQuantity: normalizedStockQuantity,
        stockUnit: ingredient.unit,
        reason: normalizeWasteReason(reason),
        staffId: staff?.id || "",
        staffName: staff?.name || "Staff",
        occurredAtMs: normalizeOptionalTimestamp(occurredAtMs) || Date.now(),
        notes: String(notes || "").trim(),
        fromLocation: normalizeInventoryLocationName(fromLocation, ""),
        cost
    };
    const detailParts = [
        `${record.reason} waste recorded by ${record.staffName}: ${formatWasteQuantity(record)} ${ingredient.name}`,
        `${money(cost)} cost`
    ];
    if (record.notes)
        detailParts.push(record.notes);
    state.wasteRecords.push(record);
    state.wasteRecords = state.wasteRecords.slice(-120);
    pushInventoryHistory({
        ingredient,
        type: "waste",
        quantity: normalizedStockQuantity,
        fromLocation: record.fromLocation,
        detail: detailParts.join(". ")
    });
    state.productionLog.push({
        id: `LOG-${Date.now()}`,
        time: timeNow(),
        text: `Waste logged: ${formatWasteQuantity(record)} ${ingredient.name} (${record.reason}) cost ${money(cost)}.`
    });
    return record;
}
function recordWaste(formData, form = null) {
    if (!can("canRecordWaste")) {
        showToast("This role cannot record waste.");
        return;
    }
    const ingredient = ingredientById(formData.get("ingredientId"));
    if (!ingredient) {
        showToast("Choose a product before recording waste.");
        return;
    }
    const quantity = normalizeStockQuantity(formData.get("quantity"));
    const unitType = normalizeWasteUnitType(formData.get("unitType"), ingredient);
    const stockQuantity = convertWasteQuantityToStockUnits(ingredient, quantity, unitType);
    if (quantity <= 0 || stockQuantity <= 0) {
        showToast("Enter a waste quantity above zero.");
        return;
    }
    if (stockQuantity > ingredient.stock) {
        showToast(`Only ${formatStockAmount(ingredient.stock, ingredient.unit)} ${ingredient.name} is available.`);
        return;
    }
    const result = deductIngredientStock(ingredient, stockQuantity);
    const fromLocation = result.removals.map((removal) => removal.location).join(", ");
    const record = pushWasteRecord({
        ingredient,
        quantity,
        unitType,
        stockQuantity: result.removed,
        reason: formData.get("reason"),
        staffId: formData.get("staffId"),
        occurredAtMs: getFormDateTimeTimestamp(formData.get("occurredAt")),
        notes: formData.get("notes"),
        fromLocation
    });
    saveState();
    render();
    if (form) {
        form.elements.notes.value = "";
        form.elements.occurredAt.value = formatDateTimeLocalInput();
    }
    let toastText = `${formatWasteQuantity(record)} ${ingredient.name} waste recorded; ${formatStockAmount(ingredient.stock, ingredient.unit)} remains.`;
    if (getIngredientStatus(ingredient) === "danger") {
        toastText += ` Low-stock alert: reorder ${formatStockAmount(getSupplierOrderQuantity(ingredient), ingredient.unit)}.`;
    }
    showToast(toastText);
}
function applyInventoryAction(formData) {
    if (!can("canManageInventory")) {
        showToast("This role cannot change inventory.");
        return;
    }
    const ingredient = ingredientById(formData.get("ingredientId"));
    const action = String(formData.get("action") || "");
    const quantity = normalizeStockQuantity(formData.get("quantity"));
    const actionDefinition = INVENTORY_ACTIONS.find((item) => item.id === action);
    if (!ingredient || !actionDefinition) {
        showToast("Choose a purchased product and inventory action.");
        return;
    }
    const fromLocation = getSelectedInventoryLocation(formData, "fromLocation");
    const toLocation = getSelectedInventoryLocation(formData, "toLocation", "customLocation");
    const fromQuantity = normalizeStockQuantity(ingredient.locationStock?.[fromLocation] || 0);
    let toastText = "";
    if (action !== "correct" && quantity <= 0) {
        showToast("Enter a quantity above zero.");
        return;
    }
    if (action === "add") {
        if (!toLocation) {
            showToast("Choose the location receiving stock.");
            return;
        }
        addStockToLocation(ingredient, toLocation, quantity);
        pushInventoryHistory({
            ingredient,
            type: action,
            quantity,
            toLocation,
            detail: `Added ${formatStockAmount(quantity, ingredient.unit)} to ${toLocation}.`
        });
        toastText = `${formatStockAmount(quantity, ingredient.unit)} added to ${ingredient.name}.`;
    }
    if (action === "remove" || action === "waste") {
        if (!fromLocation) {
            showToast("Choose the location to reduce.");
            return;
        }
        if (quantity > fromQuantity) {
            showToast(`Only ${formatStockAmount(fromQuantity, ingredient.unit)} is in ${fromLocation}.`);
            return;
        }
        const removed = removeStockFromLocation(ingredient, fromLocation, quantity);
        if (action === "waste") {
            pushWasteRecord({
                ingredient,
                quantity: removed,
                unitType: ingredient.unitType,
                stockQuantity: removed,
                reason: "Other",
                staffId: currentUser()?.id,
                occurredAtMs: Date.now(),
                notes: "Marked wasted from stock action.",
                fromLocation
            });
        }
        else {
            pushInventoryHistory({
                ingredient,
                type: action,
                quantity: removed,
                fromLocation,
                detail: `Removed ${formatStockAmount(removed, ingredient.unit)} from ${fromLocation}.`
            });
        }
        toastText = `${ingredient.name} ${action === "waste" ? "waste" : "stock"} updated.`;
    }
    if (action === "transfer") {
        if (!fromLocation || !toLocation) {
            showToast("Choose both transfer locations.");
            return;
        }
        if (fromLocation === toLocation) {
            showToast("Choose two different locations for a transfer.");
            return;
        }
        if (quantity > fromQuantity) {
            showToast(`Only ${formatStockAmount(fromQuantity, ingredient.unit)} is in ${fromLocation}.`);
            return;
        }
        const removed = removeStockFromLocation(ingredient, fromLocation, quantity);
        addStockToLocation(ingredient, toLocation, removed);
        pushInventoryHistory({
            ingredient,
            type: action,
            quantity: removed,
            fromLocation,
            toLocation,
            detail: `Transferred ${formatStockAmount(removed, ingredient.unit)} from ${fromLocation} to ${toLocation}.`
        });
        toastText = `${ingredient.name} transferred to ${toLocation}.`;
    }
    if (action === "correct") {
        if (!toLocation) {
            showToast("Choose the location to correct.");
            return;
        }
        const previousQuantity = normalizeStockQuantity(ingredient.locationStock?.[toLocation] || 0);
        setIngredientLocationStock(ingredient, toLocation, quantity);
        pushInventoryHistory({
            ingredient,
            type: action,
            quantity,
            toLocation,
            detail: `Manual correction set ${toLocation} from ${formatStockAmount(previousQuantity, ingredient.unit)} to ${formatStockAmount(quantity, ingredient.unit)}.`
        });
        toastText = `${ingredient.name} count corrected.`;
    }
    saveState();
    render();
    const stockStatus = getIngredientStatus(ingredient);
    if (stockStatus === "danger")
        toastText += ` Low-stock alert: reorder ${formatStockAmount(getSupplierOrderQuantity(ingredient), ingredient.unit)}.`;
    if (stockStatus === "over")
        toastText += " Over-stock warning.";
    showToast(toastText);
}
function createStaffUser(formData) {
    if (!can("canCreateUsers")) {
        showToast("Only Owner/Admin can create staff users.");
        return;
    }
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const role = String(formData.get("role") || "");
    const password = String(formData.get("password") || "").trim();
    const planned = String(formData.get("planned") || "12:00-20:00").trim();
    if (!name || !email || !ROLE_DEFINITIONS[role] || role === "owner_admin" || password.length < 4) {
        showToast("Add a name, email, staff role, and password of at least 4 characters.");
        return;
    }
    if (state.users.some((user) => user.email === email)) {
        showToast("A user with that email already exists.");
        return;
    }
    const id = uniqueRecordId(email.split("@")[0], [state.users, state.staff, state.drivers]);
    const roleInfo = roleDefinition(role);
    state.users.push({ id, name, email, role, password, status: "Active" });
    state.staff.push({
        id,
        name,
        role: roleInfo.operationalRole,
        planned,
        clocked: "-",
        status: "Starts soon"
    });
    if (role === "driver") {
        state.drivers.push({
            id,
            name,
            status: "Available",
            eta: "-",
            orderId: null,
            location: "Restaurant"
        });
    }
    saveState();
    render();
    showToast(`${name} can now log in as ${roleInfo.label}.`);
}
function saveRestaurantSettings(formData) {
    if (!can("canEditSettings")) {
        showToast("This role cannot edit restaurant settings.");
        return;
    }
    const defaultLanguage = String(formData.get("defaultLanguage") || DEFAULT_RESTAURANT_SETTINGS.defaultLanguage);
    const supportedLanguages = formData.getAll("supportedLanguages").filter((language) => {
        return LANGUAGE_OPTIONS.some((option) => option.id === language);
    });
    if (!supportedLanguages.includes(defaultLanguage))
        supportedLanguages.push(defaultLanguage);
    state.restaurantSettings = normalizeRestaurantSettings({
        restaurantName: String(formData.get("restaurantName") || "").trim(),
        location: String(formData.get("location") || "").trim(),
        currency: "EUR",
        opensAt: String(formData.get("opensAt") || ""),
        closesAt: String(formData.get("closesAt") || ""),
        defaultLanguage,
        supportedLanguages
    });
    saveState();
    render();
    showToast("Restaurant settings saved.");
}
function createTableQrCode(formData) {
    if (!can("canEditSettings")) {
        showToast("This role cannot manage QR codes.");
        return;
    }
    const table = tableById(formData.get("tableId"));
    if (!table) {
        showToast("Choose a table before creating a QR code.");
        return;
    }
    state.tableQrCodes
        .filter((code) => code.tableId === table.id && code.status === "Active")
        .forEach((code) => {
        code.status = "Disabled";
    });
    const token = createQrToken(table.id, new Set(state.tableQrCodes.map((code) => code.token)));
    state.tableQrCodes.push({
        id: `qr-${table.id}-${Date.now()}`,
        tableId: table.id,
        area: String(formData.get("area") || table.zone || "Dining room").trim(),
        token,
        status: "Active",
        createdAt: timeNow(),
        regeneratedAt: ""
    });
    saveState();
    render();
    showToast(`${table.name} QR code created.`);
}
function assignQrCode(qrCodeId) {
    if (!can("canEditSettings")) {
        showToast("This role cannot manage QR codes.");
        return;
    }
    const code = qrCodeById(qrCodeId);
    const tableSelect = document.querySelector(`[data-qr-table="${qrCodeId}"]`);
    const areaInput = document.querySelector(`[data-qr-area="${qrCodeId}"]`);
    const table = tableById(tableSelect?.value);
    if (!code || !table) {
        showToast("Choose a valid table for that QR code.");
        return;
    }
    code.tableId = table.id;
    code.area = String(areaInput?.value || table.zone || "Dining room").trim();
    if (code.status === "Active") {
        state.tableQrCodes
            .filter((item) => item.id !== code.id && item.tableId === code.tableId && item.status === "Active")
            .forEach((item) => {
            item.status = "Disabled";
        });
    }
    saveState();
    render();
    showToast(`${code.token} assigned to ${table.name}.`);
}
function toggleQrCode(qrCodeId) {
    if (!can("canEditSettings")) {
        showToast("This role cannot manage QR codes.");
        return;
    }
    const code = qrCodeById(qrCodeId);
    if (!code)
        return;
    code.status = code.status === "Active" ? "Disabled" : "Active";
    if (code.status === "Active") {
        state.tableQrCodes
            .filter((item) => item.id !== code.id && item.tableId === code.tableId && item.status === "Active")
            .forEach((item) => {
            item.status = "Disabled";
        });
    }
    saveState();
    render();
    showToast(`QR code ${code.status.toLowerCase()}.`);
}
function regenerateQrCode(qrCodeId) {
    if (!can("canEditSettings")) {
        showToast("This role cannot manage QR codes.");
        return;
    }
    const code = qrCodeById(qrCodeId);
    if (!code)
        return;
    code.token = createQrToken(code.tableId, new Set(state.tableQrCodes.filter((item) => item.id !== code.id).map((item) => item.token)));
    code.status = "Active";
    code.regeneratedAt = timeNow();
    state.tableQrCodes
        .filter((item) => item.id !== code.id && item.tableId === code.tableId && item.status === "Active")
        .forEach((item) => {
        item.status = "Disabled";
    });
    saveState();
    render();
    showToast("QR code regenerated; the previous link is disabled.");
}
function openQrCustomerUrl(qrCodeId) {
    const code = qrCodeById(qrCodeId);
    if (!code)
        return;
    window.open(getQrOrderUrl(code), "_blank", "noopener");
}
function setView(view) {
    if (!canView(view)) {
        showToast("That page is not available for this role.");
        return;
    }
    state.activeView = view;
    saveState();
    render();
}
function rememberInventoryLocation(location) {
    const normalizedLocation = normalizeInventoryLocationName(location, "");
    if (!normalizedLocation || isDefaultInventoryLocation(normalizedLocation))
        return normalizedLocation;
    if (!state.customInventoryLocations.includes(normalizedLocation)) {
        state.customInventoryLocations = sortInventoryLocations([...state.customInventoryLocations, normalizedLocation])
            .filter((item) => !isDefaultInventoryLocation(item));
    }
    return normalizedLocation;
}
function setIngredientLocationStock(ingredient, location, quantity) {
    const normalizedLocation = rememberInventoryLocation(location);
    if (!normalizedLocation)
        return;
    const normalizedQuantity = normalizeStockQuantity(quantity);
    ingredient.locationStock = ingredient.locationStock || {};
    if (normalizedQuantity <= 0)
        delete ingredient.locationStock[normalizedLocation];
    else
        ingredient.locationStock[normalizedLocation] = normalizedQuantity;
    syncIngredientStock(ingredient);
}
function addStockToLocation(ingredient, location, quantity) {
    const normalizedLocation = rememberInventoryLocation(location);
    if (!normalizedLocation)
        return;
    const currentQuantity = normalizeStockQuantity(ingredient.locationStock?.[normalizedLocation] || 0);
    setIngredientLocationStock(ingredient, normalizedLocation, currentQuantity + normalizeStockQuantity(quantity));
}
function removeStockFromLocation(ingredient, location, quantity) {
    const normalizedLocation = normalizeInventoryLocationName(location, "");
    const requestedQuantity = normalizeStockQuantity(quantity);
    const currentQuantity = normalizeStockQuantity(ingredient.locationStock?.[normalizedLocation] || 0);
    const removedQuantity = Math.min(currentQuantity, requestedQuantity);
    setIngredientLocationStock(ingredient, normalizedLocation, currentQuantity - removedQuantity);
    return removedQuantity;
}
function deductIngredientStock(ingredient, quantity, preferredLocation = "") {
    let remaining = normalizeStockQuantity(quantity);
    const removals = [];
    const preferred = normalizeInventoryLocationName(preferredLocation, "");
    const rows = getIngredientLocationRows(ingredient);
    const orderedRows = [
        ...rows.filter((row) => row.location === preferred),
        ...rows.filter((row) => row.location !== preferred).sort((first, second) => second.quantity - first.quantity)
    ];
    orderedRows.forEach((row) => {
        if (remaining <= 0)
            return;
        const removedQuantity = removeStockFromLocation(ingredient, row.location, remaining);
        if (removedQuantity <= 0)
            return;
        remaining = normalizeStockQuantity(remaining - removedQuantity);
        removals.push({ location: row.location, quantity: removedQuantity });
    });
    return { removed: normalizeStockQuantity(quantity - remaining), remaining, removals };
}
function pushInventoryHistory({ ingredient, type, quantity, fromLocation = "", toLocation = "", detail = "" }) {
    state.inventoryHistory.push({
        id: `INV-${Date.now()}-${state.inventoryHistory.length + 1}`,
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        type,
        quantity: normalizeStockQuantity(quantity),
        fromLocation: normalizeInventoryLocationName(fromLocation, ""),
        toLocation: normalizeInventoryLocationName(toLocation, ""),
        resultingStock: getIngredientTotalStock(ingredient),
        time: timeNow(),
        detail
    });
    state.inventoryHistory = state.inventoryHistory.slice(-80);
}
function deductInventoryForItems(items, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
    const changes = [];
    getStockRequirementsForItems(items, orderContext).forEach((required, ingredientId) => {
        const ingredient = ingredientById(ingredientId);
        if (!ingredient)
            return;
        const result = deductIngredientStock(ingredient, required);
        pushInventoryHistory({
            ingredient,
            type: "remove",
            quantity: result.removed,
            fromLocation: result.removals.map((removal) => removal.location).join(", "),
            detail: `Order used ${formatStockAmount(result.removed, ingredient.unit)} ${ingredient.name}.`
        });
        changes.push({
            ingredient,
            required,
            removed: result.removed,
            resultingStock: ingredient.stock
        });
    });
    return changes;
}
function getOrderCompletionToast(number, stations, stockChanges, items, orderContext) {
    const stationText = stations.length === 1 ? stations[0] : `${stations.length} stations`;
    const product = items.length === 1 ? productById(items[0].productId) : null;
    const primaryChange = stockChanges.length === 1 ? stockChanges[0] : null;
    let message = `Order #${number} sent to ${stationText}; inventory updated automatically.`;
    if (product && primaryChange) {
        message = `Order #${number} sent to ${stationText}; ${primaryChange.ingredient.name} stock is now ${formatStockAmount(primaryChange.resultingStock, primaryChange.ingredient.unit)}. ${product.name} margin ${getProductMargin(product, orderContext).toFixed(1)}%.`;
    }
    const lowStockChanges = stockChanges.filter((change) => getIngredientStatus(change.ingredient) === "danger");
    if (lowStockChanges.length) {
        const lowStockText = lowStockChanges
            .map((change) => `${change.ingredient.name} ${formatStockAmount(change.resultingStock, change.ingredient.unit)}`)
            .join(", ");
        message += ` Low-stock alert: ${lowStockText}.`;
    }
    return message;
}
function markSupplierOrderOrdered(supplier) {
    if (!can("canManageInventory")) {
        showToast("This role cannot manage supplier orders.");
        return;
    }
    const draft = getSupplierOrderDrafts().find((order) => order.supplier === supplier);
    if (!draft || !draft.items.length) {
        showToast("No supplier draft is ready for that supplier.");
        return;
    }
    const activeOrder = getActiveSupplierOrder(supplier);
    const orderedOrder = {
        id: activeOrder?.id || `SUP-${getSupplierKey(supplier)}-${Date.now()}`,
        supplier,
        status: "Ordered",
        createdAt: activeOrder?.createdAt || draft.createdAt || timeNow(),
        orderedAt: timeNow(),
        receivedAt: "",
        items: draft.items.map((item) => ({ ...item }))
    };
    if (activeOrder) {
        Object.assign(activeOrder, orderedOrder);
    }
    else {
        state.supplierOrders.push(orderedOrder);
    }
    saveState();
    render();
    showToast(`${supplier} supplier order marked ordered.`);
}
function receiveSupplierOrder(supplier) {
    if (!can("canManageInventory")) {
        showToast("This role cannot receive supplier orders.");
        return;
    }
    const order = getActiveSupplierOrder(supplier);
    if (!order || order.status !== "Ordered") {
        showToast("Mark the supplier order as ordered before receiving it.");
        return;
    }
    const receivedLines = order.items.map((item) => {
        const ingredient = ingredientById(item.ingredientId);
        if (!ingredient)
            return null;
        const location = getIngredientPrimaryLocation(ingredient);
        addStockToLocation(ingredient, location, item.quantity);
        pushInventoryHistory({
            ingredient,
            type: "add",
            quantity: item.quantity,
            toLocation: location,
            detail: `Supplier delivery received from ${supplier}.`
        });
        return `${formatStockAmount(item.quantity, ingredient.unit)} ${ingredient.name}`;
    }).filter(Boolean);
    order.status = "Received";
    order.receivedAt = timeNow();
    state.productionLog.push({
        id: `LOG-${Date.now()}`,
        time: timeNow(),
        text: `Supplier delivery received from ${supplier}: ${receivedLines.join(", ")} added to stock.`
    });
    saveState();
    render();
    showToast(`${supplier} delivery received and inventory updated.`);
}
function getSelectedLineModifiers() {
    const checked = [...document.querySelectorAll("input[name='lineModifier']:checked")]
        .map((input) => input.value);
    const customModifier = String(document.querySelector("#orderCustomModifier")?.value || "").trim();
    return normalizeLineModifiers(customModifier ? [...checked, customModifier] : checked);
}
function clearLineDetailFields() {
    document.querySelectorAll("input[name='lineModifier']:checked").forEach((input) => {
        input.checked = false;
    });
    const noteInput = document.querySelector("#orderLineNote");
    const customModifierInput = document.querySelector("#orderCustomModifier");
    if (noteInput)
        noteInput.value = "";
    if (customModifierInput)
        customModifierInput.value = "";
}
function addOrderDraftLine(productId, quantity, note = "", modifiers = []) {
    if (!can("canCreateOrders")) {
        showToast("This role cannot create orders.");
        return;
    }
    const product = productById(productId);
    const channel = normalizeOrderType(document.querySelector("#orderForm")?.elements.channel.value || "Dine-in");
    const orderContext = getCurrentOrderContext();
    const requestedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    const availability = getProductAvailability(product, state.orderDraft, orderContext);
    if (!product)
        return;
    if (!productCanBeOrdered(product, channel)) {
        showToast(`${product.name} is not active for ${channel}.`);
        renderOrderBuilder();
        return;
    }
    if (requestedQuantity > availability.maxQuantity) {
        showToast(`Only ${availability.maxQuantity} ${product.name} can be added with current stock.`);
        renderOrderBuilder();
        return;
    }
    state.orderDraft = normalizeOrderItems([
        ...state.orderDraft,
        {
            productId: product.id,
            quantity: requestedQuantity,
            note: String(note || "").trim(),
            modifiers: normalizeLineModifiers(modifiers)
        }
    ]);
    saveState();
    clearLineDetailFields();
    render();
    showToast(`${requestedQuantity}x ${product.name} added to basket.`);
}
function removeOrderDraftLine(index) {
    state.orderDraft.splice(Number(index), 1);
    state.orderDraft = normalizeOrderItems(state.orderDraft);
    saveState();
    render();
}
function clearOrderDraft() {
    state.orderDraft = [];
    saveState();
    render();
}
function getOrderCustomerLabel(channel, tableId, customerName) {
    const orderType = orderTypeDefinition(channel);
    const table = tableById(tableId);
    if (orderType.requiresTable && table)
        return table.name;
    return String(customerName || "").trim() || (orderType.requiresTable ? "Unassigned table" : "Walk-in");
}
function getKitchenTicketNotes(order, item) {
    return [
        order.notes,
        item.modifiers?.length ? `Modifiers: ${item.modifiers.join(", ")}` : "",
        item.note ? `Line note: ${item.note}` : ""
    ].filter(Boolean).join(" | ");
}
function createKitchenTicketsForOrder(order) {
    const existingTickets = state.tickets.filter((ticket) => ticket.orderId === order.id);
    if (existingTickets.length)
        return existingTickets;
    const createdAt = order.sentAt || timeNow();
    const createdAtMs = Date.now();
    const tickets = order.items.map((item, index) => {
        const product = productById(item.productId);
        return {
            id: `TCK-${order.number}-${index + 1}`,
            orderId: order.id,
            productId: product.id,
            quantity: item.quantity,
            station: normalizeKitchenStation(product.station),
            status: "Queued",
            createdAt,
            createdAtMs,
            acceptedAtMs: "",
            startedAtMs: "",
            delayedAtMs: "",
            readyAtMs: "",
            completedAtMs: "",
            notes: getKitchenTicketNotes(order, item),
            issueNote: ""
        };
    });
    state.tickets.push(...tickets);
    return tickets;
}
function validateOrderForKitchen(order) {
    const orderContext = {
        channel: order.channel,
        fulfillment: order.fulfillment
    };
    const shortages = getStockShortages(order.items, orderContext);
    if (shortages.length) {
        const missing = shortages.map((item) => `${formatStockAmount(item.shortage, item.ingredient.unit)} ${item.ingredient.name}`).join(", ");
        return { ok: false, message: `Cannot send order; missing ${missing}.` };
    }
    const unavailableItem = order.items.find((item) => !productCanBeOrdered(productById(item.productId), order.channel));
    if (unavailableItem) {
        const unavailableProduct = productById(unavailableItem.productId);
        return { ok: false, message: `${unavailableProduct?.name || "That product"} is not available for ${order.channel}.` };
    }
    const inactiveIngredientItem = order.items.find((item) => {
        const product = productById(item.productId);
        return (product?.recipe || []).some((line) => {
            if (!recipeLineAppliesToOrder(line, orderContext))
                return false;
            const ingredient = ingredientById(line.ingredientId);
            return !ingredient?.active;
        });
    });
    if (inactiveIngredientItem) {
        const product = productById(inactiveIngredientItem.productId);
        return { ok: false, message: `${product?.name || "That product"} has an inactive purchased product in its recipe.` };
    }
    return { ok: true, orderContext };
}
function sendOrderToKitchen(orderId, options = {}) {
    if (!options.skipPermission && !can("canCreateOrders")) {
        showToast("This role cannot send orders.");
        return false;
    }
    const order = orderById(orderId);
    if (!order)
        return false;
    if (order.status === "Cancelled" || order.status === "Paid") {
        showToast(`Order #${order.number} cannot be sent from ${order.status}.`);
        return false;
    }
    const validation = validateOrderForKitchen(order);
    if (!validation.ok) {
        showToast(validation.message);
        renderOrderBuilder();
        return false;
    }
    order.sentAt = order.sentAt || timeNow();
    order.status = "Sent to kitchen";
    const tickets = createKitchenTicketsForOrder(order);
    const stations = [...new Set(tickets.map((ticket) => ticket.station))];
    const stockChanges = order.inventoryDeducted ? [] : deductInventoryForItems(order.items, validation.orderContext);
    order.inventoryDeducted = true;
    if (order.fulfillment === "Delivery") {
        const availableDriver = state.drivers.find((driver) => driver.status === "Available");
        if (availableDriver) {
            availableDriver.status = "Assigned";
            availableDriver.orderId = order.id;
            availableDriver.eta = "18 min";
            availableDriver.location = "Restaurant";
            order.assignedDriver = availableDriver.id;
        }
    }
    saveState();
    render();
    if (!options.silent) {
        showToast(getOrderCompletionToast(order.number, stations, stockChanges, order.items, validation.orderContext));
    }
    return true;
}
function createOrder(formData, mode = "kitchen") {
    if (!can("canCreateOrders")) {
        showToast("This role cannot create orders.");
        return;
    }
    const channel = normalizeOrderType(formData.get("channel"));
    const orderType = orderTypeDefinition(channel);
    const orderContext = {
        channel,
        fulfillment: formData.get("fulfillment") || orderType.fulfillment
    };
    const paymentMethod = normalizePaymentMethod(formData.get("paymentMethod") || formData.get("paymentStatus"));
    const paymentStatus = getPaymentStatusForMethod(paymentMethod, formData.get("paymentStatus"));
    const items = state.orderDraft.length
        ? normalizeOrderItems(state.orderDraft)
        : normalizeOrderItems([{ productId: formData.get("productId"), quantity: formData.get("quantity") }]);
    const tableId = formData.get("tableId");
    if (!items.length) {
        showToast("Add an item before sending the order.");
        return;
    }
    if (orderType.requiresTable && !tableById(tableId)) {
        showToast("Select a table before creating the dine-in order.");
        return;
    }
    const number = state.nextOrderNumber;
    const orderId = `ORD-${number}`;
    const createdAt = timeNow();
    const createdAtMs = Date.now();
    const staff = currentUser();
    const order = {
        id: orderId,
        number,
        channel,
        orderType: channel,
        tableId: tableById(tableId) ? tableId : "",
        customer: getOrderCustomerLabel(channel, tableId, formData.get("customer")),
        paymentStatus,
        paymentMethod,
        fulfillment: orderContext.fulfillment,
        status: "New",
        createdAt,
        createdAtMs,
        sentAt: "",
        paidAt: paymentStatus === "Paid" ? createdAt : "",
        paidAtMs: paymentStatus === "Paid" ? createdAtMs : "",
        staffId: staff?.id || "",
        staffName: staff?.name || "",
        paidByUserId: paymentStatus === "Paid" ? staff?.id || "" : "",
        paidByName: paymentStatus === "Paid" ? staff?.name || "" : "",
        inventoryDeducted: false,
        notes: String(formData.get("notes") || "").trim(),
        items: items.map((item) => ({ ...item }))
    };
    const validation = validateOrderForKitchen(order);
    if (!validation.ok) {
        showToast(validation.message);
        renderOrderBuilder();
        return;
    }
    state.orders.push(order);
    state.nextOrderNumber += 1;
    state.orderDraft = [];
    state.receiptOrderId = order.id;
    if (mode === "kitchen") {
        sendOrderToKitchen(order.id);
        return;
    }
    saveState();
    render();
    showToast(`Order #${number} saved as New.`);
}
function addCustomerCartItem(productId) {
    const session = getCustomerQrSession();
    if (!session || session.error)
        return;
    const product = productById(productId);
    if (!product || !productCanBeOrdered(product, CUSTOMER_QR_CHANNEL)) {
        showToast("That item is not available for QR ordering.");
        return;
    }
    const cartItems = getCustomerCartItems();
    const availability = getProductAvailability(product, cartItems, CUSTOMER_QR_ORDER_CONTEXT);
    if (availability.maxQuantity < 1) {
        showToast(`${product.name} is not available with current stock.`);
        renderCustomerQrScreen();
        return;
    }
    state.customerCart = normalizeOrderItems([...cartItems, { productId: product.id, quantity: 1, note: "", modifiers: [] }]);
    state.customerLastOrderId = "";
    saveState();
    render();
    showToast(`${product.name} added.`);
}
function adjustCustomerCartItem(index, delta) {
    const cartItems = getCustomerCartItems();
    const item = cartItems[Number(index)];
    if (!item)
        return;
    const product = productById(item.productId);
    if (!product)
        return;
    if (delta > 0) {
        const otherItems = cartItems.filter((_, itemIndex) => itemIndex !== Number(index));
        const availability = getProductAvailability(product, otherItems, CUSTOMER_QR_ORDER_CONTEXT);
        if (item.quantity + 1 > availability.maxQuantity) {
            showToast(`Only ${availability.maxQuantity} ${product.name} can be ordered with current stock.`);
            return;
        }
    }
    item.quantity += delta;
    state.customerCart = normalizeOrderItems(cartItems.filter((line) => line.quantity > 0));
    saveState();
    render();
}
function removeCustomerCartItem(index) {
    state.customerCart = getCustomerCartItems().filter((_, itemIndex) => itemIndex !== Number(index));
    saveState();
    render();
}
function startNewCustomerOrder() {
    state.customerCart = [];
    state.customerLastOrderId = "";
    saveState();
    render();
}
function submitCustomerQrOrder(formData) {
    const session = getCustomerQrSession();
    if (!session || session.error || !session.table) {
        showToast("Ask staff for an active table QR code.");
        renderCustomerQrScreen();
        return;
    }
    const items = getCustomerCartItems();
    if (!items.length) {
        showToast("Add an item before placing the order.");
        return;
    }
    const paymentOption = String(formData.get("paymentOption") || "online");
    const paymentMethod = paymentOption === "later" ? UNPAID_PAYMENT_METHOD : "Online payment";
    const paymentStatus = getPaymentStatusForMethod(paymentMethod);
    const number = state.nextOrderNumber;
    const orderId = `ORD-${number}`;
    const createdAt = timeNow();
    const createdAtMs = Date.now();
    const order = {
        id: orderId,
        number,
        channel: CUSTOMER_QR_CHANNEL,
        orderType: CUSTOMER_QR_CHANNEL,
        tableId: session.table.id,
        customer: session.table.name,
        paymentStatus,
        paymentMethod,
        fulfillment: "Kitchen",
        status: "New",
        createdAt,
        createdAtMs,
        sentAt: "",
        paidAt: paymentStatus === "Paid" ? createdAt : "",
        paidAtMs: paymentStatus === "Paid" ? createdAtMs : "",
        staffId: "",
        staffName: "QR guest",
        paidByUserId: "",
        paidByName: paymentStatus === "Paid" ? "QR online checkout" : "",
        inventoryDeducted: false,
        notes: String(formData.get("notes") || "").trim(),
        qrCodeId: session.code?.id || "",
        items: items.map((item) => ({ ...item }))
    };
    const validation = validateOrderForKitchen(order);
    if (!validation.ok) {
        showToast(validation.message);
        renderCustomerQrScreen();
        return;
    }
    state.orders.push(order);
    state.nextOrderNumber += 1;
    state.customerCart = [];
    state.customerLastOrderId = order.id;
    state.receiptOrderId = order.id;
    sendOrderToKitchen(order.id, { silent: true, skipPermission: true });
    showToast(`Order #${number} sent to the kitchen.`);
}
function advanceStatus(current) {
    if (current === "Delayed")
        return "Preparing";
    return TICKET_STATUS_FLOW[Math.min(TICKET_STATUS_FLOW.indexOf(current) + 1, TICKET_STATUS_FLOW.length - 1)] || "Queued";
}
function setTicketStatus(ticket, status) {
    if (!TICKET_STATUSES.includes(status))
        return;
    const now = Date.now();
    ticket.status = status;
    if (["Accepted", "Preparing", "Delayed", "Ready", "Done"].includes(status) && !ticket.acceptedAtMs) {
        ticket.acceptedAtMs = now;
    }
    if (status === "Preparing" && !ticket.startedAtMs) {
        ticket.startedAtMs = now;
    }
    if (status === "Delayed" && !ticket.delayedAtMs) {
        ticket.delayedAtMs = now;
    }
    if (status === "Ready" && !ticket.readyAtMs) {
        if (!ticket.startedAtMs)
            ticket.startedAtMs = now;
        ticket.readyAtMs = now;
    }
    if (status === "Done" && !ticket.completedAtMs) {
        if (!ticket.startedAtMs)
            ticket.startedAtMs = now;
        if (!ticket.readyAtMs)
            ticket.readyAtMs = now;
        ticket.completedAtMs = now;
    }
}
function syncOrderStatus(orderId) {
    const tickets = state.tickets.filter((ticket) => ticket.orderId === orderId);
    const order = orderById(orderId);
    if (!order || !tickets.length)
        return;
    if (order.status === "Paid" || order.status === "Cancelled")
        return;
    if (tickets.every((ticket) => ticket.status === "Done"))
        order.status = isOrderPaid(order) ? "Paid" : "Served";
    else if (tickets.every((ticket) => ticket.status === "Ready" || ticket.status === "Done"))
        order.status = "Ready";
    else if (tickets.some((ticket) => ticket.status === "Delayed"))
        order.status = "Delayed";
    else if (tickets.some((ticket) => ["Accepted", "Preparing"].includes(ticket.status)))
        order.status = "Preparing";
    else
        order.status = "Sent to kitchen";
}
function advanceTicket(ticketId) {
    if (!can("canAdvanceTickets")) {
        showToast("This role cannot update kitchen tickets.");
        return;
    }
    const ticket = state.tickets.find((item) => item.id === ticketId);
    if (!ticket)
        return;
    setTicketStatus(ticket, advanceStatus(ticket.status));
    syncOrderStatus(ticket.orderId);
    saveState();
    render();
    showToast(`Ticket moved to ${ticket.status}.`);
}
function updateTicketStatus(ticketId, status) {
    if (!can("canAdvanceTickets")) {
        showToast("This role cannot update kitchen tickets.");
        return;
    }
    const ticket = state.tickets.find((item) => item.id === ticketId);
    if (!ticket || !TICKET_STATUSES.includes(status))
        return;
    setTicketStatus(ticket, status);
    syncOrderStatus(ticket.orderId);
    saveState();
    render();
    showToast(`Kitchen task marked ${getTicketStatusLabel(ticket.status).toLowerCase()}.`);
}
function markTicketDelayed(ticketId) {
    if (!can("canAdvanceTickets")) {
        showToast("This role cannot update kitchen tickets.");
        return;
    }
    const ticket = state.tickets.find((item) => item.id === ticketId);
    if (!ticket)
        return;
    const issueNote = window.prompt("Issue note for the delay", ticket.issueNote || "");
    if (issueNote === null)
        return;
    ticket.issueNote = String(issueNote || "").trim();
    setTicketStatus(ticket, "Delayed");
    syncOrderStatus(ticket.orderId);
    saveState();
    render();
    showToast("Kitchen task marked delayed.");
}
function addTicketIssueNote(ticketId) {
    if (!can("canAdvanceTickets")) {
        showToast("This role cannot update kitchen tickets.");
        return;
    }
    const ticket = state.tickets.find((item) => item.id === ticketId);
    if (!ticket)
        return;
    const issueNote = window.prompt("Issue note", ticket.issueNote || "");
    if (issueNote === null)
        return;
    ticket.issueNote = String(issueNote || "").trim();
    saveState();
    render();
    showToast(ticket.issueNote ? "Issue note added." : "Issue note cleared.");
}
function advanceOrder(orderId) {
    if (!can("canCreateOrders") && !can("canAdvanceTickets")) {
        showToast("This role cannot update orders.");
        return;
    }
    const order = orderById(orderId);
    if (!order)
        return;
    if (order.status === "New") {
        sendOrderToKitchen(orderId);
        return;
    }
    if (order.status === "Ready") {
        markOrderServed(orderId);
        return;
    }
    if (order.status === "Served") {
        markOrderPaid(orderId);
        return;
    }
    const orderTickets = state.tickets.filter((ticket) => ticket.orderId === orderId && ticket.status !== "Done");
    orderTickets.forEach((ticket) => {
        setTicketStatus(ticket, advanceStatus(ticket.status));
    });
    syncOrderStatus(orderId);
    saveState();
    render();
    showToast("Order status updated.");
}
function markOrderServed(orderId) {
    if (!can("canCreateOrders")) {
        showToast("This role cannot update orders.");
        return;
    }
    const order = orderById(orderId);
    if (!order || order.status === "Cancelled" || order.status === "Paid")
        return;
    state.tickets
        .filter((ticket) => ticket.orderId === orderId)
        .forEach((ticket) => setTicketStatus(ticket, "Done"));
    order.status = isOrderPaid(order) ? "Paid" : "Served";
    saveState();
    render();
    showToast(`Order #${order.number} marked served.`);
}
function markOrderPaid(orderId, paymentMethod = DEFAULT_PAID_PAYMENT_METHOD) {
    if (!can("canCreateOrders")) {
        showToast("This role cannot take payment.");
        return;
    }
    const order = orderById(orderId);
    if (!order || order.status === "Cancelled")
        return;
    const method = normalizePaymentMethod(paymentMethod);
    const staff = currentUser();
    order.paymentStatus = "Paid";
    order.paymentMethod = isPaidPaymentMethod(method) ? method : DEFAULT_PAID_PAYMENT_METHOD;
    if (order.status === "Served")
        order.status = "Paid";
    order.paidAt = order.paidAt || timeNow();
    order.paidAtMs = order.paidAtMs || Date.now();
    order.paidByUserId = staff?.id || order.paidByUserId || "";
    order.paidByName = staff?.name || order.paidByName || "";
    state.receiptOrderId = order.id;
    saveState();
    render();
    showToast(`Payment recorded for order #${order.number}.`);
}
function cancelOrder(orderId) {
    if (!can("canCreateOrders")) {
        showToast("This role cannot cancel orders.");
        return;
    }
    const order = orderById(orderId);
    if (!order || order.status !== "New") {
        showToast("Only New orders can be cancelled in this phase.");
        return;
    }
    order.status = "Cancelled";
    order.paymentStatus = "Unpaid";
    order.paymentMethod = UNPAID_PAYMENT_METHOD;
    order.paidAt = "";
    order.paidAtMs = "";
    order.paidByUserId = "";
    order.paidByName = "";
    saveState();
    render();
    showToast(`Order #${order.number} cancelled.`);
}
function showOrderReceipt(orderId) {
    const order = orderById(orderId);
    if (!order)
        return;
    state.receiptOrderId = order.id;
    if (canView("orders"))
        state.activeView = "orders";
    saveState();
    render();
}
function printOrderReceipt(orderId) {
    showOrderReceipt(orderId);
    window.setTimeout(() => window.print(), 50);
}
function logWaste() {
    if (!can("canRecordWaste")) {
        showToast("This role cannot record waste.");
        return;
    }
    const ingredient = ingredientById("kefta");
    if (!ingredient)
        return;
    const location = getIngredientPrimaryLocation(ingredient);
    if (ingredient.stock < 0.25) {
        showToast(`Only ${formatStockAmount(ingredient.stock, ingredient.unit)} Kefta is available.`);
        return;
    }
    const result = deductIngredientStock(ingredient, 0.25, location);
    pushWasteRecord({
        ingredient,
        quantity: result.removed,
        unitType: "kilograms",
        stockQuantity: result.removed,
        reason: "Dropped",
        staffId: currentUser()?.id,
        occurredAtMs: Date.now(),
        notes: "Quick kefta waste shortcut.",
        fromLocation: location,
    });
    saveState();
    render();
    showToast("Waste logged and stock recalculated.");
}
function recordProduction(form) {
    if (!can("canManageProcedures")) {
        showToast("This role cannot record production.");
        return;
    }
    const draft = getProductionExecutionDraft(form);
    const readiness = getProductionReadiness(draft, form);
    const product = draft.product;
    if (!readiness.ok) {
        showToast(readiness.detail);
        updateProductionCostPreview();
        return;
    }
    const batchId = `BAT-${Date.now()}-${state.productionBatches.length + 1}`;
    const completedAt = timeNow();
    const completedAtMs = Date.now();
    const staff = currentUser();
    const actualUsages = draft.lines.map((line) => {
        const result = deductIngredientStock(line.ingredient, line.actualStockQuantity, getIngredientPrimaryLocation(line.ingredient));
        pushInventoryHistory({
            ingredient: line.ingredient,
            type: "remove",
            quantity: result.removed,
            fromLocation: result.removals.map((removal) => removal.location).join(", "),
            detail: `${product.name} batch ${batchId} used ${formatActualUsageLabel(line.actualUsage, line.measure)} ${line.ingredient.name} (${money(line.actualCost)} actual cost).`
        });
        return `${formatActualUsageLabel(line.actualUsage, line.measure)} ${line.ingredient.name}`;
    });
    if (draft.outputIngredient && draft.outputStockQuantity > 0) {
        addStockToLocation(draft.outputIngredient, draft.outputLocation, draft.outputStockQuantity);
        if (draft.outputUnitCost > 0)
            draft.outputIngredient.purchasePrice = draft.outputUnitCost;
        pushInventoryHistory({
            ingredient: draft.outputIngredient,
            type: "add",
            quantity: draft.outputStockQuantity,
            toLocation: draft.outputLocation,
            detail: `${product.name} batch ${batchId} produced ${formatStockAmount(draft.outputStockQuantity, draft.outputIngredient.unit)} at ${money(draft.outputUnitCost)} per ${draft.outputIngredient.unit}.`
        });
    }
    product.lastProductionCost = draft.actualCost;
    product.lastProductionPlannedCost = draft.plannedCost;
    product.lastProductionMargin = draft.actualMargin;
    product.lastProductionCostDelta = draft.costDelta;
    product.lastProductionAt = completedAt;
    product.lastProductionAtMs = completedAtMs;
    state.productionBatches.push({
        id: batchId,
        productId: product.id,
        productName: product.name,
        completedById: staff?.id || "",
        completedByName: staff?.name || "Staff",
        completedAt,
        completedAtMs,
        plannedCost: draft.plannedCost,
        actualCost: draft.actualCost,
        costDelta: draft.costDelta,
        plannedMargin: draft.plannedMargin,
        actualMargin: draft.actualMargin,
        marginDelta: draft.marginDelta,
        outputIngredientId: draft.outputIngredient?.id || "",
        outputIngredientName: draft.outputIngredient?.name || "",
        outputQuantity: draft.outputQuantity,
        outputUnitType: draft.outputUnitType,
        outputStockQuantity: draft.outputStockQuantity,
        outputUnitCost: draft.outputUnitCost,
        outputLocation: draft.outputLocation,
        lines: draft.lines.map((line) => ({
            ingredientId: line.ingredient.id,
            ingredientName: line.ingredient.name,
            measure: line.measure,
            plannedUsage: line.plannedUsage,
            actualUsage: line.actualUsage,
            plannedStockQuantity: line.plannedStockQuantity,
            actualStockQuantity: line.actualStockQuantity,
            plannedCost: line.plannedCost,
            actualCost: line.actualCost
        }))
    });
    state.productionBatches = state.productionBatches.slice(-80);
    const outputText = draft.outputIngredient
        ? ` Added ${formatStockAmount(draft.outputStockQuantity, draft.outputIngredient.unit)} ${draft.outputIngredient.name} at ${money(draft.outputUnitCost)} per ${draft.outputIngredient.unit}.`
        : "";
    const marginText = draft.actualMargin === null ? "" : ` Margin ${draft.actualMargin.toFixed(1)}% (${formatSignedAmount(draft.marginDelta, " pts")}).`;
    state.productionLog.push({
        id: `LOG-${Date.now()}`,
        time: completedAt,
        text: `${product.name} batch complete: ${actualUsages.join(", ")}. Actual cost ${money(draft.actualCost)} (${money(draft.costDelta)} vs planned).${marginText}${outputText}`
    });
    saveState();
    render();
    renderProductionRecipeFields({ reset: true });
    const productionForm = document.querySelector("#productionForm");
    if (productionForm?.elements?.prepComplete)
        productionForm.elements.prepComplete.checked = false;
    updateProductionCostPreview();
    showToast("Batch result saved; inventory and actual cost updated.");
}
function createProcedure(formData) {
    if (!can("canCreateProcedures")) {
        showToast("Only Owner/Admin can create procedures.");
        return false;
    }
    const title = String(formData.get("title") || "").trim();
    const department = normalizeProcedureDepartment(formData.get("department"));
    const language = normalizeProcedureLanguage(formData.get("language"));
    const frequency = normalizeProcedureFrequency(formData.get("frequency"));
    const assignedRole = normalizeProcedureAssignedRole(formData.get("assignedRole"), department);
    const steps = normalizeProcedureSteps(String(formData.get("steps") || "").split(/\n/));
    const requiredTools = normalizeListInput(formData.get("requiredTools"));
    const requiredProducts = normalizeListInput(formData.get("requiredProducts"));
    const media = normalizeProcedureMedia(formData.get("media"));
    const user = currentUser();
    if (!title || !steps.length) {
        showToast("Add a procedure title and at least one step.");
        return false;
    }
    state.procedures.push({
        id: uniqueRecordId(title, [state.procedures]),
        title,
        department,
        language,
        steps,
        requiredTools,
        requiredProducts,
        media,
        frequency,
        assignedRole,
        active: true,
        createdById: user?.id || "",
        createdByName: user?.name || "",
        createdAtMs: Date.now()
    });
    saveState();
    render();
    showToast(`${title} procedure created.`);
    return true;
}
function setProcedureStepProgress(procedureId, stepIndex, checked) {
    const procedure = procedureById(procedureId);
    if (!procedure || !can("canCompleteProcedures") || !procedureAssignedToUser(procedure)) {
        showToast("This role cannot update that procedure.");
        return;
    }
    const index = Math.floor(Number(stepIndex) || 0);
    if (index < 0 || index >= procedure.steps.length)
        return;
    state.procedureProgress = state.procedureProgress || {};
    const key = procedureProgressKey(procedure.id);
    const progress = getProcedureStepProgress(procedure.id);
    if (checked)
        progress.add(index);
    else
        progress.delete(index);
    const nextProgress = [...progress].sort((first, second) => first - second);
    if (nextProgress.length)
        state.procedureProgress[key] = nextProgress;
    else
        delete state.procedureProgress[key];
    saveState();
    render();
}
function recordProcedureCompletion(procedureId, status = "Done", notes = "") {
    const procedure = procedureById(procedureId);
    const user = currentUser();
    if (!procedure || !user || !can("canCompleteProcedures") || !procedureAssignedToUser(procedure)) {
        showToast("This role cannot complete that procedure.");
        return false;
    }
    const normalizedStatus = PROCEDURE_COMPLETION_STATUSES.includes(status) ? status : "Done";
    const normalizedNotes = String(notes || "").trim();
    if (normalizedStatus === "Done" && !procedureStepsComplete(procedure)) {
        showToast("Check each step before marking the procedure done.");
        return false;
    }
    if (normalizedStatus !== "Done" && !normalizedNotes) {
        showToast("Add a reason before saving this procedure status.");
        return false;
    }
    const checkedSteps = [...getProcedureStepProgress(procedure.id)].sort((first, second) => first - second);
    const roleInfo = roleDefinition(user.role);
    state.procedureCompletions.push({
        id: `PROC-CMP-${Date.now()}-${state.procedureCompletions.length + 1}`,
        procedureId: procedure.id,
        status: normalizedStatus,
        completedById: user.id,
        completedByName: user.name,
        assignedRole: normalizeProcedureAssignedRole(procedure.assignedRole, roleInfo.operationalRole),
        completedAtMs: Date.now(),
        completedAt: timeNow(),
        checkedSteps,
        notes: normalizedNotes
    });
    state.procedureCompletions = state.procedureCompletions.slice(-180);
    delete state.procedureProgress?.[procedureProgressKey(procedure.id)];
    saveState();
    render();
    showToast(`${procedure.title} marked ${normalizedStatus.toLowerCase()}.`);
    return true;
}
function promptAndRecordProcedureStatus(procedureId, status) {
    const procedure = procedureById(procedureId);
    if (!procedure)
        return;
    const promptText = status === "Problem"
        ? `What problem happened with ${procedure.title}?`
        : `Why are you skipping ${procedure.title}?`;
    const note = window.prompt(promptText, "");
    if (note === null)
        return;
    recordProcedureCompletion(procedureId, status, note);
}
function addReservation(formData) {
    if (!can("canManageReservations")) {
        showToast("This role cannot create reservations.");
        return;
    }
    const guests = Math.max(1, Math.floor(Number(formData.get("guests")) || 1));
    const time = formData.get("time") || "";
    const tableId = formData.get("tableId");
    const validation = getReservationValidation({ guests, time, tableId });
    if (!validation.ok) {
        showToast(validation.detail);
        renderReservationPlanner();
        return;
    }
    const reservation = {
        id: `RES-${Date.now()}`,
        name: formData.get("name") || "Guest",
        guests,
        time,
        tableId,
        source: formData.get("source"),
        status: "Confirmed"
    };
    state.reservations.push(reservation);
    saveState();
    render();
    showToast(`Reservation booked for ${reservation.name} at ${tableById(tableId).name}.`);
}
function renderTimingSurfaces() {
    if (getCustomerQrSession()) {
        renderCustomerQrScreen();
        return;
    }
    if (!currentUser())
        return;
    ensureActiveViewAccess();
    renderNav();
    renderMetrics();
    renderDashboard();
    renderKitchen();
    renderProcedures();
}
export function initApp() {
    document.addEventListener("click", (event) => {
        const demoLogin = event.target.closest("[data-demo-login]");
        if (demoLogin) {
            const loginForm = document.querySelector("#loginForm");
            loginForm.elements.email.value = demoLogin.dataset.demoLogin;
            loginForm.elements.password.value = demoLogin.dataset.demoPassword;
            return;
        }
        const viewButton = event.target.closest("[data-view]");
        if (viewButton)
            setView(viewButton.dataset.view);
        const viewLink = event.target.closest("[data-view-link]");
        if (viewLink)
            setView(viewLink.dataset.viewLink);
        const stationButton = event.target.closest("[data-station]");
        if (stationButton) {
            state.activeStation = stationButton.dataset.station;
            saveState();
            render();
        }
        const orderFilter = event.target.closest("[data-order-filter]");
        if (orderFilter) {
            state.orderFilter = orderFilter.dataset.orderFilter;
            saveState();
            render();
        }
        const nextTicket = event.target.closest("[data-next-ticket]");
        if (nextTicket)
            advanceTicket(nextTicket.dataset.nextTicket);
        const ticketStatus = event.target.closest("[data-ticket-status][data-ticket-id]");
        if (ticketStatus)
            updateTicketStatus(ticketStatus.dataset.ticketId, ticketStatus.dataset.ticketStatus);
        const delayTicket = event.target.closest("[data-delay-ticket]");
        if (delayTicket)
            markTicketDelayed(delayTicket.dataset.delayTicket);
        const issueTicket = event.target.closest("[data-issue-ticket]");
        if (issueTicket)
            addTicketIssueNote(issueTicket.dataset.issueTicket);
        const nextOrder = event.target.closest("[data-next-order]");
        if (nextOrder)
            advanceOrder(nextOrder.dataset.nextOrder);
        const supplierOrdered = event.target.closest("[data-supplier-ordered]");
        if (supplierOrdered)
            markSupplierOrderOrdered(supplierOrdered.dataset.supplierOrdered);
        const supplierReceived = event.target.closest("[data-supplier-received]");
        if (supplierReceived)
            receiveSupplierOrder(supplierReceived.dataset.supplierReceived);
        const removeDraft = event.target.closest("[data-remove-draft-index]");
        if (removeDraft)
            removeOrderDraftLine(removeDraft.dataset.removeDraftIndex);
        const sendKitchen = event.target.closest("[data-send-kitchen]");
        if (sendKitchen)
            sendOrderToKitchen(sendKitchen.dataset.sendKitchen);
        const markServed = event.target.closest("[data-mark-served]");
        if (markServed)
            markOrderServed(markServed.dataset.markServed);
        const markPaid = event.target.closest("[data-mark-paid]");
        if (markPaid)
            markOrderPaid(markPaid.dataset.markPaid, getSelectedPaymentMethodFromAction(markPaid));
        const cancelButton = event.target.closest("[data-cancel-order]");
        if (cancelButton)
            cancelOrder(cancelButton.dataset.cancelOrder);
        const showReceipt = event.target.closest("[data-show-receipt]");
        if (showReceipt)
            showOrderReceipt(showReceipt.dataset.showReceipt);
        const printReceipt = event.target.closest("[data-print-receipt]");
        if (printReceipt)
            printOrderReceipt(printReceipt.dataset.printReceipt);
        const removeRecipeLine = event.target.closest("[data-remove-recipe-line]");
        if (removeRecipeLine)
            removeSellableRecipeLine(removeRecipeLine.dataset.removeRecipeLine);
        const toggleSellable = event.target.closest("[data-toggle-sellable]");
        if (toggleSellable)
            toggleSellableProduct(toggleSellable.dataset.toggleSellable);
        const togglePurchased = event.target.closest("[data-toggle-purchased]");
        if (togglePurchased)
            togglePurchasedProduct(togglePurchased.dataset.togglePurchased);
        const updatePurchasePrice = event.target.closest("[data-update-purchase-price]");
        if (updatePurchasePrice) {
            const input = document.querySelector(`[data-purchase-price-input="${updatePurchasePrice.dataset.updatePurchasePrice}"]`);
            updateIngredientPurchasePrice(updatePurchasePrice.dataset.updatePurchasePrice, input?.value);
        }
        const procedureDone = event.target.closest("[data-procedure-done]");
        if (procedureDone)
            recordProcedureCompletion(procedureDone.dataset.procedureDone, "Done");
        const procedureProblem = event.target.closest("[data-procedure-problem]");
        if (procedureProblem)
            promptAndRecordProcedureStatus(procedureProblem.dataset.procedureProblem, "Problem");
        const procedureSkip = event.target.closest("[data-procedure-skip]");
        if (procedureSkip)
            promptAndRecordProcedureStatus(procedureSkip.dataset.procedureSkip, "Skipped");
        const openQr = event.target.closest("[data-open-qr]");
        if (openQr)
            openQrCustomerUrl(openQr.dataset.openQr);
        const assignQr = event.target.closest("[data-assign-qr]");
        if (assignQr)
            assignQrCode(assignQr.dataset.assignQr);
        const regenerateQr = event.target.closest("[data-regenerate-qr]");
        if (regenerateQr)
            regenerateQrCode(regenerateQr.dataset.regenerateQr);
        const toggleQr = event.target.closest("[data-toggle-qr]");
        if (toggleQr)
            toggleQrCode(toggleQr.dataset.toggleQr);
        const customerAdd = event.target.closest("[data-customer-add]");
        if (customerAdd)
            addCustomerCartItem(customerAdd.dataset.customerAdd);
        const customerIncrease = event.target.closest("[data-customer-increase]");
        if (customerIncrease)
            adjustCustomerCartItem(customerIncrease.dataset.customerIncrease, 1);
        const customerDecrease = event.target.closest("[data-customer-decrease]");
        if (customerDecrease)
            adjustCustomerCartItem(customerDecrease.dataset.customerDecrease, -1);
        const customerRemove = event.target.closest("[data-customer-remove]");
        if (customerRemove)
            removeCustomerCartItem(customerRemove.dataset.customerRemove);
        const customerNewOrder = event.target.closest("[data-customer-new-order]");
        if (customerNewOrder)
            startNewCustomerOrder();
    });
    document.addEventListener("change", (event) => {
        const productionProduct = event.target.closest("#productionProduct");
        if (productionProduct) {
            renderProductionRecipeFields({ reset: true });
            return;
        }
        const productionOutputIngredient = event.target.closest("#productionOutputIngredient");
        if (productionOutputIngredient) {
            renderProductionRecipeFields();
            return;
        }
        const productionForm = event.target.closest("#productionForm");
        if (productionForm) {
            updateProductionCostPreview();
            return;
        }
        const qrTableSelect = event.target.closest("#qrTableSelect");
        if (qrTableSelect) {
            const table = tableById(qrTableSelect.value);
            const areaInput = document.querySelector("#qrAreaInput");
            if (areaInput && table)
                areaInput.value = table.zone;
            return;
        }
        const sellableRecipeIngredient = event.target.closest("#sellableRecipeIngredient");
        if (sellableRecipeIngredient) {
            renderSellableProductForm();
            return;
        }
        const procedureStep = event.target.closest("[data-procedure-step]");
        if (!procedureStep)
            return;
        if (!can("canCompleteProcedures")) {
            procedureStep.checked = !procedureStep.checked;
            showToast("This role cannot update procedures.");
            return;
        }
        setProcedureStepProgress(procedureStep.dataset.procedureStep, procedureStep.dataset.stepIndex, procedureStep.checked);
    });
    document.querySelector("#loginForm").addEventListener("submit", (event) => {
        event.preventDefault();
        login(new FormData(event.currentTarget));
    });
    document.addEventListener("submit", (event) => {
        const customerOrderForm = event.target.closest("#customerOrderForm");
        if (!customerOrderForm)
            return;
        event.preventDefault();
        submitCustomerQrOrder(new FormData(customerOrderForm));
    });
    document.querySelector("#orderForm").addEventListener("submit", (event) => {
        event.preventDefault();
        createOrder(new FormData(event.currentTarget), event.submitter?.dataset.orderMode || "kitchen");
    });
    document.querySelector("#addOrderLineBtn").addEventListener("click", () => {
        addOrderDraftLine(document.querySelector("#productSelect").value, document.querySelector("#orderQuantity").value, document.querySelector("#orderLineNote")?.value, getSelectedLineModifiers());
    });
    document.querySelector("#clearOrderDraftBtn").addEventListener("click", clearOrderDraft);
    document.querySelector("#productSelect").addEventListener("change", renderOrderBuilder);
    document.querySelector("#orderQuantity").addEventListener("input", renderOrderBuilder);
    document.querySelector("#orderForm").elements.channel.addEventListener("change", () => {
        renderProductsInSelects();
        renderOrderBuilder();
    });
    document.querySelector("#orderForm").elements.fulfillment?.addEventListener("change", renderOrderBuilder);
    document.querySelector("#addRecipeLineBtn").addEventListener("click", () => {
        addSellableRecipeLine(document.querySelector("#sellableRecipeIngredient").value, document.querySelector("#sellableRecipeQuantity").value, document.querySelector("#sellableRecipeMeasure").value, document.querySelector("#sellableRecipeStation").value, document.querySelector("#sellableRecipeWaste").value, document.querySelector("#sellableRecipeAppliesTo").value, document.querySelector("#sellableRecipeNotes").value);
    });
    document.querySelector("#sellableProductForm").addEventListener("input", (event) => {
        if (event.target.closest("[name='price'], [name='targetMargin'], [name='minMargin']")) {
            renderSellableRecipeCostPreview();
        }
    });
    document.querySelector("#sellableProductForm").addEventListener("submit", (event) => {
        event.preventDefault();
        createSellableProduct(new FormData(event.currentTarget));
    });
    document.querySelector("#purchasedProductForm").addEventListener("submit", (event) => {
        event.preventDefault();
        createPurchasedProduct(new FormData(event.currentTarget));
    });
    document.querySelector("#inventoryActionForm").addEventListener("submit", (event) => {
        event.preventDefault();
        applyInventoryAction(new FormData(event.currentTarget));
    });
    document.querySelector("#inventoryActionForm").addEventListener("change", renderInventoryActionForm);
    document.querySelectorAll("[data-waste-form]").forEach((form) => {
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            recordWaste(new FormData(event.currentTarget), event.currentTarget);
        });
        form.addEventListener("input", renderWasteForms);
        form.addEventListener("change", renderWasteForms);
    });
    document.querySelector("#procedureForm").addEventListener("submit", (event) => {
        event.preventDefault();
        if (createProcedure(new FormData(event.currentTarget))) {
            event.currentTarget.reset();
            renderProcedureFormControls();
        }
    });
    document.querySelector("#productionForm").addEventListener("submit", (event) => {
        event.preventDefault();
        recordProduction(event.currentTarget);
    });
    document.querySelector("#productionForm").addEventListener("input", updateProductionCostPreview);
    document.querySelector("#reservationForm").addEventListener("submit", (event) => {
        event.preventDefault();
        addReservation(new FormData(event.currentTarget));
    });
    document.querySelector("#reservationForm").addEventListener("input", renderReservationPlanner);
    document.querySelector("#reservationForm").addEventListener("change", renderReservationPlanner);
    document.querySelector("#staffUserForm").addEventListener("submit", (event) => {
        event.preventDefault();
        createStaffUser(new FormData(event.currentTarget));
    });
    document.querySelector("#settingsForm").addEventListener("submit", (event) => {
        event.preventDefault();
        saveRestaurantSettings(new FormData(event.currentTarget));
    });
    document.querySelector("#qrCodeForm").addEventListener("submit", (event) => {
        event.preventDefault();
        createTableQrCode(new FormData(event.currentTarget));
    });
    document.querySelector("#logoutBtn").addEventListener("click", logout);
    document.querySelector("#quickOrderBtn").addEventListener("click", () => {
        if (!can("canCreateOrders"))
            return;
        setView("orders");
        document.querySelector("#orderForm").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    document.querySelector("#resetDemoBtn").addEventListener("click", () => {
        if (!can("canResetDemo"))
            return;
        const previousUserId = state.currentUserId;
        state = normalizeState(getFreshSeedState());
        if (state.users.some((user) => user.id === previousUserId))
            state.currentUserId = previousUserId;
        saveState();
        render();
        showToast("Demo data reset.");
    });
    document.querySelector("#wasteKeftaBtn")?.addEventListener("click", logWaste);
    render();
    window.setInterval(renderTimingSurfaces, 30 * 1000);
}
//# sourceMappingURL=core.js.map