// @ts-nocheck
// This is the TypeScript port of the original static prototype.
// It intentionally keeps the domain/rendering code together for the first
// migration step so behavior stays identical while the app gains a typed build.
const STORAGE_KEY = "libabite-ops-state-v1";
const RESERVATION_TURNOVER_MINUTES = 90;
const MINUTE_MS = 60 * 1000;
const TICKET_STATUS_FLOW = ["Queued", "Preparing", "Ready", "Done"];
const TICKET_SLA_MINUTES = {
    "Burger": 12,
    "Cold Mezza": 8,
    "Sweets": 10,
    default: 12
};
const SLA_WARNING_WINDOW_MINUTES = 3;
const KITCHEN_STATIONS = ["Burger", "Cold Mezza", "Sweets", "Drinks", "Grill", "Prep", "Packaging", "Main Kitchen"];
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
        canManageProducts: true,
        canManageProcedures: true,
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
        canManageProcedures: true,
        canManageReservations: true,
        operationalRole: "Manager"
    },
    waiter_cashier: {
        label: "Waiter/Cashier",
        icon: "WC",
        homeView: "orders",
        views: ["dashboard", "orders", "reservations"],
        canCreateOrders: true,
        canManageReservations: true,
        operationalRole: "Front"
    },
    kitchen_staff: {
        label: "Kitchen staff",
        icon: "KS",
        homeView: "kitchen",
        views: ["dashboard", "kitchen", "procedures"],
        canAdvanceTickets: true,
        canManageProcedures: true,
        operationalRole: "Kitchen"
    },
    driver: {
        label: "Driver",
        icon: "DR",
        homeView: "team",
        views: ["dashboard", "team"],
        operationalRole: "Driver"
    }
};
const LANGUAGE_OPTIONS = [
    { id: "nl", label: "Dutch" },
    { id: "ar", label: "Arabic" },
    { id: "tr", label: "Turkish" },
    { id: "en", label: "English" }
];
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
    { name: "sellable_products", fields: "name, code/SKU, category, kitchen station, price, VAT, status, availability, recipe links" },
    { name: "purchased_products", fields: "ingredient, supplier, purchase price, unit type, min/max, total stock, stock by location, expiry, barcode, status" },
    { name: "inventory_locations", fields: "default restaurant locations, custom locations, per-location quantities" },
    { name: "inventory_actions", fields: "add, remove, transfer, waste, manual correction, stock history" },
    { name: "orders", fields: "channel, customer, payment, fulfillment, line items" },
    { name: "kitchen_tickets", fields: "order, product, station, status, SLA times" },
    { name: "reservations", fields: "guest, time, table, source, status" }
];
function minutesAgoTimestamp(minutes) {
    return Date.now() - (minutes * MINUTE_MS);
}
const seedState = {
    currentUserId: "",
    activeView: "dashboard",
    activeStation: "All",
    orderFilter: "All",
    orderDraft: [],
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
    supplierOrders: [],
    customInventoryLocations: ["Pastry fridge", "Fridge 3"],
    inventoryHistory: [
        {
            id: "INV-SEED-1",
            ingredientId: "kefta",
            ingredientName: "Kefta Meat",
            type: "add",
            quantity: 4.2,
            fromLocation: "",
            toLocation: "Freezer",
            resultingStock: 4.2,
            time: "09:30",
            detail: "Opening stock entered for Kefta Meat."
        },
        {
            id: "INV-SEED-2",
            ingredientId: "pistachio-cream",
            ingredientName: "Pistachio Cream",
            type: "correct",
            quantity: 0.7,
            fromLocation: "",
            toLocation: "Pastry fridge",
            resultingStock: 0.7,
            time: "10:05",
            detail: "Manual count confirmed below minimum."
        }
    ],
    productRecipeDraft: [],
    nextOrderNumber: 104,
    products: [
        {
            id: "kefta-plate",
            name: "Kefta Plate",
            code: "99301",
            category: "Kefta",
            station: "Burger",
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
            recipe: [
                { ingredientId: "kefta", grams: 200 },
                { ingredientId: "flatbread", units: 1 },
                { ingredientId: "garlic-sauce", grams: 30 },
                { ingredientId: "salad-mix", grams: 60 }
            ]
        },
        {
            id: "cold-mezza",
            name: "Cold Mezza Box",
            code: "88420",
            category: "Cold Mezza",
            station: "Cold Mezza",
            price: 11.75,
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
            targetMargin: 64,
            recipe: [
                { ingredientId: "hummus", grams: 120 },
                { ingredientId: "flatbread", units: 1 },
                { ingredientId: "salad-mix", grams: 80 }
            ]
        },
        {
            id: "pistachio-dessert",
            name: "Pistachio Dessert",
            code: "55214",
            category: "Sweets",
            station: "Sweets",
            price: 7.25,
            vatSetting: "standard",
            active: true,
            availability: {
                dineIn: true,
                qrOrdering: true,
                takeaway: true,
                delivery: true,
                websiteOrdering: true,
                externalDeliveryApps: false
            },
            targetMargin: 70,
            recipe: [
                { ingredientId: "pistachio-cream", grams: 45 },
                { ingredientId: "milk", milliliters: 90 }
            ]
        }
    ],
    ingredients: [
        {
            id: "kefta",
            name: "Kefta Meat",
            unitType: "kilograms",
            unit: "kg",
            stock: 4.2,
            min: 3,
            max: 12,
            purchasePrice: 9.4,
            location: "Freezer",
            locationStock: { "Freezer": 4.2 },
            supplier: "Halal Butcher Limburg",
            active: true,
            expiryDate: "",
            barcode: ""
        },
        {
            id: "flatbread",
            name: "Flatbread",
            unitType: "pieces",
            unit: "pcs",
            stock: 48,
            min: 30,
            max: 120,
            purchasePrice: 0.32,
            location: "Dry storage",
            locationStock: { "Dry storage": 48 },
            supplier: "Bakery Roermond",
            active: true,
            expiryDate: "",
            barcode: ""
        },
        {
            id: "garlic-sauce",
            name: "Garlic Sauce",
            unitType: "kilograms",
            unit: "kg",
            stock: 1.8,
            min: 1.5,
            max: 6,
            purchasePrice: 4.1,
            location: "Fridge 2",
            locationStock: { "Fridge 2": 1.8 },
            supplier: "Fresh Foods BV",
            active: true,
            expiryDate: "",
            barcode: ""
        },
        {
            id: "salad-mix",
            name: "Salad Mix",
            unitType: "kilograms",
            unit: "kg",
            stock: 2.4,
            min: 2,
            max: 7,
            purchasePrice: 3.6,
            location: "Fridge 1",
            locationStock: { "Fridge 1": 2.4 },
            supplier: "Fresh Foods BV",
            active: true,
            expiryDate: "",
            barcode: ""
        },
        {
            id: "hummus",
            name: "Hummus",
            unitType: "kilograms",
            unit: "kg",
            stock: 3.1,
            min: 1.8,
            max: 8,
            purchasePrice: 4.8,
            location: "Fridge 2",
            locationStock: { "Fridge 2": 3.1 },
            supplier: "Fresh Foods BV",
            active: true,
            expiryDate: "",
            barcode: ""
        },
        {
            id: "pistachio-cream",
            name: "Pistachio Cream",
            unitType: "kilograms",
            unit: "kg",
            stock: 0.7,
            min: 0.8,
            max: 3,
            purchasePrice: 18.5,
            location: "Pastry fridge",
            locationStock: { "Pastry fridge": 0.7 },
            supplier: "Sweet Trade NL",
            active: true,
            expiryDate: "",
            barcode: ""
        },
        {
            id: "milk",
            name: "Milk",
            unitType: "liters",
            unit: "l",
            stock: 8,
            min: 6,
            max: 24,
            purchasePrice: 1.25,
            location: "Fridge 3",
            locationStock: { "Fridge 3": 8 },
            supplier: "Dairy Limburg",
            active: true,
            expiryDate: "",
            barcode: ""
        }
    ],
    orders: [
        {
            id: "ORD-101",
            number: 101,
            channel: "QR",
            customer: "Table 4",
            paymentStatus: "Paid",
            fulfillment: "Kitchen",
            status: "Preparing",
            createdAt: "12:22",
            createdAtMs: minutesAgoTimestamp(14),
            notes: "Extra garlic",
            items: [{ productId: "kefta-plate", quantity: 2 }]
        },
        {
            id: "ORD-102",
            number: 102,
            channel: "Website",
            customer: "M. Jansen",
            paymentStatus: "Paid",
            fulfillment: "Delivery",
            status: "Ready",
            createdAt: "12:31",
            createdAtMs: minutesAgoTimestamp(5),
            notes: "Ring doorbell",
            assignedDriver: "samir",
            items: [{ productId: "cold-mezza", quantity: 1 }]
        },
        {
            id: "ORD-103",
            number: 103,
            channel: "Phone",
            customer: "Pickup 18:15",
            paymentStatus: "Unpaid",
            fulfillment: "Pickup",
            status: "Queued",
            createdAt: "12:37",
            createdAtMs: minutesAgoTimestamp(7),
            notes: "",
            items: [{ productId: "pistachio-dessert", quantity: 3 }]
        }
    ],
    tickets: [
        {
            id: "TCK-101-1",
            orderId: "ORD-101",
            productId: "kefta-plate",
            quantity: 2,
            station: "Burger",
            status: "Preparing",
            createdAt: "12:22",
            createdAtMs: minutesAgoTimestamp(14),
            startedAtMs: minutesAgoTimestamp(12),
            notes: "Extra garlic"
        },
        {
            id: "TCK-102-1",
            orderId: "ORD-102",
            productId: "cold-mezza",
            quantity: 1,
            station: "Cold Mezza",
            status: "Ready",
            createdAt: "12:31",
            createdAtMs: minutesAgoTimestamp(5),
            startedAtMs: minutesAgoTimestamp(4),
            readyAtMs: minutesAgoTimestamp(1),
            notes: "Ring doorbell"
        },
        {
            id: "TCK-103-1",
            orderId: "ORD-103",
            productId: "pistachio-dessert",
            quantity: 3,
            station: "Sweets",
            status: "Queued",
            createdAt: "12:37",
            createdAtMs: minutesAgoTimestamp(7),
            notes: ""
        }
    ],
    procedures: [
        { id: "close-1", text: "Clean grill and burger station with assigned tools.", owner: "Kitchen", done: false },
        { id: "close-2", text: "Label opened sauces with date and staff initials.", owner: "Cold Mezza", done: true },
        { id: "close-3", text: "Count freezer, fridge, and dry-storage stock.", owner: "Manager", done: false },
        { id: "close-4", text: "Run floor sweep, mop, and table reset.", owner: "Front", done: false }
    ],
    staff: [
        { id: "amina", name: "Amina", role: "Kitchen", planned: "10:00-17:00", clocked: "10:02", status: "On shift" },
        { id: "yusuf", name: "Yusuf", role: "Front", planned: "12:00-21:00", clocked: "11:58", status: "On shift" },
        { id: "samir", name: "Samir", role: "Driver", planned: "16:00-22:00", clocked: "15:57", status: "On delivery" },
        { id: "lina", name: "Lina", role: "Sweets", planned: "15:00-22:00", clocked: "-", status: "Starts soon" }
    ],
    drivers: [
        { id: "samir", name: "Samir", status: "On route", eta: "8 min", orderId: "ORD-102", location: "Kapellerlaan" },
        { id: "omar", name: "Omar", status: "Available", eta: "-", orderId: null, location: "Restaurant" }
    ],
    reservations: [
        { id: "RES-1", name: "Van Dijk", guests: 5, time: "18:45", tableId: "table-5", source: "Google link", status: "Confirmed" },
        { id: "RES-2", name: "Nour Family", guests: 4, time: "19:30", tableId: "table-3", source: "Phone", status: "Confirmed" }
    ],
    productionLog: [
        { id: "LOG-1", text: "Kefta prep logged: planned 200g, actual 210g. Cost updated for next batch.", time: "11:20" }
    ]
};
function getFreshSeedState() {
    const freshState = structuredClone(seedState);
    const orderAges = {
        "ORD-101": 14,
        "ORD-102": 5,
        "ORD-103": 7
    };
    const ticketTimings = {
        "TCK-101-1": { created: 14, started: 12 },
        "TCK-102-1": { created: 5, started: 4, ready: 1 },
        "TCK-103-1": { created: 7 }
    };
    freshState.orders.forEach((order) => {
        if (orderAges[order.id] !== undefined) {
            order.createdAtMs = minutesAgoTimestamp(orderAges[order.id]);
        }
    });
    freshState.tickets.forEach((ticket) => {
        const timing = ticketTimings[ticket.id];
        if (!timing)
            return;
        ticket.createdAtMs = minutesAgoTimestamp(timing.created);
        ticket.startedAtMs = timing.started === undefined ? "" : minutesAgoTimestamp(timing.started);
        ticket.readyAtMs = timing.ready === undefined ? "" : minutesAgoTimestamp(timing.ready);
        ticket.completedAtMs = timing.completed === undefined ? "" : minutesAgoTimestamp(timing.completed);
    });
    return freshState;
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
function normalizeRecipeLine(line, ingredientIds) {
    if (!line || !ingredientIds.has(line.ingredientId))
        return null;
    const base = { ingredientId: line.ingredientId };
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
        const vatSetting = VAT_OPTIONS.some((option) => option.id === product.vatSetting) ? product.vatSetting : "standard";
        return {
            id,
            name,
            code: String(product.code || product.sku || product.SKU || "").trim() || id.toUpperCase(),
            category,
            station: String(product.station || product.kitchenStation || "Main Kitchen").trim(),
            price: Math.max(0, Number(product.price ?? product.sellingPrice) || 0),
            vatSetting,
            active: product.active === undefined ? product.status !== "Inactive" : Boolean(product.active),
            availability: normalizeProductAvailability(product.availability),
            targetMargin: Math.max(0, Number(product.targetMargin) || 65),
            recipe: normalizeRecipeLines(product.recipe, ingredientIds)
        };
    })
        .filter(Boolean);
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
function normalizeState(candidate) {
    const source = candidate ? structuredClone(candidate) : {};
    const next = { ...getFreshSeedState(), ...source };
    const collectionKeys = [
        "products",
        "ingredients",
        "orders",
        "tickets",
        "tables",
        "supplierOrders",
        "procedures",
        "staff",
        "drivers",
        "reservations",
        "productionLog",
        "users",
        "customInventoryLocations",
        "inventoryHistory",
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
    next.ingredients = normalizeIngredients(next.ingredients);
    const ingredientIds = new Set(next.ingredients.map((ingredient) => ingredient.id));
    next.customInventoryLocations = normalizeCustomInventoryLocations(next.customInventoryLocations, next.ingredients);
    next.inventoryHistory = normalizeInventoryHistory(next.inventoryHistory, ingredientIds);
    next.products = normalizeProducts(next.products, ingredientIds);
    const productIds = new Set(next.products.map((product) => product.id));
    next.orderDraft = Array.isArray(candidate?.orderDraft)
        ? candidate.orderDraft
            .map((item) => ({ productId: item.productId, quantity: Number(item.quantity) }))
            .filter((item) => productIds.has(item.productId) && item.quantity > 0)
        : [];
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
        .map((order) => ({
        ...order,
        createdAt: order.createdAt || timeNow(),
        createdAtMs: normalizeTimestamp(order.createdAtMs, order.createdAt)
    }))
        .filter((order) => order.id && Array.isArray(order.items));
    const orderIds = new Set(next.orders.map((order) => order.id));
    next.tickets = next.tickets
        .map((ticket, index) => {
        const product = next.products.find((item) => item.id === ticket.productId);
        const order = next.orders.find((item) => item.id === ticket.orderId);
        const status = TICKET_STATUS_FLOW.includes(ticket.status) ? ticket.status : "Queued";
        const createdAt = ticket.createdAt || order?.createdAt || timeNow();
        const createdAtMs = normalizeTimestamp(ticket.createdAtMs, createdAt);
        const startedAtMs = normalizeOptionalTimestamp(ticket.startedAtMs);
        const readyAtMs = normalizeOptionalTimestamp(ticket.readyAtMs)
            || ((status === "Ready" || status === "Done") ? Date.now() : "");
        const completedAtMs = normalizeOptionalTimestamp(ticket.completedAtMs)
            || (status === "Done" ? readyAtMs || Date.now() : "");
        return {
            id: ticket.id || `TCK-${order?.number || Date.now()}-${index + 1}`,
            orderId: ticket.orderId,
            productId: ticket.productId,
            quantity: Math.max(1, Math.floor(Number(ticket.quantity) || 1)),
            station: ticket.station || product?.station || "Kitchen",
            status,
            createdAt,
            createdAtMs,
            startedAtMs: startedAtMs || (status !== "Queued" ? createdAtMs : ""),
            readyAtMs,
            completedAtMs,
            notes: ticket.notes || ""
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
function timeNow() {
    return new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(new Date());
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
function getChannelAvailabilityKey(channel) {
    const map = {
        "Dine-in": "dineIn",
        QR: "qrOrdering",
        Website: "websiteOrdering",
        Phone: "takeaway",
        "Uber Eats": "externalDeliveryApps",
        Takeaway: "takeaway",
        Delivery: "delivery"
    };
    return map[channel] || "dineIn";
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
function getLineCost(line) {
    const ingredient = ingredientById(line.ingredientId);
    if (!ingredient)
        return 0;
    return convertRecipeLineToStockUnits(line) * ingredient.purchasePrice;
}
function getProductCost(product) {
    return (product.recipe || []).reduce((sum, line) => sum + getLineCost(line), 0);
}
function getProductMargin(product) {
    if (!product.price)
        return 0;
    return ((product.price - getProductCost(product)) / product.price) * 100;
}
function getRecipeUsageLabel(line) {
    if (line.grams)
        return `${line.grams}g`;
    if (line.milliliters)
        return `${line.milliliters}ml`;
    return `${line.units} pcs`;
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
    if (line.grams)
        return unitType.id === "kilograms" ? line.grams / 1000 : line.grams;
    if (line.milliliters)
        return unitType.id === "liters" ? line.milliliters / 1000 : line.milliliters;
    return line.units || 0;
}
function convertActualUsageToStockUnits(line, actualUsage) {
    const measure = getRecipeMeasure(line);
    return convertRecipeLineToStockUnits({
        ingredientId: line.ingredientId,
        [measure.key]: actualUsage
    });
}
function formatStockAmount(value, unit) {
    const safeValue = Math.max(0, Number(value) || 0);
    const wholeUnit = ["pcs", "boxes", "packages"].includes(unit);
    const amount = wholeUnit ? Math.floor(safeValue) : safeValue.toFixed(safeValue >= 10 ? 1 : 2);
    return `${amount} ${unit}`;
}
function normalizeOrderItems(items) {
    const byProduct = new Map();
    items.forEach((item) => {
        const product = productById(item.productId);
        const quantity = Math.floor(Number(item.quantity) || 0);
        if (!product || quantity < 1)
            return;
        byProduct.set(product.id, (byProduct.get(product.id) || 0) + quantity);
    });
    return [...byProduct.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}
function getStockRequirementsForItems(items) {
    const requirements = new Map();
    normalizeOrderItems(items).forEach((item) => {
        const product = productById(item.productId);
        (product.recipe || []).forEach((line) => {
            const ingredient = ingredientById(line.ingredientId);
            if (!ingredient)
                return;
            const stockUnits = convertRecipeLineToStockUnits(line) * item.quantity;
            requirements.set(ingredient.id, (requirements.get(ingredient.id) || 0) + stockUnits);
        });
    });
    return requirements;
}
function getProductAvailability(product, reservedItems = state.orderDraft) {
    if (!product)
        return { maxQuantity: 0, limiting: null, details: [] };
    if (!product.active)
        return { maxQuantity: 0, limiting: null, details: [] };
    const reservedStock = getStockRequirementsForItems(reservedItems);
    const details = (product.recipe || [])
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
function getStockShortages(items) {
    return [...getStockRequirementsForItems(items).entries()]
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
    const stations = new Set();
    state.products.filter((product) => product.active).forEach((product) => stations.add(product.station));
    getOpenTickets().forEach((ticket) => stations.add(ticket.station));
    return ["All", ...stations];
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
function getTicketSla(ticket, now = Date.now()) {
    const targetMinutes = getTicketTargetMinutes(ticket);
    const ageMinutes = getTicketAgeMinutes(ticket, now);
    const remainingMinutes = targetMinutes - ageMinutes;
    const progress = Math.min(100, Math.max(4, Math.round((ageMinutes / targetMinutes) * 100)));
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
function getKitchenSlaSummary(tickets = getOpenTickets(), now = Date.now()) {
    return tickets.reduce((summary, ticket) => {
        const sla = getTicketSla(ticket, now);
        summary.total += 1;
        summary[sla.state] = (summary[sla.state] || 0) + 1;
        return summary;
    }, { total: 0, aging: 0, warning: 0, escalated: 0, ready: 0 });
}
function getSlaSummaryLabel(summary) {
    const issues = [];
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
    const loginScreen = document.querySelector("#loginScreen");
    const appShell = document.querySelector(".app-shell");
    const loginForm = document.querySelector("#loginForm");
    const currentUserName = document.querySelector("#currentUserName");
    const currentUserRole = document.querySelector("#currentUserRole");
    const quickOrderButton = document.querySelector("#quickOrderBtn");
    const resetDemoButton = document.querySelector("#resetDemoBtn");
    renderDemoLogins();
    document.body.classList.toggle("is-authenticated", Boolean(user));
    loginScreen.classList.toggle("is-hidden", Boolean(user));
    appShell.classList.toggle("is-hidden", !user);
    if (loginForm && !user) {
        loginForm.elements.email.value = loginForm.elements.email.value || "owner@libabite.nl";
        loginForm.elements.password.value = loginForm.elements.password.value || "admin123";
    }
    if (!user)
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
        orders: state.orders.filter((order) => order.status !== "Done").length,
        kitchen: getOpenTickets().length,
        inventory: getLowStockIngredients().length,
        procedures: state.procedures.filter((item) => !item.done).length,
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
    const channel = orderForm?.elements.channel.value || "Dine-in";
    const orderableProducts = getOrderableProducts(channel);
    const orderOptions = orderableProducts
        .map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} - ${escapeHtml(money(product.price))}</option>`)
        .join("");
    const productionOptions = state.products
        .map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} - ${escapeHtml(money(product.price))}</option>`)
        .join("");
    const selectedProduct = productSelect.value || orderableProducts[0]?.id;
    const selectedProductionProduct = productionProduct.value || state.products[0]?.id;
    productSelect.innerHTML = orderOptions;
    productionProduct.innerHTML = productionOptions;
    productSelect.disabled = !orderableProducts.length || !can("canCreateOrders");
    productSelect.value = orderableProducts.some((product) => product.id === selectedProduct) ? selectedProduct : orderableProducts[0]?.id || "";
    productionProduct.value = productById(selectedProductionProduct) ? selectedProductionProduct : state.products[0]?.id;
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
    const channel = orderForm?.elements.channel.value || "Dine-in";
    state.orderDraft = normalizeOrderItems(state.orderDraft).filter((item) => productCanBeOrdered(productById(item.productId), channel));
    const product = productById(productSelect.value);
    const requestedQuantity = Math.max(1, Math.floor(Number(quantityInput.value) || 1));
    const availability = getProductAvailability(product);
    const canAddLine = Boolean(productCanBeOrdered(product, channel) && requestedQuantity <= availability.maxQuantity);
    const availabilityClass = availability.maxQuantity === 0 ? "danger" : requestedQuantity > availability.maxQuantity ? "warning" : "";
    const limiting = availability.limiting;
    const limitingText = limiting
        ? `${limiting.ingredient.name} limits this item; ${formatStockAmount(limiting.remaining, limiting.ingredient.unit)} left after basket.`
        : product
            ? "No stock rule is attached to this product."
            : "No active sellable product is available for this channel.";
    availabilityPanel.className = `availability-card ${availabilityClass}`.trim();
    availabilityPanel.innerHTML = `
    <header>
      <strong>${escapeHtml(product?.name || "Select product")}</strong>
      <span class="pill ${availability.maxQuantity ? "ok" : "danger"}">${availability.maxQuantity} available</span>
    </header>
    <p>${escapeHtml(limitingText)}</p>
  `;
    const draftItems = state.orderDraft;
    const pendingItems = draftItems.length ? draftItems : product ? [{ productId: product.id, quantity: requestedQuantity }] : [];
    const shortages = getStockShortages(pendingItems);
    const itemCount = getItemCount(pendingItems);
    const orderTotal = getItemsTotal(pendingItems);
    const selectedLineBlocked = !draftItems.length && (!productCanBeOrdered(product, channel) || requestedQuantity > availability.maxQuantity);
    addLineButton.disabled = !can("canCreateOrders") || !canAddLine;
    clearDraftButton.disabled = !draftItems.length;
    sendOrderButton.disabled = !can("canCreateOrders") || !itemCount || shortages.length > 0 || selectedLineBlocked;
    sendOrderButton.innerHTML = `<span aria-hidden="true">+</span>${itemCount > 1 ? `Send ${itemCount} Items` : "Send Order"} · ${escapeHtml(money(orderTotal))}`;
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
      ${draftItems.map((item) => {
        const lineProduct = productById(item.productId);
        if (!lineProduct)
            return "";
        return `
          <div class="draft-line">
            <div>
              <strong>${item.quantity}x ${escapeHtml(lineProduct.name)}</strong>
              <p>${escapeHtml(lineProduct.station)} · ${escapeHtml(money(lineProduct.price * item.quantity))}</p>
            </div>
            <button class="mini-btn" type="button" data-remove-draft="${escapeHtml(item.productId)}" aria-label="Remove ${escapeHtml(lineProduct.name)}">Remove</button>
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
        const stationState = slaSummary.escalated ? "sla-escalated" : slaSummary.warning ? "sla-warning" : "";
        const pillClass = slaSummary.escalated ? "danger" : slaSummary.warning ? "warning" : open ? "info" : "ok";
        const pillText = slaSummary.escalated
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
function orderCard(order) {
    const productLines = order.items.map((item) => {
        const product = productById(item.productId);
        if (!product)
            return null;
        return `${item.quantity}x ${product.name}`;
    }).filter(Boolean).join(", ");
    const statusClass = order.status === "Ready" || order.status === "Done" ? "ok" : order.status === "Queued" ? "warning" : "info";
    return `
    <article class="order-card">
      <div>
        <div class="card-title">
          <strong>#${order.number} ${escapeHtml(productLines)}</strong>
          <span class="pill ${statusClass}">${escapeHtml(order.status)}</span>
        </div>
        <div class="meta-line">
          <span>${escapeHtml(order.channel)}</span>
          <span>${escapeHtml(order.customer)}</span>
          <span>${escapeHtml(order.fulfillment)}</span>
          <span>${escapeHtml(money(getOrderTotal(order)))}</span>
          <span>${escapeHtml(order.paymentStatus)}</span>
        </div>
      </div>
      <div class="mini-actions">
        ${order.status !== "Done" && (can("canCreateOrders") || can("canAdvanceTickets")) ? `<button class="mini-btn" type="button" data-next-order="${escapeHtml(order.id)}">Next</button>` : ""}
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
        : state.orders.filter((order) => order.fulfillment === state.orderFilter);
    document.querySelector("#orderList").innerHTML = filtered.length
        ? filtered.slice().reverse().map(orderCard).join("")
        : emptyState("No orders match this filter.");
    document.querySelectorAll("[data-order-filter]").forEach((button) => {
        button.classList.toggle("is-selected", button.dataset.orderFilter === state.orderFilter);
    });
}
function renderKitchen() {
    const tabs = document.querySelector("#stationTabs");
    tabs.innerHTML = getStationNames()
        .map((station) => `<button type="button" class="${state.activeStation === station ? "is-selected" : ""}" data-station="${escapeHtml(station)}">${escapeHtml(station)}</button>`)
        .join("");
    const tickets = state.activeStation === "All"
        ? getOpenTickets()
        : getOpenTickets().filter((ticket) => ticket.station === state.activeStation);
    document.querySelector("#ticketBoard").innerHTML = tickets.length
        ? tickets.map(ticketCard).join("")
        : emptyState("This screen is clear.");
}
function ticketCard(ticket) {
    const product = productById(ticket.productId);
    const order = orderById(ticket.orderId);
    const sla = getTicketSla(ticket);
    const statusClass = ticket.status === "Ready" ? "ok" : ticket.status === "Preparing" ? "info" : "warning";
    return `
    <article class="ticket-card ${sla.cardClass}">
      <header>
        <div>
          <strong>${ticket.quantity}x ${escapeHtml(product?.name || "Unknown item")}</strong>
          <p>${escapeHtml(order ? `#${order.number} ${order.customer}` : ticket.orderId)}</p>
        </div>
        <div class="ticket-pills">
          <span class="pill ${statusClass}">${escapeHtml(ticket.status)}</span>
          <span class="pill ${sla.pillClass}">${escapeHtml(sla.label)}</span>
        </div>
      </header>
      <p>${escapeHtml(ticket.notes || "No notes")}</p>
      <div class="ticket-timing">
        <div class="meta-line">
          <span>Age ${escapeHtml(formatDuration(sla.ageMinutes))}</span>
          <span>Target ${sla.targetMinutes}m</span>
          <span>${escapeHtml(sla.detail)}</span>
        </div>
        <div class="sla-meter ${sla.state}" aria-label="${escapeHtml(`${sla.label}: age ${formatDuration(sla.ageMinutes)} of ${sla.targetMinutes} minutes`)}">
          <div class="progress-bar" style="--value: ${sla.progress}%"></div>
        </div>
      </div>
      <div class="mini-actions">
        ${can("canAdvanceTickets") ? `<button class="mini-btn" type="button" data-next-ticket="${escapeHtml(ticket.id)}">Next</button>` : ""}
      </div>
    </article>
  `;
}
function getRecipeMeasureOptionsForIngredient(ingredient) {
    const measure = unitTypeDefinition(ingredient?.unitType).recipeMeasure;
    if (measure === "grams")
        return [{ id: "grams", label: "grams" }];
    if (measure === "milliliters")
        return [{ id: "milliliters", label: "milliliters" }];
    return [{ id: "units", label: unitTypeDefinition(ingredient?.unitType).label }];
}
function buildRecipeLine(ingredientId, quantity, measureKey) {
    const amount = Math.max(0, Number(quantity) || 0);
    if (measureKey === "grams")
        return { ingredientId, grams: amount };
    if (measureKey === "milliliters")
        return { ingredientId, milliliters: amount };
    return { ingredientId, units: amount };
}
function renderProductManagement() {
    document.querySelectorAll(".admin-product-only").forEach((panel) => {
        panel.hidden = !can("canManageProducts");
    });
    renderSellableProductForm();
    renderPurchasedProductForm();
}
function renderSellableProductForm() {
    const form = document.querySelector("#sellableProductForm");
    const categorySelect = document.querySelector("#sellableCategory");
    const stationSelect = document.querySelector("#sellableStation");
    const vatSelect = document.querySelector("#sellableVat");
    const availabilityChecks = document.querySelector("#sellableAvailabilityChecks");
    const ingredientSelect = document.querySelector("#sellableRecipeIngredient");
    const measureSelect = document.querySelector("#sellableRecipeMeasure");
    const draftPanel = document.querySelector("#sellableRecipeDraft");
    const addRecipeButton = document.querySelector("#addRecipeLineBtn");
    const createButton = document.querySelector("#createSellableProductBtn");
    if (!form || !categorySelect || !stationSelect || !vatSelect || !availabilityChecks || !ingredientSelect || !measureSelect || !draftPanel || !addRecipeButton || !createButton)
        return;
    const editable = can("canManageProducts");
    const selectedCategory = categorySelect.value || PRODUCT_CATEGORIES[0];
    categorySelect.innerHTML = PRODUCT_CATEGORIES
        .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
        .join("");
    categorySelect.value = PRODUCT_CATEGORIES.includes(selectedCategory) ? selectedCategory : PRODUCT_CATEGORIES[0];
    const stations = [...new Set([...KITCHEN_STATIONS, ...state.products.map((product) => product.station).filter(Boolean)])];
    const selectedStation = stationSelect.value || stations[0];
    stationSelect.innerHTML = stations
        .map((station) => `<option value="${escapeHtml(station)}">${escapeHtml(station)}</option>`)
        .join("");
    stationSelect.value = stations.includes(selectedStation) ? selectedStation : stations[0];
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
    addRecipeButton.disabled = !editable || !activeIngredients.length;
    createButton.disabled = !editable || !state.productRecipeDraft.length;
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
    const selectedLocation = locationSelect.value || "Freezer";
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
        .map((action) => `<option value="${escapeHtml(action.id)}">${escapeHtml(action.label)}</option>`)
        .join("");
    actionSelect.value = INVENTORY_ACTIONS.some((action) => action.id === selectedAction) ? selectedAction : "add";
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
        <td>${escapeHtml(money(ingredient.purchasePrice))} / ${escapeHtml(ingredient.unit)}</td>
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
        const cost = getProductCost(product);
        const margin = getProductMargin(product);
        const vatLabel = VAT_OPTIONS.find((option) => option.id === product.vatSetting)?.label || "Standard VAT";
        return `
      <article class="recipe-card ${product.active ? "" : "is-inactive"}">
        <header>
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <p>${escapeHtml(product.category)} | SKU ${escapeHtml(product.code)} | ${escapeHtml(product.station)}</p>
          </div>
          <div class="ticket-pills">
            <span class="pill ${product.active ? "ok" : "warning"}">${product.active ? "Active" : "Inactive"}</span>
            <span class="pill ${margin >= product.targetMargin ? "ok" : "warning"}">${margin.toFixed(1)}%</span>
          </div>
        </header>
        <p>Sale ${escapeHtml(money(product.price))} | Cost ${escapeHtml(money(cost))} | Target ${product.targetMargin}% | ${escapeHtml(vatLabel)}</p>
        <p>${escapeHtml(productAvailabilityLabel(product))}</p>
        <div class="recipe-lines">
          ${(product.recipe || []).map((line) => {
            const ingredient = ingredientById(line.ingredientId);
            if (!ingredient)
                return "";
            return `<div class="recipe-line"><span>${escapeHtml(ingredient.name)}</span><strong>${escapeHtml(getRecipeUsageLabel(line))}</strong></div>`;
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
function renderProcedures() {
    document.querySelector("#procedureList").innerHTML = state.procedures.map((procedure) => `
    <article class="procedure-card ${procedure.done ? "is-done" : ""}">
      <input type="checkbox" ${procedure.done ? "checked" : ""} ${can("canManageProcedures") ? "" : "disabled"} data-procedure="${escapeHtml(procedure.id)}" aria-label="Mark procedure done">
      <div>
        <div class="card-title">
          <strong>${escapeHtml(procedure.owner)}</strong>
          <span class="pill ${procedure.done ? "ok" : "warning"}">${procedure.done ? "Done" : "Open"}</span>
        </div>
        <p>${escapeHtml(procedure.text)}</p>
      </div>
    </article>
  `).join("");
    document.querySelector("#productionLog").innerHTML = state.productionLog.length
        ? state.productionLog.slice().reverse().map((log) => `
      <article class="log-card">
        <p><strong>${escapeHtml(log.time)}</strong> ${escapeHtml(log.text)}</p>
      </article>
    `).join("")
        : emptyState("No production changes yet.");
    document.querySelectorAll("#productionForm input, #productionForm select, #productionForm button").forEach((element) => {
        element.disabled = !can("canManageProcedures");
    });
}
function renderProductionRecipeFields() {
    const container = document.querySelector("#productionRecipeFields");
    const productionProduct = document.querySelector("#productionProduct");
    const product = productionProduct ? productById(productionProduct.value) : null;
    if (!container)
        return;
    container.innerHTML = product?.recipe?.length
        ? product.recipe.map((line, index) => {
            const ingredient = ingredientById(line.ingredientId);
            if (!ingredient)
                return "";
            const measure = getRecipeMeasure(line);
            const plannedUsage = getRecipeLineQuantity(line);
            return `
        <label>
          Actual ${escapeHtml(ingredient.name)} used (${escapeHtml(measure.label)})
          <input
            name="${escapeHtml(getProductionFieldName(line, index))}"
            type="number"
            min="0"
            step="${measure.step}"
            value="${plannedUsage}"
          >
        </label>
      `;
        }).join("")
        : emptyState("No recipe lines are attached to this product.");
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
        reservations: state.reservations.length
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
function addSellableRecipeLine(ingredientId, quantity, measureKey) {
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
    const line = buildRecipeLine(ingredient.id, amount, measureKey);
    const normalizedLine = normalizeRecipeLine(line, new Set(state.ingredients.map((item) => item.id)));
    if (!normalizedLine) {
        showToast("Choose a valid recipe amount.");
        return;
    }
    const measure = getRecipeMeasure(normalizedLine);
    const existing = state.productRecipeDraft.find((draftLine) => {
        return draftLine.ingredientId === normalizedLine.ingredientId && getRecipeMeasure(draftLine).key === measure.key;
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
    const station = String(formData.get("station") || "Main Kitchen").trim();
    const price = Math.max(0, Number(formData.get("price")) || 0);
    const vatSetting = String(formData.get("vatSetting") || "standard");
    const active = formData.get("active") === "true";
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
        targetMargin: 65,
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
function getSelectedInventoryLocation(formData, selectName, customName = "") {
    const customLocation = customName ? normalizeInventoryLocationName(formData.get(customName), "") : "";
    return customLocation || normalizeInventoryLocationName(formData.get(selectName), "");
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
        pushInventoryHistory({
            ingredient,
            type: action,
            quantity: removed,
            fromLocation,
            detail: `${action === "waste" ? "Wasted" : "Removed"} ${formatStockAmount(removed, ingredient.unit)} from ${fromLocation}.`
        });
        if (action === "waste") {
            state.productionLog.push({
                id: `LOG-${Date.now()}`,
                time: timeNow(),
                text: `Waste logged: ${formatStockAmount(removed, ingredient.unit)} ${ingredient.name} removed from ${fromLocation}.`
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
function deductInventoryForItems(items) {
    getStockRequirementsForItems(items).forEach((required, ingredientId) => {
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
    });
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
function addOrderDraftLine(productId, quantity) {
    if (!can("canCreateOrders")) {
        showToast("This role cannot create orders.");
        return;
    }
    const product = productById(productId);
    const channel = document.querySelector("#orderForm")?.elements.channel.value || "Dine-in";
    const requestedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    const availability = getProductAvailability(product);
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
    state.orderDraft = normalizeOrderItems([...state.orderDraft, { productId: product.id, quantity: requestedQuantity }]);
    saveState();
    render();
    showToast(`${requestedQuantity}x ${product.name} added to basket.`);
}
function removeOrderDraftLine(productId) {
    state.orderDraft = state.orderDraft.filter((item) => item.productId !== productId);
    saveState();
    render();
}
function clearOrderDraft() {
    state.orderDraft = [];
    saveState();
    render();
}
function createOrder(formData) {
    if (!can("canCreateOrders")) {
        showToast("This role cannot create orders.");
        return;
    }
    const channel = formData.get("channel");
    const items = state.orderDraft.length
        ? normalizeOrderItems(state.orderDraft)
        : normalizeOrderItems([{ productId: formData.get("productId"), quantity: formData.get("quantity") }]);
    const shortages = getStockShortages(items);
    const unavailableItem = items.find((item) => !productCanBeOrdered(productById(item.productId), channel));
    const inactiveIngredientItem = items.find((item) => {
        const product = productById(item.productId);
        return (product?.recipe || []).some((line) => {
            const ingredient = ingredientById(line.ingredientId);
            return !ingredient?.active;
        });
    });
    if (!items.length) {
        showToast("Add an item before sending the order.");
        return;
    }
    if (unavailableItem) {
        const unavailableProduct = productById(unavailableItem.productId);
        showToast(`${unavailableProduct?.name || "That product"} is not available for ${channel}.`);
        state.orderDraft = state.orderDraft.filter((item) => productCanBeOrdered(productById(item.productId), channel));
        renderOrderBuilder();
        return;
    }
    if (inactiveIngredientItem) {
        const product = productById(inactiveIngredientItem.productId);
        showToast(`${product?.name || "That product"} has an inactive purchased product in its recipe.`);
        renderOrderBuilder();
        return;
    }
    if (shortages.length) {
        const missing = shortages.map((item) => `${formatStockAmount(item.shortage, item.ingredient.unit)} ${item.ingredient.name}`).join(", ");
        showToast(`Cannot send order; missing ${missing}.`);
        renderOrderBuilder();
        return;
    }
    const number = state.nextOrderNumber;
    const orderId = `ORD-${number}`;
    const createdAt = timeNow();
    const createdAtMs = Date.now();
    const order = {
        id: orderId,
        number,
        channel,
        customer: formData.get("customer") || "Walk-in",
        paymentStatus: formData.get("paymentStatus"),
        fulfillment: formData.get("fulfillment"),
        status: "Queued",
        createdAt,
        createdAtMs,
        notes: formData.get("notes"),
        items: items.map((item) => ({ ...item }))
    };
    const stations = [...new Set(items.map((item) => productById(item.productId).station))];
    state.orders.push(order);
    items.forEach((item, index) => {
        const product = productById(item.productId);
        state.tickets.push({
            id: `TCK-${number}-${index + 1}`,
            orderId,
            productId: product.id,
            quantity: item.quantity,
            station: product.station,
            status: "Queued",
            createdAt,
            createdAtMs,
            notes: order.notes
        });
    });
    state.nextOrderNumber += 1;
    state.orderDraft = [];
    deductInventoryForItems(items);
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
    showToast(`Order #${number} sent to ${stations.length === 1 ? stations[0] : `${stations.length} stations`}; inventory updated automatically.`);
}
function advanceStatus(current) {
    return TICKET_STATUS_FLOW[Math.min(TICKET_STATUS_FLOW.indexOf(current) + 1, TICKET_STATUS_FLOW.length - 1)] || "Queued";
}
function setTicketStatus(ticket, status) {
    const now = Date.now();
    ticket.status = status;
    if (status === "Preparing" && !ticket.startedAtMs) {
        ticket.startedAtMs = now;
    }
    if (status === "Ready" && !ticket.readyAtMs) {
        ticket.readyAtMs = now;
    }
    if (status === "Done" && !ticket.completedAtMs) {
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
    if (tickets.every((ticket) => ticket.status === "Done"))
        order.status = "Done";
    else if (tickets.every((ticket) => ticket.status === "Ready" || ticket.status === "Done"))
        order.status = "Ready";
    else if (tickets.some((ticket) => ticket.status === "Preparing"))
        order.status = "Preparing";
    else
        order.status = "Queued";
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
function advanceOrder(orderId) {
    if (!can("canCreateOrders") && !can("canAdvanceTickets")) {
        showToast("This role cannot update orders.");
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
function logWaste() {
    if (!can("canManageInventory")) {
        showToast("This role cannot change inventory.");
        return;
    }
    const ingredient = ingredientById("kefta");
    if (!ingredient)
        return;
    const location = getIngredientPrimaryLocation(ingredient);
    const result = deductIngredientStock(ingredient, 0.25, location);
    pushInventoryHistory({
        ingredient,
        type: "waste",
        quantity: result.removed,
        fromLocation: location,
        detail: `Waste logged: ${formatStockAmount(result.removed, ingredient.unit)} kefta removed from ${location}.`
    });
    state.productionLog.push({
        id: `LOG-${Date.now()}`,
        time: timeNow(),
        text: `Waste logged: ${formatStockAmount(result.removed, ingredient.unit)} kefta removed from ${location}. Stock and reorder status updated.`
    });
    saveState();
    render();
    showToast("Waste logged and stock recalculated.");
}
function recordProduction(formData) {
    if (!can("canManageProcedures")) {
        showToast("This role cannot record production.");
        return;
    }
    const product = productById(formData.get("productId"));
    if (!product)
        return;
    const actualUsages = product.recipe.map((line, index) => {
        const ingredient = ingredientById(line.ingredientId);
        if (!ingredient)
            return null;
        const measure = getRecipeMeasure(line);
        const actualUsage = Math.max(0, Number(formData.get(getProductionFieldName(line, index))) || 0);
        const usedStock = convertActualUsageToStockUnits(line, actualUsage);
        const result = deductIngredientStock(ingredient, usedStock);
        pushInventoryHistory({
            ingredient,
            type: "remove",
            quantity: result.removed,
            fromLocation: result.removals.map((removal) => removal.location).join(", "),
            detail: `${product.name} batch used ${formatActualUsageLabel(actualUsage, measure)} ${ingredient.name}.`
        });
        return `${formatActualUsageLabel(actualUsage, measure)} ${ingredient.name}`;
    }).filter(Boolean);
    state.productionLog.push({
        id: `LOG-${Date.now()}`,
        time: timeNow(),
        text: `${product.name} batch used actual ${actualUsages.join(", ")}. Ingredient stock and cost trace updated.`
    });
    saveState();
    render();
    showToast("Recipe execution recorded.");
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
    if (!currentUser())
        return;
    ensureActiveViewAccess();
    renderNav();
    renderMetrics();
    renderDashboard();
    renderKitchen();
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
        const nextOrder = event.target.closest("[data-next-order]");
        if (nextOrder)
            advanceOrder(nextOrder.dataset.nextOrder);
        const supplierOrdered = event.target.closest("[data-supplier-ordered]");
        if (supplierOrdered)
            markSupplierOrderOrdered(supplierOrdered.dataset.supplierOrdered);
        const supplierReceived = event.target.closest("[data-supplier-received]");
        if (supplierReceived)
            receiveSupplierOrder(supplierReceived.dataset.supplierReceived);
        const removeDraft = event.target.closest("[data-remove-draft]");
        if (removeDraft)
            removeOrderDraftLine(removeDraft.dataset.removeDraft);
        const removeRecipeLine = event.target.closest("[data-remove-recipe-line]");
        if (removeRecipeLine)
            removeSellableRecipeLine(removeRecipeLine.dataset.removeRecipeLine);
        const toggleSellable = event.target.closest("[data-toggle-sellable]");
        if (toggleSellable)
            toggleSellableProduct(toggleSellable.dataset.toggleSellable);
        const togglePurchased = event.target.closest("[data-toggle-purchased]");
        if (togglePurchased)
            togglePurchasedProduct(togglePurchased.dataset.togglePurchased);
    });
    document.addEventListener("change", (event) => {
        const productionProduct = event.target.closest("#productionProduct");
        if (productionProduct) {
            renderProductionRecipeFields();
            return;
        }
        const sellableRecipeIngredient = event.target.closest("#sellableRecipeIngredient");
        if (sellableRecipeIngredient) {
            renderSellableProductForm();
            return;
        }
        const procedureToggle = event.target.closest("[data-procedure]");
        if (!procedureToggle)
            return;
        if (!can("canManageProcedures")) {
            procedureToggle.checked = !procedureToggle.checked;
            showToast("This role cannot update procedures.");
            return;
        }
        const procedure = state.procedures.find((item) => item.id === procedureToggle.dataset.procedure);
        procedure.done = procedureToggle.checked;
        saveState();
        render();
    });
    document.querySelector("#loginForm").addEventListener("submit", (event) => {
        event.preventDefault();
        login(new FormData(event.currentTarget));
    });
    document.querySelector("#orderForm").addEventListener("submit", (event) => {
        event.preventDefault();
        createOrder(new FormData(event.currentTarget));
    });
    document.querySelector("#addOrderLineBtn").addEventListener("click", () => {
        addOrderDraftLine(document.querySelector("#productSelect").value, document.querySelector("#orderQuantity").value);
    });
    document.querySelector("#clearOrderDraftBtn").addEventListener("click", clearOrderDraft);
    document.querySelector("#productSelect").addEventListener("change", renderOrderBuilder);
    document.querySelector("#orderQuantity").addEventListener("input", renderOrderBuilder);
    document.querySelector("#orderForm").elements.channel.addEventListener("change", () => {
        renderProductsInSelects();
        renderOrderBuilder();
    });
    document.querySelector("#addRecipeLineBtn").addEventListener("click", () => {
        addSellableRecipeLine(document.querySelector("#sellableRecipeIngredient").value, document.querySelector("#sellableRecipeQuantity").value, document.querySelector("#sellableRecipeMeasure").value);
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
    document.querySelector("#productionForm").addEventListener("submit", (event) => {
        event.preventDefault();
        recordProduction(new FormData(event.currentTarget));
    });
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