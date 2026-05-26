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
    let totalPresentOverall = 0;
    let totalMarkedOverall = 0;

    prayers.forEach(p => {
      const attMap = window.StorageService.getAttendance(date, reportData.classId, p);
      attendanceByPrayer[p] = attMap;

      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let leaveCount = 0;

      students.forEach(s => {
        const status = attMap[s.id] || '';
        if (status === 'Present') presentCount++;
        else if (status === 'Absent') absentCount++;
        else if (status === 'Late') lateCount++;
        else if (status === 'Leave') leaveCount++;
      });

      const totalMarked = presentCount + absentCount + lateCount;
      const present = presentCount + lateCount;
      totalPresentOverall += present;
      totalMarkedOverall += totalMarked;

      prayerStats[p] = {
        present: presentCount + lateCount
      };
    });

    const overallAttendancePercentage = totalMarkedOverall > 0
      ? Math.round((totalPresentOverall / totalMarkedOverall) * 100)
      : 0;

    // 2. Evaluate each student
    const evaluatedStudents = students.map(student => {
      let attendedCount = 0;
      let leaveCount = 0;
      let absentCount = 0;

      prayers.forEach(p => {
        const status = attendanceByPrayer[p][student.id] || '';
        if (status === 'Present' || status === 'Late') {
          attendedCount++;
        } else if (status === 'Absent') {
          absentCount++;
        } else if (status === 'Leave') {
          leaveCount++;
        }
      });

      let overallStatus = 'Absent';
      let icon = '❌';
      if (attendedCount === 5) {
        overallStatus = 'Full Present';
        icon = '✅';
      } else if (leaveCount === 5 || (leaveCount > 0 && attendedCount === 0 && absentCount === 0)) {
        overallStatus = 'Leave';
        icon = '🟡';
      } else if (attendedCount > 0 && attendedCount < 5) {
        overallStatus = 'Partial';
        icon = '⚠️';
      } else {
        overallStatus = 'Absent';
        icon = '❌';
      }

      return {
        ...student,
        overallStatus,
        icon
      };
    });

    const totalStudents = students.length;
    const totalPresent = evaluatedStudents.filter(s => s.overallStatus === 'Full Present').length;
    const totalPartial = evaluatedStudents.filter(s => s.overallStatus === 'Partial').length;
    const totalAbsent = evaluatedStudents.filter(s => s.overallStatus === 'Absent').length;
    const totalLeave = evaluatedStudents.filter(s => s.overallStatus === 'Leave').length;

    text += `📋 *DAILY STUDENT ATTENDANCE:*\n`;
    evaluatedStudents.forEach((s, idx) => {
      text += `${idx + 1}. Roll ${s.rollNumber} - ${s.name}: ${s.icon} *${s.overallStatus.toUpperCase()}*\n`;
    });
    text += `───────────────────\n\n`;

    text += `🕌 *PRAYER PRESENT COUNTS:*\n`;
    prayers.forEach(p => {
      text += `*${p}:* ${prayerStats[p].present} present\n`;
    });
    text += `───────────────────\n\n`;

    text += `📊 *DAILY AGGREGATES:*\n`;
    text += `👥 *Total Students:* ${totalStudents}\n`;
    text += `✅ *Total Present (Full):* ${totalPresent}\n`;
    text += `⚠️ *Total Partial:* ${totalPartial}\n`;
    text += `❌ *Total Absent:* ${totalAbsent}\n`;
    text += `🟡 *Total Leave:* ${totalLeave}\n`;
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
    let totalPresentOverall = 0;
    let totalMarkedOverall = 0;

    prayers.forEach(p => {
      const attMap = window.StorageService.getAttendance(date, classId, p);
      attendanceByPrayer[p] = attMap;

      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let leaveCount = 0;

      students.forEach(s => {
        const status = attMap[s.id] || '';
        if (status === 'Present') presentCount++;
        else if (status === 'Absent') absentCount++;
        else if (status === 'Late') lateCount++;
        else if (status === 'Leave') leaveCount++;
      });

      const totalMarked = presentCount + absentCount + lateCount;
      const present = presentCount + lateCount; // late is physically present
      totalPresentOverall += present;
      totalMarkedOverall += totalMarked;

      prayerStats[p] = {
        present: presentCount,
        late: lateCount
      };
    });

    const overallAttendancePercentage = totalMarkedOverall > 0
      ? Math.round((totalPresentOverall / totalMarkedOverall) * 100)
      : 0;

    // Evaluate each student overall status
    const evaluatedStudents = students.map(student => {
      let attendedCount = 0;
      let leaveCount = 0;
      let absentCount = 0;

      prayers.forEach(p => {
        const status = attendanceByPrayer[p][student.id] || '';
        if (status === 'Present' || status === 'Late') {
          attendedCount++;
        } else if (status === 'Absent') {
          absentCount++;
        } else if (status === 'Leave') {
          leaveCount++;
        }
      });

      let overallStatus = 'Absent';
      if (attendedCount === 5) {
        overallStatus = 'Full Present';
      } else if (leaveCount === 5 || (leaveCount > 0 && attendedCount === 0 && absentCount === 0)) {
        overallStatus = 'Leave';
      } else if (attendedCount > 0 && attendedCount < 5) {
        overallStatus = 'Partial';
      } else {
        overallStatus = 'Absent';
      }

      return {
        ...student,
        overallStatus
      };
    });

    const totalStudents = students.length;
    const totalPresent = evaluatedStudents.filter(s => s.overallStatus === 'Full Present').length;
    const totalPartial = evaluatedStudents.filter(s => s.overallStatus === 'Partial').length;
    const totalAbsent = evaluatedStudents.filter(s => s.overallStatus === 'Absent').length;
    const totalLeave = evaluatedStudents.filter(s => s.overallStatus === 'Leave').length;

    // Create Canvas & dynamic scaling for high DPI sharp rendering
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Dynamic height calculation based on student count
    const width = 800; // Perfect mobile aspect ratio card width
    const rowHeight = 44;
    const headerHeight = 160;
    const tableHeaderHeight = 50;
    const tableBodyHeight = Math.max(students.length, 1) * rowHeight;
    const analyticsHeight = 220;
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

    // Draw metadata row in header (Date, Class)
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'normal 14px sans-serif';
    ctx.fillText(`Date: ${date}    |    Class: ${className}`, width / 2, 126);

    // --- DRAW ATTENDANCE TABLE ---
    const tableY = headerHeight + 20;
    
    // Table Header Background
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(40, tableY, 720, tableHeaderHeight);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    
    ctx.textAlign = 'center';
    ctx.fillText('ROLL NO', 90, tableY + 30);
    
    ctx.textAlign = 'left';
    ctx.fillText('STUDENT NAME', 180, tableY + 30);
    
    ctx.textAlign = 'center';
    ctx.fillText('PRAYER OVERALL', 620, tableY + 30);

    // Table Body rows
    let currentY = tableY + tableHeaderHeight;
    
    if (evaluatedStudents.length === 0) {
      ctx.fillStyle = '#4b5563';
      ctx.font = 'italic 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No students registered in this class', width / 2, currentY + 30);
      currentY += rowHeight;
    } else {
      evaluatedStudents.forEach((student, idx) => {
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
        const separators = [140, 500];
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
        ctx.fillText(student.rollNumber, 90, currentY + 27);

        // Student Name
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#064e3b';
        ctx.textAlign = 'left';
        ctx.fillText(student.name, 180, currentY + 27);

        // Overall combined status badge
        this.drawOverallStatusBadge(ctx, 620, currentY + rowHeight / 2, student.overallStatus);

        currentY += rowHeight;
      });
    }

    // --- DRAW ANALYTICS & SUMMARIES ---
    const cardsY = currentY + 25;

    // 1. Left Card: Prayer Present Counts
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(40, cardsY, 340, 180);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, cardsY, 340, 180);

    ctx.fillStyle = '#064e3b';
    ctx.fillRect(40, cardsY, 340, 4);

    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🕌 PRAYER PRESENT SUMMARY', 55, cardsY + 25);

    let rowY = cardsY + 50;
    const rowGap = 24;
    prayers.forEach(p => {
      const stats = prayerStats[p];
      ctx.fillStyle = '#4b5563';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`🕌 ${p}`, 55, rowY);
      
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${stats.present + stats.late} present`, 365, rowY);
      
      rowY += rowGap;
    });

    // 2. Right Card: Daily Status Aggregates
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(420, cardsY, 340, 180);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(420, cardsY, 340, 180);

    ctx.fillStyle = '#d4af37';
    ctx.fillRect(420, cardsY, 340, 4);

    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('📊 DAILY STATUS AGGREGATES', 435, cardsY + 25);

    const statsList = [
      { label: '👥 Total Students', val: `${totalStudents}` },
      { label: '✅ Total Present (Full)', val: `${totalPresent}` },
      { label: '⚠️ Total Partial Attended', val: `${totalPartial}` },
      { label: '❌ Total Absent', val: `${totalAbsent}` },
      { label: '🟡 Total Leave', val: `${totalLeave}` },
      { label: '📈 Overall Attendance %', val: `${overallAttendancePercentage}%` }
    ];

    let statRowY = cardsY + 50;
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
    const footerY = cardsY + 180 + 25;
    
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

  // Helper: Draw rounded overall status badge
  drawOverallStatusBadge(ctx, x, y, status) {
    let text = 'Absent';
    let color = '#ef4444'; // Red
    let bg = '#fef2f2';
    let icon = '❌';

    if (status === 'Full Present') {
      text = 'Full Present';
      color = '#10b981'; // Green
      bg = '#ecfdf5';
      icon = '✅';
    } else if (status === 'Partial') {
      text = 'Partial';
      color = '#f59e0b'; // Gold
      bg = '#fffbeb';
      icon = '⚠️';
    } else if (status === 'Leave') {
      text = 'Leave';
      color = '#6b7280'; // Slate Gray
      bg = '#f3f4f6';
      icon = '🟡';
    }

    ctx.save();
    
    // Draw rounded badge block
    const badgeWidth = 140;
    const badgeHeight = 26;
    const rx = x - badgeWidth / 2;
    const ry = y - badgeHeight / 2;
    
    ctx.fillStyle = bg;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(rx, ry, badgeWidth, badgeHeight, 6);
    } else {
      ctx.rect(rx, ry, badgeWidth, badgeHeight);
    }
    ctx.fill();
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, badgeWidth, badgeHeight);
    
    // Draw emoji icon + Text inside badge
    ctx.fillStyle = color;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${icon} ${text.toUpperCase()}`, x, y);
    
    ctx.restore();
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
