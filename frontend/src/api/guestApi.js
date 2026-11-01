import { apiRequest } from './client';

export function guestCheckIn(payload) {
  return apiRequest('/attendance/guest-check-in', {
    method: 'POST',
    body: payload,
  });
}
