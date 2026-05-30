/**
 * App - Main UI orchestrator, router, directory managers, settings, and modal controller.
 */
const App = {
  // Application State
  state: {
    activeView: 'home-view',
    attendance: {
      date: '',
      classId: '',
      prayer: 'Fajr'
    },
    reports: {
      activeTab: 'daily', // 'daily' | 'monthly'
      generatedData: null
    },
    directory: {
      activeTab: 'students', // 'students' | 'classes'
      searchQuery: '',
      classFilter: 'ALL'
    }
  },

  // DOM Elements cache
  nodes: {},

  init() {
    this.cacheDom();
    this.setupDateDefaults();
    this.setupEventListeners();
    this.setupVisualViewportListener();
    this.renderClassDropdowns();
    this.navigateTo('home-view');
    this.loadDashboard();
    
    // Reactive PWA Status Listener
    if (window.PwaManager) {
      window.PwaManager.onStatusChange(() => {
        if (this.state.activeView === 'settings-view') {
          this.renderPwaSettings();
        }
      });
    }
  },

  cacheDom() {
    this.nodes = {
      views: document.querySelectorAll('.app-view'),
      navItems: document.querySelectorAll('.nav-item'),
      viewContainer: document.getElementById('view-container'),
      
      // Headers
      headerMadrasaName: document.getElementById('header-madrasa-name'),
      headerDate: document.getElementById('current-header-date'),
      
      // Dashboard Elements
      dashPct: document.getElementById('dash-pct'),
      dashProgressRing: document.getElementById('dashboard-progress-ring'),
      dashTotalStudents: document.getElementById('dash-total-students'),
      dashPresentCount: document.getElementById('dash-present-count'),
      dashAbsentCount: document.getElementById('dash-absent-count'),
      dashLeaveCount: document.getElementById('dash-leave-count'),
      dashPrayersTracker: document.getElementById('dash-prayers-tracker'),
      
      // Attendance Elements
      attDate: document.getElementById('attendance-date'),
      attClassSelect: document.getElementById('attendance-class-select'),
      attStudentsList: document.getElementById('attendance-students-list'),
      attCountPresent: document.getElementById('att-count-present'),
      attCountAbsent: document.getElementById('att-count-absent'),
      attCountLate: document.getElementById('att-count-late'),
      attCountLeave: document.getElementById('att-count-leave'),
      prayerBadges: document.querySelectorAll('.prayer-badge-btn'),
      autoSaveToast: document.getElementById('auto-save-toast'),
      
      // Reports Elements
      tabDailyReport: document.getElementById('tab-daily-report'),
      tabMonthlyReport: document.getElementById('tab-monthly-report'),
      formDailyFields: document.getElementById('form-daily-report-fields'),
      formMonthlyFields: document.getElementById('form-monthly-report-fields'),
      repDailyDate: document.getElementById('report-daily-date'),
      repDailyClass: document.getElementById('report-daily-class'),
      repMonthlyClass: document.getElementById('report-monthly-class'),
      repMonthlyMonth: document.getElementById('report-monthly-month'),
      repMonthlyYear: document.getElementById('report-monthly-year'),
      btnGenDaily: document.getElementById('btn-generate-daily'),
      btnGenMonthly: document.getElementById('btn-generate-monthly'),
      repResultCard: document.getElementById('report-result-card'),
      repPctBadge: document.getElementById('report-percentage-badge'),
      repVisualTarget: document.getElementById('report-visual-table-target'),
      btnShareImage: document.getElementById('btn-share-image'),

      // Students / Directory Elements
      tabStudentDir: document.getElementById('tab-student-dir'),
      tabClassDir: document.getElementById('tab-class-dir'),
      panelStudentDir: document.getElementById('panel-student-dir'),
      panelClassDir: document.getElementById('panel-class-dir'),
      studentCountTitle: document.getElementById('student-count-title'),
      studentSearchBox: document.getElementById('student-search-box'),
      filterClassDropdown: document.getElementById('filter-class-dropdown'),
      studentsListTarget: document.getElementById('students-list-target'),
      classesListTarget: document.getElementById('classes-list-target'),
      btnAddStudentTrigger: document.getElementById('btn-add-student-trigger'),
      btnAddClassTrigger: document.getElementById('btn-add-class-trigger'),

      // Settings Elements
      settingsMadrasaInput: document.getElementById('settings-madrasa-input'),
      btnSaveSettings: document.getElementById('btn-save-settings'),
      btnExportBackup: document.getElementById('btn-export-backup'),
      importBackupFile: document.getElementById('import-backup-file'),
      btnResetDb: document.getElementById('btn-reset-db'),

      // Modals
      modalClass: document.getElementById('modal-class'),
      modalClassTitle: document.getElementById('modal-class-title'),
      modalClassClose: document.getElementById('modal-class-close'),
      modalClassId: document.getElementById('modal-class-id'),
      modalClassName: document.getElementById('modal-class-name'),
      btnSaveClass: document.getElementById('btn-save-class'),
      
      modalStudent: document.getElementById('modal-student'),
      modalStudentTitle: document.getElementById('modal-student-title'),
      modalStudentClose: document.getElementById('modal-student-close'),
      modalStudentId: document.getElementById('modal-student-id'),
      modalStudentName: document.getElementById('modal-student-name'),
      modalStudentRoll: document.getElementById('modal-student-roll'),
      modalStudentClass: document.getElementById('modal-student-class'),
      btnSaveStudent: document.getElementById('btn-save-student')
    };
  },

  setupDateDefaults() {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    // Set in State
    this.state.attendance.date = dateStr;
    
    // Set in Form inputs
    if (this.nodes.attDate) this.nodes.attDate.value = dateStr;
    if (this.nodes.repDailyDate) this.nodes.repDailyDate.value = dateStr;
    
    // Set Current Month / Year for Monthly Reports
    if (this.nodes.repMonthlyMonth) this.nodes.repMonthlyMonth.value = today.getMonth() + 1;
    if (this.nodes.repMonthlyYear) this.nodes.repMonthlyYear.value = today.getFullYear();
    
    // Format Header Date (e.g. 26 May 2026)
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    this.nodes.headerDate.innerText = today.toLocaleDateString('en-GB', options);
    
    // Load branding
    const settings = window.StorageService.getSettings();
    this.nodes.headerMadrasaName.innerText = settings.madrasaName;
    if (this.nodes.settingsMadrasaInput) this.nodes.settingsMadrasaInput.value = settings.madrasaName;
  },

  setupEventListeners() {
    // --- ROUTER VIEW TOGGLES ---
    this.nodes.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const viewId = item.getAttribute('data-view');
        this.navigateTo(viewId);
      });
    });

    // --- DASHBOARD EVENTS ---
    // Let clicking progress ring jump to Attendance
    if (this.nodes.dashProgressRing) {
      this.nodes.dashProgressRing.addEventListener('click', () => this.navigateTo('attendance-view'));
    }

    // --- ATTENDANCE SELECTORS LISTENERS ---
    if (this.nodes.attDate) {
      this.nodes.attDate.addEventListener('change', (e) => {
        this.state.attendance.date = e.target.value;
        this.loadAttendanceRoster();
      });
    }

    if (this.nodes.attClassSelect) {
      this.nodes.attClassSelect.addEventListener('change', (e) => {
        this.state.attendance.classId = e.target.value;
        this.loadAttendanceRoster();
      });
    }

    // Prayer Badges Selection
    this.nodes.prayerBadges.forEach(btn => {
      btn.addEventListener('click', () => {
        this.nodes.prayerBadges.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.attendance.prayer = btn.getAttribute('data-prayer');
        this.loadAttendanceRoster();
      });
    });

    // --- REPORTS SELECTORS & GENERATION ---
    if (this.nodes.tabDailyReport) {
      this.nodes.tabDailyReport.addEventListener('click', () => {
        this.nodes.tabDailyReport.classList.add('active');
        this.nodes.tabMonthlyReport.classList.remove('active');
        this.nodes.formDailyFields.style.display = 'grid';
        this.nodes.formMonthlyFields.style.display = 'none';
        this.nodes.repResultCard.classList.remove('visible');
        this.state.reports.activeTab = 'daily';
      });
    }

    if (this.nodes.tabMonthlyReport) {
      this.nodes.tabMonthlyReport.addEventListener('click', () => {
        this.nodes.tabMonthlyReport.classList.add('active');
        this.nodes.tabDailyReport.classList.remove('active');
        this.nodes.formMonthlyFields.style.display = 'grid';
        this.nodes.formDailyFields.style.display = 'none';
        this.nodes.repResultCard.classList.remove('visible');
        this.state.reports.activeTab = 'monthly';
      });
    }

    if (this.nodes.btnGenDaily) {
      this.nodes.btnGenDaily.addEventListener('click', () => this.generateDailyReport());
    }

    if (this.nodes.btnGenMonthly) {
      this.nodes.btnGenMonthly.addEventListener('click', () => this.generateMonthlyReport());
    }

    // Share triggers
    if (this.nodes.btnShareImage) {
      this.nodes.btnShareImage.addEventListener('click', () => this.shareReportImage());
    }

    // --- DIRECTORIES TABBED INTERFACES ---
    if (this.nodes.tabStudentDir) {
      this.nodes.tabStudentDir.addEventListener('click', () => {
        this.nodes.tabStudentDir.classList.add('active');
        this.nodes.tabClassDir.classList.remove('active');
        this.nodes.panelStudentDir.style.display = 'block';
        this.nodes.panelClassDir.style.display = 'none';
        this.state.directory.activeTab = 'students';
        this.loadStudentsDirectory();
      });
    }

    if (this.nodes.tabClassDir) {
      this.nodes.tabClassDir.addEventListener('click', () => {
        this.nodes.tabClassDir.classList.add('active');
        this.nodes.tabStudentDir.classList.remove('active');
        this.nodes.panelClassDir.style.display = 'block';
        this.nodes.panelStudentDir.style.display = 'none';
        this.state.directory.activeTab = 'classes';
        this.loadClassesDirectory();
      });
    }

    // Search Box Filter
    if (this.nodes.studentSearchBox) {
      this.nodes.studentSearchBox.addEventListener('input', (e) => {
        this.state.directory.searchQuery = e.target.value.toLowerCase().trim();
        this.loadStudentsDirectory();
      });
    }

    // Class Dropdown Filter
    if (this.nodes.filterClassDropdown) {
      this.nodes.filterClassDropdown.addEventListener('change', (e) => {
        this.state.directory.classFilter = e.target.value;
        this.loadStudentsDirectory();
      });
    }

    // Modal Trigger Buttons
    if (this.nodes.btnAddClassTrigger) {
      this.nodes.btnAddClassTrigger.addEventListener('click', () => this.openClassModal());
    }

    if (this.nodes.btnAddStudentTrigger) {
      this.nodes.btnAddStudentTrigger.addEventListener('click', () => this.openStudentModal());
    }

    // --- MODAL CLOSURES ---
    if (this.nodes.modalClassClose) {
      this.nodes.modalClassClose.addEventListener('click', () => this.closeClassModal());
    }
    if (this.nodes.modalStudentClose) {
      this.nodes.modalStudentClose.addEventListener('click', () => this.closeStudentModal());
    }

    // Modal Save Actions
    if (this.nodes.btnSaveClass) {
      this.nodes.btnSaveClass.addEventListener('click', () => this.saveClassAction());
    }
    if (this.nodes.btnSaveStudent) {
      this.nodes.btnSaveStudent.addEventListener('click', () => this.saveStudentAction());
    }

    // Close Modals on overlay click
    [this.nodes.modalClass, this.nodes.modalStudent].forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            this.closeClassModal();
            this.closeStudentModal();
          }
        });
      }
    });

    // --- SETTINGS VIEW ACTIONS ---
    if (this.nodes.btnSaveSettings) {
      this.nodes.btnSaveSettings.addEventListener('click', () => this.saveSettingsAction());
    }

    if (this.nodes.btnExportBackup) {
      this.nodes.btnExportBackup.addEventListener('click', () => this.exportBackupAction());
    }

    if (this.nodes.importBackupFile) {
      this.nodes.importBackupFile.addEventListener('change', (e) => this.importBackupAction(e));
    }

    if (this.nodes.btnResetDb) {
      this.nodes.btnResetDb.addEventListener('click', () => this.resetDbAction());
    }
  },

  setupVisualViewportListener() {
    const handleViewportChange = () => {
      if (!window.visualViewport) return;
      const height = window.visualViewport.height;
      const offsetTop = window.visualViewport.offsetTop;
      
      // Prevent running if viewport dimensions are not yet ready/loaded
      if (height <= 0) return;
      
      const windowHeight = window.innerHeight;
      const keyboardHeight = Math.max(0, windowHeight - height);
      
      document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
      document.documentElement.style.setProperty('--visual-viewport-offsetTop', `${offsetTop}px`);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
      // Run once immediately to set initial values
      handleViewportChange();
    }

    // Set up auto-scroll listeners for input fields when they are focused
    const setupAutoScroll = () => {
      const inputs = document.querySelectorAll('input[type="text"], input[type="number"], input[type="date"], select, textarea');
      inputs.forEach(input => {
        if (input.dataset.scrollBound) return;
        input.dataset.scrollBound = 'true';
        input.addEventListener('focus', () => {
          setTimeout(() => {
            input.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }, 150);
        });
      });
    };

    // Run setup on load
    setupAutoScroll();

    // Since directory students roster loads dynamically, observe changes or run setup on modal opens
    const originalOpenClassModal = this.openClassModal;
    this.openClassModal = (classId = '') => {
      originalOpenClassModal.call(this, classId);
      setTimeout(setupAutoScroll, 50);
      // Automatically focus first field with a slight delay to ensure keyb triggers
      setTimeout(() => {
        if (this.nodes.modalClassName) this.nodes.modalClassName.focus();
      }, 100);
    };

    const originalOpenStudentModal = this.openStudentModal;
    this.openStudentModal = (studentId = '') => {
      originalOpenStudentModal.call(this, studentId);
      setTimeout(setupAutoScroll, 50);
      // Automatically focus first field with a slight delay to ensure keyb triggers
      setTimeout(() => {
        if (this.nodes.modalStudentName) this.nodes.modalStudentName.focus();
      }, 100);
    };
  },

  // --- RENDERING ROUTINES ---

  // Navigates between screens cleanly with fades
  navigateTo(viewId) {
    this.state.activeView = viewId;
    
    // Toggle active view items in bottom bar
    this.nodes.navItems.forEach(item => {
      if (item.getAttribute('data-view') === viewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Animate out active and transition in new view
    this.nodes.views.forEach(view => {
      if (view.id === viewId) {
        view.classList.add('active');
        view.scrollTop = 0; // reset scroll
      } else {
        view.classList.remove('active');
      }
    });

    // View specific hooks
    if (viewId === 'home-view') {
      this.loadDashboard();
    } else if (viewId === 'attendance-view') {
      this.renderClassDropdowns();
      this.loadAttendanceRoster();
    } else if (viewId === 'reports-view') {
      this.renderClassDropdowns();
    } else if (viewId === 'students-view') {
      this.renderClassDropdowns();
      if (this.state.directory.activeTab === 'students') {
        this.loadStudentsDirectory();
      } else {
        this.loadClassesDirectory();
      }
    } else if (viewId === 'settings-view') {
      this.renderPwaSettings();
    }
  },

  // Setup Class options in selectors dynamically
  renderClassDropdowns() {
    const classes = window.StorageService.getClasses();
    
    // Renders inside Attendance Selection dropdown
    if (this.nodes.attClassSelect) {
      const oldVal = this.nodes.attClassSelect.value;
      this.nodes.attClassSelect.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      if (classes.length > 0) {
        if (classes.some(c => c.id === oldVal)) {
          this.nodes.attClassSelect.value = oldVal;
        }
        this.state.attendance.classId = this.nodes.attClassSelect.value;
      }
    }

    // Reports Daily & Monthly
    if (this.nodes.repDailyClass) {
      this.nodes.repDailyClass.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    if (this.nodes.repMonthlyClass) {
      this.nodes.repMonthlyClass.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    // Directory filter dropdown
    if (this.nodes.filterClassDropdown) {
      this.nodes.filterClassDropdown.innerHTML = '<option value="ALL">Show All Classes</option>' + 
        classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    // Assigning modal dropdown options
    if (this.nodes.modalStudentClass) {
      this.nodes.modalStudentClass.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  },

  // Dynamic PWA status rendering inside Settings
  renderPwaSettings() {
    const target = document.getElementById('pwa-settings-status');
    if (!target) return;

    if (!window.PwaManager) {
      target.innerHTML = `
        <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 600; text-align: center; padding: 6px 0;">
          ⚠️ PWA Manager module failed to load.
        </div>
      `;
      return;
    }

    const isStandalone = window.PwaManager.isStandalone();
    const isIOS = window.PwaManager.isIOSDevice();
    const isInstallable = window.PwaManager.isInstallable();

    let html = '';

    if (isStandalone) {
      html = `
        <div style="display:flex; align-items:center; gap:10px; background: rgba(16, 185, 129, 0.08); padding: 12px; border-radius: 12px; border: 1.5px solid var(--color-present);">
          <div style="font-size: 1.8rem; color: var(--color-present); line-height: 1;">✓</div>
          <div style="display:flex; flex-direction:column; gap:2px;">
            <div style="font-size: 0.9rem; font-weight: 800; color: var(--primary);">Application Installed</div>
            <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; line-height: 1.3;">
              Running successfully in standalone native app window. Offline access is fully enabled.
            </div>
          </div>
        </div>
      `;
    } else if (isInstallable) {
      html = `
        <div style="display:flex; flex-direction:column; gap:10px; background: rgba(6, 78, 59, 0.04); padding: 12px; border-radius: 12px; border: 1.5px solid var(--border-light);">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="font-size: 1.8rem; line-height: 1;">📥</div>
            <div style="display:flex; flex-direction:column; gap:2px;">
              <div style="font-size: 0.9rem; font-weight: 800; color: var(--primary);">Install Application</div>
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; line-height: 1.3;">
                Install this app on your device for quick launching and immersive native interface.
              </div>
            </div>
          </div>
          <button class="btn-primary" id="btn-settings-pwa-install" style="margin-top: 6px; font-weight: 800; border-radius: 10px;">
            Install Now
          </button>
        </div>
      `;
    } else if (isIOS) {
      html = `
        <div style="display:flex; flex-direction:column; gap:10px; background: rgba(212, 175, 55, 0.06); padding: 12px; border-radius: 12px; border: 1.5px solid rgba(212, 175, 55, 0.3);">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="font-size: 1.8rem; line-height: 1;">📱</div>
            <div style="display:flex; flex-direction:column; gap:2px;">
              <div style="font-size: 0.9rem; font-weight: 800; color: var(--primary);">iOS Installation Instructions</div>
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; line-height: 1.3;">
                iOS Safari requires a manual tap to add the application to your mobile home screen.
              </div>
            </div>
          </div>
          <button class="btn-outline" id="btn-settings-pwa-ios" style="margin-top: 6px; font-weight: 800; border-radius: 10px; border-color: var(--secondary); color: var(--primary);">
            View Add to Home Screen Instructions
          </button>
        </div>
      `;
    } else {
      // Fallback
      html = `
        <div style="display:flex; align-items:center; gap:10px; background: rgba(6, 78, 59, 0.02); padding: 12px; border-radius: 12px; border: 1px dashed var(--border-light);">
          <div style="font-size: 1.5rem; line-height: 1;">🌐</div>
          <div style="display:flex; flex-direction:column; gap:2px;">
            <div style="font-size: 0.8rem; font-weight: 800; color: var(--primary);">Perfect Browser Experience</div>
            <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600; line-height: 1.3;">
              This system runs as a fully optimized offline mobile app directly inside your browser. Installation is completely optional.
            </div>
          </div>
        </div>
      `;
    }

    target.innerHTML = html;

    // Bind event listeners
    const installBtn = document.getElementById('btn-settings-pwa-install');
    if (installBtn) {
      installBtn.addEventListener('click', () => {
        window.PwaManager.triggerInstall();
      });
    }

    const iosBtn = document.getElementById('btn-settings-pwa-ios');
    if (iosBtn) {
      iosBtn.addEventListener('click', () => {
        window.PwaManager.showIosInstructions();
      });
    }
  },

  // --- DASHBOARD ROUTINES ---
  loadDashboard() {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const stats = window.StorageService.getDashboardStats(dateStr);
    
    // Set texts
    this.nodes.dashTotalStudents.innerText = stats.totalStudents;
    this.nodes.dashPresentCount.innerText = stats.presentToday;
    this.nodes.dashAbsentCount.innerText = stats.absentToday;
    this.nodes.dashLeaveCount.innerText = stats.leaveToday;
    this.nodes.dashPct.innerText = `${stats.attendancePercentage}%`;

    // Dynamic conic-gradient progress circle setting
    if (this.nodes.dashProgressRing) {
      // Rotate gradient from emerald to white/gray based on percentage
      const pct = stats.attendancePercentage;
      this.nodes.dashProgressRing.style.background = `conic-gradient(var(--primary) ${pct}%, var(--border-light) ${pct}%)`;
    }

    // Dynamic rendering of Today's completed prayers
    const classes = window.StorageService.getClasses();
    const db = window.StorageService.getAttendanceDb();
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    
    let html = '';
    
    if (classes.length === 0) {
      html = '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:10px;">Create a class to get started</div>';
    } else {
      prayers.forEach(prayer => {
        // Check if any class has marked this prayer today
        let classesMarked = 0;
        classes.forEach(c => {
          const key = `${dateStr}_${c.id}_${prayer}`;
          if (db[key] && Object.keys(db[key]).length > 0) {
            classesMarked++;
          }
        });

        const isMarked = classesMarked === classes.length && classes.length > 0;
        const isPartial = classesMarked > 0 && classesMarked < classes.length;
        
        let statusBadge = `<span style="color:var(--text-muted); font-size:0.75rem; font-weight:700;">Unmarked</span>`;
        let iconColor = 'var(--text-muted)';
        
        if (isMarked) {
          statusBadge = `<span style="color:var(--color-present); font-size:0.75rem; font-weight:700; display:flex; align-items:center; gap:4px;">🟢 Completed</span>`;
          iconColor = 'var(--color-present)';
        } else if (isPartial) {
          statusBadge = `<span style="color:var(--color-late); font-size:0.75rem; font-weight:700;">🟡 Partial (${classesMarked}/${classes.length})</span>`;
          iconColor = 'var(--color-late)';
        }

        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 4px; border-bottom:1px solid var(--border-light);">
            <div style="display:flex; align-items:center; gap:8px;">
              <!-- Mini solid circular dot visual -->
              <div style="width:8px; height:8px; border-radius:50%; background-color:${iconColor};"></div>
              <span style="font-size:0.85rem; font-weight:700; color:var(--text-dark);">${prayer}</span>
            </div>
            ${statusBadge}
          </div>
        `;
      });
    }
    
    this.nodes.dashPrayersTracker.innerHTML = html;
  },

  // --- ATTENDANCE SYSTEM CONTROLLER ---
  loadAttendanceRoster() {
    const classId = this.state.attendance.classId;
    const date = this.state.attendance.date;
    const prayer = this.state.attendance.prayer;
    
    if (!classId) {
      this.nodes.attStudentsList.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:30px;">Please create a Class first.</div>';
      return;
    }

    const students = window.StorageService.getStudentsByClass(classId);
    const attendanceMap = window.StorageService.getAttendance(date, classId, prayer);

    // Refresh display counts
    let countP = 0, countA = 0, countL = 0, countLV = 0;
    
    if (students.length === 0) {
      this.nodes.attStudentsList.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:30px;">No students registered in this class yet. Go to the "Students" directory tab to add students.</div>';
      this.updateAttendanceSummaryDisplay(0, 0, 0, 0);
      return;
    }

    let html = '';
    
    students.forEach(student => {
      const activeStatus = attendanceMap[student.id] || '';
      
      if (activeStatus === 'Present') countP++;
      else if (activeStatus === 'Absent') countA++;
      else if (activeStatus === 'Late') countL++;
      else if (activeStatus === 'Leave') countLV++;

      html += `
        <div class="attendance-row-card">
          <div class="student-meta">
            <span class="student-roll">ROLL #${student.rollNumber}</span>
            <span class="student-name">${student.name}</span>
          </div>
          <div class="status-chips-group">
            <button class="status-chip-btn ${activeStatus === 'Present' ? 'active' : ''}" 
                    data-status="Present" 
                    data-student-id="${student.id}" 
                    title="Present">P</button>
            <button class="status-chip-btn ${activeStatus === 'Absent' ? 'active' : ''}" 
                    data-status="Absent" 
                    data-student-id="${student.id}" 
                    title="Absent">A</button>
            <button class="status-chip-btn ${activeStatus === 'Late' ? 'active' : ''}" 
                    data-status="Late" 
                    data-student-id="${student.id}" 
                    title="Late">L</button>
            <button class="status-chip-btn ${activeStatus === 'Leave' ? 'active' : ''}" 
                    data-status="Leave" 
                    data-student-id="${student.id}" 
                    title="On Leave">LV</button>
          </div>
        </div>
      `;
    });

    this.nodes.attStudentsList.innerHTML = html;
    this.updateAttendanceSummaryDisplay(countP, countA, countL, countLV);

    // Bind tap clicks on dynamic status badges buttons
    const buttons = this.nodes.attStudentsList.querySelectorAll('.status-chip-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const studentId = btn.getAttribute('data-student-id');
        const status = btn.getAttribute('data-status');
        this.markStudentAttendance(studentId, status, btn);
      });
    });
  },

  updateAttendanceSummaryDisplay(p, a, l, lv) {
    this.nodes.attCountPresent.innerText = p;
    this.nodes.attCountAbsent.innerText = a;
    this.nodes.attCountLate.innerText = l;
    this.nodes.attCountLeave.innerText = lv;
  },

  // Save student attendance action with butter smooth indicator alerts
  markStudentAttendance(studentId, status, buttonNode) {
    const classId = this.state.attendance.classId;
    const date = this.state.attendance.date;
    const prayer = this.state.attendance.prayer;

    // Toggle button active states visually in UI instantly before storage latency (optimistic UI)
    const siblings = buttonNode.parentNode.querySelectorAll('.status-chip-btn');
    const wasActive = buttonNode.classList.contains('active');
    
    siblings.forEach(s => s.classList.remove('active'));
    
    let finalStatus = status;
    if (wasActive) {
      // Toggle off if tapped again to unmarked state
      finalStatus = ''; 
    } else {
      buttonNode.classList.add('active');
    }

    // Save strictly to local database
    window.StorageService.saveStudentAttendance(date, classId, prayer, studentId, finalStatus);

    // Dynamic floating "Saved" visual pulse toast
    if (this.nodes.autoSaveToast) {
      this.nodes.autoSaveToast.classList.remove('saved-pulse');
      // Trigger browser reflow to reset CSS transition triggers
      void this.nodes.autoSaveToast.offsetWidth; 
      this.nodes.autoSaveToast.classList.add('saved-pulse');
      
      // Auto hide pulse after 1s
      setTimeout(() => {
        this.nodes.autoSaveToast.classList.remove('saved-pulse');
      }, 1000);
    }

    // Recompute local roster stats summary instantly without full table redraw
    const activeButtons = this.nodes.attStudentsList.querySelectorAll('.status-chip-btn.active');
    let p = 0, a = 0, l = 0, lv = 0;
    activeButtons.forEach(ab => {
      const st = ab.getAttribute('data-status');
      if (st === 'Present') p++;
      else if (st === 'Absent') a++;
      else if (st === 'Late') l++;
      else if (st === 'Leave') lv++;
    });
    this.updateAttendanceSummaryDisplay(p, a, l, lv);
  },

  // --- REPORTS MODULE ---
  generateDailyReport() {
    const classId = this.nodes.repDailyClass.value;
    const date = this.nodes.repDailyDate.value;

    if (!classId) {
      alert('Please create a Class first.');
      return;
    }

    const students = window.StorageService.getStudentsByClass(classId);
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

    const attendanceByPrayer = {};
    const prayerStats = {};
    let totalPresentOverall = 0;
    let totalAbsentOverall = 0;
    let totalLateOverall = 0;
    let totalLeaveOverall = 0;

    prayers.forEach(p => {
      const attMap = window.StorageService.getAttendance(date, classId, p);
      attendanceByPrayer[p] = attMap;

      let pCount = 0, aCount = 0, lCount = 0, lvCount = 0;
      students.forEach(s => {
        const status = attMap[s.id] || '';
        if (status === 'Present') { pCount++; totalPresentOverall++; }
        else if (status === 'Absent') { aCount++; totalAbsentOverall++; }
        else if (status === 'Late') { lCount++; totalLateOverall++; }
        else if (status === 'Leave') { lvCount++; totalLeaveOverall++; }
      });

      prayerStats[p] = {
        present: pCount,
        absent: aCount,
        late: lCount,
        leave: lvCount
      };
    });

    const activeMarkedOverall = totalPresentOverall + totalAbsentOverall + totalLateOverall;
    const overallAttendancePercentage = activeMarkedOverall > 0
      ? Math.round(((totalPresentOverall + totalLateOverall) / activeMarkedOverall) * 100)
      : 0;

    const report = {
      classId,
      date,
      totalStudents: students.length,
      totalPresent: totalPresentOverall,
      totalAbsent: totalAbsentOverall,
      totalLate: totalLateOverall,
      totalLeave: totalLeaveOverall,
      overallAttendancePercentage,
      prayerStats,
      attendanceByPrayer
    };

    this.state.reports.generatedData = { type: 'daily', report };

    // Format Badge Text
    this.nodes.repPctBadge.innerText = `${overallAttendancePercentage}% Attendance`;
    this.nodes.repPctBadge.style.color = overallAttendancePercentage > 75 ? 'var(--color-present)' : 'var(--color-absent)';

    // Render Table HTML
    let tableHtml = `
      <div class="table-scroll">
        <table class="report-table">
          <thead>
            <tr>
              <th style="text-align:center;">Roll</th>
              <th>Student Name</th>
              <th style="text-align:center;">Fajr</th>
              <th style="text-align:center;">Dhuhr</th>
              <th style="text-align:center;">Asr</th>
              <th style="text-align:center;">Maghrib</th>
              <th style="text-align:center;">Isha</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (students.length === 0) {
      tableHtml += `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No student attendance marked.</td></tr>`;
    } else {
      students.forEach(student => {
        tableHtml += `
          <tr>
            <td style="text-align:center;"><strong>${student.rollNumber}</strong></td>
            <td style="font-weight:700; color:var(--primary);">${student.name}</td>
        `;
        prayers.forEach(p => {
          const status = attendanceByPrayer[p][student.id] || '';
          let icon = '➖';
          let badgeClass = 'unmarked';
          
          if (status === 'Present') { icon = '✅'; badgeClass = 'present'; }
          else if (status === 'Absent') { icon = '❌'; badgeClass = 'absent'; }
          else if (status === 'Late') { icon = '⚠️'; badgeClass = 'late'; }
          else if (status === 'Leave') { icon = '🟡'; badgeClass = 'leave'; }
          
          tableHtml += `<td style="text-align:center; font-size:1.1rem;">${icon}</td>`;
        });
        tableHtml += `</tr>`;
      });
    }

    tableHtml += `</tbody></table></div>`;

    // Render Prayer Summary and Overall stats inside the target container HTML
    let summaryHtml = `
      <div style="margin-top: 18px; display: grid; grid-template-columns: 1fr; gap: 14px;">
        <!-- Left block: Prayer Summary -->
        <div style="background: rgba(6, 78, 59, 0.03); border: 1px solid var(--border-light); border-radius: 12px; padding: 14px;">
          <h4 style="font-size: 0.85rem; font-weight: 800; color: var(--primary); margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            🕌 Prayer Summary
          </h4>
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.8rem;">
    `;

    prayers.forEach(p => {
      const stats = prayerStats[p];
      summaryHtml += `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); padding-bottom: 6px;">
          <strong style="color: var(--text-dark);">${p}</strong>
          <span style="font-weight: 600; color: var(--text-muted);">
            ✅ ${stats.present}   ❌ ${stats.absent}   ⚠️ ${stats.late}   🟡 ${stats.leave}
          </span>
        </div>
      `;
    });

    summaryHtml += `
          </div>
        </div>

        <!-- Right block: Overall Statistics -->
        <div style="background: rgba(212, 175, 55, 0.03); border: 1px solid var(--border-light); border-radius: 12px; padding: 14px;">
          <h4 style="font-size: 0.85rem; font-weight: 800; color: var(--primary); margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            📊 Overall Daily Stats
          </h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 0.8rem; font-weight: 700; color: var(--text-dark);">
            <div style="border-bottom:1px solid var(--border-light); padding-bottom:4px;">👥 Students: <span style="color:var(--primary); font-weight:800;">${report.totalStudents}</span></div>
            <div style="border-bottom:1px solid var(--border-light); padding-bottom:4px;">✅ Present: <span style="color:var(--color-present); font-weight:800;">${report.totalPresent}</span></div>
            <div style="border-bottom:1px solid var(--border-light); padding-bottom:4px;">❌ Absent: <span style="color:var(--color-absent); font-weight:800;">${report.totalAbsent}</span></div>
            <div style="border-bottom:1px solid var(--border-light); padding-bottom:4px;">⚠️ Late: <span style="color:var(--color-late); font-weight:800;">${report.totalLate}</span></div>
            <div style="border-bottom:1px solid var(--border-light); padding-bottom:4px; grid-column: span 2;">🟡 Leave: <span style="color:var(--color-leave); font-weight:800;">${report.totalLeave}</span></div>
            <div style="grid-column: span 2; font-size: 0.9rem; color: var(--primary); margin-top: 4px;">📈 Overall Attendance: <span style="font-weight:900;">${report.overallAttendancePercentage}%</span></div>
          </div>
        </div>
      </div>
    `;

    // Put everything inside the target container!
    this.nodes.repVisualTarget.innerHTML = tableHtml + summaryHtml;

    // Slide down display card
    this.nodes.repResultCard.classList.add('visible');
    this.nodes.repResultCard.scrollIntoView({ behavior: 'smooth' });
  },

  generateMonthlyReport() {
    const classId = this.nodes.repMonthlyClass.value;
    const month = parseInt(this.nodes.repMonthlyMonth.value);
    const year = parseInt(this.nodes.repMonthlyYear.value);

    if (!classId) {
      alert('Please create a Class first.');
      return;
    }

    const report = window.StorageService.getMonthlyReport(classId, year, month);
    this.state.reports.generatedData = { type: 'monthly', report };

    this.nodes.repPctBadge.innerText = `${report.classAvgPercentage}% Average`;
    this.nodes.repPctBadge.style.color = report.classAvgPercentage > 75 ? 'var(--color-present)' : 'var(--color-absent)';

    let html = `
      <div style="font-size:0.8rem; margin-bottom:12px; display:flex; flex-direction:column; gap:4px;">
        <div><strong>Total Marked Sessions:</strong> ${report.totalSessions} sessions</div>
      </div>
      <div class="table-scroll">
        <table class="report-table">
          <thead>
            <tr>
              <th>Roll</th>
              <th>Student</th>
              <th>Attendances %</th>
              <th>P / L / A / LV</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (report.studentStats.length === 0) {
      html += `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No student records found.</td></tr>`;
    } else {
      report.studentStats.forEach(stat => {
        let pctColor = 'var(--color-present)';
        if (stat.attendancePct < 60) pctColor = 'var(--color-absent)';
        else if (stat.attendancePct < 85) pctColor = 'var(--color-late)';

        html += `
          <tr>
            <td><strong>${stat.student.rollNumber}</strong></td>
            <td>${stat.student.name}</td>
            <td style="color:${pctColor}; font-weight:800;">${stat.attendancePct}%</td>
            <td>${stat.presentCount} / ${stat.lateCount} / ${stat.absentCount} / ${stat.leaveCount}</td>
          </tr>
        `;
      });
    }

    html += `</tbody></table></div>`;
    this.nodes.repVisualTarget.innerHTML = html;

    this.nodes.repResultCard.classList.add('visible');
    this.nodes.repResultCard.scrollIntoView({ behavior: 'smooth' });
  },

  async shareReportImage() {
    const data = this.state.reports.generatedData;
    if (!data) return;

    if (data.type !== 'daily') {
      alert('Image sharing is exclusively optimized for Daily Attendance sheets.');
      return;
    }

    // Set interactive loader inside button
    const originalHtml = this.nodes.btnShareImage.innerHTML;
    this.nodes.btnShareImage.disabled = true;
    this.nodes.btnShareImage.innerText = 'Generating image...';

    try {
      const title = `Daily Attendance Report - Full-Day`;
      
      // Draw dynamically in background canvas & convert to blob PNG
      const blob = await window.ShareService.generateDailyImageReport(data.report);
      
      // Call system share API
      await window.ShareService.shareReport("", blob, title);
    } catch (e) {
      console.error('Image generator share failure:', e);
      alert('Error rendering or saving report card image.');
    } finally {
      this.nodes.btnShareImage.disabled = false;
      this.nodes.btnShareImage.innerHTML = originalHtml;
    }
  },

  // --- DIRECTORY (STUDENTS & CLASSES MODULES) ---
  loadStudentsDirectory() {
    const search = this.state.directory.searchQuery;
    const filterClass = this.state.directory.classFilter;
    const students = window.StorageService.getStudents();
    const classes = window.StorageService.getClasses();

    // Filter students
    const filtered = students.filter(student => {
      const matchSearch = student.name.toLowerCase().includes(search) || student.rollNumber.includes(search);
      const matchClass = filterClass === 'ALL' || student.classId === filterClass;
      return matchSearch && matchClass;
    });

    if (this.nodes.studentCountTitle) {
      this.nodes.studentCountTitle.innerText = `Students (${filtered.length})`;
    }

    let html = '';
    
    if (filtered.length === 0) {
      html = '<div style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:30px;">No students found matching filters.</div>';
    } else {
      filtered.forEach(student => {
        const clsName = classes.find(c => c.id === student.classId)?.name || 'Unknown Class';
        html += `
          <div class="list-item-row">
            <div class="list-item-meta">
              <span style="font-size:0.75rem; font-weight:800; color:var(--secondary);">ROLL #${student.rollNumber} - ${clsName.toUpperCase()}</span>
              <span style="font-weight:700; color:var(--text-dark); font-size:0.95rem;">${student.name}</span>
            </div>
            <div class="list-item-actions">
              <button class="action-btn edit" onclick="window.App.editStudent('${student.id}')" title="Edit Student">
                <!-- Pen Edit Icon -->
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              </button>
              <button class="action-btn delete" onclick="window.App.deleteStudent('${student.id}')" title="Delete Student">
                <!-- Trash Can Icon -->
                <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
              </button>
            </div>
          </div>
        `;
      });
    }

    this.nodes.studentsListTarget.innerHTML = html;
  },

  loadClassesDirectory() {
    const classes = window.StorageService.getClasses();
    const students = window.StorageService.getStudents();

    let html = '';

    if (classes.length === 0) {
      html = '<div style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:30px;">No classes created yet.</div>';
    } else {
      classes.forEach(cls => {
        // Count students in each class dynamically
        const clsStuds = students.filter(s => s.classId === cls.id);
        
        html += `
          <div class="list-item-row">
            <div class="list-item-meta">
              <span style="font-size:0.7rem; font-weight:800; color:var(--secondary); text-transform:uppercase;">MADRASA SECTION</span>
              <span style="font-weight:700; color:var(--text-dark); font-size:0.95rem;">${cls.name}</span>
              <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600; margin-top:2px;">${clsStuds.length} Registered Students</span>
            </div>
            <div class="list-item-actions">
              <button class="action-btn edit" onclick="window.App.editClass('${cls.id}')" title="Edit Class">
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              </button>
              <button class="action-btn delete" onclick="window.App.deleteClass('${cls.id}')" title="Delete Class">
                <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
              </button>
            </div>
          </div>
        `;
      });
    }

    this.nodes.classesListTarget.innerHTML = html;
  },

  // --- MODAL SHEETS ACTIONS ---

  // Classes Modal
  openClassModal(clsId = '') {
    if (clsId) {
      const classes = window.StorageService.getClasses();
      const cls = classes.find(c => c.id === clsId);
      if (cls) {
        this.nodes.modalClassTitle.innerText = 'Edit Class Name';
        this.nodes.modalClassId.value = cls.id;
        this.nodes.modalClassName.value = cls.name;
      }
    } else {
      this.nodes.modalClassTitle.innerText = 'Add New Class';
      this.nodes.modalClassId.value = '';
      this.nodes.modalClassName.value = '';
    }
    this.nodes.modalClass.classList.add('active');
    this.nodes.modalClassName.focus();
  },

  closeClassModal() {
    this.nodes.modalClass.classList.remove('active');
  },

  saveClassAction() {
    const id = this.nodes.modalClassId.value;
    const name = this.nodes.modalClassName.value.trim();

    if (!name) {
      alert('Class name cannot be empty!');
      return;
    }

    window.StorageService.saveClass({ id: id || undefined, name });
    this.closeClassModal();
    this.renderClassDropdowns();
    this.loadClassesDirectory();
  },

  editClass(classId) {
    this.openClassModal(classId);
  },

  deleteClass(classId) {
    const cls = window.StorageService.getClasses().find(c => c.id === classId);
    if (!cls) return;

    if (confirm(`⚠️ WARNING: Deleting "${cls.name}" will CASCADINGLY DELETE all students assigned to this class alongside all their attendance histories. This action is final.\n\nAre you sure you want to proceed?`)) {
      window.StorageService.deleteClass(classId);
      this.renderClassDropdowns();
      this.loadClassesDirectory();
    }
  },

  // Student Modal
  openStudentModal(studentId = '') {
    const classes = window.StorageService.getClasses();
    if (classes.length === 0) {
      alert('Please create at least one Class directory first.');
      return;
    }

    // Set modal drop options
    this.renderClassDropdowns();

    if (studentId) {
      const students = window.StorageService.getStudents();
      const s = students.find(x => x.id === studentId);
      if (s) {
        this.nodes.modalStudentTitle.innerText = 'Edit Student Details';
        this.nodes.modalStudentId.value = s.id;
        this.nodes.modalStudentName.value = s.name;
        this.nodes.modalStudentRoll.value = s.rollNumber;
        this.nodes.modalStudentClass.value = s.classId;
      }
    } else {
      this.nodes.modalStudentTitle.innerText = 'Add Student';
      this.nodes.modalStudentId.value = '';
      this.nodes.modalStudentName.value = '';
      
      // Auto increment roll number guess based on total students count + 1 for high efficiency!
      const totalStuds = window.StorageService.getStudents().length;
      this.nodes.modalStudentRoll.value = totalStuds + 101; 
      
      // Default to filter value if applicable
      if (this.state.directory.classFilter !== 'ALL') {
        this.nodes.modalStudentClass.value = this.state.directory.classFilter;
      }
    }
    
    this.nodes.modalStudent.classList.add('active');
    this.nodes.modalStudentName.focus();
  },

  closeStudentModal() {
    this.nodes.modalStudent.classList.remove('active');
  },

  saveStudentAction() {
    const id = this.nodes.modalStudentId.value;
    const name = this.nodes.modalStudentName.value.trim();
    const roll = this.nodes.modalStudentRoll.value.trim();
    const classId = this.nodes.modalStudentClass.value;

    if (!name || !roll || !classId) {
      alert('All fields are required!');
      return;
    }

    // Check if roll number already exists inside the SAME class to avoid confusion
    const students = window.StorageService.getStudents();
    const rollConflict = students.some(s => s.classId === classId && s.rollNumber === roll && s.id !== id);
    if (rollConflict) {
      alert(`⚠️ Conflict: Roll Number #${roll} already registered inside this class.`);
      return;
    }

    window.StorageService.saveStudent({
      id: id || undefined,
      name,
      rollNumber: roll,
      classId
    });

    this.closeStudentModal();
    this.loadStudentsDirectory();
  },

  editStudent(studentId) {
    this.openStudentModal(studentId);
  },

  deleteStudent(studentId) {
    const s = window.StorageService.getStudents().find(x => x.id === studentId);
    if (!s) return;

    if (confirm(`Are you sure you want to delete student "${s.name}" (Roll: ${s.rollNumber})? This will delete all their past attendance stats.`)) {
      window.StorageService.deleteStudent(studentId);
      this.loadStudentsDirectory();
    }
  },

  // --- SETTINGS CONTROLLERS ---
  saveSettingsAction() {
    const newName = this.nodes.settingsMadrasaInput.value.trim();
    if (!newName) {
      alert('Madrasa branding name cannot be blank!');
      return;
    }
    
    window.StorageService.saveSettings({
      madrasaName: newName
    });

    // Refresh UI components instantly
    this.nodes.headerMadrasaName.innerText = newName;
    alert('Settings configuration saved successfully!');
  },

  exportBackupAction() {
    try {
      const dataStr = window.StorageService.backupData();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      const settings = window.StorageService.getSettings();
      const cleanName = settings.madrasaName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      a.href = url;
      a.download = `backup_${cleanName}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Backup generation failed!');
      console.error(e);
    }
  },

  importBackupAction(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const jsonStr = e.target.result;
      const success = window.StorageService.restoreData(jsonStr);
      if (success) {
        alert('🎉 Database successfully restored! Reloading application states.');
        window.location.reload();
      } else {
        alert('❌ Invalid backup JSON file format.');
      }
    };
    reader.readAsText(file);
  },

  resetDbAction() {
    if (confirm('⚠️ WARNING: You are about to RESET the entire database, clearing all customized classes, students, and attendance sheets.\n\nThis will reinitialize sample classes & students demo data for review.\n\nAre you absolutely sure you want to proceed?')) {
      window.StorageService.resetDatabase();
      alert('Database reset. Seeding template records.');
      window.location.reload();
    }
  }
};

// Initialize App once DOMContentLoaded triggers
document.addEventListener('DOMContentLoaded', () => {
  App.init();
  window.App = App; // Expose globally for inline onclick triggers
});
