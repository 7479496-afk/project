const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getQrWindowStatus } = require('./qrWindow');

describe('getQrWindowStatus', () => {
  it('allows check-in during the lesson window', () => {
    const now = new Date('2026-11-02T10:00:00');
    const status = getQrWindowStatus(
      '2026-11-02',
      '09:00:00',
      '10:20:00',
      now
    );

    assert.equal(status.ok, true);
    assert.equal(status.reason, 'active');
  });

  it('rejects check-in before the lesson starts', () => {
    const now = new Date('2026-11-02T08:59:59');
    const status = getQrWindowStatus(
      '2026-11-02',
      '09:00:00',
      '10:20:00',
      now
    );

    assert.equal(status.ok, false);
    assert.equal(status.reason, 'before');
  });

  it('rejects check-in after the lesson ends', () => {
    const now = new Date('2026-11-02T10:20:01');
    const status = getQrWindowStatus(
      '2026-11-02',
      '09:00:00',
      '10:20:00',
      now
    );

    assert.equal(status.ok, false);
    assert.equal(status.reason, 'after');
  });
});
