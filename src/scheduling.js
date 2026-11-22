export const defaultTimeZone = "America/New_York";

export function localAppointment(now = new Date(), timeZone = defaultTimeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01") return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function readAppointment(form) {
  if (form.getAll("appointmentDate").length !== 1 || form.getAll("appointmentTime").length !== 1) return null;
  const date = form.get("appointmentDate");
  const time = form.get("appointmentTime");
  return validDate(date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? { date, time } : null;
}

export function futureOrder(order, now = new Date()) {
  return Boolean(order?.appointment_date && order.appointment_date > localAppointment(now, order.time_zone).date);
}
