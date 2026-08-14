import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('custom_error_rate');
const publicClinicsTrend = new Trend('public_clinics_duration');
const publicSpecialtiesTrend = new Trend('public_specialties_duration');
const publicDoctorsTrend = new Trend('public_doctors_duration');
const filteredDoctorTrend = new Trend('filtered_doctor_duration');
const clinicDoctorTrend = new Trend('clinic_doctor_duration');

// Configurable base URL
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Stage 1: Warm-up & baseline (10 VUs)
    { duration: '1m',  target: 30 },  // Stage 2: Normal production traffic (30 VUs)
    { duration: '1m',  target: 60 },  // Stage 3: Peak concurrency stress (60 VUs)
    { duration: '30s', target: 10 },  // Stage 4: Ramp-down & cooldown (10 VUs)
  ],
  thresholds: {
    'http_req_failed': ['rate<0.01'],                               // Under 1% HTTP failures
    'http_req_duration': ['p(95)<250'],                             // Overall p95 < 250ms
    'http_req_duration{endpoint:specialties}': ['p(95)<100'],
    'http_req_duration{endpoint:clinics}': ['p(95)<100'],
    'http_req_duration{endpoint:doctors}': ['p(95)<150'],
    'http_req_duration{endpoint:filtered_doctors}': ['p(95)<200'],
    'http_req_duration{endpoint:clinic_doctors}': ['p(95)<150'],
    'custom_error_rate': ['rate<0.01'],                             // Under 1% custom errors
  },
};

const CLINIC_IDS = [1, 2, 3, 4];
const SPECIALTIES = ['General Medicine'];

export default function () {
  // Scenario 1: Public Landing Page & Discovery (Homepage Browse)
  group('01_Public_Discovery', function () {
    // 1. Get specialties
    const resSpecialties = http.get(`${BASE_URL}/api/public/specialties/`, {
      tags: { endpoint: 'specialties' },
    });
    const specialtiesOk = check(resSpecialties, {
      'specialties status is 200': (r) => r.status === 200,
      'specialties has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body) && body.length > 0;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!specialtiesOk);
    publicSpecialtiesTrend.add(resSpecialties.timings.duration);

    sleep(0.3);

    // 2. Get public clinics
    const resClinics = http.get(`${BASE_URL}/api/public/clinics/`, {
      tags: { endpoint: 'clinics' },
    });
    const clinicsOk = check(resClinics, {
      'clinics status is 200': (r) => r.status === 200,
      'clinics has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body) && body.length > 0;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!clinicsOk);
    publicClinicsTrend.add(resClinics.timings.duration);

    sleep(0.3);
  });

  // Scenario 2: Specialty Browsing & Doctor Directory
  group('02_Doctor_Directory', function () {
    // 1. Unfiltered doctors
    const resDoctors = http.get(`${BASE_URL}/api/public/doctors/`, {
      tags: { endpoint: 'doctors' },
    });
    const doctorsOk = check(resDoctors, {
      'doctors status is 200': (r) => r.status === 200,
      'doctors has results': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.count !== undefined && body.count > 0;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!doctorsOk);
    publicDoctorsTrend.add(resDoctors.timings.duration);

    sleep(0.4);

    // 2. Specialty-filtered doctors
    const randomSpec = SPECIALTIES[Math.floor(Math.random() * SPECIALTIES.length)];
    const resFiltered = http.get(`${BASE_URL}/api/public/doctors/?specialty=${encodeURIComponent(randomSpec)}`, {
      tags: { endpoint: 'filtered_doctors' },
    });
    const filteredOk = check(resFiltered, {
      'filtered doctors status is 200': (r) => r.status === 200,
      'filtered doctors has results': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.count !== undefined && body.count > 0;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!filteredOk);
    filteredDoctorTrend.add(resFiltered.timings.duration);

    sleep(0.4);
  });

  // Scenario 3: Clinic Detail & Doctor Clinic Lookup
  group('03_Clinic_Doctor_Lookup', function () {
    const randomClinicId = CLINIC_IDS[Math.floor(Math.random() * CLINIC_IDS.length)];
    const resClinicDocs = http.get(`${BASE_URL}/api/public/clinics/${randomClinicId}/doctors/`, {
      tags: { endpoint: 'clinic_doctors' },
    });
    const clinicDocsOk = check(resClinicDocs, {
      'clinic doctors status is 200': (r) => r.status === 200,
      'clinic doctors has clinic info': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.clinic_name !== undefined || body.clinic_id !== undefined;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!clinicDocsOk);
    clinicDoctorTrend.add(resClinicDocs.timings.duration);

    sleep(0.6);
  });
}
