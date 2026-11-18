import { query, withTransaction } from "../config/database";

export const DURATION_MINUTES = 25;

export const machineInfo = (booking: { machine_type?: string }) =>
  booking.machine_type === "WASHING"
    ? { machineColumn: "washing_machine_id", table: "washing_machines" }
    : { machineColumn: "drying_machine_id", table: "drying_machines" };

export const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export const minutesToTime = (total: number): string =>
  `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;

export const nowWibTime = (): string =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());

export const addMinutesToTime = (time: string, minutes: number): string =>
  minutesToTime(toMinutes(time) + minutes);

export const refundBooking = async (conn: any, booking: any, note: string) => {
  if (booking.status !== "CONFIRMED") return 0;
  const [userRows]: any = await conn.query(
    "SELECT balance FROM users WHERE id = ? FOR UPDATE",
    [booking.user_id]
  );
  const before = Number(userRows[0].balance);
  const refund = Number(booking.total_price);
  const after = before + refund;

  await conn.query("UPDATE users SET balance = ? WHERE id = ?", [after, booking.user_id]);
  await conn.query(
    `INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
     VALUES (?, 'REFUND', ?, ?, ?, 'BOOKING', ?, ?)`,
    [booking.user_id, refund, before, after, booking.id, note]
  );
  return refund;
};

export const finishDueLaundry = async () => {
  const due = await query(
    `SELECT id, machine_type, washing_machine_id, drying_machine_id
     FROM bookings
     WHERE status = 'IN_PROGRESS' AND started_at IS NOT NULL
       AND TIMESTAMPADD(MINUTE, ?, started_at) <= NOW()`,
    [DURATION_MINUTES]
  );
  if (due.length === 0) return;

  await withTransaction(async (conn) => {
    for (const booking of due) {
      const { machineColumn, table } = machineInfo(booking);
      await conn.query(
        "UPDATE bookings SET status = 'COMPLETED', finished_at = NOW() WHERE id = ?",
        [booking.id]
      );
      await conn.query(`UPDATE ${table} SET status = 'AVAILABLE' WHERE id = ?`, [booking[machineColumn]]);
    }
  });
};
