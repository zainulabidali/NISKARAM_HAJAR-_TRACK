/**
 * StorageService - Offline LocalStorage manager for Madrasa Attendance System.
 * Uses normalized data models with cascading deletes and seed data for demo.
 */
const StorageService = {
  // Key names
  KEYS: {
    CLASSES: 'madrasa_classes',
    STUDENTS: 'madrasa_students',
    ATTENDANCE: 'madrasa_attendance',
    SETTINGS: 'madrasa_settings'
  },

  // Initialize service & initialize clean empty database if empty
  init() {
    if (!localStorage.getItem(this.KEYS.CLASSES)) {
      this._set(this.KEYS.CLASSES, []);
      this._set(this.KEYS.STUDENTS, []);
      this.saveAttendanceDb({});
      this.saveSettings({
        madrasaName: 'Darul Huda Islamic Madrasa',
        weeklyOff: 'Friday'
      });
    }
  },

  // Helper: Get item from LocalStorage with fallback
  _get(key, fallback = []) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      console.error(`Error reading ${key} from localStorage:`, e);
      return fallback;
    }
  },

  // Helper: Save item to LocalStorage
  _set(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error(`Error saving ${key} to localStorage:`, e);
      return false;
    }
  },

  // --- CLASSES MODULE ---
  getClasses() {
    return this._get(this.KEYS.CLASSES, []);
  },

  saveClass(cls) {
    const classes = this.getClasses();
    if (cls.id) {
      // Edit
      const idx = classes.findIndex(c => c.id === cls.id);
      if (idx !== -1) classes[idx] = cls;
    } else {
      // Add
      cls.id = 'class_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      classes.push(cls);
    }
    this._set(this.KEYS.CLASSES, classes);
    return cls;
  },

  deleteClass(classId) {
    // 1. Delete Class
    let classes = this.getClasses();
    classes = classes.filter(c => c.id !== classId);
    this._set(this.KEYS.CLASSES, classes);

    // 2. Cascade Delete Students belonging to this Class
    const students = this.getStudents();
    const studentsToKeep = students.filter(s => s.classId !== classId);
    const deletedStudents = students.filter(s => s.classId === classId);
    this._set(this.KEYS.STUDENTS, studentsToKeep);

    // 3. Clean up attendance for deleted students or classes
    const attendance = this.getAttendanceDb();
    const deletedStudentIds = new Set(deletedStudents.map(s => s.id));
    
    for (const key in attendance) {
      // Key format: YYYY-MM-DD_classId_prayer
      const parts = key.split('_');
      if (parts[1] === classId) {
        delete attendance[key]; // Delete entire record for this class
      } else {
        // Delete records of cascaded students inside other classes if any
        const record = attendance[key];
        let changed = false;
        for (const sId in record) {
          if (deletedStudentIds.has(sId)) {
            delete record[sId];
            changed = true;
          }
        }
        if (changed && Object.keys(record).length === 0) {
          delete attendance[key];
        }
      }
    }
    this.saveAttendanceDb(attendance);
    return true;
  },

  // --- STUDENTS MODULE ---
  getStudents() {
    return this._get(this.KEYS.STUDENTS, []);
  },

  getStudentsByClass(classId) {
    const students = this.getStudents();
    return students.filter(s => s.classId === classId);
  },

  saveStudent(student) {
    const students = this.getStudents();
    if (student.id) {
      // Edit
      const idx = students.findIndex(s => s.id === student.id);
      if (idx !== -1) students[idx] = student;
    } else {
      // Add
      student.id = 'student_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      students.push(student);
    }
    this._set(this.KEYS.STUDENTS, students);
    return student;
  },

  deleteStudent(studentId) {
    let students = this.getStudents();
    students = students.filter(s => s.id !== studentId);
    this._set(this.KEYS.STUDENTS, students);

    // Clean up attendance record for this specific student
    const attendance = this.getAttendanceDb();
    let changed = false;
    for (const key in attendance) {
      if (attendance[key] && attendance[key][studentId]) {
        delete attendance[key][studentId];
        changed = true;
        if (Object.keys(attendance[key]).length === 0) {
          delete attendance[key];
        }
      }
    }
    if (changed) {
      this.saveAttendanceDb(attendance);
    }
    return true;
  },

  // --- ATTENDANCE MODULE ---
  getAttendanceDb() {
    return this._get(this.KEYS.ATTENDANCE, {});
  },

  saveAttendanceDb(db) {
    return this._set(this.KEYS.ATTENDANCE, db);
  },

  // Get active attendance map for a single class, date, and prayer
  // Returns: { studentId: 'Present' | 'Absent' | 'Late' | 'Leave' }
  getAttendance(date, classId, prayer) {
    const db = this.getAttendanceDb();
    const key = `${date}_${classId}_${prayer}`;
    return db[key] || {};
  },

  // Save single student's status with absolute auto-save
  saveStudentAttendance(date, classId, prayer, studentId, status) {
    const db = this.getAttendanceDb();
    const key = `${date}_${classId}_${prayer}`;
    
    if (!db[key]) {
      db[key] = {};
    }
    
    db[key][studentId] = status;
    this.saveAttendanceDb(db);
    return db[key];
  },

  // Save full class attendance map
  saveClassAttendance(date, classId, prayer, attendanceMap) {
    const db = this.getAttendanceDb();
    const key = `${date}_${classId}_${prayer}`;
    db[key] = attendanceMap;
    return this.saveAttendanceDb(db);
  },

  // --- SETTINGS SERVICE ---
  getSettings() {
    const defaults = {
      madrasaName: 'Madrasa Darul Huda',
      weeklyOff: 'Friday' // Standard default
    };
    const saved = localStorage.getItem(this.KEYS.SETTINGS);
    return saved ? {...defaults, ...JSON.parse(saved)} : defaults;
  },

  saveSettings(settings) {
    return this._set(this.KEYS.SETTINGS, settings);
  },

  // --- ANALYTICS & REPORTS MODULE ---
  
  // Dashboard aggregated data for a specific date (usually today)
  getDashboardStats(dateStr) {
    const students = this.getStudents();
    const totalStudents = students.length;
    
    const db = this.getAttendanceDb();
    let presentToday = 0;
    let absentToday = 0;
    let lateToday = 0;
    let leaveToday = 0;
    let recordsCount = 0;

    // We scan all keys matching this date: dateStr_classId_prayer
    for (const key in db) {
      if (key.startsWith(dateStr + '_')) {
        const record = db[key];
        for (const sId in record) {
          const status = record[sId];
          recordsCount++;
          if (status === 'Present') presentToday++;
          else if (status === 'Absent') absentToday++;
          else if (status === 'Late') lateToday++;
          else if (status === 'Leave') leaveToday++;
        }
      }
    }

    const totalMarked = presentToday + absentToday + lateToday + leaveToday;
    const attendancePercentage = totalMarked > 0 
      ? Math.round(((presentToday + lateToday) / totalMarked) * 100) 
      : 100; // default to 100% or 0% when no classes marked

    return {
      totalStudents,
      presentToday: presentToday + lateToday, // late are physically present
      absentToday,
      leaveToday,
      attendancePercentage: totalMarked > 0 ? attendancePercentage : 0,
      totalMarked
    };
  },

  // Daily report compiler
  getDailyReport(date, classId, prayer) {
    const students = this.getStudentsByClass(classId);
    const attendanceMap = this.getAttendance(date, classId, prayer);
    
    const presentList = [];
    const absentList = [];
    const lateList = [];
    const leaveList = [];
    const unmarkedList = [];

    students.forEach(student => {
      const status = attendanceMap[student.id];
      if (status === 'Present') {
        presentList.push(student);
      } else if (status === 'Absent') {
        absentList.push(student);
      } else if (status === 'Late') {
        lateList.push(student);
      } else if (status === 'Leave') {
        leaveList.push(student);
      } else {
        unmarkedList.push(student);
      }
    });

    const totalStudents = students.length;
    const presentCount = presentList.length;
    const absentCount = absentList.length;
    const lateCount = lateList.length;
    const leaveCount = leaveList.length;
    const unmarkedCount = unmarkedList.length;

    const totalMarked = presentCount + absentCount + lateCount + leaveCount;
    const attendancePercentage = totalMarked > 0 
      ? Math.round(((presentCount + lateCount) / totalMarked) * 100)
      : 0;

    return {
      classId,
      date,
      prayer,
      totalStudents,
      presentCount,
      absentCount,
      lateCount,
      leaveCount,
      unmarkedCount,
      presentList,
      absentList,
      lateList,
      leaveList,
      unmarkedList,
      attendancePercentage
    };
  },

  // Monthly report compiler
  // Year: YYYY, Month: MM (1-indexed, i.e., 1 = Jan, 12 = Dec)
  getMonthlyReport(classId, year, month) {
    const students = this.getStudentsByClass(classId);
    const db = this.getAttendanceDb();
    
    // Format month search prefix e.g., "2026-05-"
    const monthStr = `${year}-${String(month).padStart(2, '0')}-`;
    
    // We want to count how many prayer times were recorded in this month for this class
    // Keys format: YYYY-MM-DD_classId_prayer
    const sessionKeys = [];
    for (const key in db) {
      if (key.startsWith(monthStr) && key.includes(`_${classId}_`)) {
        sessionKeys.push(key);
      }
    }
    
    const totalSessions = sessionKeys.length;
    
    // Compute stats for each student
    const studentStats = students.map(student => {
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let leaveCount = 0;
      let unattendedCount = 0;

      sessionKeys.forEach(key => {
        const status = db[key][student.id];
        if (status === 'Present') presentCount++;
        else if (status === 'Absent') absentCount++;
        else if (status === 'Late') lateCount++;
        else if (status === 'Leave') leaveCount++;
        else unattendedCount++;
      });

      const totalMarkedSessions = presentCount + absentCount + lateCount + leaveCount;
      const attendancePct = totalMarkedSessions > 0
        ? Math.round(((presentCount + lateCount) / totalMarkedSessions) * 100)
        : 100; // default to 100 if never marked to avoid demotivations

      return {
        student,
        presentCount,
        absentCount,
        lateCount,
        leaveCount,
        totalMarkedSessions,
        attendancePct
      };
    });

    // Calculate class average
    const validStudentStats = studentStats.filter(s => s.totalMarkedSessions > 0);
    const classAvgPercentage = validStudentStats.length > 0
      ? Math.round(validStudentStats.reduce((acc, curr) => acc + curr.attendancePct, 0) / validStudentStats.length)
      : 100;

    return {
      classId,
      year,
      month,
      totalSessions,
      studentStats,
      classAvgPercentage
    };
  },

  // Backup / Restore Utility
  backupData() {
    const backup = {
      classes: this.getClasses(),
      students: this.getStudents(),
      attendance: this.getAttendanceDb(),
      settings: this.getSettings(),
      version: '1.0',
      timestamp: Date.now()
    };
    return JSON.stringify(backup);
  },

  restoreData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.classes && data.students && data.attendance) {
        this._set(this.KEYS.CLASSES, data.classes);
        this._set(this.KEYS.STUDENTS, data.students);
        this.saveAttendanceDb(data.attendance);
        if (data.settings) this._set(this.KEYS.SETTINGS, data.settings);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to restore backup data:', e);
      return false;
    }
  },

  // Reset entire database and initialize empty
  resetDatabase() {
    localStorage.removeItem(this.KEYS.CLASSES);
    localStorage.removeItem(this.KEYS.STUDENTS);
    localStorage.removeItem(this.KEYS.ATTENDANCE);
    localStorage.removeItem(this.KEYS.SETTINGS);
    this.init();
  },

  // --- SEED SAMPLE DATA ---
  seedData() {
    const sampleClasses = [
      { id: 'class_primary', name: 'Class 1 - Primary (A)' },
      { id: 'class_senior', name: 'Class 2 - Senior (B)' }
    ];

    const sampleStudents = [
      // Class Primary
      { id: 's1', name: 'Muhammad Ali', rollNumber: '101', classId: 'class_primary' },
      { id: 's2', name: 'Aisha Siddiqa', rollNumber: '102', classId: 'class_primary' },
      { id: 's3', name: 'Fatima Zahra', rollNumber: '103', classId: 'class_primary' },
      { id: 's4', name: 'Zayd Ibn Harith', rollNumber: '104', classId: 'class_primary' },
      { id: 's5', name: 'Umar Farooq', rollNumber: '105', classId: 'class_primary' },
      
      // Class Senior
      { id: 's6', name: 'Abu Bakr As-Siddiq', rollNumber: '201', classId: 'class_senior' },
      { id: 's7', name: 'Usman Ibn Affan', rollNumber: '202', classId: 'class_senior' },
      { id: 's8', name: 'Ali Ibn Abi Talib', rollNumber: '203', classId: 'class_senior' },
      { id: 's9', name: 'Khadijah Bint Khuwaylid', rollNumber: '204', classId: 'class_senior' },
      { id: 's10', name: 'Bilal Ibn Rabah', rollNumber: '205', classId: 'class_senior' }
    ];

    // Seed past 3 days of attendance to make the dashboard statistics graph/displays instantly awesome!
    const attendanceDb = {};
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const statuses = ['Present', 'Present', 'Present', 'Absent', 'Late', 'Leave']; // biased towards Present

    const today = new Date();
    for (let i = 0; i < 4; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      sampleClasses.forEach(cls => {
        const clsStudents = sampleStudents.filter(s => s.classId === cls.id);
        prayers.forEach(prayer => {
          // Don't mark all prayers for today to let user see "Mark Attendance" actions
          if (i === 0 && (prayer === 'Maghrib' || prayer === 'Isha')) return;

          const key = `${dateStr}_${cls.id}_${prayer}`;
          attendanceDb[key] = {};
          
          clsStudents.forEach((student, index) => {
            // Seed a consistent but slightly randomized distribution of attendance
            const seedIdx = (index + i + prayer.length) % statuses.length;
            attendanceDb[key][student.id] = statuses[seedIdx];
          });
        });
      });
    }

    this._set(this.KEYS.CLASSES, sampleClasses);
    this._set(this.KEYS.STUDENTS, sampleStudents);
    this.saveAttendanceDb(attendanceDb);
    this.saveSettings({
      madrasaName: 'Darul Huda Islamic Madrasa',
      weeklyOff: 'Friday'
    });

    console.log('Sample seed data initialized inside localStorage!');
  }
};

// Initialize on load
StorageService.init();
window.StorageService = StorageService; // Expose globally
