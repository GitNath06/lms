import { LAB_ROOMS, DEFAULT_CLASSES, DEFAULT_SUBJECTS, MASTER_ROUTINE } from '@/lib/master-data'

export interface TeacherAssignment {
  teacherId: string // internal code e.g. 't1', 't2', or uuid
  name: string
  email: string
  department: string
  assignedClasses: string[]
  assignedSubjects: Array<{
    code: string
    title: string
    grade: string
    labId: string
    labName: string
    defaultTopic?: string
  }>
  assignedLabIds: string[]
}

// Canonical institutional faculty list mapping to subjects & curriculum
export const INSTITUTIONAL_TEACHERS: TeacherAssignment[] = [
  {
    teacherId: 't4', // Er. Anish Karki
    name: 'Er. Anish Karki',
    email: 'a.karki@rrl.edu.np',
    department: 'Electronics & Computer',
    assignedClasses: ['12C', '11C', '10A', '9B', '8A', '7B', '6A'],
    assignedSubjects: [
      { code: 'COMP-12', title: 'Data Structures & Algorithms Lab', grade: '12C', labId: 'comp', labName: 'Computer Engineering Lab 01', defaultTopic: 'Verification of Binary Search Tree Operations & Node Insertion' },
      { code: 'ELEC-12', title: 'Digital Electronics & Logic Gates', grade: '12C', labId: 'elec', labName: 'Electronics & Hardware Lab', defaultTopic: 'Design and Implementation of Combinational Half & Full Adders' },
      { code: 'COMP-11', title: 'C Programming & Logic Development Lab', grade: '11C', labId: 'comp', labName: 'Computer Engineering Lab 01', defaultTopic: 'Implementation of Multi-Dimensional Arrays and Pointer Arithmetic' },
      { code: 'ELEC-11', title: 'Basic Electrical & Circuit Simulation', grade: '11C', labId: 'elec', labName: 'Electronics & Hardware Lab', defaultTopic: "Verification of Kirchhoff's Current & Voltage Laws (KCL / KVL)" },
      { code: 'DBMS-10', title: 'Database Management Systems Lab', grade: '10A', labId: 'comp', labName: 'Computer Engineering Lab 01', defaultTopic: 'DDL and DML Queries with Relational Constraints in PostgreSQL' },
      { code: 'WPD-9', title: 'Web Page Design & Development Lab', grade: '9B', labId: 'comp', labName: 'Computer Engineering Lab 01', defaultTopic: 'Responsive CSS Grid and Flexbox UI Layouts with Semantic HTML5' },
      { code: 'ICT-8', title: 'Information Technology Basics', grade: '8A', labId: 'comp', labName: 'Computer Engineering Lab 01', defaultTopic: 'Spreadsheets Formatting and Basic Presentation Animations' },
      { code: 'ICT-7', title: 'Computer Applications Lab', grade: '7B', labId: 'comp', labName: 'Computer Engineering Lab 01', defaultTopic: 'Word Processing Formatting and Typographic Styles' },
      { code: 'SCI-6', title: 'Basic Science & Computing Lab', grade: '6A', labId: 'comp', labName: 'Computer Engineering Lab 01', defaultTopic: 'Introduction to Computer Peripherals and Paint Drawing Utilities' },
    ],
    assignedLabIds: ['comp', 'elec'],
  },
  {
    teacherId: 't2', // Dr. Prakash Adhikari
    name: 'Dr. Prakash Adhikari',
    email: 'p.adhikari@rrl.edu.np',
    department: 'Physics Department',
    assignedClasses: ['12 Sc', '11 Sc', '10A', '8A'],
    assignedSubjects: [
      { code: 'PHY-12', title: 'Modern Physics & Wave Optics Lab', grade: '12 Sc', labId: 'phys', labName: 'Physics Laboratory', defaultTopic: 'Determination of Wavelength of Sodium Light by Diffraction Grating' },
      { code: 'PHY-11', title: 'Optics & Wave Mechanics Lab', grade: '11 Sc', labId: 'phys', labName: 'Physics Laboratory', defaultTopic: 'Determination of Focal Length of Convex Lens using u-v Method' },
      { code: 'SCI-10', title: 'Secondary Applied Science Lab', grade: '10A', labId: 'phys', labName: 'Physics Laboratory', defaultTopic: "Verification of Ohm's Law and Series/Parallel Resistors" },
      { code: 'SCI-8', title: 'General Science Practicals', grade: '8A', labId: 'phys', labName: 'Physics Laboratory', defaultTopic: 'Measurement of Density of Irregular Solids using Archimedes Principle' },
    ],
    assignedLabIds: ['phys'],
  },
  {
    teacherId: 't3', // Ms. Sunita Thapa
    name: 'Ms. Sunita Thapa',
    email: 's.thapa@rrl.edu.np',
    department: 'Chemistry Department',
    assignedClasses: ['12 Sc', '11 Sc', '9B'],
    assignedSubjects: [
      { code: 'CHEM-12', title: 'Analytical Chemistry Practicals', grade: '12 Sc', labId: 'chem', labName: 'Chemistry Laboratory', defaultTopic: 'Volumetric Titration of Sodium Carbonate against Standard Oxalic Acid' },
      { code: 'CHEM-11', title: 'Inorganic & General Chemistry Lab', grade: '11 Sc', labId: 'chem', labName: 'Chemistry Laboratory', defaultTopic: 'Preparation of Standard M/10 Solution of Mohr Salt' },
      { code: 'SCI-9', title: 'Integrated Science Practicals', grade: '9B', labId: 'chem', labName: 'Chemistry Laboratory', defaultTopic: 'Identification of Acidic and Basic Radicals in Inorganic Salts' },
    ],
    assignedLabIds: ['chem'],
  },
  {
    teacherId: 't5', // Dr. Nirmala Poudel
    name: 'Dr. Nirmala Poudel',
    email: 'n.poudel@rrl.edu.np',
    department: 'Biology & Life Sciences',
    assignedClasses: ['12 Sc', '11 Sc', '7B'],
    assignedSubjects: [
      { code: 'BIO-12', title: 'Plant Physiology & Genetics Lab', grade: '12 Sc', labId: 'bio', labName: 'Biology & Life Sciences Lab', defaultTopic: 'Observation of Stages of Mitosis in Onion Root Tip Cells' },
      { code: 'BIO-11', title: 'Cell Biology & Microbiology Lab', grade: '11 Sc', labId: 'bio', labName: 'Biology & Life Sciences Lab', defaultTopic: 'Study of Bacteria and Fungi using Compound Light Microscope' },
      { code: 'SCI-7', title: 'General Science Observations', grade: '7B', labId: 'bio', labName: 'Biology & Life Sciences Lab', defaultTopic: 'Parts of Flowering Plants and Leaf Venation Classification' },
    ],
    assignedLabIds: ['bio'],
  },
  {
    teacherId: 't1', // Dr. Rajesh Sharma
    name: 'Dr. Rajesh Sharma',
    email: 'incharge@rrl.edu.np',
    department: 'Science & Technology Laboratories',
    assignedClasses: ['12C', '12 Mgt', '11C', '10A', '9B'],
    assignedSubjects: [
      { code: 'COMP-12', title: 'Data Structures & Algorithms Lab', grade: '12C', labId: 'comp', labName: 'Computer Engineering Lab 01', defaultTopic: 'Verification of Binary Search Tree Operations & Node Insertion' },
      { code: 'COMP-12M', title: 'Business Computing & Spreadsheets Lab', grade: '12 Mgt', labId: 'comp', labName: 'Computer Engineering Lab 01', defaultTopic: 'Financial Modeling, Pivot Tables & Macro Automation in Excel' },
      { code: 'COMP-11', title: 'C Programming & Logic Development Lab', grade: '11C', labId: 'comp', labName: 'Computer Engineering Lab 01', defaultTopic: 'Implementation of Multi-Dimensional Arrays and Pointer Arithmetic' },
      { code: 'DBMS-10', title: 'Database Management Systems Lab', grade: '10A', labId: 'comp', labName: 'Computer Engineering Lab 01', defaultTopic: 'DDL and DML Queries with Relational Constraints in PostgreSQL' },
      { code: 'WPD-9', title: 'Web Page Design & Development Lab', grade: '9B', labId: 'comp', labName: 'Computer Engineering Lab 01', defaultTopic: 'Responsive CSS Grid and Flexbox UI Layouts with Semantic HTML5' },
    ],
    assignedLabIds: ['comp', 'elec', 'phys', 'chem', 'bio'],
  },
]

// Known UUID to Teacher mapping for Supabase Auth profiles
export const PROFILE_TEACHER_MAPPING: Record<string, string> = {
  'f3ad9570-a56c-4727-82b7-b3edd942896c': 't4', // Er. Anish Karki
  'a0110dea-ef2a-4fc1-b60a-6415fcc36bd1': 't2', // Dr. Prakash Adhikari
  '0a8ee514-a58a-41a1-a6a5-c444447b1db9': 't5', // Dr. Nirmala Poudel
  'e094a954-b7ec-4e42-ae36-b41019c0ce81': 't1', // Dr. Rajesh Sharma
}

/**
 * Resolve teacher assignment by any identifier (UUID, internal code, email, or full name)
 */
export function getTeacherAssignments(identifier?: string | null): TeacherAssignment | null {
  if (!identifier) return null
  const cleanId = identifier.trim().toLowerCase()

  // Check known UUID mapping
  if (PROFILE_TEACHER_MAPPING[identifier]) {
    const targetCode = PROFILE_TEACHER_MAPPING[identifier]
    const found = INSTITUTIONAL_TEACHERS.find((t) => t.teacherId === targetCode)
    if (found) return found
  }

  // Check direct matches
  const match = INSTITUTIONAL_TEACHERS.find((t) => {
    return (
      t.teacherId.toLowerCase() === cleanId ||
      t.email.toLowerCase() === cleanId ||
      t.name.toLowerCase() === cleanId ||
      cleanId.includes(t.name.toLowerCase()) ||
      t.name.toLowerCase().includes(cleanId)
    )
  })

  if (match) return match

  // Fallback for general teacher
  return {
    teacherId: identifier,
    name: identifier,
    email: '',
    department: 'Science & Technology',
    assignedClasses: DEFAULT_CLASSES.map((c) => c.name),
    assignedSubjects: DEFAULT_SUBJECTS.map((s) => ({
      code: s.code,
      title: s.title,
      grade: s.grade,
      labId: s.labId,
      labName: s.lab,
      defaultTopic: s.defaultTopic,
    })),
    assignedLabIds: LAB_ROOMS.map((l) => l.id),
  }
}

/**
 * Fuzzy check if two class/grade identifiers belong to the same level / cohort
 * e.g. "12 Eng" matches "12", "Class 12", "12 Eng", "12C", "12 Sc"
 */
export function matchesGrade(classOrGradeA?: string | null, classOrGradeB?: string | null): boolean {
  if (!classOrGradeA || !classOrGradeB) return true
  const normA = classOrGradeA.trim().toLowerCase().replace(/^class\s+/i, '')
  const normB = classOrGradeB.trim().toLowerCase().replace(/^class\s+/i, '')
  
  if (normA === normB) return true
  if (normA.startsWith(normB) || normB.startsWith(normA)) return true

  // Extract leading digits if present: e.g. "12 Eng" -> "12", "12 Sc" -> "12", "Class 12" -> "12"
  const numA = normA.match(/\d+/)?.[0]
  const numB = normB.match(/\d+/)?.[0]
  if (numA && numB && numA === numB) {
    const isMgtA = normA.includes('mgt') || normA.includes('management')
    const isMgtB = normB.includes('mgt') || normB.includes('management')
    const isEngA = normA.includes('eng') || normA.includes('comp')
    const isEngB = normB.includes('eng') || normB.includes('comp')
    const isScA = normA.includes('sc') || normA.includes('science')
    const isScB = normB.includes('sc') || normB.includes('science')

    // If one is explicitly management and the other is engineering/science, separate them
    if ((isMgtA && (isEngB || isScB)) || (isMgtB && (isEngA || isScA))) {
      return false
    }
    return true
  }

  return false
}

/**
 * Get all subjects for a class/grade
 */
export function getSubjectsForClass(className?: string | null, customSubjects?: any[]) {
  const pool = customSubjects && customSubjects.length > 0 ? customSubjects : DEFAULT_SUBJECTS
  if (!className) return pool
  const matched = pool.filter((s: any) => matchesGrade(s.grade, className))
  return matched.length > 0 ? matched : pool
}

/**
 * Get Lab for a subject code
 */
export function getLabForSubject(subjectCode?: string | null) {
  if (!subjectCode) return null
  const cleanCode = subjectCode.split(/[\s-—]/)[0].toUpperCase()
  const subject = DEFAULT_SUBJECTS.find((s) => s.code.toUpperCase().startsWith(cleanCode))
  if (subject) {
    const room = LAB_ROOMS.find((l) => l.id === subject.labId)
    return {
      labId: subject.labId,
      labName: subject.lab,
      room,
    }
  }
  return null
}
