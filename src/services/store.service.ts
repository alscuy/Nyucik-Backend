import { pool, queryOne } from "../config/database";

export const getStoreStatus = async () => {
  const setting = await queryOne(
    "SELECT is_open FROM store_settings WHERE id = 1"
  );
  const staff = await queryOne(
    "SELECT COUNT(*) AS total FROM employees WHERE is_ready = 1"
  );

  const manualOpen = setting ? Boolean(Number(setting.is_open)) : true;
  const hasStaff = Number(staff?.total || 0) > 0;
  const isOpen = manualOpen && hasStaff;

  return {
    is_open: isOpen,
    manual_open: manualOpen,
    has_staff: hasStaff,
    reason: !hasStaff
      ? "Tidak ada petugas siap"
      : !manualOpen
        ? "Toko ditutup admin"
        : null,
  };
};

export const setStoreOpen = async (open: boolean) => {
  await pool.query(
    `INSERT INTO store_settings (id, is_open) VALUES (1, ?)
     ON DUPLICATE KEY UPDATE is_open = VALUES(is_open)`,
    [open ? 1 : 0]
  );
  return getStoreStatus();
};

export const storeIsOpen = async (): Promise<boolean> =>
  (await getStoreStatus()).is_open;
