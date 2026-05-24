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
      currentSpeed = 400;
    }
    
    setTimeout(type, currentSpeed);
  }
  
  setTimeout(type, 1000);

  // SMOOTH SCROLL
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

      const navLinks = document.getElementById('nav-links');
      if (navLinks && navLinks.classList.contains('active')) {
        navLinks.classList.remove('active');
      }
    });
  });

  // MOBILE MENU
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  if(mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      const navLinks = document.getElementById('nav-links');
      if(navLinks) {
        navLinks.classList.toggle('active');
      }
    });
  }

  const btnClose = document.getElementById('close-dialog-btn');

  // FORM HANDLER
const missionForm = document.getElementById('mission-form');

if (missionForm) {
  missionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = missionForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    submitBtn.textContent = 'Se trimite...';
    submitBtn.disabled = true;

    try {
      const formData = new FormData(missionForm);

      const res = await fetch('https://formspree.io/f/xvzybgzb', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      // IMPORTANT: Formspree poate returna 200 chiar dacă body nu e JSON
      if (!res.ok) throw new Error('Request failed');

      // SUCCESS UI (NES STYLE)
      const dialog = document.getElementById('dialog-success');

      if (dialog) {
        dialog.innerHTML = `
          <div class="nes-container is-dark with-title" style="padding:20px;">
            <p class="title">SYSTEM</p>
            <p style="color:#00ff99;">✔ Misiune trimisa cu succes!</p>
            <button class="nes-btn is-primary" onclick="this.closest('dialog').close()">OK</button>
          </div>
        `;
        dialog.showModal();
      } else {
        alert('✔ Misiune trimisa cu succes!');
      }

      missionForm.reset();

    } catch (err) {
      console.log('Form error:', err);

      // NU mai afișăm eroare falsă dacă de fapt a mers
      alert('Eroare la trimitere');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}

  // TERMINAL BLINK
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

  // THEME
  const themeBtn = document.getElementById('theme-toggle');
  const toggleTargets = document.querySelectorAll('.nes-container:not(.terminal-graphic), .nes-input, .nes-textarea, .nes-dialog');
  const badgeSpans = document.querySelectorAll('.nav-links .nes-badge span');

  function updateTheme(dark) {
    if(dark) {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
      toggleTargets.forEach(el => el.classList.add('is-dark'));
      badgeSpans.forEach(span => {
        if(span.textContent === 'Start') span.classList.add('is-dark');
      });
      if(themeBtn) themeBtn.textContent = '☀️';
      localStorage.setItem('nes-portfolio-theme', 'dark');
    } else {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
      toggleTargets.forEach(el => el.classList.remove('is-dark'));
      badgeSpans.forEach(span => {
        if(span.classList.contains('is-dark')) span.classList.remove('is-dark');
      });
      if(themeBtn) themeBtn.textContent = '🌑';
      localStorage.setItem('nes-portfolio-theme', 'light');
    }
  }

  const savedTheme = localStorage.getItem('nes-portfolio-theme');
  if (savedTheme === 'light') {
    updateTheme(false);
  } else {
    updateTheme(true);
  }

  if(themeBtn) {
    themeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isDark = document.body.classList.contains('dark-theme');
      updateTheme(!isDark);
    });
  }

  // MUSIC
  const bgMusic = document.getElementById('bg-music');
  const musicToggle = document.getElementById('music-toggle');
  let isMusicPlaying = false;
  let musicInitialized = false;

  if(bgMusic) {
    bgMusic.volume = 0.2;
    if(musicToggle) musicToggle.textContent = '🔇';
  }

  function startMusicOnInteraction() {
    if (!musicInitialized && bgMusic) {
      bgMusic.play().then(() => {
        isMusicPlaying = true;
        musicInitialized = true;
        if(musicToggle) musicToggle.textContent = '🔇';
      }).catch(err => {
        console.log('Autoplay blocked:', err);
        if(musicToggle) musicToggle.textContent = '🎵';
      });
    }
  }

  document.addEventListener('click', startMusicOnInteraction, { once: true });
  document.addEventListener('keydown', startMusicOnInteraction, { once: true });
  document.addEventListener('wheel', startMusicOnInteraction, { once: true });
  document.addEventListener('scroll', startMusicOnInteraction, { once: true });

  if(musicToggle && bgMusic) {
    musicToggle.addEventListener('click', (e) => {
      e.preventDefault();
      
      if(isMusicPlaying) {
        bgMusic.pause();
        musicToggle.textContent = '🎵';
        isMusicPlaying = false;
      } else {
        bgMusic.play().then(() => {
          musicToggle.textContent = '🔇';
          isMusicPlaying = true;
          musicInitialized = true;
        }).catch(err => {
          console.log('Music play failed:', err);
        });
      }
    });
  }

  // COOKIE
  const cookieBanner = document.getElementById('cookie-banner');
  const btnAcceptCookies = document.getElementById('accept-cookies');
  const btnDeclineCookies = document.getElementById('decline-cookies');

  function loadTrackingScripts() {
    console.log("-> Tracking Scripts Initialized");
  }

  if (cookieBanner && btnAcceptCookies && btnDeclineCookies) {
    const consent = localStorage.getItem('nes-cookie-consent');

    if (consent === 'accepted') {
      loadTrackingScripts();
    } else if (!consent) {
      cookieBanner.style.display = 'block';
    }

    btnAcceptCookies.addEventListener('click', () => {
      localStorage.setItem('nes-cookie-consent', 'accepted');
      cookieBanner.style.display = 'none';
      loadTrackingScripts();
    });

    btnDeclineCookies.addEventListener('click', () => {
      localStorage.setItem('nes-cookie-consent', 'declined');
      cookieBanner.style.display = 'none';
    });
  }

});
