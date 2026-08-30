// Shared formatters. One definition so every figure renders identically across the app.

// Indian Rupees, no decimals (en-IN grouping: 1,23,195). Used wherever ₹ spend/revenue shows.
export const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

// Rupees with 2 decimals - for small per-unit costs (CPM, CPC) where rounding to whole rupees hides real
// differences (₹8.24 vs ₹8.71 both read "₹8" otherwise).
export const rupeesPrecise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
