/**
 * ShareService - Logic for compiling attendance reports as gorgeous text or high-DPI canvas-generated images
 * and triggering native mobile WhatsApp sharing using the Web Share API.
 */
const ShareService = {
  // Helper: Get Class Name by ID
  getClassName(classId) {
    const classes = window.StorageService.getClasses();
    const cls = classes.find(c => c.id === classId);
    return cls ? cls.name : 'Unknown Class';
  },

  // --- TEXT REPORT FORMATTER ---
  generateDailyTextReport(reportData) {
    const settings = window.StorageService.getSettings();
    const className = this.getClassName(reportData.classId);
    const date = reportData.date;
    const students = window.StorageService.getStudentsByClass(reportData.classId);
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

    let text = `🕌 *${settings.madrasaName.toUpperCase()}*\n`;
    text += `📅 *Date:* ${date}\n`;
    text += `👥 *Class:* ${className}\n`;
    text += `───────────────────\n\n`;

    // 1. Get attendance maps and compute aggregates
    const attendanceByPrayer = {};
    const prayerStats = {};
    let totalStudents = students.length;
    let totalPresentOverall = 0;
    let totalAbsentOverall = 0;
    let totalLateOverall = 0;
    let totalLeaveOverall = 0;

    prayers.forEach(p => {
      const attMap = window.StorageService.getAttendance(date, reportData.classId, p);
      attendanceByPrayer[p] = attMap;

      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let leaveCount = 0;

      students.forEach(s => {
        const status = attMap[s.id] || '';
        if (status === 'Present') {
          presentCount++;
          totalPresentOverall++;
        } else if (status === 'Absent') {
          absentCount++;
          totalAbsentOverall++;
        } else if (status === 'Late') {
          lateCount++;
          totalLateOverall++;
        } else if (status === 'Leave') {
          leaveCount++;
          totalLeaveOverall++;
        }
      });

      prayerStats[p] = {
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        leave: leaveCount
      };
    });

    const activeMarkedOverall = totalPresentOverall + totalAbsentOverall + totalLateOverall;
    const overallAttendancePercentage = activeMarkedOverall > 0
      ? Math.round(((totalPresentOverall + totalLateOverall) / activeMarkedOverall) * 100)
      : 0;

    text += `📋 *DETAILED DAILY ATTENDANCE SHEET:*\n`;
    students.forEach((s, idx) => {
      let rowText = `${idx + 1}. Roll ${s.rollNumber} - ${s.name}: `;
      const rowStatuses = [];
      prayers.forEach(p => {
        const status = attendanceByPrayer[p][s.id] || '';
        let char = '➖';
        if (status === 'Present') char = '✅';
        else if (status === 'Absent') char = '❌';
        else if (status === 'Late') char = '⚠️';
        else if (status === 'Leave') char = '🟡';
        rowStatuses.push(char);
      });
      rowText += rowStatuses.join(' ');
      text += `${rowText}\n`;
    });
    text += `───────────────────\n\n`;

    text += `🕌 *PRAYER SUMMARY:*\n`;
    prayers.forEach(p => {
      const stats = prayerStats[p];
      text += `*${p}:*\n  ✅ Present: ${stats.present}\n  ❌ Absent: ${stats.absent}\n  ⚠️ Late: ${stats.late}\n  🟡 Leave: ${stats.leave}\n`;
    });
    text += `───────────────────\n\n`;

    text += `📊 *OVERALL DAILY STATS:*\n`;
    text += `👥 *Total Students:* ${totalStudents}\n`;
    text += `✅ *Total Present:* ${totalPresentOverall}\n`;
    text += `❌ *Total Absent:* ${totalAbsentOverall}\n`;
    text += `⚠️ *Total Late:* ${totalLateOverall}\n`;
    text += `🟡 *Total Leave:* ${totalLeaveOverall}\n`;
    text += `📈 *Overall Attendance:* ${overallAttendancePercentage}%\n`;
    text += `───────────────────\n`;
    text += `_Generated via Madrasa Namaz App_`;

    return text;
  },

  generateMonthlyTextReport(reportData) {
    const settings = window.StorageService.getSettings();
    const className = this.getClassName(reportData.classId);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = months[reportData.month - 1];

    let text = `🕌 *${settings.madrasaName.toUpperCase()}*\n`;
    text += `📅 *Monthly Report:* ${monthName} ${reportData.year}\n`;
    text += `👥 *Class:* ${className}\n`;
    text += `📊 *Total Sessions:* ${reportData.totalSessions}\n`;
    text += `📈 *Class Average:* ${reportData.classAvgPercentage}%\n`;
    text += `───────────────────\n\n`;
    
    text += `📝 *INDIVIDUAL STUDENT SUMMARY:*\n`;
    reportData.studentStats.forEach((stat, index) => {
      let icon = '🟢';
      if (stat.attendancePct < 60) icon = '🔴';
      else if (stat.attendancePct < 85) icon = '🟡';
      
      text += `${index + 1}. Roll: ${stat.student.rollNumber} - ${stat.student.name} (${stat.attendancePct}%)\n`;
      text += `   [P: ${stat.presentCount}, L: ${stat.lateCount}, A: ${stat.absentCount}, LV: ${stat.leaveCount}]\n`;
    });
    
    text += `───────────────────\n`;
    text += `_Generated via Madrasa Namaz App_`;
    
    return text;
  },

  // --- CANVAS HIGH-RESOLUTION IMAGE GENERATOR ---
  async generateDailyImageReport(reportData) {
    const settings = window.StorageService.getSettings();
    const classId = reportData.classId;
    const date = reportData.date;
    const className = this.getClassName(classId);
    
    // Fetch all students in the class
    const students = window.StorageService.getStudentsByClass(classId);
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

    // Get attendance maps and compute aggregates
    const attendanceByPrayer = {};
    const prayerStats = {};
    let totalStudents = students.length;
    let totalPresentOverall = 0;
    let totalAbsentOverall = 0;
    let totalLateOverall = 0;
    let totalLeaveOverall = 0;

    prayers.forEach(p => {
      const attMap = window.StorageService.getAttendance(date, classId, p);
      attendanceByPrayer[p] = attMap;

      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let leaveCount = 0;

      students.forEach(s => {
        const status = attMap[s.id] || '';
        if (status === 'Present') {
          presentCount++;
          totalPresentOverall++;
        } else if (status === 'Absent') {
          absentCount++;
          totalAbsentOverall++;
        } else if (status === 'Late') {
          lateCount++;
          totalLateOverall++;
        } else if (status === 'Leave') {
          leaveCount++;
          totalLeaveOverall++;
        }
      });

      prayerStats[p] = {
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        leave: leaveCount
      };
    });

    const activeMarkedOverall = totalPresentOverall + totalAbsentOverall + totalLateOverall;
    const overallAttendancePercentage = activeMarkedOverall > 0
      ? Math.round(((totalPresentOverall + totalLateOverall) / activeMarkedOverall) * 100)
      : 0;

    // Create Canvas & dynamic scaling for high DPI sharp rendering
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Dynamic height calculation based on student count
    const width = 800; // Perfect mobile aspect ratio card width
    const rowHeight = 44;
    const headerHeight = 160;
    const tableHeaderHeight = 50;
    const tableBodyHeight = Math.max(students.length, 1) * rowHeight;
    const analyticsHeight = 225;
    const footerHeight = 110;
    
    const totalHeight = headerHeight + tableHeaderHeight + tableBodyHeight + analyticsHeight + footerHeight + 40;

    // Set high pixel density
    const dpr = 2; // Generate at 2x resolution
    canvas.width = width * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = totalHeight + 'px';
    ctx.scale(dpr, dpr);

    // --- DRAW BACKGROUND ---
    ctx.fillStyle = '#ffffff'; // White premium background
    ctx.fillRect(0, 0, width, totalHeight);

    // Green outer frame border
    ctx.strokeStyle = '#064e3b'; // Deep emerald
    ctx.lineWidth = 5;
    ctx.strokeRect(12, 12, width - 24, totalHeight - 24);

    // Gold inner thin border
    ctx.strokeStyle = '#d4af37'; // Antique gold
    ctx.lineWidth = 1.5;
    ctx.strokeRect(18, 18, width - 36, totalHeight - 36);

    // --- DRAW GREEN HEADER BLOCK ---
    const headerWidth = width - 32;
    const headerBgGrad = ctx.createLinearGradient(16, 16, width - 16, 16);
    headerBgGrad.addColorStop(0, '#064e3b'); // Emerald
    headerBgGrad.addColorStop(1, '#0a5c45');
    ctx.fillStyle = headerBgGrad;
    ctx.fillRect(16, 16, headerWidth, headerHeight - 16);

    // Islamic patterned gold horizontal line underneath the header
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(16, headerHeight - 4, headerWidth, 4);

    // Header Texts
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    
    // Madrasa Name
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(settings.madrasaName.toUpperCase(), width / 2, 58);

    // Report Subtitle
    ctx.fillStyle = '#fbbf24'; // Champagne gold
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('DAILY ATTENDANCE REPORT', width / 2, 92);

    // Draw metadata row in header (Date, Class, Student count)
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'normal 14px sans-serif';
    ctx.fillText(`Date: ${date}    |    Class: ${className}    |    Students: ${totalStudents}`, width / 2, 126);

    // --- DRAW ATTENDANCE TABLE ---
    const tableY = headerHeight + 20;
    
    // Table Header Background
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(40, tableY, 720, tableHeaderHeight);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    
    ctx.textAlign = 'center';
    ctx.fillText('ROLL', 75, tableY + 30);
    
    ctx.textAlign = 'left';
    ctx.fillText('STUDENT NAME', 120, tableY + 30);
    
    ctx.textAlign = 'center';
    ctx.fillText('FAJR', 380, tableY + 30);
    ctx.fillText('DHUHR', 465, tableY + 30);
    ctx.fillText('ASR', 550, tableY + 30);
    ctx.fillText('MAGHRIB', 635, tableY + 30);
    ctx.fillText('ISHA', 720, tableY + 30);

    // Table Body rows
    let currentY = tableY + tableHeaderHeight;
    
    if (students.length === 0) {
      ctx.fillStyle = '#4b5563';
      ctx.font = 'italic 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No students registered in this class', width / 2, currentY + 30);
      currentY += rowHeight;
    } else {
      students.forEach((student, idx) => {
        // Alternating row colors
        ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f7f9f8';
        ctx.fillRect(40, currentY, 720, rowHeight);

        // Thin horizontal bottom separator
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.strokeRect(40, currentY, 720, rowHeight);

        // Vertical separators between cells
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 0.5;
        const separators = [110, 340, 422, 507, 592, 677];
        separators.forEach(sepX => {
          ctx.beginPath();
          ctx.moveTo(sepX, currentY);
          ctx.lineTo(sepX, currentY + rowHeight);
          ctx.stroke();
        });

        // Roll Number
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(student.rollNumber, 75, currentY + 27);

        // Student Name
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#064e3b';
        ctx.textAlign = 'left';
        ctx.fillText(student.name, 120, currentY + 27);

        // Status for each prayer
        const prayerCols = [
          { p: 'Fajr', x: 380 },
          { p: 'Dhuhr', x: 465 },
          { p: 'Asr', x: 550 },
          { p: 'Maghrib', x: 635 },
          { p: 'Isha', x: 720 }
        ];

        ctx.font = 'normal 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        prayerCols.forEach(col => {
          const status = attendanceByPrayer[col.p][student.id] || '';
          this.drawTableCellStatus(ctx, col.x, currentY + rowHeight / 2, status);
        });

        ctx.textBaseline = 'alphabetic';

        currentY += rowHeight;
      });
    }

    // --- DRAW ANALYTICS & SUMMARIES ---
    const cardsY = currentY + 25;

    // 1. Left Card: Prayer-wise Summaries (🕌 PRAYER SUMMARY)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(40, cardsY, 340, 185);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, cardsY, 340, 185);

    ctx.fillStyle = '#064e3b';
    ctx.fillRect(40, cardsY, 340, 4);

    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🕌 PRAYER SUMMARY', 55, cardsY + 23);

    let rowY = cardsY + 48;
    const rowGap = 26;
    
    prayers.forEach(p => {
      const stats = prayerStats[p];
      
      // Prayer icon and name
      ctx.fillStyle = '#4b5563';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`🕌 ${p}`, 55, rowY);
      
      // Prayer counts
      ctx.fillStyle = '#111827';
      ctx.font = 'normal 11px sans-serif';
      ctx.fillText(`✅ ${stats.present}   ❌ ${stats.absent}   ⚠️ ${stats.late}   🟡 ${stats.leave}`, 155, rowY);
      
      rowY += rowGap;
    });

    // 2. Right Card: Overall Summaries (📊 OVERALL DAILY STATS)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(420, cardsY, 340, 185);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(420, cardsY, 340, 185);

    ctx.fillStyle = '#d4af37';
    ctx.fillRect(420, cardsY, 340, 4);

    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('📊 OVERALL DAILY STATS', 435, cardsY + 23);

    const statsList = [
      { label: '👥 Total Students', val: `${totalStudents}` },
      { label: '✅ Total Present', val: `${totalPresentOverall}` },
      { label: '❌ Total Absent', val: `${totalAbsentOverall}` },
      { label: '⚠️ Total Late', val: `${totalLateOverall}` },
      { label: '🟡 Total Leave', val: `${totalLeaveOverall}` },
      { label: '📈 Overall Attendance', val: `${overallAttendancePercentage}%` }
    ];

    let statRowY = cardsY + 48;
    const statRowGap = 22;
    
    statsList.forEach(stat => {
      ctx.fillStyle = '#4b5563';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(stat.label, 435, statRowY);
      
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(stat.val, 745, statRowY);
      
      statRowY += statRowGap;
    });

    // --- DRAW FOOTER ---
    const footerY = cardsY + 185 + 25;
    
    // Decorative gold separator line
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(40, footerY - 5, 720, 2);

    ctx.fillStyle = '#4b5563';
    ctx.font = 'italic 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Mashallah, verify prayers daily to cultivate beautiful spiritual habits.', width / 2, footerY + 20);
    
    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('🕌 NAMAZ ATTENDANCE MANAGEMENT SYSTEM 🕌', width / 2, footerY + 45);

    ctx.fillStyle = '#9ca3af';
    ctx.font = 'normal 10px sans-serif';
    ctx.fillText('Generated via Madrasa Namaz App', width / 2, footerY + 68);

    // Return canvas as blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  },

  // Helper: Draw table cell status indicator emoji
  drawTableCellStatus(ctx, x, y, status) {
    let icon = '➖';
    if (status === 'Present') icon = '✅';
    else if (status === 'Absent') icon = '❌';
    else if (status === 'Late') icon = '⚠️';
    else if (status === 'Leave') icon = '🟡';

    ctx.fillStyle = '#111827';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, y);
  },

  // --- WHATSAPP SHARING ENGINE WITH WEB SHARE API ---
  async shareReport(textReport, imageBlob = null, title = 'Prayer Report') {
    // 1. First, check if Web Share API is available with File support
    if (navigator.share) {
      try {
        const shareData = {
          title: title,
          text: textReport
        };

        if (imageBlob) {
          const imageFile = new File([imageBlob], 'namaz_report.png', { type: 'image/png' });
          
          if (navigator.canShare && navigator.canShare({ files: [imageFile] })) {
            shareData.files = [imageFile];
          }
        }

        await navigator.share(shareData);
        return { success: true, method: 'web-share' };
      } catch (err) {
        // User canceled share sheet, do not trigger fallback in that case unless it's a real failure
        if (err.name !== 'AbortError') {
          console.error('Web Share failed, attempting fallback...', err);
        } else {
          return { success: false, method: 'canceled' };
        }
      }
    }

    // 2. FALLBACK 1: If it's an image, download it automatically
    if (imageBlob) {
      const url = URL.createObjectURL(imageBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    // 3. FALLBACK 2: Open WhatsApp directly with text
    const cleanText = encodeURIComponent(textReport);
    
    // Attempt mobile application custom protocol first, fallback to web api
    let whatsappUrl = `https://api.whatsapp.com/send?text=${cleanText}`;
    
    // Open in new tab
    const newTab = window.open(whatsappUrl, '_blank');
    if (newTab) {
      newTab.focus();
    }
    
    return { success: true, method: 'fallback' };
  }
};

window.ShareService = ShareService; // Expose globally
