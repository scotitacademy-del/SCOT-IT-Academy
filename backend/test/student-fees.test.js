const { test } = require('node:test');
const assert = require('node:assert/strict');
const { studentFees } = require('../src/student-fees');

test('partial payment updates keep the agreed total and recalculate the balance', () => {
  assert.deepEqual(studentFees({ paidFee: 400 }, { total_fee: '1000', paid_fee: '100', balance_fee: '900' }), {
    total: 1000, paid: 400, balance: 600, staffPayout: 0, netProfit: 400,
  });
});
test('ignore a stale client balance and use currency precision', () => {
  assert.deepEqual(studentFees({ totalFee: 10.1, paidFee: 0.2, balanceFee: 100 }), {
    total: 10.1, paid: 0.2, balance: 9.9, staffPayout: 0, netProfit: 0.2,
  });
});
test('reject invalid or overpaid amounts', () => {
  for (const body of [{ totalFee: -1 }, { totalFee: 'invalid' }, { totalFee: 10, paidFee: 11 }, { totalFee: Infinity }, { staffPayout: -1 }, { staffPayout: 'invalid' }]) {
    assert.throws(() => studentFees(body), error => error.status === 400);
  }
});
test('legacy paid and balance inputs still create a total', () => {
  assert.deepEqual(studentFees({ paid_fee: '40', balance_fee: '60' }), {
    total: 100, paid: 40, balance: 60, staffPayout: 0, netProfit: 40,
  });
});
test('net profit is paid fee minus staff payout, including partial edits', () => {
  assert.deepEqual(
    studentFees({ staff_payout: '125.55' }, { paid_fee: '400.75', total_fee: '1000', staff_payout: '50' }),
    { total: 1000, paid: 400.75, balance: 599.25, staffPayout: 125.55, netProfit: 275.2 }
  );
});
