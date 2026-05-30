export function slugify(value, fallback = "item") {
    return String(value || fallback)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        || fallback;
}
export function uniqueRecordId(base, collections, fallback = "user") {
    let nextId = slugify(base, fallback);
    const existingIds = new Set(collections.flat().map((record) => record.id));
    let suffix = 2;
    while (existingIds.has(nextId)) {
        nextId = `${slugify(base, fallback)}-${suffix}`;
        suffix += 1;
    }
    return nextId;
}
//# sourceMappingURL=ids.js.map