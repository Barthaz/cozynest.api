const addStatusHistoryEntry = async (
  connection,
  { orderId, oldStatus, newStatus, comment, changedBy }
) => {
  await connection.execute(
    `INSERT INTO order_status_history (
      order_id,
      old_status,
      new_status,
      comment,
      changed_by
    ) VALUES (?, ?, ?, ?, ?)`,
    [orderId, oldStatus, newStatus, comment, changedBy]
  );
};

module.exports = {
  addStatusHistoryEntry,
};
