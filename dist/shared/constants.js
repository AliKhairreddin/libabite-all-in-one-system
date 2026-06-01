export const STORAGE_KEY = "libabite-ops-state-v3";
export const RESERVATION_TURNOVER_MINUTES = 90;
export const MINUTE_MS = 60 * 1000;
export const TICKET_STATUS_FLOW = ["Queued", "Accepted", "Preparing", "Ready", "Done"];
export const TICKET_STATUSES = ["Queued", "Accepted", "Preparing", "Delayed", "Ready", "Done"];
export const ORDER_STATUSES = ["New", "Sent to kitchen", "Preparing", "Delayed", "Ready", "Served", "Paid", "Cancelled"];
export const PHONE_MESSAGE_ORDER_CHANNEL = "Phone/message order";
export const ORDER_TYPE_OPTIONS = [
    { value: "Dine-in", label: "Dine-in", availabilityKey: "dineIn", fulfillment: "Kitchen", requiresTable: true },
    { value: "Takeaway", label: "Takeaway", availabilityKey: "takeaway", fulfillment: "Pickup", requiresTable: false },
    { value: "Delivery", label: "Delivery", availabilityKey: "delivery", fulfillment: "Delivery", requiresTable: false },
    { value: PHONE_MESSAGE_ORDER_CHANNEL, label: "Phone/message order", availabilityKey: "takeaway", fulfillment: "Pickup", requiresTable: false },
    { value: "QR table order", label: "QR table order", availabilityKey: "qrOrdering", fulfillment: "Kitchen", requiresTable: true },
    { value: "Website order", label: "Website order", availabilityKey: "websiteOrdering", fulfillment: "Pickup", requiresTable: false },
    { value: "External delivery app order", label: "External delivery app order", availabilityKey: "externalDeliveryApps", fulfillment: "Delivery", requiresTable: false }
];
export const LEGACY_ORDER_TYPE_MAP = {
    QR: "QR table order",
    Website: "Website order",
    Phone: "Phone/message order",
    "Uber Eats": "External delivery app order"
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
export const PRODUCT_CATEGORIES = ["Kefta", "Sandwiches", "Burgers", "Cold Mezza", "Sweets", "Drinks", "Packaging", "Other"];
export const VAT_OPTIONS = [
    { id: "standard", label: "Standard VAT" },
    { id: "reduced", label: "Reduced VAT" },
    { id: "zero", label: "Zero VAT" }
];
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
export const PHASE_11_SEED_PRODUCT_IDS = ["kefta-mix-batch"];
export const CUSTOMER_QR_CHANNEL = "QR table order";
export const CUSTOMER_QR_ORDER_CONTEXT = { channel: CUSTOMER_QR_CHANNEL, fulfillment: "Kitchen" };
export const WEBSITE_ORDER_CHANNEL = "Website order";
export const WEBSITE_PAYMENT_PROCESSOR = "Libabite Online Checkout";
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
        views: ["dashboard", "orders", "procedures", "team", "reservations"],
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
        views: ["dashboard", "kitchen", "procedures", "team"],
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
    restaurantName: "Libabite",
    location: "Roermond, Netherlands",
    currency: "EUR",
    currencyLabel: "Euro",
    opensAt: "11:00",
    closesAt: "22:00",
    defaultLanguage: "nl",
    supportedLanguages: ["nl", "ar", "tr", "en"]
};
export const DATA_MODEL = [
    { name: "users", fields: "id, name, email, role, password, status" },
    { name: "roles", fields: "role id, label, visible views, permissions" },
    { name: "restaurant_settings", fields: "name, location, currency, hours, languages" },
    { name: "sellable_products", fields: "name, code/SKU, category, kitchen station, price, VAT, status, availability, margin settings, recipe links" },
    { name: "purchased_products", fields: "ingredient, supplier, purchase price, unit type, min/max, total stock, stock by location, expiry, barcode, status" },
    { name: "suppliers", fields: "name, contact person, email, phone, integration/API details, delivery days, minimum order amount, products supplied" },
    { name: "purchase_orders", fields: "supplier, status, suggested quantity, approved quantity, sent method, received quantity, inventory update log" },
    { name: "inventory_locations", fields: "default restaurant locations, custom locations, per-location quantities" },
    { name: "inventory_actions", fields: "add, remove, transfer, waste, manual correction, stock history" },
    { name: "waste_records", fields: "product, quantity, unit, reason, staff member, date/time, notes, cost" },
    { name: "recipes", fields: "sellable product, ingredient, quantity, unit, waste %, preparation station, notes, fulfillment rule" },
    { name: "customers", fields: "name, phone, email, address history, notes, favorite items, previous orders" },
    { name: "orders", fields: "channel, customer, payment status/method/reference, staff member, fulfillment, requested time, address, line items, assigned driver, delivery status/proof" },
    { name: "kitchen_tickets", fields: "order, product, station, status, priority, issue note, SLA times" },
    { name: "driver_deliveries", fields: "driver, order, pickup status, delivery status, ETA, location, notes, proof photo, cash collection" },
    { name: "staff_shifts", fields: "staff, date, role/station, planned start/end, notification, clock-in/out, breaks, planned vs actual metrics" },
    { name: "table_qr_codes", fields: "token, table, area, active/disabled status, customer order URL" },
    { name: "reservations", fields: "guest, time, table, source, status" },
    { name: "procedures", fields: "title, department, language, steps, required tools/products, media, frequency, assigned role" },
    { name: "procedure_completions", fields: "procedure, staff member, status, completed at, checked steps, notes/issues" }
];
//# sourceMappingURL=constants.js.map