export async function transitionTransfer(conn, { transferId, actorId, actorRole, fromStatus, toStatus, notes }) {
  await conn.execute(
    "UPDATE transfers SET status = ? WHERE transfer_id = ? AND status = ?",
    [toStatus, transferId, fromStatus]
  );
  const [result] = await conn.execute(
    "SELECT ROW_COUNT() as affected"
  );
  if (!result[0].affected) throw new Error("Concurrent status change — retry");

  await conn.execute(
    `INSERT INTO transfer_events (transfer_id, actor_id, actor_role, from_status, to_status, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [transferId, actorId, actorRole, fromStatus, toStatus, notes || null]
  );
}