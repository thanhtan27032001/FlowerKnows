export const vnd = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

/** Cost / margin figures may include decimals from weighted-average cost. */
export const vndCost = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 2,
});

export function formatCostPrice(value: number | null | undefined): string {
  if (value == null) return "Not set";
  return vndCost.format(value);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatDate(isoDate: string): string {
  // LocalDate from API is YYYY-MM-DD — parse as local date, not UTC midnight
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
  }).format(date);
}
