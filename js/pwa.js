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

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  
  // Show our custom Install Banner
  const installBanner = document.getElementById('pwa-install-banner');
  if (installBanner) {
    installBanner.classList.add('visible');
  }
});

// Setup PWA event listeners when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('pwa-install-btn');
  const closeBtn = document.getElementById('pwa-install-close');
  const installBanner = document.getElementById('pwa-install-banner');

  if (installBtn) {
    installBtn.addEventListener('click', () => {
      if (!deferredPrompt) return;
      
      // Hide our custom banner
      if (installBanner) installBanner.classList.remove('visible');
      
      // Show the native browser prompt
      deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the PWA install prompt');
        } else {
          console.log('User dismissed the PWA install prompt');
        }
        deferredPrompt = null;
      });
    });
  }

  if (closeBtn && installBanner) {
    closeBtn.addEventListener('click', () => {
      installBanner.classList.remove('visible');
    });
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
  console.log('Madrasa Attendance PWA installed successfully');
  const installBanner = document.getElementById('pwa-install-banner');
  if (installBanner) {
    installBanner.classList.remove('visible');
  }
});
