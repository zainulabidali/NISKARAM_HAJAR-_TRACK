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
    
    let text = `🕌 *${settings.madrasaName.toUpperCase()}*\n`;
    text += `📅 *Date:* ${reportData.date}\n`;
    text += `📿 *Prayer:* ${reportData.prayer}\n`;
    text += `👥 *Class:* ${className}\n`;
    text += `───────────────────\n\n`;
    
    text += `📊 *ATTENDANCE SUMMARY:*\n`;
    text += `✅ *Present:* ${reportData.presentCount + reportData.lateCount}\n`;
    text += `❌ *Absent:* ${reportData.absentCount}\n`;
    text += `⚠️ *Late:* ${reportData.lateCount}\n`;
    text += `📝 *Leave:* ${reportData.leaveCount}\n`;
    text += `📈 *Percentage:* ${reportData.attendancePercentage}%\n\n`;
    
    text += `───────────────────\n`;
    if (reportData.absentCount > 0) {
      text += `🚫 *ABSENT STUDENTS (${reportData.absentCount}):*\n`;
      reportData.absentList.forEach((student, index) => {
        text += `${index + 1}. Roll: ${student.rollNumber} - ${student.name}\n`;
      });
    } else {
      text += `🎉 *MASHALLAH! 100% Attendance today!*\n`;
    }
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
    const className = this.getClassName(reportData.classId);

    // Create Canvas & dynamic scaling for high DPI sharp rendering
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Dynamic height calculation based on number of students to make sure it never cuts off
    const rowHeight = 44;
    const headerHeight = 180;
    const summaryHeight = 150;
    const tableHeaderHeight = 50;
    const studentCount = reportData.presentList.length + reportData.absentList.length + reportData.lateList.length + reportData.leaveList.length;
    const students = [
      ...reportData.presentList.map(s => ({ ...s, status: 'Present' })),
      ...reportData.lateList.map(s => ({ ...s, status: 'Late' })),
      ...reportData.leaveList.map(s => ({ ...s, status: 'Leave' })),
      ...reportData.absentList.map(s => ({ ...s, status: 'Absent' }))
    ];
    
    const tableBodyHeight = Math.max(students.length, 1) * rowHeight;
    const footerHeight = 100;
    
    const totalHeight = headerHeight + summaryHeight + tableHeaderHeight + tableBodyHeight + footerHeight;
    const width = 800; // Perfect mobile aspect ratio card width

    // Set high pixel density
    const dpr = 2; // Generate at 2x resolution
    canvas.width = width * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = totalHeight + 'px';
    ctx.scale(dpr, dpr);

    // --- DRAW BACKGROUND ---
    ctx.fillStyle = '#faf8f5'; // Light ivory premium background
    ctx.fillRect(0, 0, width, totalHeight);

    // Gold outer frame border
    ctx.strokeStyle = '#d4af37'; // Antique gold
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, width - 20, totalHeight - 20);

    // Gold inner thin border
    ctx.strokeStyle = '#064e3b'; // Deep emerald
    ctx.lineWidth = 1.5;
    ctx.strokeRect(15, 15, width - 30, totalHeight - 30);

    // --- DRAW GREEN HEADER BLOCK ---
    const headerBgGrad = ctx.createLinearGradient(15, 15, width - 15, 15);
    headerBgGrad.addColorStop(0, '#064e3b'); // Emerald
    headerBgGrad.addColorStop(1, '#0c624b');
    ctx.fillStyle = headerBgGrad;
    ctx.fillRect(16, 16, width - 32, headerHeight - 16);

    // Islamic patterned gold horizontal line underneath the header
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(16, headerHeight - 4, width - 32, 4);

    // Header Texts
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    
    // Madrasa Name
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(settings.madrasaName.toUpperCase(), width / 2, 60);

    // Report Subtitle
    ctx.fillStyle = '#fbbf24'; // Champagne gold
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('DAILY PRAYER ATTENDANCE REPORT', width / 2, 95);

    // Draw metadata row in header (Date, Prayer, Class)
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'normal 15px sans-serif';
    ctx.fillText(`Date: ${reportData.date}   |   Prayer: ${reportData.prayer}   |   Class: ${className}`, width / 2, 135);

    // --- DRAW SUMMARY CARDS PANEL ---
    const summaryY = headerHeight + 20;
    
    // Present Card
    this.drawSummaryBox(ctx, 40, summaryY, 150, 95, 'PRESENT', reportData.presentCount + reportData.lateCount, '#10b981', '#ecfdf5');
    // Absent Card
    this.drawSummaryBox(ctx, 210, summaryY, 150, 95, 'ABSENT', reportData.absentCount, '#ef4444', '#fef2f2');
    // Late/Leave Card
    this.drawSummaryBox(ctx, 380, summaryY, 150, 95, 'LATE/LEAVE', `${reportData.lateCount}/${reportData.leaveCount}`, '#f59e0b', '#fffbeb');
    // Percentage Circle / Card
    this.drawSummaryBox(ctx, 550, summaryY, 210, 95, 'ATTENDANCE %', `${reportData.attendancePercentage}%`, '#064e3b', '#e6f4ea', true);

    // --- DRAW ATTENDANCE TABLE ---
    const tableY = summaryY + 120;
    
    // Table Header Background
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(40, tableY, width - 80, tableHeaderHeight);
    
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('ROLL', 60, tableY + 30);
    ctx.fillText('STUDENT NAME', 140, tableY + 30);
    ctx.textAlign = 'center';
    ctx.fillText('STATUS', width - 100, tableY + 30);

    // Table Body rows
    let currentY = tableY + tableHeaderHeight;
    
    if (students.length === 0) {
      ctx.fillStyle = '#4b5563';
      ctx.font = 'italic 16px sans-serif';
      ctx.fillText('No students registered in this class', width / 2, currentY + 30);
    } else {
      students.forEach((student, idx) => {
        // Alternating row colors
        ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f4f6f5';
        ctx.fillRect(40, currentY, width - 80, rowHeight);

        // Thin horizontal bottom separator
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.strokeRect(40, currentY, width - 80, rowHeight);

        // Roll Number
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(student.rollNumber, 60, currentY + 26);

        // Student Name
        ctx.font = 'normal 15px sans-serif';
        ctx.fillText(student.name, 140, currentY + 26);

        // Status Badge Graphic
        this.drawStatusBadge(ctx, width - 100, currentY + 12, student.status);

        currentY += rowHeight;
      });
    }

    // --- DRAW FOOTER ---
    const footerY = currentY + 20;
    ctx.fillStyle = '#9ca3af';
    ctx.font = 'italic 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Mashallah, verify prayers daily to cultivate beautiful spiritual habits.', width / 2, footerY + 15);
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('🕌 NAMAZ ATTENDANCE MANAGEMENT SYSTEM 🕌', width / 2, footerY + 38);

    // Return canvas as blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  },

  // Helper: Draw single stats card
  drawSummaryBox(ctx, x, y, w, h, label, value, color, bg, isCircular = false) {
    // Card Box
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Small Top border strip color
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 4);

    // Label Text
    ctx.fillStyle = '#4b5563';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + 25);

    // Value Text
    ctx.fillStyle = color;
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(value, x + w / 2, y + 68);
  },

  // Helper: Draw round status badge inside canvas
  drawStatusBadge(ctx, x, y, status) {
    let badgeColor = '#10b981'; // Green
    let textColor = '#ffffff';
    let text = 'P';

    if (status === 'Absent') {
      badgeColor = '#ef4444'; // Red
      text = 'A';
    } else if (status === 'Late') {
      badgeColor = '#f59e0b'; // Gold
      text = 'L';
    } else if (status === 'Leave') {
      badgeColor = '#6b7280'; // Slate Gray
      text = 'LV';
    }

    ctx.save();
    // Rounded chip outline
    ctx.fillStyle = badgeColor;
    ctx.beginPath();
    ctx.arc(x, y + 10, 14, 0, 2 * Math.PI);
    ctx.fill();

    // Badge text character
    ctx.fillStyle = textColor;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 10);
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
