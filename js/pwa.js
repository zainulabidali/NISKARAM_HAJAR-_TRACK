// Register Service Worker in the background
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('PWA: Service Worker registered successfully:', reg.scope))
      .catch((err) => console.error('PWA: Service Worker registration failed:', err));
  });
}

// Global PWA Manager
const PwaManager = {
  deferredPrompt: null,
  statusCallbacks: [],

  // Detect standalone mode
  isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  },

  // Detect iOS devices
  isIOSDevice() {
    return /Macintosh|iPad|iPhone|iPod/.test(navigator.userAgent) && ('ontouchend' in document);
  },

  // Check if native app installation is stashed and ready to trigger
  isInstallable() {
    return !!this.deferredPrompt;
  },

  // Register callback for installation status changes
  onStatusChange(callback) {
    if (typeof callback === 'function') {
      this.statusCallbacks.push(callback);
      // Run immediately for initial status
      callback();
    }
  },

  // Notify all listeners
  notifyStatusChange() {
    this.statusCallbacks.forEach(cb => {
      try {
        cb();
      } catch (err) {
        console.error('PWA Manager Callback Error:', err);
      }
    });
  },

  // Trigger Android/Desktop native browser install flow
  triggerInstall() {
    if (!this.deferredPrompt) {
      console.warn('PWA: No install prompt stashed.');
      return;
    }

    const promptEvent = this.deferredPrompt;
    this.deferredPrompt = null; // Clear prompt after usage
    this.notifyStatusChange();

    promptEvent.prompt();
    promptEvent.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('PWA: User accepted install prompt');
      } else {
        console.log('PWA: User dismissed install prompt');
        // Re-stash to allow triggering again if needed
        this.deferredPrompt = promptEvent;
        this.notifyStatusChange();
      }
    });
  },

  // Manual iOS Instruction Panel management
  showIosInstructions() {
    const iosBanner = document.getElementById('pwa-ios-banner');
    if (iosBanner) {
      iosBanner.classList.add('visible');
    }
  },

  hideIosInstructions() {
    const iosBanner = document.getElementById('pwa-ios-banner');
    if (iosBanner) {
      iosBanner.classList.remove('visible');
    }
  }
};

// Setup PWA listeners when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  const androidBanner = document.getElementById('pwa-android-banner');
  const iosBanner = document.getElementById('pwa-ios-banner');
  
  const btnAndroidInstall = document.getElementById('btn-android-install');
  const btnAndroidClose = document.getElementById('btn-android-close');
  
  const btnIosClose = document.getElementById('btn-ios-close');
  const btnIosGotit = document.getElementById('btn-ios-gotit');

  // Wire up inline banner buttons if they are used manually
  if (btnAndroidInstall) {
    btnAndroidInstall.addEventListener('click', () => {
      PwaManager.triggerInstall();
      if (androidBanner) androidBanner.classList.remove('visible');
    });
  }

  if (btnAndroidClose && androidBanner) {
    btnAndroidClose.addEventListener('click', () => {
      androidBanner.classList.remove('visible');
    });
  }

  if (btnIosClose && iosBanner) {
    btnIosClose.addEventListener('click', () => {
      PwaManager.hideIosInstructions();
    });
  }

  if (btnIosGotit && iosBanner) {
    btnIosGotit.addEventListener('click', () => {
      PwaManager.hideIosInstructions();
    });
  }

  if (iosBanner) {
    iosBanner.addEventListener('click', (e) => {
      if (e.target === iosBanner) {
        PwaManager.hideIosInstructions();
      }
    });
  }

  // Android/Desktop browser beforeinstallprompt handling
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default browser install banner/prompts automatically
    e.preventDefault();
    // Stash the event so it can be triggered manually in Settings
    PwaManager.deferredPrompt = e;
    console.log('PWA: beforeinstallprompt stashed in PwaManager.');
    PwaManager.notifyStatusChange();
  });

  // Monitor network status
  const updateOnlineStatus = () => {
    const isOnline = navigator.onLine;
    const offlineIndicator = document.getElementById('offline-indicator');
    if (offlineIndicator) {
      if (!isOnline) {
        offlineIndicator.classList.add('visible');
        offlineIndicator.innerText = '⚠️ Running Offline Mode';
      } else {
        offlineIndicator.classList.remove('visible');
      }
    }
  };

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus(); // initial check
});

window.addEventListener('appinstalled', (evt) => {
  console.log('PWA: Madrasa Attendance PWA installed successfully');
  PwaManager.deferredPrompt = null;
  PwaManager.notifyStatusChange();
  const androidBanner = document.getElementById('pwa-android-banner');
  if (androidBanner) {
    androidBanner.classList.remove('visible');
  }
});

// Expose to window globally
window.PwaManager = PwaManager;
