// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Service Worker registered successfully:', reg.scope))
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}

// Global PWA installation handling
let deferredPrompt;

// Check if app is already running in standalone mode (installed)
const isStandalone = () => {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
};

// Check if installation prompt has been dismissed previously
const isDismissed = () => {
  return localStorage.getItem('pwa_install_dismissed') === 'true';
};

// Detect iOS devices (iPhone, iPad, iPod)
const isIOSDevice = () => {
  return /Macintosh|iPad|iPhone|iPod/.test(navigator.userAgent) && ('ontouchend' in document);
};

// Setup PWA event listeners when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  const androidBanner = document.getElementById('pwa-android-banner');
  const iosBanner = document.getElementById('pwa-ios-banner');
  
  const btnAndroidInstall = document.getElementById('btn-android-install');
  const btnAndroidClose = document.getElementById('btn-android-close');
  
  const btnIosClose = document.getElementById('btn-ios-close');
  const btnIosGotit = document.getElementById('btn-ios-gotit');

  // Helper to hide all banners
  const hideAllBanners = () => {
    if (androidBanner) androidBanner.classList.remove('visible');
    if (iosBanner) iosBanner.classList.remove('visible');
  };

  // Helper to dismiss installer permanently
  const dismissInstaller = () => {
    localStorage.setItem('pwa_install_dismissed', 'true');
    hideAllBanners();
  };

  // If already installed or dismissed, do nothing
  if (isStandalone() || isDismissed()) {
    console.log('PWA: Already running standalone or installation dismissed.');
    return;
  }

  // iOS-specific guidance workflow
  if (isIOSDevice()) {
    console.log('PWA: iOS platform detected, displaying instruction banner.');
    if (iosBanner) {
      iosBanner.classList.add('visible');
    }

    if (btnIosClose) {
      btnIosClose.addEventListener('click', dismissInstaller);
    }
    if (btnIosGotit) {
      btnIosGotit.addEventListener('click', dismissInstaller);
    }
    return; // Stop here, iOS doesn't trigger beforeinstallprompt
  }

  // Android/Desktop browser beforeinstallprompt handling
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default browser install banner/prompts
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    
    // Double check again that user hasn't dismissed or installed during the session
    if (!isStandalone() && !isDismissed()) {
      console.log('PWA: Android/Desktop browser beforeinstallprompt fired. Showing custom banner.');
      if (androidBanner) {
        androidBanner.classList.add('visible');
      }
    }
  });

  if (btnAndroidInstall) {
    btnAndroidInstall.addEventListener('click', () => {
      if (!deferredPrompt) return;
      
      // Hide our custom banner
      hideAllBanners();
      
      // Show the native browser prompt
      deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('PWA: User accepted install prompt');
          localStorage.setItem('pwa_install_dismissed', 'true');
        } else {
          console.log('PWA: User dismissed install prompt');
        }
        deferredPrompt = null;
      });
    });
  }

  if (btnAndroidClose) {
    btnAndroidClose.addEventListener('click', dismissInstaller);
  }

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
  localStorage.setItem('pwa_install_dismissed', 'true');
  const androidBanner = document.getElementById('pwa-android-banner');
  if (androidBanner) {
    androidBanner.classList.remove('visible');
  }
});
