export function formatMoney(value, currency = "EUR", locale = "nl-NL") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}
