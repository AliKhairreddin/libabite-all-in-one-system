export const STORAGE_KEY = "libabite-ops-state-v3";
export const RESERVATION_TURNOVER_MINUTES = 90;
export const MINUTE_MS = 60 * 1000;
export const TICKET_STATUS_FLOW = ["Queued", "Accepted", "Preparing", "Ready", "Done"];
export const TICKET_STATUSES = ["Queued", "Accepted", "Preparing", "Delayed", "Ready", "Done"];
export const ORDER_STATUSES = ["New", "Sent to kitchen", "Preparing", "Delayed", "Ready", "Served", "Paid", "Cancelled"];
export const PHONE_MESSAGE_ORDER_CHANNEL = "Phone/message order";
export const EXTERNAL_DELIVERY_ORDER_CHANNEL = "External delivery app order";
export const ORDER_TYPE_OPTIONS = [
    { value: "Dine-in", label: "Dine-in", availabilityKey: "dineIn", fulfillment: "Kitchen", requiresTable: true },
    { value: "Takeaway", label: "Takeaway", availabilityKey: "takeaway", fulfillment: "Pickup", requiresTable: false },
    { value: "Delivery", label: "Delivery", availabilityKey: "delivery", fulfillment: "Delivery", requiresTable: false },
    { value: PHONE_MESSAGE_ORDER_CHANNEL, label: "Phone/message order", availabilityKey: "takeaway", fulfillment: "Pickup", requiresTable: false },
    { value: "QR table order", label: "QR table order", availabilityKey: "qrOrdering", fulfillment: "Kitchen", requiresTable: true },
    { value: "Website order", label: "Website order", availabilityKey: "websiteOrdering", fulfillment: "Pickup", requiresTable: false },
    { value: EXTERNAL_DELIVERY_ORDER_CHANNEL, label: "External delivery app order", availabilityKey: "externalDeliveryApps", fulfillment: "Delivery", requiresTable: false }
];
export const LEGACY_ORDER_TYPE_MAP = {
    QR: "QR table order",
    Website: "Website order",
    Phone: "Phone/message order",
    "Uber Eats": EXTERNAL_DELIVERY_ORDER_CHANNEL,
    Thuisbezorgd: EXTERNAL_DELIVERY_ORDER_CHANNEL
};
export const UNPAID_PAYMENT_METHOD = "Unpaid / pay later";
export const DEFAULT_PAID_PAYMENT_METHOD = "Cash";
export const PAYMENT_METHOD_OPTIONS = [
    { value: UNPAID_PAYMENT_METHOD, label: "Unpaid / pay later", paid: false },
    { value: "Cash", label: "Cash", paid: true },
    { value: "Card", label: "Card", paid: true },
    { value: "Online payment", label: "Online payment", paid: true },
    { value: "External delivery app payment", label: "External delivery app payment", paid: true }
];
export const PAYMENT_STATUSES = ["Unpaid", "Pending", "Authorized", "Paid", "Pay later", "Failed", "Cancelled", "Refunded", "Partially refunded"];
export const PAYMENT_LEDGER_KINDS = ["order", "reservation_deposit", "reservation_no_show_fee", "terminal", "external_platform", "refund"];
export const PAYMENT_PROVIDERS = [
    { id: "manual", label: "Manual / recorded by staff", supportsOnline: false, supportsTerminal: false },
    { id: "cash", label: "Cash", supportsOnline: false, supportsTerminal: false },
    { id: "stripe", label: "Stripe", supportsOnline: true, supportsTerminal: true },
    { id: "mollie", label: "Mollie", supportsOnline: true, supportsTerminal: true },
    { id: "uber-eats", label: "Uber Eats", supportsOnline: false, supportsTerminal: false },
    { id: "thuisbezorgd", label: "Thuisbezorgd", supportsOnline: false, supportsTerminal: false }
];
export const ONLINE_PAYMENT_PROVIDER_OPTIONS = ["stripe", "mollie"];
export const IN_PERSON_PAYMENT_PROVIDER_OPTIONS = ["cash", "manual", "stripe", "mollie"];
export const DEFAULT_ONLINE_PAYMENT_PROVIDER = "stripe";
export const DEFAULT_TERMINAL_PAYMENT_PROVIDER = "manual";
export const STRIPE_CHECKOUT_PAYMENT_METHOD_TYPES_NL = ["ideal", "card"];
export const MOLLIE_ONLINE_PAYMENT_METHODS_NL = ["ideal", "creditcard", "applepay"];
export const PAYMENT_CAPTURE_MODES = ["online_checkout", "qr_order", "staff_recorded", "terminal", "external_platform"];
export const ORDER_OPERATIONAL_STATUSES = ["New", "Accepted", "Sent to kitchen", "Preparing", "Delayed", "Ready", "Served", "Completed", "Cancelled"];
export const FULFILLMENT_STATUSES = ["Not started", "Scheduled", "Preparing", "Ready", "Picked up", "On the way", "Delivered", "Served", "Completed", "Cancelled"];
export const VAT_RATES = {
    standard: 0.21,
    reduced: 0.09,
    zero: 0
};
export const LINE_MODIFIER_OPTIONS = ["No onion", "Extra sauce", "Spicy", "Cutlery", "Allergy check"];
export const TICKET_SLA_MINUTES = {
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
export const SLA_WARNING_WINDOW_MINUTES = 3;
export const KITCHEN_STATIONS = ["Burger station", "Cold mezza station", "Sweets station", "Drinks station", "Grill station", "Packaging station", "Main kitchen"];
export const KITCHEN_STATION_ALIASES = {
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
export const PRODUCT_CATEGORIES = [
    "LibaGrill TOGO",
    "LibaWraps - TOGO",
    "LibaPizza - TOGO",
    "LibaSoup",
    "Cold Mezze",
    "Hot Mezze",
    "Salades",
    "Liba Fried Chicken",
    "LibaSweets",
    "Liba Shared Dining - TOGO",
    "Extra voor erbij",
    "Sauzen",
    "Frisdrank",
    "Other"
];
export const VAT_OPTIONS = [
    { id: "standard", label: "Standard VAT (21%)" },
    { id: "reduced", label: "Reduced food VAT (9%)" },
    { id: "zero", label: "Zero VAT (0%)" }
];
export const PRODUCT_ALLERGENS = [
    { id: "gluten", label: "Gluten-containing cereals" },
    { id: "egg", label: "Egg" },
    { id: "fish", label: "Fish" },
    { id: "peanut", label: "Peanut" },
    { id: "tree-nuts", label: "Tree nuts" },
    { id: "soy", label: "Soy" },
    { id: "milk", label: "Milk / lactose" },
    { id: "crustaceans", label: "Crustaceans" },
    { id: "molluscs", label: "Molluscs" },
    { id: "celery", label: "Celery" },
    { id: "mustard", label: "Mustard" },
    { id: "sesame", label: "Sesame" },
    { id: "sulphites", label: "Sulphites" },
    { id: "lupin", label: "Lupin" }
];
export const PRECAUTIONARY_ALLERGEN_STATUSES = ["none", "may_contain", "ask_staff"];
export const AVAILABILITY_OPTIONS = [
    { id: "dineIn", label: "Dine-in" },
    { id: "qrOrdering", label: "QR ordering" },
    { id: "takeaway", label: "Takeaway" },
    { id: "delivery", label: "Delivery" },
    { id: "websiteOrdering", label: "Website ordering" },
    { id: "externalDeliveryApps", label: "External delivery apps" }
];
export const DEFAULT_PRODUCT_AVAILABILITY = {
    dineIn: true,
    qrOrdering: true,
    takeaway: true,
    delivery: true,
    websiteOrdering: true,
    externalDeliveryApps: false
};
export const UNIT_TYPES = [
    { id: "grams", label: "grams", shortLabel: "g", recipeMeasure: "grams" },
    { id: "kilograms", label: "kilograms", shortLabel: "kg", recipeMeasure: "grams" },
    { id: "milliliters", label: "milliliters", shortLabel: "ml", recipeMeasure: "milliliters" },
    { id: "liters", label: "liters", shortLabel: "l", recipeMeasure: "milliliters" },
    { id: "pieces", label: "pieces", shortLabel: "pcs", recipeMeasure: "units" },
    { id: "boxes", label: "boxes", shortLabel: "boxes", recipeMeasure: "units" },
    { id: "packages", label: "packages", shortLabel: "packages", recipeMeasure: "units" }
];
export const DEFAULT_INVENTORY_LOCATIONS = [
    "Fridge",
    "Fridge 1",
    "Fridge 2",
    "Freezer",
    "Dry storage",
    "Kitchen station storage",
    "Bar storage",
    "No-cooling storage"
];
export const INVENTORY_ACTIONS = [
    { id: "add", label: "Add stock" },
    { id: "remove", label: "Remove stock" },
    { id: "transfer", label: "Transfer stock" },
    { id: "waste", label: "Mark wasted" },
    { id: "correct", label: "Correct manually" }
];
export const SUPPLIER_INTEGRATION_METHODS = [
    { id: "email", label: "Email order" },
    { id: "pdf", label: "PDF order" },
    { id: "csv", label: "CSV export" },
    { id: "api", label: "API integration" },
    { id: "whatsapp", label: "WhatsApp/message template" },
    { id: "manual", label: "Manual order" }
];
export const SUPPLIER_ORDER_STATUSES = ["Draft", "Approved", "Sent", "Ordered", "Received"];
export const EXTERNAL_DELIVERY_PLATFORMS = [
    { id: "uber-eats", name: "Uber Eats" },
    { id: "thuisbezorgd", name: "Thuisbezorgd" },
    { id: "local-delivery", name: "Other local delivery platform" }
];
export const EXTERNAL_DELIVERY_PLATFORM_STATUSES = ["Draft", "Approval pending", "Connected", "Paused"];
export const EXTERNAL_DELIVERY_IMPORT_METHODS = [
    { id: "api", label: "API receive" },
    { id: "manual", label: "Manual import" },
    { id: "email", label: "Email parser" },
    { id: "csv", label: "CSV import" },
    { id: "staff", label: "Staff-entered external order" }
];
export const WASTE_REASONS = [
    { id: "Spoiled", label: "Spoiled" },
    { id: "Dropped", label: "Dropped" },
    { id: "Wrong preparation", label: "Wrong preparation" },
    { id: "Expired", label: "Expired" },
    { id: "Returned", label: "Returned" },
    { id: "Other", label: "Other" }
];
export const RECIPE_APPLIES_OPTIONS = [
    { id: "all", label: "Every order" },
    { id: "takeawayDelivery", label: "Takeaway/delivery only" }
];
export const DEFAULT_MARGIN_TARGET = 65;
export const DEFAULT_MARGIN_MINIMUM = 55;
export const DEFAULT_RECIPE_ORDER_CONTEXT = { channel: "Dine-in", fulfillment: "Kitchen" };
export const TAKEAWAY_DELIVERY_RECIPE_CONTEXT = { channel: "Takeaway", fulfillment: "Delivery" };
export const PHASE_11_SEED_INGREDIENT_IDS = ["minced-beef", "onion-herb-mix", "kefta-spice-blend"];
export const PHASE_11_SEED_PRODUCT_IDS = [];
export const PHASE_18_SEED_PRODUCT_IDS = [];
export const CUSTOMER_QR_CHANNEL = "QR table order";
export const CUSTOMER_QR_ORDER_CONTEXT = { channel: CUSTOMER_QR_CHANNEL, fulfillment: "Kitchen" };
export const WEBSITE_ORDER_CHANNEL = "Website order";
export const WEBSITE_PAYMENT_PROCESSOR = "Stripe";
export const WEBSITE_DEFAULT_FULFILLMENT = "Pickup";
export const WEBSITE_FULFILLMENT_OPTIONS = [
    { value: "Pickup", label: "Takeaway", channel: "Takeaway" },
    { value: "Delivery", label: "Delivery", channel: "Delivery" }
];
export const PHONE_MESSAGE_FULFILLMENT_OPTIONS = [
    { value: "Pickup", label: "Takeaway", channel: "Takeaway" },
    { value: "Delivery", label: "Delivery", channel: "Delivery" }
];
export const QR_CODE_STATUSES = ["Active", "Disabled"];
export const RESERVATION_STATUSES = ["Pending", "Confirmed", "Arrived", "No-show", "Declined", "Cancelled"];
export const RESERVATION_ACTIVE_STATUSES = ["Pending", "Confirmed", "Arrived"];
export const RESERVATION_SOURCES = ["Website", "Google link", "Facebook/Instagram", "Phone", "Staff entry", "Walk-in"];
export const DRIVER_IDLE_STATUS = "Available";
export const DRIVER_DELIVERY_STATUSES = ["Assigned", "At restaurant", "Picked up", "On the way", "Delivered", "Failed delivery", "Returned"];
export const DRIVER_TERMINAL_DELIVERY_STATUSES = ["Delivered", "Returned"];
export const DELIVERY_STATUS_ETA_MINUTES = {
    Assigned: 18,
    "At restaurant": 16,
    "Picked up": 14,
    "On the way": 10,
    "Failed delivery": 0,
    Delivered: 0,
    Returned: 0
};
export const DELIVERY_LATE_MINUTES = 35;
export const SHIFT_GRACE_MINUTES = 5;
export const SCHEDULE_ROLES = ["Manager", "Kitchen", "Front", "Cashier", "Driver", "Grill", "Sweets", "Packaging", "Cleaning"];
export const SCHEDULE_STATIONS = [
    "Restaurant floor",
    "Cashier",
    "Main kitchen",
    "Grill station",
    "Burger station",
    "Cold mezza station",
    "Sweets station",
    "Drinks station",
    "Packaging station",
    "Delivery",
    "Cleaning"
];
export const ROLE_ORDER = ["owner_admin", "manager", "waiter_cashier", "kitchen_staff", "driver"];
export const ROLE_DEFINITIONS = {
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
        canManageSchedule: true,
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
        canManageSchedule: true,
        operationalRole: "Manager"
    },
    waiter_cashier: {
        label: "Waiter/Cashier",
        icon: "WC",
        homeView: "orders",
        views: ["orders", "reservations"],
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
        views: ["kitchen"],
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
        views: ["team"],
        canCompleteProcedures: true,
        operationalRole: "Driver"
    }
};
export const LANGUAGE_OPTIONS = [
    { id: "nl", label: "Dutch" },
    { id: "ar", label: "Arabic" },
    { id: "tr", label: "Turkish" },
    { id: "en", label: "English" }
];
export const PROCEDURE_DEPARTMENTS = ["Kitchen", "Front of house", "Cashier", "Delivery", "Cleaning", "Food safety", "Management"];
export const PROCEDURE_FREQUENCIES = ["Daily", "Weekly", "Monthly", "Per shift"];
export const PROCEDURE_ASSIGNED_ROLES = ["All staff", "Owner/Admin", "Manager", "Kitchen", "Front", "Cashier", "Driver"];
export const PROCEDURE_COMPLETION_STATUSES = ["Done", "Problem", "Skipped"];
export const DEFAULT_RESTAURANT_SETTINGS = {
    restaurantName: "LibaBite",
    location: "Roermond, Netherlands",
    currency: "EUR",
    currencyLabel: "Euro",
    opensAt: "11:00",
    closesAt: "22:00",
    timeZone: "Europe/Amsterdam",
    reservationsEnabled: true,
    reservationLeadMinutes: 120,
    reservationHorizonDays: 90,
    reservationMaxGuests: 12,
    defaultLanguage: "nl",
    supportedLanguages: ["nl", "ar", "tr", "en"]
};
export const RECEIPT_PRINT_TRIGGERS = [
    "order_sent",
    "order_paid",
    "qr_order_sent",
    "website_payment_paid",
    "external_order_imported",
    "manual_reprint",
    "test_print"
];
export const RECEIPT_PRINT_JOB_STATUSES = ["queued", "claimed", "printed", "failed", "cancelled"];
export const DEFAULT_RECEIPT_PRINTER_SETTINGS = {
    enabled: true,
    printerId: "main-receipt",
    printerName: "Main receipt printer",
    connection: "network-escpos",
    host: "",
    port: 9100,
    paperWidth: 42,
    copies: 1,
    printOnOrderSent: false,
    printOnPaid: true,
    printOnQrOrder: true,
    printOnWebsitePayment: true,
    printOnExternalImport: true,
    cutPaper: true,
    openCashDrawer: false,
    maxAttempts: 3
};
export const DATA_MODEL = [
    { name: "users", fields: "id, name, email, role, password, status" },
    { name: "roles", fields: "role id, label, visible views, permissions" },
    { name: "restaurant_settings", fields: "name, location, currency, hours, languages" },
    { name: "receipt_print_jobs", fields: "order, trigger, printer, status, attempts, timestamps, error" },
    { name: "sellable_products", fields: "name, code/SKU, category, kitchen station, price, VAT, status, availability, margin settings, recipe links" },
    { name: "purchased_products", fields: "ingredient, supplier, purchase price, unit type, min/max, total stock, stock by location, expiry, barcode, status" },
    { name: "suppliers", fields: "name, contact person, email, phone, integration/API details, delivery days, minimum order amount, products supplied" },
    { name: "purchase_orders", fields: "supplier, status, suggested quantity, approved quantity, sent method, received quantity, inventory update log" },
    { name: "external_delivery_platforms", fields: "platform, API approval status, import fallback mode, commission rate, API details, last menu push" },
    { name: "external_product_mappings", fields: "platform, external product name/code, internal product, recipe, kitchen station, commission override" },
    { name: "external_order_imports", fields: "platform, external order id, import method, matched items, unmatched items, internal order link, status push log" },
    { name: "inventory_locations", fields: "default restaurant locations, custom locations, per-location quantities" },
    { name: "inventory_actions", fields: "add, remove, transfer, waste, manual correction, stock history" },
    { name: "waste_records", fields: "product, quantity, unit, reason, staff member, date/time, notes, cost" },
    { name: "recipes", fields: "sellable product, ingredient, quantity, unit, waste %, preparation station, notes, fulfillment rule" },
    { name: "customers", fields: "name, phone, email, address history, notes, favorite items, previous orders" },
    { name: "orders", fields: "channel, customer, payment status/method/reference, staff member, fulfillment, requested time, address, line items, assigned driver, delivery status/proof" },
    { name: "payments", fields: "kind, provider, status, amount, currency, order/reservation link, method, provider reference, checkout session/payment intent, terminal reader, paid/failed/refunded timestamps" },
    { name: "kitchen_tickets", fields: "order, product, station, status, priority, issue note, SLA times" },
    { name: "driver_deliveries", fields: "driver, order, pickup status, delivery status, ETA, location, notes, proof photo, cash collection" },
    { name: "staff_shifts", fields: "staff, date, role/station, planned start/end, notification, clock-in/out, breaks, planned vs actual metrics" },
    { name: "table_qr_codes", fields: "token, table, area, active/disabled status, customer order URL" },
    { name: "reservations", fields: "date, time, guest, contact, table, notes, source, status, optional deposit/payment status" },
    { name: "reservation_blocks", fields: "date, start/end time, reason, active unavailable windows" },
    { name: "reservation_capacity_rules", fields: "date or daily rule, start/end time, max guests, max reservations" },
    { name: "procedures", fields: "title, department, language, steps, required tools/products, media, frequency, assigned role" },
    { name: "procedure_completions", fields: "procedure, staff member, status, completed at, checked steps, notes/issues" }
];
//# sourceMappingURL=constants.js.map