/* ข้อมูลจำลองสำหรับจับภาพหน้าจอประกอบเอกสารส่งมอบ — ชื่อ/เลข/เรื่อง ทั้งหมดเป็นข้อมูลสมมติ ไม่ใช่ข้อมูลจริง
   โครงสร้างแถวเลียนแบบตารางจริงใน Supabase (ดู schema.json) เพราะ UI จริงจะ query ผ่าน dg() ที่ถูกจำลองใน capture.mjs */

const T = (d, h = 9, m = 0) => new Date(Date.UTC(2026, d[0] - 1, d[1], h - 7, m)).toISOString(); // เวลาไทย → ISO
const D = (m, d) => `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export const users = [
  { id: 'u01', full_name: 'นายภาคิน วงศ์สุวรรณ',        email: 'pakin.w@student.chula.ac.th',   student_id: '6612345627', position_code: 'GNK-PRE', role_code: 'ROLE-SGN', user_type: 'gnk',     department: 'คณะกรรมการนิสิต' },
  { id: 'u02', full_name: 'นางสาวณิชา พงษ์พิพัฒน์',     email: 'nicha.p@student.chula.ac.th',   student_id: '6612345727', position_code: 'GNK-SEC', role_code: 'ROLE-CRT', user_type: 'gnk',     department: 'คณะกรรมการนิสิต' },
  { id: 'u03', full_name: 'นายธนกร ศรีสมบูรณ์',         email: 'thanakorn.s@student.chula.ac.th', student_id: '6612345827', position_code: 'GNK-TRS', role_code: 'ROLE-SGN', user_type: 'gnk', department: 'คณะกรรมการนิสิต' },
  { id: 'u04', full_name: 'นางสาวปาลิดา จันทร์เพ็ญ',    email: 'palida.j@student.chula.ac.th',  student_id: '6612345927', position_code: 'GNK-ACA', role_code: 'ROLE-REV', user_type: 'gnk',     department: 'ฝ่ายวิชาการ', signature_path: 'u04/signature.png' },
  { id: 'u05', full_name: 'นายกิตติภพ แสงทอง',          email: 'kittiphop.s@student.chula.ac.th', student_id: '6612346027', position_code: 'GNK-SPT', role_code: 'ROLE-CRT', user_type: 'gnk', department: 'ฝ่ายกีฬา', signature_path: 'u05/signature.png' },
  { id: 'u06', full_name: 'ผศ.ดร.สุภาวดี รัตนโกศล',     email: 'supawadee.r@chula.ac.th',       student_id: null,         position_code: null,      role_code: 'ROLE-ADV', user_type: 'advisor', department: 'อาจารย์ที่ปรึกษาชมรมวอลเลย์บอล', signature_path: 'u06/signature.png' },
  { id: 'u07', full_name: 'นางสาวอรทัย บุญมี',          email: 'orathai.b@chula.ac.th',         student_id: null,         position_code: null,      role_code: 'ROLE-STF', user_type: 'staff',   department: 'ฝ่ายกิจการนิสิต', signature_path: 'u07/signature.png' },
  { id: 'u08', full_name: 'นายวรวุฒิ ใจดี',             email: 'worawut.j@chula.ac.th',         student_id: null,         position_code: null,      role_code: 'ROLE-SYS', user_type: 'staff',   department: 'ฝ่ายกิจการนิสิต' },
  { id: 'u09', full_name: 'นายชยพล มั่นคง',             email: 'chayapol.m@student.chula.ac.th', student_id: '6612346127', position_code: 'GNK-CPR', role_code: 'ROLE-CRT', user_type: 'gnk', department: 'ประธานชมรม — ชมรมวอลเลย์บอล' },
  { id: 'u10', full_name: 'นางสาวพิมพ์ชนก อารีย์',      email: 'pimchanok.a@student.chula.ac.th', student_id: '6612346227', position_code: 'GNK-STR', role_code: 'ROLE-CRT', user_type: 'gnk', department: 'ฝ่ายนิสิตสัมพันธ์' },
  { id: 'u11', full_name: 'นายศุภกร ทองดี',             email: 'supakorn.t@student.chula.ac.th', student_id: '6712346327', position_code: 'GNK-YR2', role_code: 'ROLE-CRT', user_type: 'gnk', department: 'หัวหน้านิสิตชั้นปีที่ 2', approval_status: 'pending' },
  { id: 'u12', full_name: 'นางสาวกมลวรรณ เพชรรัตน์',   email: 'kamonwan.p@chula.ac.th',        student_id: null,         position_code: null,      role_code: 'ROLE-DEV', user_type: 'staff',   department: 'ผู้พัฒนาระบบ' },
].map((u, i) => Object.assign({
  contact_email: u.email, is_active: true, approval_status: 'approved', created_at: T([5, 20 + (i % 8)]),
  approved_at: T([5, 21]), expires_at: u.user_type === 'gnk' ? '2027-05-20T00:00:00+07:00' : null,
  auth_uid: 'auth-' + u.id, signature_path: null, line_user_id: (i === 0 || i === 3) ? 'Uxxxxxxxxxxxxxxxx' : null,
}, u));

export const CU_BY_ROLE = Object.fromEntries(users.map(u => [u.id, u]));

/* ─── เอกสาร ─── */
export const documents = [
  { id: 'd01', doc_type: 'outgoing', status: 'pending', title: 'ขออนุมัติโครงการกีฬาสานสัมพันธ์ครุศาสตร์ ประจำปีการศึกษา 2569',
    description: 'ขออนุมัติโครงการ ไม่เกิน 1 แสนบาท', subject_line: 'ขออนุมัติจัดโครงการและงบประมาณ 85,000 บาท', project_name: 'โครงการกีฬาสานสัมพันธ์ครุศาสตร์',
    addressed_to: 'ฝ่ายกีฬา', from_department: null, doc_number: 'GNK-2569-071', urgency: 'normal', created_by: 'u05',
    doc_date: D(9, 8), due_date: D(10, 6), current_step: 3, total_steps: 7, created_at: T([9, 8], 10, 12), updated_at: T([9, 11], 14, 30) },
  { id: 'd02', doc_type: 'outgoing', status: 'pending', title: 'ขอความอนุเคราะห์ใช้ห้องประชุมอาคาร 6 สำหรับกิจกรรมรับน้องฝ่ายนิสิตสัมพันธ์',
    description: 'ขอความอนุเคราะห์ใช้ห้องภายในอาคาร 6', subject_line: 'ขอใช้ห้อง 601 วันที่ 3 ต.ค. 2569', project_name: 'กิจกรรมรับน้อง 2569',
    addressed_to: 'ฝ่ายนิสิตสัมพันธ์', doc_number: 'GNK-2569-072', urgency: 'urgent', created_by: 'u10',
    doc_date: D(9, 10), due_date: D(9, 18), current_step: 2, total_steps: 4, created_at: T([9, 10], 9, 5), updated_at: T([9, 10], 9, 6) },
  { id: 'd03', doc_type: 'outgoing', status: 'numbering', title: 'ขออนุมัติปรับงบประมาณโครงการค่ายอาสาพัฒนาชนบท ครั้งที่ 12',
    description: 'ขออนุมัติปรับงบ', subject_line: 'ปรับงบค่าเดินทางเพิ่ม 12,000 บาท', project_name: 'โครงการค่ายอาสาพัฒนาชนบท',
    addressed_to: 'ฝ่ายพัฒนาสังคมและบำเพ็ญประโยชน์', doc_number: 'GNK-2569-066', urgency: 'normal', created_by: 'u05',
    doc_date: D(8, 25), due_date: D(9, 30), current_step: 7, total_steps: 7, created_at: T([8, 25], 11, 0), updated_at: T([9, 9], 16, 20) },
  { id: 'd04', doc_type: 'outgoing', status: 'awaiting_submit', title: 'ขอความอนุเคราะห์ประชาสัมพันธ์กิจกรรม Open House คณะครุศาสตร์ 2569',
    description: 'ขอความอนุเคราะห์ประชาสัมพันธ์ ภายในคณะ', subject_line: 'ขอติดโปสเตอร์และประกาศบนจอ LED', project_name: 'Open House 2569',
    addressed_to: 'ฝ่ายนิสิตสัมพันธ์', doc_number: 'กนค. 1072011/2569', urgency: 'normal', created_by: 'u10',
    doc_date: D(8, 18), due_date: D(9, 25), current_step: 4, total_steps: 4, forwarded_to_staff: true, forwarded_at: T([9, 2], 10, 0), accepted_by: 'u07', accepted_at: T([9, 3], 9, 15),
    created_at: T([8, 18], 13, 40), updated_at: T([9, 3], 9, 15) },
  { id: 'd05', doc_type: 'incoming', status: 'completed', title: 'หนังสือเชิญเข้าร่วมประชุมสภานิสิต ครั้งที่ 3/2569',
    description: null, project_name: 'ประชุมสภานิสิต', from_department: null, addressed_to: 'หัวหน้านิสิต',
    doc_number: 'กนค. 2047003/2569', received_number: '3544', received_date: D(9, 1), urgency: 'normal', created_by: 'u02',
    doc_date: D(9, 1), due_date: D(9, 20), current_step: 1, total_steps: 1, created_at: T([9, 2], 8, 50), updated_at: T([9, 2], 9, 30) },
  { id: 'd06', doc_type: 'outgoing', status: 'rejected', title: 'ขออนุมัติโครงการอบรมผู้นำนิสิต Leadership Camp',
    description: 'ขออนุมัติโครงการ เกิน 1 แสนบาท', subject_line: 'ขออนุมัติโครงการและงบประมาณ 128,500 บาท', project_name: 'Leadership Camp',
    addressed_to: 'ฝ่ายวิชาการ', doc_number: 'GNK-2569-069', urgency: 'normal', created_by: 'u04',
    doc_date: D(9, 4), due_date: D(10, 20), current_step: 5, total_steps: 7, created_at: T([9, 4], 14, 0), updated_at: T([9, 12], 10, 45) },
  { id: 'd07', doc_type: 'outgoing', status: 'draft', title: 'ขอความอนุเคราะห์ใช้ยานพาหนะรถตู้คณะ สำหรับการแข่งขันวอลเลย์บอลระหว่างคณะ',
    description: 'ขอความอนุเคราะห์ใช้ยานพาหนะรถตู้คณะ', subject_line: 'รถตู้ 1 คัน วันที่ 11 ต.ค. 2569', project_name: 'แข่งขันวอลเลย์บอลระหว่างคณะ',
    addressed_to: 'ชมรมวอลเลย์บอล', doc_number: 'GNK-2569-073', urgency: 'normal', created_by: 'u09',
    doc_date: D(9, 14), due_date: D(10, 11), current_step: 1, total_steps: 4, created_at: T([9, 14], 20, 10), updated_at: T([9, 14], 20, 10) },
  { id: 'd08', doc_type: 'outgoing', status: 'completed', title: 'ขออนุมัติโครงการวันไหว้ครู ประจำปีการศึกษา 2569',
    description: 'ขออนุมัติโครงการ ไม่เกิน 1 แสนบาท', subject_line: 'ขออนุมัติโครงการและงบประมาณ 42,000 บาท', project_name: 'โครงการวันไหว้ครู',
    addressed_to: 'ฝ่ายศิลปะและวัฒนธรรม', doc_number: 'กนค. 1091008/2569', urgency: 'normal', created_by: 'u05',
    doc_date: D(7, 20), due_date: D(8, 21), current_step: 7, total_steps: 7, forwarded_to_staff: true, forwarded_at: T([9, 12], 15, 0),
    created_at: T([7, 20], 9, 30), updated_at: T([9, 12], 15, 0) },
  { id: 'd09', doc_type: 'outgoing', status: 'cancelled', title: 'ขอความอนุเคราะห์สถานที่จัดกิจกรรมดนตรีในสวน',
    description: 'ขอความอนุเคราะห์สถานที่ ภายในคณะ', subject_line: 'ลานหน้าอาคาร 3 วันที่ 26 ก.ย. 2569', project_name: 'ดนตรีในสวน',
    addressed_to: 'ฝ่ายศิลปะและวัฒนธรรม', doc_number: 'GNK-2569-064', urgency: 'normal', created_by: 'u10',
    doc_date: D(8, 20), due_date: D(9, 26), current_step: 2, total_steps: 4, created_at: T([8, 20], 10, 0), updated_at: T([9, 1], 11, 0) },
  { id: 'd10', doc_type: 'outgoing', status: 'pending', title: 'ขอความอนุเคราะห์ใช้สนามกีฬาจัดกิจกรรมปฐมนิเทศสมาชิกใหม่ชมรมวอลเลย์บอล',
    description: 'ขอความอนุเคราะห์สถานที่ ภายในคณะ', subject_line: 'ขอใช้สนามกีฬาคณะ วันเสาร์ที่ 27 ก.ย. 2569 เวลา 13.00–17.00 น.', project_name: 'ปฐมนิเทศสมาชิกใหม่ชมรมวอลเลย์บอล',
    addressed_to: 'ชมรมวอลเลย์บอล', doc_number: 'GNK-2569-070', urgency: 'normal', created_by: 'u09',
    doc_date: D(9, 5), due_date: D(9, 24), current_step: 4, total_steps: 4, created_at: T([9, 5], 15, 20), updated_at: T([9, 11], 9, 40) },
  { id: 'd11', doc_type: 'outgoing', status: 'completed', title: 'ขออนุมัติโครงการติวเข้มก่อนสอบกลางภาค ประจำภาคต้น 2569',
    description: 'ขออนุมัติโครงการ ไม่เกิน 1 แสนบาท', subject_line: 'ขออนุมัติโครงการและงบประมาณ 18,000 บาท', project_name: 'โครงการติวเข้มก่อนสอบ',
    addressed_to: 'ฝ่ายวิชาการ', doc_number: 'กนค. 1061009/2569', urgency: 'normal', created_by: 'u05',
    doc_date: D(8, 11), due_date: D(9, 22), current_step: 7, total_steps: 7, created_at: T([8, 11], 10, 0), updated_at: T([9, 10], 11, 30) },
].map(d => Object.assign({ notify_step: true, notify_overdue: true, forwarded_to_staff: false, forwarded_to_id: null, forwarded_at: null, accepted_by: null, accepted_at: null,
  final_recipient_id: null, final_recipient_note: null, received_number: null, received_date: null, deadline_datetime: null }, d));

/* ─── ขั้นตอน ─── */
const S = (doc, n, name, role, user, status, extra) => Object.assign({ id: `${doc}-s${n}`, document_id: doc, step_number: n, step_name: name, role_required: role, assigned_to: user, status, deadline_days: 2, action_taken: null, note: null, action_at: null, started_at: null, deadline_datetime: null, completed_at: null, revision_section: null, rejected_by: null, created_at: T([9, 1]) }, extra || {});
const budget = (doc, creator, chair, opts) => [
  S(doc, 1, 'ผู้จัดทำ', 'ROLE-CRT', creator, 'done', { action_taken: 'approve', action_at: opts.t1, completed_at: opts.t1, started_at: opts.t1, note: 'จัดทำเอกสาร' }),
  S(doc, 2, 'เหรัญญิก', 'ROLE-SGN', 'u03', opts.s2 || 'pending', opts.s2 === 'done' ? { action_taken: 'approve', action_at: opts.t2, completed_at: opts.t2, started_at: opts.t1, note: 'ตรวจสอบงบประมาณแล้ว ถูกต้อง' } : { started_at: opts.t1, deadline_datetime: opts.d2 }),
  S(doc, 3, 'เจ้าหน้าที่กิจการนิสิต', 'ROLE-STF', 'u07', opts.s3 || 'pending', opts.s3 === 'done' ? { action_taken: 'approve', action_at: opts.t3, completed_at: opts.t3 } : opts.s3 === 'active' ? { started_at: opts.t2, deadline_datetime: opts.d3 } : {}),
  S(doc, 4, 'ผู้รับผิดชอบโครงการ', 'ROLE-CRT', creator, opts.s4 || 'pending', opts.s4 === 'done' ? { action_taken: 'approve', action_at: opts.t4, completed_at: opts.t4 } : {}),
  S(doc, 5, 'ประธานฝ่าย', 'ROLE-SGN', chair, opts.s5 || 'pending', opts.s5 === 'done' ? { action_taken: 'approve', action_at: opts.t5, completed_at: opts.t5 } : opts.s5 === 'rejected' ? { action_taken: 'reject', action_at: opts.t5, rejected_by: chair, revision_section: 'ไฟล์แนบ', note: 'กรุณาแนบกำหนดการและตารางงบประมาณฉบับที่แก้ไขแล้ว' } : {}),
  S(doc, 6, 'หัวหน้านิสิต', 'ROLE-SGN', 'u01', opts.s6 || 'pending', opts.s6 === 'done' ? { action_taken: 'approve', action_at: opts.t6, completed_at: opts.t6 } : {}),
  S(doc, 7, 'อาจารย์ที่ปรึกษา', 'ROLE-ADV', 'u06', opts.s7 || 'pending', opts.s7 === 'done' ? { action_taken: 'approve', action_at: opts.t7, completed_at: opts.t7 } : {}),
];
const general = (doc, creator, chair, opts) => [
  S(doc, 1, 'ผู้จัดทำ', 'ROLE-CRT', creator, 'done', { action_taken: 'approve', action_at: opts.t1, completed_at: opts.t1, started_at: opts.t1 }),
  S(doc, 2, 'ประธานฝ่าย', 'ROLE-SGN', chair, opts.s2 || 'pending', opts.s2 === 'done' ? { action_taken: 'approve', action_at: opts.t2, completed_at: opts.t2 } : opts.s2 === 'active' ? { started_at: opts.t1, deadline_datetime: opts.d2 } : {}),
  S(doc, 3, 'หัวหน้านิสิต', 'ROLE-SGN', 'u01', opts.s3 || 'pending', opts.s3 === 'done' ? { action_taken: 'approve', action_at: opts.t3, completed_at: opts.t3 } : {}),
  S(doc, 4, 'อาจารย์ที่ปรึกษา', 'ROLE-ADV', 'u06', opts.s4 || 'pending', opts.s4 === 'done' ? { action_taken: 'approve', action_at: opts.t4, completed_at: opts.t4 } : {}),
];
export const workflow_steps = [
  ...budget('d01', 'u05', 'u04', { t1: T([9, 8], 10, 15), t2: T([9, 9], 13, 20), s2: 'done', s3: 'active', d3: T([9, 16], 23, 59) }),
  ...general('d02', 'u10', 'u04', { t1: T([9, 10], 9, 6), s2: 'active', d2: T([9, 17], 23, 59) }),
  ...budget('d03', 'u05', 'u04', { t1: T([8, 25], 11, 5), t2: T([8, 26]), t3: T([8, 28]), t4: T([8, 28], 15), t5: T([9, 1]), t6: T([9, 3]), t7: T([9, 9], 16, 20), s2: 'done', s3: 'done', s4: 'done', s5: 'done', s6: 'done', s7: 'done' }),
  ...general('d04', 'u10', 'u04', { t1: T([8, 18], 13, 45), t2: T([8, 20]), t3: T([8, 22]), t4: T([8, 26]), s2: 'done', s3: 'done', s4: 'done' }),
  S('d05', 1, 'ผู้จัดทำ', 'ROLE-CRT', 'u02', 'done', { action_taken: 'approve', action_at: T([9, 2], 8, 55), completed_at: T([9, 2], 8, 55) }),
  ...budget('d06', 'u04', 'u04', { t1: T([9, 4], 14, 5), t2: T([9, 5]), t3: T([9, 8]), t4: T([9, 9]), t5: T([9, 12], 10, 45), s2: 'done', s3: 'done', s4: 'done', s5: 'rejected' }),
  ...general('d07', 'u09', 'u04', { t1: T([9, 14], 20, 10) }).map((s, i) => i === 0 ? Object.assign(s, { status: 'active' }) : s),
  ...budget('d08', 'u05', 'u04', { t1: T([7, 20], 9, 35), t2: T([7, 22]), t3: T([7, 24]), t4: T([7, 24], 16), t5: T([7, 28]), t6: T([8, 1]), t7: T([8, 4]), s2: 'done', s3: 'done', s4: 'done', s5: 'done', s6: 'done', s7: 'done' }),
  ...general('d09', 'u10', 'u04', { t1: T([8, 20], 10, 5) }).map((s, i) => i === 1 ? Object.assign(s, { status: 'cancelled' }) : i > 1 ? Object.assign(s, { status: 'cancelled' }) : s),
  ...budget('d11', 'u05', 'u04', { t1: T([8, 11], 10, 5), t2: T([8, 13]), t3: T([8, 15]), t4: T([8, 15], 16), t5: T([8, 20]), t6: T([8, 25]), t7: T([9, 1]), s2: 'done', s3: 'done', s4: 'done', s5: 'done', s6: 'done', s7: 'done' }),
  ...general('d10', 'u09', 'u04', { t1: T([9, 5], 15, 25), t2: T([9, 8], 10, 0), t3: T([9, 11], 9, 40), s2: 'done', s3: 'done' }).map((s, i) => i === 3 ? Object.assign(s, { status: 'active', started_at: T([9, 11], 9, 40), deadline_datetime: T([9, 17], 23, 59) }) : s),
];

/* ─── ไฟล์แนบ ─── */
const F = (id, doc, name, path, by, at, extra) => Object.assign({ id, document_id: doc, file_name: name, file_path: path, file_size: 248_120, file_type: 'application/pdf', version: 1, uploaded_by: by, uploaded_at: at, archive_url: null, archive_ref: null, archived_at: null }, extra || {});
export const document_files = [
  F('f01', 'd01', 'ขออนุมัติโครงการกีฬาสานสัมพันธ์ครุศาสตร์ 2569.pdf', 'd01/ขออนุมัติโครงการกีฬาสานสัมพันธ์ครุศาสตร์ 2569.pdf', 'u05', T([9, 8], 10, 10)),
  F('f02', 'd01', '[ลงนาม] ขออนุมัติโครงการกีฬาสานสัมพันธ์ครุศาสตร์ 2569.pdf', 'signed/d01/v2-ขออนุมัติโครงการกีฬาสานสัมพันธ์ครุศาสตร์ 2569.pdf', 'u03', T([9, 9], 13, 21), { version: 2, file_size: 261_400 }),
  F('f03', 'd01', 'กำหนดการและตารางงบประมาณ.docx', 'd01/กำหนดการและตารางงบประมาณ.docx', 'u05', T([9, 8], 10, 11), { file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', file_size: 48_900 }),
  F('f04', 'd02', 'ขอใช้ห้องประชุมอาคาร 6.pdf', 'd02/ขอใช้ห้องประชุมอาคาร 6.pdf', 'u10', T([9, 10], 9, 4)),
  F('f05', 'd03', '[ลงนาม] ขออนุมัติปรับงบโครงการค่ายอาสา.pdf', 'signed/d03/v7-ขออนุมัติปรับงบโครงการค่ายอาสา.pdf', 'u06', T([9, 9], 16, 21), { version: 7 }),
  F('f06', 'd03', 'ขออนุมัติปรับงบโครงการค่ายอาสา.pdf', 'd03/ขออนุมัติปรับงบโครงการค่ายอาสา.pdf', 'u05', T([8, 25], 11, 0)),
  F('f07', 'd04', '[ลงนาม] ขอความอนุเคราะห์ประชาสัมพันธ์ Open House.pdf', 'signed/d04/v4-openhouse.pdf', 'u06', T([8, 26], 10, 0), { version: 4 }),
  F('f08', 'd05', 'หนังสือเชิญประชุมสภานิสิต 3-2569.pdf', 'd05/หนังสือเชิญประชุมสภานิสิต 3-2569.pdf', 'u02', T([9, 2], 8, 52)),
  F('f09', 'd06', 'ขออนุมัติโครงการ Leadership Camp.pdf', 'd06/ขออนุมัติโครงการ Leadership Camp.pdf', 'u04', T([9, 4], 14, 2)),
  F('f10', 'd08', '[ลงนาม] ขออนุมัติโครงการวันไหว้ครู 2569.pdf', 'signed/d08/v7-waikru.pdf', 'u06', T([8, 4], 11, 0), { version: 7 }),
  F('f11', 'd08', 'ขออนุมัติโครงการวันไหว้ครู 2569.pdf', 'd08/waikru.pdf', 'u05', T([7, 20], 9, 31), { archive_url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view', archive_ref: 'SaEDU-Archive/2569/d08/waikru.pdf', archived_at: T([9, 1], 2, 30) }),
  F('f14', 'd11', '[ลงนาม] ขออนุมัติโครงการติวเข้มก่อนสอบ.pdf', 'signed/d11/v8-tutor.pdf', 'u05', T([9, 10], 11, 31), { version: 8 }),
  F('f12', 'd10', 'ขอใช้สนามกีฬาปฐมนิเทศชมรมวอลเลย์บอล.pdf', 'd10/ขอใช้สนามกีฬาปฐมนิเทศชมรมวอลเลย์บอล.pdf', 'u09', T([9, 5], 15, 18)),
  F('f13', 'd10', '[ลงนาม] ขอใช้สนามกีฬาปฐมนิเทศชมรมวอลเลย์บอล.pdf', 'signed/d10/v3-ขอใช้สนามกีฬาปฐมนิเทศชมรมวอลเลย์บอล.pdf', 'u01', T([9, 11], 9, 41), { version: 3 }),
];

/* ─── ประวัติ ─── */
const H = (doc, action, by, at, note) => ({ id: `${doc}-h-${Math.random().toString(36).slice(2, 7)}`, document_id: doc, action, performed_by: by, performed_at: at, note: note || null, performer_name: CU_BY_ROLE[by] ? CU_BY_ROLE[by].full_name : null, performer_email: null });
export const document_history = [
  H('d01', 'สร้างเอกสาร', 'u05', T([9, 8], 10, 12)),
  H('d01', 'ส่งเอกสาร', 'u05', T([9, 8], 10, 15), 'ส่งเข้าขั้นตอนอนุมัติ'),
  H('d01', 'อนุมัติ / ลงนาม', 'u03', T([9, 9], 13, 20), 'ตรวจสอบงบประมาณแล้ว ถูกต้อง'),
  H('d01', 'ฝังลายเซ็นในเอกสาร', 'u03', T([9, 9], 13, 21), 'ไฟล์: [ลงนาม] ขออนุมัติโครงการกีฬาสานสัมพันธ์ครุศาสตร์ 2569.pdf'),
  H('d02', 'สร้างเอกสาร', 'u10', T([9, 10], 9, 5)),
  H('d02', 'ส่งเอกสาร', 'u10', T([9, 10], 9, 6)),
  H('d03', 'สร้างเอกสาร', 'u05', T([8, 25], 11, 0)),
  H('d03', 'อนุมัติ / ลงนาม', 'u06', T([9, 9], 16, 20), 'อนุมัติ'),
  H('d04', 'ออกเลขหนังสือ', 'u10', T([9, 2], 9, 58), 'กนค. 1072011/2569'),
  H('d04', 'ส่งเข้ากิจการนิสิต', 'u10', T([9, 2], 10, 0), 'ส่งเข้าคิวกลุ่มเจ้าหน้าที่'),
  H('d04', 'เจ้าหน้าที่รับเอกสาร', 'u07', T([9, 3], 9, 15), 'รับเรื่องแล้ว จะยื่นในระบบคณะ'),
  H('d05', 'สร้างเอกสาร', 'u02', T([9, 2], 8, 50)),
  H('d05', 'ออกเลขหนังสือ', 'u02', T([9, 2], 9, 30), 'กนค. 2047003/2569'),
  H('d05', 'เสนอเอกสารเพื่อรับทราบ: นายภาคิน วงศ์สุวรรณ, นางสาวปาลิดา จันทร์เพ็ญ, นายธนกร ศรีสมบูรณ์', 'u02', T([9, 2], 9, 35)),
  H('d05', 'รับทราบเอกสาร', 'u03', T([9, 3], 11, 5)),
  H('d06', 'ส่งคืนแก้ไข', 'u04', T([9, 12], 10, 45), 'ส่วนที่ต้องแก้ไข: ไฟล์แนบ — กรุณาแนบกำหนดการและตารางงบประมาณฉบับที่แก้ไขแล้ว'),
  H('d08', 'ออกเลขหนังสือ', 'u05', T([8, 5], 9, 0), 'กนค. 1091008/2569'),
  H('d08', 'ส่งเข้ากิจการนิสิต', 'u05', T([9, 12], 15, 0)),
  H('d09', 'ยกเลิกเอกสาร', 'u10', T([9, 1], 11, 0), 'เหตุผล: กิจกรรมถูกยกเลิกเนื่องจากฝนตกหนักและพื้นที่ไม่พร้อม'),
  H('d11', 'ออกเลขหนังสือ', 'u05', T([9, 10], 11, 30), 'กนค. 1061009/2569'),
  H('d10', 'สร้างเอกสาร', 'u09', T([9, 5], 15, 20)),
  H('d10', 'ส่งเอกสาร', 'u09', T([9, 5], 15, 25)),
  H('d10', 'อนุมัติ / ลงนาม', 'u04', T([9, 8], 10, 0), 'ตรวจทานแล้ว'),
  H('d10', 'อนุมัติ / ลงนาม', 'u01', T([9, 11], 9, 40)),
  H('d10', 'ฝังลายเซ็นในเอกสาร', 'u01', T([9, 11], 9, 41), 'ไฟล์: [ลงนาม] ขอใช้สนามกีฬาปฐมนิเทศชมรมวอลเลย์บอล.pdf'),
];

export const document_acks = [
  { id: 'a01', document_id: 'd05', user_id: 'u01', status: 'pending', acked_at: null, note: null, signed: false, requested_by: 'u02', created_at: T([9, 2], 9, 35) },
  { id: 'a02', document_id: 'd05', user_id: 'u04', status: 'pending', acked_at: null, note: null, signed: false, requested_by: 'u02', created_at: T([9, 2], 9, 35) },
  { id: 'a03', document_id: 'd05', user_id: 'u03', status: 'acked', acked_at: T([9, 3], 11, 5), note: 'รับทราบ', signed: true, requested_by: 'u02', created_at: T([9, 2], 9, 35) },
];

export const announcements = [
  { id: 'an1', title: 'กำหนดยื่นเอกสารขออนุมัติโครงการภาคต้น', body: 'เอกสารขออนุมัติโครงการที่จะจัดในเดือนตุลาคม ต้องยื่นเข้าระบบภายใน 19 กันยายน 2569 เพื่อให้สายอนุมัติเดินครบก่อนเริ่มกิจกรรม', level: 'warn', pinned: true, is_active: true, created_by: 'u07', created_at: T([9, 5]) },
  { id: 'an2', title: 'เปิดใช้งานการแจ้งเตือนผ่าน LINE OA แล้ว', body: 'ผูกบัญชีได้ที่กระดิ่งมุมขวาบน → รับแจ้งเตือนทาง LINE', level: 'info', pinned: false, is_active: true, created_by: 'u08', created_at: T([8, 28]) },
];
export const calendar_events = [
  { id: 'c1', date: D(9, 19), title: 'ปิดรับเอกสารโครงการเดือน ต.ค.', color: '#E83A00', created_by: 'u07', created_at: T([9, 1]), is_private: false },
  { id: 'c2', date: D(9, 24), title: 'ประชุม กนค. ประจำเดือน', color: '#2563EB', created_by: 'u02', created_at: T([9, 1]), is_private: false },
  { id: 'c3', date: D(10, 3), title: 'กิจกรรมรับน้องฝ่ายนิสิตสัมพันธ์', color: '#10A65A', created_by: 'u10', created_at: T([9, 10]), is_private: false },
];
export const projects = [
  { id: 'p1', name: 'โครงการกีฬาสานสัมพันธ์ครุศาสตร์', is_active: true, sort_order: 1 },
  { id: 'p2', name: 'โครงการค่ายอาสาพัฒนาชนบท', is_active: true, sort_order: 2 },
  { id: 'p3', name: 'โครงการวันไหว้ครู', is_active: true, sort_order: 3 },
  { id: 'p4', name: 'Open House 2569', is_active: true, sort_order: 4 },
  { id: 'p5', name: 'กิจกรรมรับน้อง 2569', is_active: true, sort_order: 5 },
];
export const form_templates = [
  { id: 't1', name: '01 แบบฟอร์มขออนุมัติโครงการ (ไม่เกิน 1 แสนบาท)', category: 'outgoing', description: 'ยื่นล่วงหน้าไม่ต่ำกว่า 4 สัปดาห์', file_path: 'tmpl_01.docx', file_name: '01-project-approval.docx', file_size: 88_200, sort_order: 1, is_active: true, uploaded_by: 'u07', created_at: T([6, 1]) },
  { id: 't2', name: '02 แบบฟอร์มขออนุมัติโครงการ (เกิน 1 แสนบาท)', category: 'outgoing', description: 'ยื่นล่วงหน้าไม่ต่ำกว่า 4 สัปดาห์', file_path: 'tmpl_02.docx', file_name: '02-project-approval-large.docx', file_size: 91_000, sort_order: 2, is_active: true, uploaded_by: 'u07', created_at: T([6, 1]) },
  { id: 't3', name: '03 แบบฟอร์มขออนุมัติปรับงบ', category: 'outgoing', description: 'ยื่นล่วงหน้าไม่ต่ำกว่า 1 สัปดาห์', file_path: 'tmpl_03.docx', file_name: '03-budget-change.docx', file_size: 64_000, sort_order: 3, is_active: true, uploaded_by: 'u07', created_at: T([6, 1]) },
  { id: 't4', name: '05 แบบฟอร์มขอความอนุเคราะห์สถานที่ภายในคณะ', category: 'outgoing', description: 'ยื่นล่วงหน้าไม่ต่ำกว่า 3 สัปดาห์', file_path: 'tmpl_05.docx', file_name: '05-venue.docx', file_size: 59_300, sort_order: 5, is_active: true, uploaded_by: 'u07', created_at: T([6, 1]) },
  { id: 't5', name: '11 แบบฟอร์มขอความอนุเคราะห์ประชาสัมพันธ์', category: 'outgoing', description: 'ยื่นล่วงหน้าไม่ต่ำกว่า 2 สัปดาห์', file_path: 'tmpl_11.docx', file_name: '11-pr.docx', file_size: 57_000, sort_order: 11, is_active: true, uploaded_by: 'u07', created_at: T([6, 1]) },
  { id: 't6', name: '20 แบบฟอร์มหนังสือนำส่ง (ขาเข้า)', category: 'incoming', description: '', file_path: 'tmpl_20.docx', file_name: '20-cover-letter.docx', file_size: 40_100, sort_order: 20, is_active: true, uploaded_by: 'u02', created_at: T([6, 1]) },
];
export const doc_types = [
  { id: 'dt1', code: 'incoming', label: 'หนังสือขาเข้า', icon: 'dn', show_from: true, from_label: 'สังกัด / ชมรม', show_to: true, to_label: 'ส่งถึงตำแหน่ง', show_ref: false, ref_label: '', show_doc_date: true, doc_date_label: 'วันที่หนังสือ', event_label: 'วันที่กิจกรรม / ต้องใช้เอกสาร', event_required: false, sort_order: 2, is_active: true, min_days: 0, enable_deadline: true },
  { id: 'dt2', code: 'outgoing', label: 'หนังสือขาออก', icon: 'up', show_from: true, from_label: 'ชื่อผู้ส่งเอกสาร', show_to: true, to_label: 'ตำแหน่ง / สังกัด', show_ref: false, ref_label: '', show_doc_date: true, doc_date_label: 'วันที่รับเอกสาร', event_label: 'วันที่ต้องดำเนินการเสร็จ', event_required: true, sort_order: 1, is_active: true, min_days: 0, enable_deadline: true },
];
export const doc_type_fields = [];
export const app_settings = [
  { key: 'app_url', value: 'https://saeduflow.edu.chula.ac.th', value_type: 'text', label: 'URL ระบบ' },
  { key: 'session_timeout_min', value: '30', value_type: 'number', label: 'หมดเวลาเซสชัน (นาที)' },
  { key: 'sla_cascade_days', value: '3', value_type: 'number', label: 'วันทำการก่อนจัดการอัตโนมัติ' },
  { key: 'email_prefix', value: '[กนค.]', value_type: 'text', label: 'คำนำหน้าหัวข้ออีเมล' },
  { key: 'line_oa_id', value: '@saeduflow', value_type: 'text', label: 'LINE OA ID' },
  { key: 'line_group_events', value: 'create,resubmit', value_type: 'text', label: 'เหตุการณ์ที่แจ้งกลุ่ม LINE' },
  { key: 'student_id_length', value: '10', value_type: 'number', label: 'ความยาวรหัสนิสิต' },
  { key: 'student_id_suffix', value: '27', value_type: 'text', label: 'เลขท้ายรหัสนิสิต' },
  { key: 'can_create_incoming_roles_json', value: '["ROLE-STF","ROLE-SYS","ROLE-DEV"]', value_type: 'json', label: 'บทบาทที่สร้างหนังสือขาเข้าได้' },
  { key: 'can_create_incoming_positions_json', value: '["GNK-PRE","GNK-SEC"]', value_type: 'json', label: 'ตำแหน่งที่สร้างหนังสือขาเข้าได้' },
  { key: 'schema_version', value: '3', value_type: 'text', label: 'schema version' },
  { key: 'ops_archive_last_ok', value: '2026-09-15T02:31:00+07:00', value_type: 'text', label: '' },
  { key: 'ops_backup_last_ok', value: '2026-09-14T04:12:00+07:00', value_type: 'text', label: '' },
  { key: 'ops_mirror_last_ok', value: '2026-09-14T04:40:00+07:00', value_type: 'text', label: '' },
].map(r => Object.assign({ updated_by: 'u08', updated_at: T([9, 1]) }, r));
export const email_templates = ['create', 'approve', 'reject', 'numbering', 'completed', 'forward'].map(k => ({ key: k, label: k, subject_suffix: '', extra_note: '', updated_at: T([9, 1]) }));
export const workflow_templates = [];
export const workflow_template_steps = [];
export const doc_number_settings = [{ id: 'dn1', year: 2026, prefix: 'GNK', out_prefix: 'กนค.', seq_reset_at: null, created_at: T([5, 20]) }];
export const notifications = [
  { id: 'n1', document_id: 'd01', recipient_id: 'u07', recipient_email: 'orathai.b@chula.ac.th', subject: '[กนค.] ถึงคิวของท่าน: ขออนุมัติโครงการกีฬาสานสัมพันธ์ครุศาสตร์', body: '…', sent_at: T([9, 9], 13, 22), status: 'sent', notification_type: 'approve' },
  { id: 'n2', document_id: 'd01', recipient_id: 'u07', recipient_email: 'orathai.b@chula.ac.th', subject: '[LINE] [กนค.] ถึงคิวของท่าน: ขออนุมัติโครงการกีฬาสานสัมพันธ์ครุศาสตร์', body: '…', sent_at: T([9, 9], 13, 22), status: 'sent', notification_type: 'approve' },
  { id: 'n3', document_id: 'd06', recipient_id: 'u04', recipient_email: 'palida.j@student.chula.ac.th', subject: '[กนค.] ส่งคืนแก้ไข: ขออนุมัติโครงการอบรมผู้นำนิสิต', body: '…', sent_at: T([9, 12], 10, 46), status: 'sent', notification_type: 'reject' },
];
export const system_logs = [];

export const TABLES = { users, user_directory: users, documents, workflow_steps, document_files, document_history, document_acks, announcements, calendar_events, projects, form_templates, doc_types, doc_type_fields, app_settings, email_templates, workflow_templates, workflow_template_steps, doc_number_settings, notifications, system_logs };
