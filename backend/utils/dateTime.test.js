const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { formatInTimeZone } = require('./dateTime');

describe('formatInTimeZone', () => {
  it('converts UTC MySQL datetime to Europe/Kyiv', () => {
    const formatted = formatInTimeZone(
      '2026-11-04 16:40:57',
      'Europe/Kyiv'
    );

    assert.equal(formatted, '2026-11-04 18:40:57');
  });
});
