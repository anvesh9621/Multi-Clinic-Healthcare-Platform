import http from 'k6/http';
import crypto from 'k6/crypto';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Custom Metrics by Traffic Category ───────────────────────────────────────
const publicErrorRate = new Rate('public_error_rate');
const dashboardErrorRate = new Rate('dashboard_error_rate');
const slotsErrorRate = new Rate('slots_error_rate');

const publicSpecialtiesTrend = new Trend('public_specialties_duration');
const publicClinicsTrend = new Trend('public_clinics_duration');
const publicDoctorsTrend = new Trend('public_doctors_duration');
const publicFilteredDoctorsTrend = new Trend('public_filtered_doctors_duration');
const publicClinicDoctorsTrend = new Trend('public_clinic_doctors_duration');

const authAppointmentsTrend = new Trend('auth_appointments_duration');
const authDashboardStatsTrend = new Trend('auth_dashboard_stats_duration');

const uncachedSlotsTrend = new Trend('uncached_slots_duration');

// Configurable base URL
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

// ── Multi-Stage Concurrency Configuration ───────────────────────────────────
// Stages: 10 -> 50 -> 100 -> 200 VUs (each held 60s minimum)
export const options = {
  stages: [
    { duration: '60s', target: 10 },   // Stage 1: 10 VUs (Baseline & Warm-up)
    { duration: '60s', target: 50 },   // Stage 2: 50 VUs (Normal to Peak Traffic)
    { duration: '60s', target: 100 },  // Stage 3: 100 VUs (Heavy saturation - queue pressure)
    { duration: '60s', target: 200 },  // Stage 4: 200 VUs (Extreme saturation backpressure)
    { duration: '30s', target: 0 },    // Stage 5: Ramp-down & Cooldown
  ],
  thresholds: {
    'http_req_failed': ['rate<0.05'],  // Overall HTTP failure rate under 5% across peak saturation
    'public_error_rate': ['rate<0.01'],
    'dashboard_error_rate': ['rate<0.05'],
    'slots_error_rate': ['rate<0.05'],
  },
};

// ── TOTP & Auth Helpers ──────────────────────────────────────────────────────
function base32tohex(base32) {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  let hex = '';
  for (let i = 0; i < base32.length; i++) {
    const val = base32chars.indexOf(base32.charAt(i).toUpperCase());
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    const chunk = bits.substr(i, 4);
    hex += parseInt(chunk, 2).toString(16);
  }
  return hex;
}

function hexToArrayBuffer(hexString) {
  const bytes = new Uint8Array(Math.ceil(hexString.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes.buffer;
}

function generateTOTP(secret) {
  const epoch = Math.round(new Date().getTime() / 1000.0);
  const timeHex = Math.floor(epoch / 30).toString(16).padStart(16, '0');
  const keyBuf = hexToArrayBuffer(base32tohex(secret));
  const timeBuf = hexToArrayBuffer(timeHex);
  const hmacHex = crypto.hmac('sha1', keyBuf, timeBuf, 'hex');
  const offset = parseInt(hmacHex.slice(-1), 16);
  const otp = (parseInt(hmacHex.substr(offset * 2, 8), 16) & 0x7fffffff) % 1000000;
  return otp.toString().padStart(6, '0');
}

// ── Pre-test Setup: Obtain JWT token for clinic admin ─────────────────────────
export function setup() {
  const mfaSecret = 'JBSWY3DPEHPK3PXP';
  const email = 'admin.clinic1@mediclinic.example.com';
  const password = 'password123';

  let token = null;

  const resLogin = http.post(
    `${BASE_URL}/api/token/`,
    JSON.stringify({ email: email, password: password }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (resLogin.status === 200) {
    const body = JSON.parse(resLogin.body);
    if (body.access) {
      token = body.access;
    } else if (body.pending_token) {
      const code = generateTOTP(mfaSecret);
      const resVerify = http.post(
        `${BASE_URL}/api/accounts/mfa/verify/`,
        JSON.stringify({ pending_token: body.pending_token, code: code }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (resVerify.status === 200) {
        const verifyBody = JSON.parse(resVerify.body);
        token = verifyBody.access;
      }
    }
  }

  return { token: token };
}


const CLINIC_IDS = [1, 2, 3, 4];
const SPECIALTIES = ['General Medicine'];
const DOCTOR_CLINIC_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

export default function (data) {
  // Traffic Category Weighting:
  // Random distribution:
  //   0.00 - 0.50 (50%): Public Listing Reads (Cached)
  //   0.50 - 0.85 (35%): Authenticated Dashboard Reads (DB & Aggregations)
  const rand = Math.random();

  if (rand < 0.50) {
    // ══════════════════════════════════════════════════════════════════════════
    // CATEGORY 1: Public Listings (~50% weight)
    // ══════════════════════════════════════════════════════════════════════════
    group('01_Public_Listings', function () {
      // 1. Specialties
      const resSpecialties = http.get(`${BASE_URL}/api/public/specialties/`, {
        tags: { endpoint: 'public_specialties' },
      });
      const specOk = check(resSpecialties, {
        'specialties status is 200': (r) => r.status === 200,
      });
      publicErrorRate.add(!specOk);
      publicSpecialtiesTrend.add(resSpecialties.timings.duration);

      sleep(0.1);

      // 2. Clinics
      const resClinics = http.get(`${BASE_URL}/api/public/clinics/`, {
        tags: { endpoint: 'public_clinics' },
      });
      const clinicsOk = check(resClinics, {
        'clinics status is 200': (r) => r.status === 200,
      });
      publicErrorRate.add(!clinicsOk);
      publicClinicsTrend.add(resClinics.timings.duration);

      sleep(0.1);

      // 3. Doctors (unfiltered)
      const resDoctors = http.get(`${BASE_URL}/api/public/doctors/`, {
        tags: { endpoint: 'public_doctors' },
      });
      const docsOk = check(resDoctors, {
        'doctors status is 200': (r) => r.status === 200,
      });
      publicErrorRate.add(!docsOk);
      publicDoctorsTrend.add(resDoctors.timings.duration);

      sleep(0.1);

      // 4. Doctors (specialty filtered)
      const randomSpec = SPECIALTIES[Math.floor(Math.random() * SPECIALTIES.length)];
      const resFiltered = http.get(
        `${BASE_URL}/api/public/doctors/?specialty=${encodeURIComponent(randomSpec)}`,
        { tags: { endpoint: 'public_filtered_doctors' } }
      );
      const filteredOk = check(resFiltered, {
        'filtered doctors status is 200': (r) => r.status === 200,
      });
      publicErrorRate.add(!filteredOk);
      publicFilteredDoctorsTrend.add(resFiltered.timings.duration);

      sleep(0.1);

      // 5. Clinic Doctors
      const randomClinicId = CLINIC_IDS[Math.floor(Math.random() * CLINIC_IDS.length)];
      const resClinicDocs = http.get(
        `${BASE_URL}/api/public/clinics/${randomClinicId}/doctors/`,
        { tags: { endpoint: 'public_clinic_doctors' } }
      );
      const clinicDocsOk = check(resClinicDocs, {
        'clinic doctors status is 200': (r) => r.status === 200,
      });
      publicErrorRate.add(!clinicDocsOk);
      publicClinicDoctorsTrend.add(resClinicDocs.timings.duration);
    });

  } else if (rand < 0.85) {
    // ══════════════════════════════════════════════════════════════════════════
    // CATEGORY 2: Authenticated Dashboard Reads (~35% weight)
    // ══════════════════════════════════════════════════════════════════════════
    group('02_Authenticated_Dashboard', function () {
      const token = (data && data.token) ? data.token : null;
      const authHeaders = token ? {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      } : null;



      if (authHeaders) {
        // 1. Appointments list
        const resAppts = http.get(`${BASE_URL}/api/appointments/`, {
          headers: authHeaders,
          tags: { endpoint: 'auth_appointments' },
        });
        const apptsOk = check(resAppts, {
          'appointments status is 200': (r) => r.status === 200,
          'appointments has count': (r) => {
            try {
              const body = JSON.parse(r.body);
              return body.count !== undefined;
            } catch {
              return false;
            }
          },
        });
        dashboardErrorRate.add(!apptsOk);
        authAppointmentsTrend.add(resAppts.timings.duration);

        sleep(0.2);

        // 2. Dashboard stats
        const resDash = http.get(`${BASE_URL}/api/analytics/dashboard/`, {
          headers: authHeaders,
          tags: { endpoint: 'auth_dashboard_stats' },
        });
        const dashOk = check(resDash, {
          'dashboard stats status is 200': (r) => r.status === 200,
          'dashboard stats has data': (r) => {
            try {
              const body = JSON.parse(r.body);
              return body.data !== undefined && body.data.total_doctors !== undefined;
            } catch {
              return false;
            }
          },
        });
        dashboardErrorRate.add(!dashOk);
        authDashboardStatsTrend.add(resDash.timings.duration);
      } else {
        dashboardErrorRate.add(1);
      }
    });

  } else {
    // ══════════════════════════════════════════════════════════════════════════
    // CATEGORY 3: Uncached Slot Availability (~15% weight)
    // ══════════════════════════════════════════════════════════════════════════
    group('03_Slot_Availability_Uncached', function () {
      const dcId = DOCTOR_CLINIC_IDS[Math.floor(Math.random() * DOCTOR_CLINIC_IDS.length)];
      // Choose date 5 days ahead
      const targetDate = '2026-08-20';

      const resSlots = http.get(
        `${BASE_URL}/api/public/doctors/${dcId}/slots/?date=${targetDate}`,
        { tags: { endpoint: 'uncached_slots' } }
      );
      const slotsOk = check(resSlots, {
        'slots status is 200': (r) => r.status === 200,
        'slots payload has slots array': (r) => {
          try {
            const body = JSON.parse(r.body);
            return Array.isArray(body.slots);
          } catch {
            return false;
          }
        },
      });
      slotsErrorRate.add(!slotsOk);
      uncachedSlotsTrend.add(resSlots.timings.duration);
    });
  }

  sleep(0.5);
}
