// Shared formatters. One definition so every figure renders identically across the app.

// Indian Rupees, no decimals (en-IN grouping: 1,23,195). Used wherever ₹ spend/revenue shows.
export const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
