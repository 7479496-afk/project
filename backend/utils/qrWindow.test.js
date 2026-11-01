const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getQrWindowStatus } = require('./qrWindow');

describe('getQrWindowStatus', () => {
  it('allows check-in during the lesson window', () => {
    const status = getQrWindowStatus('2026-11-02', '09:00:00', '10:20:00', {
      now: new Date('2026-11-02T10:00:00.000Z'),
      timeZone: 'UTC',
    });

    assert.equal(status.ok, true);
    assert.equal(status.reason, 'active');
  });

  it('rejects check-in before the lesson starts', () => {
    const status = getQrWindowStatus('2026-11-02', '09:00:00', '10:20:00', {
      now: new Date('2026-11-02T08:59:59.000Z'),
      timeZone: 'UTC',
    });

    assert.equal(status.ok, false);
    assert.equal(status.reason, 'before');
  });

  it('rejects check-in after the lesson ends', () => {
    const status = getQrWindowStatus('2026-11-02', '09:00:00', '10:20:00', {
      now: new Date('2026-11-02T10:20:01.000Z'),
      timeZone: 'UTC',
    });

    assert.equal(status.ok, false);
    assert.equal(status.reason, 'after');
  });

  it('uses Europe/Kyiv wall clock against UTC server time', () => {
    // 07:30 UTC = 09:30 in Kyiv (UTC+2 in November)
    const status = getQrWindowStatus('2026-11-02', '09:00:00', '10:20:00', {
      now: new Date('2026-11-02T07:30:00.000Z'),
      timeZone: 'Europe/Kyiv',
    });

    assert.equal(status.ok, true);
    assert.equal(status.reason, 'active');
  });
});
