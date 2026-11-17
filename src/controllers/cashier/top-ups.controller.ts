import { Response } from "express";
import { query, queryOne, withTransaction } from "../../config/database";
import { success, fail } from "../../utils/response";
import { AuthRequest } from "../../middlewares/auth.middleware";

export const listPendingTopUps = async (_req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT t.id, t.user_id, u.full_name, u.email, t.reference, t.amount,
            t.status, t.proof_url, t.created_at
     FROM top_ups t JOIN users u ON u.id = t.user_id
     WHERE t.status = 'WAITING_CONFIRM'
     ORDER BY t.created_at ASC`
  );
  rows.forEach((row: any) => {
    row.amount = Number(row.amount);
  });
  return success(res, rows, "Bukti top up yang menunggu verifikasi berhasil diambil");
};

export const verifyTopUp = async (req: AuthRequest, res: Response) => {
  const action = String(req.body?.action || "").toUpperCase();
  const note = (req.body?.note as string) || null;
  if (!["ACCEPT", "REJECT"].includes(action)) {
    return fail(res, "action wajib 'ACCEPT' atau 'REJECT'", 400);
  }
  if (action === "REJECT" && !note) {
    return fail(res, "Catatan wajib diisi saat menolak bukti", 400);
  }

  const topup: any = await queryOne("SELECT * FROM top_ups WHERE id = ?", [req.params.id]);
  if (!topup) return fail(res, "Top up tidak ditemukan", 404);
  if (topup.status === "PAID") return fail(res, "Top up ini sudah disetujui sebelumnya", 400);
  if (topup.status !== "WAITING_CONFIRM") {
    return fail(res, "Top up belum mengirim bukti pembayaran", 400);
  }

  if (action === "REJECT") {
    await query("UPDATE top_ups SET status = 'REJECTED', admin_note = ? WHERE id = ?", [note, topup.id]);
    return success(res, { top_up_id: topup.id, status: "REJECTED" }, "Bukti ditolak, user bisa upload ulang");
  }

  await withTransaction(async (conn) => {
    const [locked]: any = await conn.query("SELECT status FROM top_ups WHERE id = ? FOR UPDATE", [topup.id]);
    if (locked[0].status === "PAID") return;

    const [userRow]: any = await conn.query("SELECT balance FROM users WHERE id = ? FOR UPDATE", [
      topup.user_id,
    ]);
    const before = Number(userRow[0].balance);
    const after = before + Number(topup.amount);

    await conn.query(
      "UPDATE top_ups SET status = 'PAID', paid_at = NOW(), admin_note = COALESCE(?, admin_note) WHERE id = ?",
      [note, topup.id]
    );
    await conn.query("UPDATE users SET balance = ? WHERE id = ?", [after, topup.user_id]);
    await conn.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description)
       VALUES (?, 'TOPUP', ?, ?, ?, 'TOPUP', ?, ?)`,
      [
        topup.user_id,
        topup.amount,
        before,
        after,
        topup.id,
        `Top up saldo via QRIS (${topup.reference}) - diverifikasi kasir`,
      ]
    );
  });

  return success(res, { top_up_id: topup.id, status: "PAID" }, "Pembayaran disetujui, saldo user bertambah");
};
