import fs from 'fs';
import { execFileSync } from 'child_process';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
fs.mkdirSync('scratch/benchmark', { recursive: true });

// 1. Generate 36 realistic practical records
const mockPracticalRecords = Array.from({ length: 36 }, (_, i) => {
  const day = String((i % 28) + 1).padStart(2, '0');
  const grades = ['Grade 11 - Sci A', 'Grade 11 - Sci B', 'Grade 12 - Sci A', 'Grade 12 - Sci B'];
  const subjects = [
    { code: 'PHY-101', name: 'Physics Laboratory', title: 'Measurement with Vernier Caliper & Screw Gauge', topic: 'Error Analysis & Least Count' },
    { code: 'CHEM-201', name: 'Chemistry Laboratory', title: 'Titration of 0.1M HCl against Na2CO3', topic: 'Volumetric Analysis & Neutralization' },
    { code: 'BIO-101', name: 'Biology Laboratory', title: 'Microscopic examination of plant mitosis (Onion root)', topic: 'Cell Division & Prophase Stages' },
    { code: 'COMP-101', name: 'Computer Lab 01', title: 'Implementation of Binary Search in C++', topic: 'Divide and Conquer Algorithms' }
  ];
  const sub = subjects[i % subjects.length];
  const isSkipped = i % 9 === 0;
  const total = 40;
  const present = isSkipped ? 0 : 34 + (i % 6);
  
  return {
    id: `log-${i + 1}`,
    date: `2026-03-${day}`,
    period_label: `Period ${(i % 6) + 1} (${8 + (i % 4)}:00 - ${9 + (i % 4)}:30)`,
    batch_group: grades[i % grades.length],
    subject_name: sub.name,
    practical_title: sub.title,
    topic_learned: isSkipped ? null : sub.topic,
    profiles: { full_name: ['Er. Anish Karki', 'Prof. B. Sharma', 'Dr. S. Thapa', 'P. Adhikari'][i % 4] },
    total_students: total,
    present_students: present,
    status: isSkipped ? 'skipped' : 'completed',
    skip_reason: isSkipped ? 'National holiday / campus sports meet' : null,
    remarks: isSkipped ? null : 'All students completed experiment logbook entry with teacher counter-sign.'
  };
});

// 2. Generate 35 realistic incident records
const mockIncidents = Array.from({ length: 35 }, (_, i) => {
  const day = String((i % 28) + 1).padStart(2, '0');
  const items = [
    { eq: 'Digital Multimeter (Sanwa CD800a)', qty: 1, title: 'Blown 500mA ceramic fuse during high voltage probe test', sev: 'minor' },
    { eq: 'Borosil 250mL Conical Flask', qty: 2, title: 'Hairline stress fracture on neck during heat bath', sev: 'minor' },
    { eq: 'Monocular Compound Microscope', qty: 1, title: 'Fine focus rack-and-pinion slipping on 40x objective', sev: 'moderate' },
    { eq: 'PC Workstation #14 (Lab 01)', qty: 1, title: 'SMPS capacitor failure with audible pop on power surge', sev: 'major_critical' },
    { eq: 'Spectrophotometer Glass Cuvette', qty: 1, title: 'Dropped on stone sink ledge during sample washing', sev: 'minor' }
  ];
  const it = items[i % items.length];
  const resolved = i % 3 !== 0;
  return {
    id: 100 + i,
    date: `2026-03-${day}`,
    lab_id: ['comp', 'phys', 'chem', 'bio'][i % 4],
    labs: { name: ['Computer Engineering Lab 01', 'Physics Laboratory', 'Chemistry Laboratory', 'Biology Laboratory'][i % 4] },
    equipment_name: it.eq,
    quantity: it.qty,
    title: it.title,
    student_rolls: `Roll 110${10 + (i % 20)}, 110${11 + (i % 20)}`,
    severity: it.sev,
    subject_teacher_name: ['Er. Anish Karki', 'P. Adhikari', 'Dr. S. Thapa', 'Prof. B. Sharma'][i % 4],
    batch_name: `Grade ${11 + (i % 2)} Sci ${i % 2 === 0 ? 'A' : 'B'}`,
    status: resolved ? 'resolved' : 'investigating',
    escalated_to_hod: it.sev === 'major_critical',
    resolution_notes: resolved ? 'Replaced with spare unit from institutional inventory pool.' : null,
    resolved_by: resolved ? 'Er. Lab In-Charge' : null
  };
});

// 3. Generate 35 realistic maintenance logs
const mockMaintenanceLogs = Array.from({ length: 35 }, (_, i) => {
  const day = String((i % 28) + 1).padStart(2, '0');
  const routines = [
    { asset: `PC-LAB01-${String(i + 1).padStart(2, '0')}`, plan: 'Deep PC Cleaning & Thermal Paste Servicing', work: 'Heatsink dust purge, Arctic MX-4 paste reapplied, CPU idle temp dropped to 38°C.', steps: 5 },
    { asset: `LAB01-SWITCH-01`, plan: 'Network Cabinet & Patch Panel Inspection', work: 'Port 14-24 cable re-dressing, firmware upgraded to v2.14, latency tested nominal.', steps: 4 },
    { asset: `PC-LAB01-${String(i + 2).padStart(2, '0')}`, plan: 'BIOS Firmware & Ubuntu Kernel Security Patch', work: 'SecureBoot updated, UEFI v1.21 flashed, unattended-upgrades verified active.', steps: 6 },
    { asset: `PHYS-SPECTRO-01`, plan: 'Optical Alignment & Lamp Calibration', work: 'Halogen lamp alignment checked, wavelength absorption standard calibrated with holmium oxide.', steps: 4 }
  ];
  const r = routines[i % routines.length];
  return {
    id: `maint-${i + 1}`,
    service_date: `2026-03-${day}`,
    lab_id: ['comp', 'phys', 'chem', 'elec'][i % 4],
    lab_name: ['Computer Lab 01', 'Physics Lab', 'Chemistry Lab', 'Electronics Lab'][i % 4],
    asset_identifier: r.asset,
    parts_replaced: i % 4 === 0 ? 'Arctic MX-4 Thermal Compound' : null,
    plan_title: r.plan,
    work_performed: r.work,
    checklist_completed: Array.from({ length: r.steps }, (_, s) => `Step ${s + 1}`),
    performed_by_name: ['S. Shrestha (Lab Tech)', 'Er. Anish Karki (In-Charge)', 'B. Poudel (IT Support)'][i % 3],
    next_service_due: `2026-06-${day}`
  };
});

// Helper to count pages and calculate rows per page
function analyzePdf(pdfPath, totalRows, label) {
  const pdf = fs.readFileSync(pdfPath, 'utf8');
  const mediaBoxes = [...pdf.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
  const pageCount = mediaBoxes.length;
  const isLandscape = mediaBoxes.length > 0 && (parseFloat(mediaBoxes[0][3]) - parseFloat(mediaBoxes[0][1])) > (parseFloat(mediaBoxes[0][4]) - parseFloat(mediaBoxes[0][2]));
  const rowsPerPage = (totalRows / pageCount).toFixed(1);
  console.log(`[${label}] Total Rows: ${totalRows} | Total Pages: ${pageCount} | Rows/Page: ${rowsPerPage} | Orientation: ${isLandscape ? 'A4 LANDSCAPE' : 'PORTRAIT'}`);
  return { pageCount, rowsPerPage, isLandscape };
}

// Generate HTML with BEFORE styling
function generateBeforeHtml(type) {
  if (type === 'records') {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  /* BEFORE STYLES (Existing PrintLayout + Page) */
  @page { size: A4 landscape; margin: 8mm 10mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; background: white; color: black; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  th { padding: 4px 6px; border: 1px solid #d1d5db; background: #f3f4f6; text-transform: uppercase; font-family: monospace; font-size: 9px; font-weight: bold; }
  td { padding: 4px 6px; border: 1px solid #d1d5db; line-height: 1.25; vertical-align: top; }
  .header-box { border-bottom: 2px solid #18181b; padding-bottom: 8px; margin-bottom: 8px; }
  .sig-box { display: grid; grid-template-columns: 1fr 1fr; margin-top: 16px; padding-top: 8px; text-align: center; }
  .sig-line { border-top: 2px solid #18181b; width: 180px; margin: 0 auto; padding-top: 4px; font-weight: bold; font-size: 10px; }
</style>
</head>
<body>
  <div class="header-box">
    <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #52525b;">NEPAL SECONDARY EDUCATION BOARD • CENTRAL CAMPUS</div>
    <div style="font-size: 14px; font-weight: 900; text-transform: uppercase;">SHREE RATNA RAJYA LAXMI SECONDARY SCHOOL</div>
    <div style="font-size: 9px; color: #52525b;">OFFICIAL PRACTICAL EXPERIMENT & ATTENDANCE AUDIT REGISTER (36 SESSIONS)</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 70px;">Date</th>
        <th style="width: 90px;">Slot</th>
        <th style="width: 80px;">Class/Batch</th>
        <th>Subject & Practical Experiment</th>
        <th>Topic Learned</th>
        <th style="width: 110px;">Subject Teacher</th>
        <th style="width: 60px; text-align: center;">Attendance</th>
        <th style="width: 50px; text-align: center;">Status</th>
        <th style="width: 140px;">Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${mockPracticalRecords.map(r => `
        <tr>
          <td style="font-family: monospace;">${r.date}</td>
          <td style="font-family: monospace; font-size: 8.5px;">${r.period_label}</td>
          <td><strong>${r.batch_group}</strong></td>
          <td><strong>${r.subject_name}</strong><br><span style="color: #4b5563; font-size: 8.5px;">${r.practical_title}</span></td>
          <td style="font-size: 8.5px; font-style: italic;">${r.topic_learned || '—'}</td>
          <td>${r.profiles.full_name}</td>
          <td style="text-align: center; font-family: monospace;"><strong>${r.present_students}</strong>/${r.total_students}</td>
          <td style="text-align: center;"><span style="font-weight: bold; text-transform: uppercase; font-size: 8px;">${r.status}</span></td>
          <td style="font-size: 8.5px;">${r.remarks || r.skip_reason || '—'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="sig-box">
    <div><div class="sig-line">SUBJECT TEACHER<br><span style="font-weight: normal; font-size: 8px; color: #6b7280;">Curricular Verification</span></div></div>
    <div><div class="sig-line">LAB IN-CHARGE<br><span style="font-weight: normal; font-size: 8px; color: #6b7280;">Laboratory Audit Sign-Off</span></div></div>
  </div>
</body>
</html>`;
  }

  if (type === 'incidents') {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  /* BEFORE STYLES (Existing Incident Register: 10px vertical cell padding, no print override!) */
  @page { size: A4 landscape; margin: 8mm 10mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; background: white; color: black; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { padding: 10px 12px; border: 1px solid #d1d5db; background: #f3f4f6; text-transform: uppercase; font-family: monospace; font-size: 10px; font-weight: bold; }
  td { padding: 10px 12px; border: 1px solid #d1d5db; line-height: 1.5; vertical-align: top; }
  .header-box { border-bottom: 2px solid #18181b; padding-bottom: 8px; margin-bottom: 8px; }
  .sig-box { display: grid; grid-template-columns: 1fr 1fr; margin-top: 16px; padding-top: 8px; text-align: center; }
  .sig-line { border-top: 2px solid #18181b; width: 180px; margin: 0 auto; padding-top: 4px; font-weight: bold; font-size: 10px; }
</style>
</head>
<body>
  <div class="header-box">
    <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #52525b;">INSTITUTIONAL EQUIPMENT REGISTRY</div>
    <div style="font-size: 14px; font-weight: 900; text-transform: uppercase;">OFFICIAL LABORATORY EQUIPMENT DAMAGE & SAFETY INCIDENT REGISTER</div>
    <div style="font-size: 9px; color: #52525b;">SHREE RATNA RAJYA LAXMI SECONDARY SCHOOL (35 INCIDENTS)</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 80px;">Date & Case</th>
        <th style="width: 90px;">Facility</th>
        <th>Equipment & Circumstances</th>
        <th style="width: 70px; text-align: center;">Severity</th>
        <th style="width: 100px;">Subject Teacher</th>
        <th style="width: 80px; text-align: center;">Status</th>
        <th style="width: 160px;">Resolution / Audit</th>
      </tr>
    </thead>
    <tbody>
      ${mockIncidents.map(inc => `
        <tr>
          <td style="font-family: monospace; font-size: 11px;"><strong>${inc.date}</strong><br><span style="color: #6b7280; font-size: 10px;">#${inc.id}</span></td>
          <td style="font-size: 11px;">${inc.labs.name}</td>
          <td><strong>${inc.equipment_name} (x${inc.quantity})</strong><br><span style="font-size: 11px; color: #374151;">${inc.title}</span><br><span style="font-size: 10px; color: #6b7280;">${inc.student_rolls}</span></td>
          <td style="text-align: center; text-transform: uppercase; font-family: monospace; font-size: 10px; font-weight: bold;">${inc.severity}</td>
          <td style="font-size: 11px;">${inc.subject_teacher_name}<br><span style="color: #6b7280; font-size: 10px;">${inc.batch_name}</span></td>
          <td style="text-align: center; text-transform: uppercase; font-family: monospace; font-size: 10px; font-weight: bold;">${inc.status}</td>
          <td style="font-size: 11px;">${inc.resolution_notes || 'Under inspection'}<br><span style="color: #6b7280; font-size: 10px;">${inc.resolved_by ? 'By: ' + inc.resolved_by : ''}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="sig-box">
    <div><div class="sig-line">REPORTING TEACHER</div></div>
    <div><div class="sig-line">LAB IN-CHARGE / HOD</div></div>
  </div>
</body>
</html>`;
  }

  if (type === 'maintenance') {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  /* BEFORE STYLES (Existing Maintenance Logbook: 10px vertical cell padding, no print override!) */
  @page { size: A4 landscape; margin: 8mm 10mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; background: white; color: black; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { padding: 10px 12px; border: 1px solid #d1d5db; background: #f3f4f6; text-transform: uppercase; font-size: 10px; font-weight: bold; }
  td { padding: 10px 12px; border: 1px solid #d1d5db; line-height: 1.5; vertical-align: top; font-size: 11px; }
  .header-box { border-bottom: 2px solid #18181b; padding-bottom: 8px; margin-bottom: 8px; }
  .sig-box { display: grid; grid-template-columns: 1fr 1fr 1fr; margin-top: 16px; padding-top: 8px; text-align: center; }
  .sig-line { border-top: 2px solid #18181b; width: 160px; margin: 0 auto; padding-top: 4px; font-weight: bold; font-size: 10px; }
</style>
</head>
<body>
  <div class="header-box">
    <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; color: #52525b;">TECHNICAL SERVICING LOGBOOK</div>
    <div style="font-size: 14px; font-weight: 900; text-transform: uppercase;">OFFICIAL LAB MAINTENANCE & COMPUTER SERVICING LOGBOOK</div>
    <div style="font-size: 9px; color: #52525b;">SHREE RATNA RAJYA LAXMI SECONDARY SCHOOL (35 RECORDS)</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 80px;">Date</th>
        <th style="width: 100px;">Facility</th>
        <th>Target Machine(s) / Hardware</th>
        <th>Routine & Work Completed</th>
        <th style="width: 90px;">Checklist</th>
        <th style="width: 110px;">Staff</th>
        <th style="width: 80px; text-align: center;">Next Due</th>
      </tr>
    </thead>
    <tbody>
      ${mockMaintenanceLogs.map(l => `
        <tr>
          <td style="font-weight: 500;">${l.service_date}</td>
          <td style="font-size: 10px; font-weight: bold; text-transform: uppercase;">${l.lab_name}</td>
          <td><strong>${l.asset_identifier}</strong><br><span style="color: #4b5563; font-size: 10px;">${l.parts_replaced ? 'Parts: ' + l.parts_replaced : ''}</span></td>
          <td><strong>${l.plan_title}</strong><br><span style="color: #4b5563; font-size: 10px;">${l.work_performed}</span></td>
          <td style="font-size: 10px; color: #047857; font-weight: bold;">✓ ${l.checklist_completed.length} Steps Verified</td>
          <td>${l.performed_by_name}</td>
          <td style="text-align: center; font-size: 10px;">${l.next_service_due}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="sig-box">
    <div><div class="sig-line">LAB IN-CHARGE<br><span style="font-weight: normal; font-size: 8px;">Technical Verification</span></div></div>
    <div><div class="sig-line">ACADEMIC COORDINATOR<br><span style="font-weight: normal; font-size: 8px;">Oversight Audit</span></div></div>
    <div><div class="sig-line">CAMPUS CHIEF<br><span style="font-weight: normal; font-size: 8px;">Certification</span></div></div>
  </div>
</body>
</html>`;
  }
}

// Generate BEFORE PDFs
const beforeRecordsHtml = generateBeforeHtml('records');
fs.writeFileSync('scratch/benchmark/records_before.html', beforeRecordsHtml);
execFileSync(chrome, ['--headless', '--disable-gpu', '--print-to-pdf=D:\\Projects\\LMR\\scratch\\benchmark\\records_before.pdf', 'D:\\Projects\\LMR\\scratch\\benchmark\\records_before.html']);
analyzePdf('D:\\Projects\\LMR\\scratch\\benchmark\\records_before.pdf', 36, 'RECORDS BEFORE');

const beforeIncidentsHtml = generateBeforeHtml('incidents');
fs.writeFileSync('scratch/benchmark/incidents_before.html', beforeIncidentsHtml);
execFileSync(chrome, ['--headless', '--disable-gpu', '--print-to-pdf=D:\\Projects\\LMR\\scratch\\benchmark\\incidents_before.pdf', 'D:\\Projects\\LMR\\scratch\\benchmark\\incidents_before.html']);
analyzePdf('D:\\Projects\\LMR\\scratch\\benchmark\\incidents_before.pdf', 35, 'INCIDENTS BEFORE');

const beforeMaintHtml = generateBeforeHtml('maintenance');
fs.writeFileSync('scratch/benchmark/maintenance_before.html', beforeMaintHtml);
execFileSync(chrome, ['--headless', '--disable-gpu', '--print-to-pdf=D:\\Projects\\LMR\\scratch\\benchmark\\maintenance_before.pdf', 'D:\\Projects\\LMR\\scratch\\benchmark\\maintenance_before.html']);
analyzePdf('D:\\Projects\\LMR\\scratch\\benchmark\\maintenance_before.pdf', 35, 'MAINTENANCE BEFORE');
