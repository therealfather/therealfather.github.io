document.addEventListener('DOMContentLoaded', () => {

  // TYPEWRITER EFFECT
  const texts = [
    "Online & Ready",
    "Analizand Algoritmi...",
    "Executand Scripturi..."
  ];
  
  let textIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let typingSpeed = 100;
  let pauseEnd = 2500;
  
  const typeTarget = document.getElementById('typewriter');
  
  function type() {
    if(!typeTarget) return;
    const currentText = texts[textIndex];
    
    if (isDeleting) {
      typeTarget.textContent = currentText.substring(0, charIndex - 1);
      charIndex--;
    } else {
      typeTarget.textContent = currentText.substring(0, charIndex + 1);
      charIndex++;
    }
    
    let currentSpeed = isDeleting ? 40 : typingSpeed;
    
    if (!isDeleting && charIndex === currentText.length) {
      currentSpeed = pauseEnd;
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      textIndex++;
      if (textIndex >= texts.length) {
        textIndex = 0;
      }
      currentSpeed = 400; // Pauză înainte să tasteze noul text
    }
    
    setTimeout(type, currentSpeed);
  }
  
  setTimeout(type, 1000);

  // SMOOTH SCROLL (ajustare offset pentru navbar fix)
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const rawTarget = this.getAttribute('href');
      if(rawTarget === '#') return;
      
      const targetElement = document.querySelector(rawTarget);
      if(targetElement) {
        const offset = 100; 
        const yPos = targetElement.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({
          top: yPos,
          behavior: 'smooth'
        });
      }

      // Close mobile menu on click
      const navLinks = document.getElementById('nav-links');
      if (navLinks && navLinks.classList.contains('active')) {
        navLinks.classList.remove('active');
      }
    });
  });

  // MOBILE MENU TOGGLE
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  if(mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      const navLinks = document.getElementById('nav-links');
      if(navLinks) {
        navLinks.classList.toggle('active');
      }
    });
  }

  // RESET FORMULAR DUPĂ CONFIRMARE (Nativ NES)
  const btnClose = document.getElementById('close-dialog-btn');

  // PHP FORM HANDLER
  const missionForm = document.getElementById('mission-form');
  if(missionForm) {
    missionForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // Show loading state
      const submitBtn = missionForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Se trimite...';
      submitBtn.disabled = true;
      
      // Form data
      const formData = new FormData(missionForm);
      
      // Send to PHP
      fetch('https://formspree.io/f/xvzybgzb', {
        method: 'POST',
        body: formData,
        headers: {
        'Accept': 'application/json'
    }
  })
.then(response => response.json())
.then(data => {
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          document.getElementById('dialog-success').showModal();
          missionForm.reset();
        } else {
          alert('Eroare: ' + data.message);
        }
      })
      .catch(error => {
        console.error('Error:', error);
        alert('Eroare la trimitere. Detalii: ' + error.message);
      })
      .finally(() => {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      });
    });
  }

  // TERMINAL BLINKING CURSOR
  const terminal = document.getElementById('terminal-text');
  if(terminal) {
    setInterval(() => {
      const lastP = terminal.lastElementChild;
      if(lastP && lastP.innerHTML) {
        if(lastP.innerHTML.endsWith('_')) {
          lastP.innerHTML = lastP.innerHTML.slice(0, -1) + '&nbsp;';
        } else {
          lastP.innerHTML = lastP.innerHTML.slice(0, -6) + '_';
        }
      }
    }, 500);
  }

  // ACCESSIBILITY: THEME TOGGLE (LIGHT / DARK)
  const themeBtn = document.getElementById('theme-toggle');
  // Grabbing all core NES elements that need the is-dark class swapped
  const toggleTargets = document.querySelectorAll('.nes-container:not(.terminal-graphic), .nes-input, .nes-textarea, .nes-dialog');
  const badgeSpans = document.querySelectorAll('.nav-links .nes-badge span');

  function updateTheme(dark) {
    if(dark) {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
      toggleTargets.forEach(el => el.classList.add('is-dark'));
      
      // badges in dark mode
      badgeSpans.forEach(span => {
        if(span.textContent === 'Start') span.classList.add('is-dark');
      });

      if(themeBtn) themeBtn.textContent = '☀️';
      localStorage.setItem('nes-portfolio-theme', 'dark');
    } else {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
      
      // In light mode, containers and inputs should NOT have is-dark
      toggleTargets.forEach(el => el.classList.remove('is-dark'));
      
      // badges in light mode
      badgeSpans.forEach(span => {
        if(span.classList.contains('is-dark')) span.classList.remove('is-dark');
      });

      if(themeBtn) themeBtn.textContent = '🌑';
      localStorage.setItem('nes-portfolio-theme', 'light');
    }
  }

  // Initialize theme 
  const savedTheme = localStorage.getItem('nes-portfolio-theme');
  // Default to dark if no saved preference
  if (savedTheme === 'light') {
    updateTheme(false);
  } else {
    updateTheme(true);
  }

  if(themeBtn) {
    themeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isDark = document.body.classList.contains('dark-theme');
      updateTheme(!isDark); // toggle
    });
  }

  // MUSIC PLAYER CONTROLS
  const bgMusic = document.getElementById('bg-music');
  const musicToggle = document.getElementById('music-toggle');
  let isMusicPlaying = false;
  let musicInitialized = false;

  // Initialize music volume
  if(bgMusic) {
    bgMusic.volume = 0.2; // Set volume to 60%
    if(musicToggle) musicToggle.textContent = '🔇'; // Show mute when music is playing
  }

  // Force music to start on ANY user interaction
  function startMusicOnInteraction() {
    if (!musicInitialized && bgMusic) {
      bgMusic.play().then(() => {
        isMusicPlaying = true;
        musicInitialized = true;
        if(musicToggle) musicToggle.textContent = '🔇'; // Mute icon when playing
      }).catch(err => {
        console.log('Autoplay blocked:', err);
        if(musicToggle) musicToggle.textContent = '🎵'; // Music icon when stopped
      });
    }
  }

  // Add listeners for first interaction
  document.addEventListener('click', startMusicOnInteraction, { once: true });
  document.addEventListener('keydown', startMusicOnInteraction, { once: true });
  document.addEventListener('wheel', startMusicOnInteraction, { once: true });
  document.addEventListener('scroll', startMusicOnInteraction, { once: true });

  // Music toggle functionality
  if(musicToggle && bgMusic) {
    musicToggle.addEventListener('click', (e) => {
      e.preventDefault();
      
      if(isMusicPlaying) {
        bgMusic.pause();
        musicToggle.textContent = '🎵'; // Music icon when stopped
        isMusicPlaying = false;
      } else {
        bgMusic.play().then(() => {
          musicToggle.textContent = '🔇'; // Mute icon when playing
          isMusicPlaying = true;
          musicInitialized = true;
        }).catch(err => {
          console.log('Music play failed:', err);
        });
      }
    });
  }

  // COOKIE CONSENT & TRACKING
  const cookieBanner = document.getElementById('cookie-banner');
  const btnAcceptCookies = document.getElementById('accept-cookies');
  const btnDeclineCookies = document.getElementById('decline-cookies');

  function loadTrackingScripts() {
    console.log("-> Tracking Scripts Initialized: GTM, Analytics, Google Ads, Meta Pixel.");
    // Aici se pot introduce scripturile propriu-zise (gtag, fbq)
    // ex: window.dataLayer = window.dataLayer || []; ...
  }

  if (cookieBanner && btnAcceptCookies && btnDeclineCookies) {
    const consent = localStorage.getItem('nes-cookie-consent');
    
    if (consent === 'accepted') {
      loadTrackingScripts();
    } else if (!consent) {
      cookieBanner.style.display = 'block'; // Afișăm dacă nu există decizie
    }

    btnAcceptCookies.addEventListener('click', () => {
      localStorage.setItem('nes-cookie-consent', 'accepted');
      cookieBanner.style.display = 'none';
      loadTrackingScripts();
    });

    btnDeclineCookies.addEventListener('click', () => {
      localStorage.setItem('nes-cookie-consent', 'declined');
      cookieBanner.style.display = 'none';
      console.log("-> Tracking Scripts Blocked by user.");
    });
  }

});
