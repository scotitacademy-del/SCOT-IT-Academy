function studentFees(body, current = {}) {
  const parse = value => {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 99999999.99) {
      const error = new Error("Fees must be valid non-negative amounts.");
      error.status = 400;
      throw error;
    }
    return Math.round(number * 100);
  };
  const paid = parse(body.paidFee ?? body.paid_fee ?? current.paid_fee ?? 0);
  const staffPayout = parse(body.staffPayout ?? body.staff_payout ?? current.staff_payout ?? 0);
  const rawTotal = body.totalFee ?? body.total_fee ?? current.total_fee;
  const total = rawTotal !== undefined ? parse(rawTotal) : paid + parse(body.balanceFee ?? body.balance_fee ?? 0);
  if (paid > total) {
    const error = new Error("Paid fee cannot exceed total fee.");
    error.status = 400;
    throw error;
  }
  return {
    paid: paid / 100,
    total: total / 100,
    balance: (total - paid) / 100,
    staffPayout: staffPayout / 100,
    netProfit: (paid - staffPayout) / 100,
  };
}
module.exports = { studentFees };
