document.addEventListener('DOMContentLoaded', () => {
  const auditBtn = document.getElementById('audit-btn');
  const urlInput = document.getElementById('url-input');
  const loader = document.getElementById('loader');
  const loaderMsg = document.getElementById('loader-msg');
  const dashboard = document.getElementById('dashboard');
  const progressBar = document.getElementById('progress-bar');
  const actionsArea = document.getElementById('actions-area');
  const pdfBtn = document.getElementById('pdf-btn');

  const cardSeo = document.getElementById('card-seo');
  const cardAeo = document.getElementById('card-aeo');
  const cardGeo = document.getElementById('card-geo');
  const helperSection = document.getElementById('helper-section');

  const seoScoreEl = document.getElementById('seo-score');
  const aeoScoreEl = document.getElementById('aeo-score');
  const geoScoreEl = document.getElementById('geo-score');

  const seoProgress = document.getElementById('seo-progress');
  const aeoProgress = document.getElementById('aeo-progress');
  const geoProgress = document.getElementById('geo-progress');

  const magicList = document.getElementById('magic-ideas-list');

  // Global state for PDF Generation
  let crawledData = [];
  let mainUrl = "";

  // DEBUG: Verifică dacă elementele există
  console.log('DEBUG: Elemente găsite:', {
    auditBtn: !!auditBtn,
    urlInput: !!urlInput,
    loader: !!loader,
    loaderMsg: !!loaderMsg,
    dashboard: !!dashboard,
    progressBar: !!progressBar,
    actionsArea: !!actionsArea,
    pdfBtn: !!pdfBtn
  });

  // DEBUG: Adaug event listener cu verificare
  if (auditBtn) {
    console.log('DEBUG: auditBtn găsit, adăug event listener');
    auditBtn.addEventListener('click', async () => {
      console.log('DEBUG: audit-btn apăsat!');
      let rawUrl = urlInput.value.trim();
      if (!rawUrl) {
        alert("⚠️ EROARE SISTEM: Introdu un link valid (ex: https://site.ro)");
        urlInput.focus();
        return;
      }

      if (!/^https?:\/\//i.test(rawUrl)) {
        rawUrl = 'https://' + rawUrl;
        urlInput.value = rawUrl;
      }

      mainUrl = rawUrl;
      crawledData = [];

      // Hide legend while auditing, scroll to loader
      const legendSection = document.querySelector('.legend-section');
      if (legendSection) legendSection.classList.add('hidden');

      // Reset UI
      dashboard.classList.add('hidden');
      actionsArea.classList.add('hidden');
      loader.classList.remove('hidden');

      // Scroll to the loader smoothly so user sees progress, not bottom of page
      setTimeout(() => loader.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);

      cardSeo.classList.remove('show');
      cardAeo.classList.remove('show');
      cardGeo.classList.remove('show');
      helperSection.classList.remove('show');

      seoScoreEl.innerHTML = '0';
      aeoScoreEl.innerHTML = '0';
      geoScoreEl.innerHTML = '0';
      magicList.innerHTML = '';

      progressBar.value = 5;
      loaderMsg.textContent = "Initializare Crawler. Se verifica domeniul principal...";

      try {
        // Step 1: Initialize Crawl
        const baseResult = await fetchAndParse(mainUrl);
        if (!baseResult || baseResult.status === 'failed') {
          throw new Error("Nu s-a putut accesa site-ul principal. URL invalid sau firewall strict (Cloudflare/Incapsula).");
        }

        progressBar.value = 25;

        // Extract Internal Links from Homepage
        const parser = new DOMParser();
        const doc = parser.parseFromString(baseResult.html, 'text/html');
        const baseHostname = new URL(mainUrl).hostname;

        // Find valid internal links — strict content-only filter
        const NON_CONTENT_PATHS = /\/(downloads?|download|wp-admin|wp-content|wp-includes|wp-json|wp-login\.php|admin|login|logout|register|account|cart|checkout|feed|rss|sitemap|sitemap\.xml|xmlrpc\.php|cdn-cgi|tag\/|author\/|search|\.well-known|cgi-bin)/i;
        const NON_CONTENT_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|avif|css|js|json|xml|pdf|zip|rar|tar|gz|svg|ico|woff|woff2|ttf|eot|mp4|mp3|avi|mov|xlsx|docx|exe|dmg)$/i;

        const allLinks = Array.from(doc.querySelectorAll('a[href]'))
          .map(a => {
            try { return new URL(a.href, mainUrl).href; } catch (e) { return null; }
          })
          .filter(href => {
            if (!href) return false;
            try {
              const u = new URL(href);
              return (
                u.hostname === baseHostname &&           // internal only
                !NON_CONTENT_EXTENSIONS.test(u.pathname) && // no assets
                !NON_CONTENT_PATHS.test(u.pathname) &&  // no admin/download/feed paths
                !u.search.includes('?s=') &&             // no search query pages
                u.hash === ''                            // no anchor-only links
              );
            } catch (e) { return false; }
          });

        // Distinct URLs
        let uniqueLinks = [...new Set(allLinks)];

        // Priority links like about, contact, services if available
        // TWO-TIER DETERMINISTIC SORT: priority first, then alphabetical tiebreaker
        // This ensures the same 24 pages are crawled on every run → consistent scores
        const priorityKeywords = ['despre', 'contact', 'servicii', 'blog', 'about', 'services', 'produse', 'products'];
        uniqueLinks.sort((a, b) => {
          const pathA = new URL(a).pathname.toLowerCase();
          const pathB = new URL(b).pathname.toLowerCase();
          const aPriority = priorityKeywords.some(kw => pathA.includes(kw)) ? 1 : 0;
          const bPriority = priorityKeywords.some(kw => pathB.includes(kw)) ? 1 : 0;
          const diff = bPriority - aPriority;
          if (diff !== 0) return diff;
          return a.localeCompare(b); // stable alphabetical tiebreaker
        });

        // Remove the main url from the queue if it's there
        uniqueLinks = uniqueLinks.filter(l => l.replace(/\/$/, '') !== mainUrl.replace(/\/$/, ''));

        // Take up to 24 more subpages (Max 25 pages crawled total, expanding coverage essentially to whole site)
        const subpagesToCrawl = uniqueLinks.slice(0, 24);

        // Process Homepage Result
        const homeAudit = performHeuristics(doc, mainUrl);
        crawledData.push({
          url: mainUrl,
          type: 'Homepage',
          seo: homeAudit.seoScore,
          aeo: homeAudit.aeoScore,
          geo: homeAudit.geoScore,
          issues: homeAudit.issues
        });

        // Step 2: Crawl subpages asynchronously but controlled
        let completedSubpages = 0;

        if (subpagesToCrawl.length > 0) {
          loaderMsg.textContent = `Avem harta! Se scanează intern ${subpagesToCrawl.length} sub-pagini...`;

          for (let i = 0; i < subpagesToCrawl.length; i++) {
            const subUrl = subpagesToCrawl[i];
            try {
              const subResult = await fetchAndParse(subUrl);
              if (subResult && subResult.status === 'ok') {
                const subDoc = parser.parseFromString(subResult.html, 'text/html');

                // ---- NOINDEX FILTER ----
                // Skip pages that have <meta name="robots" content="noindex">
                // These are invisible to search engines, so we exclude them from audit
                const robotsMeta = subDoc.querySelector('meta[name="robots"], meta[name="ROBOTS"]');
                const robotsContent = robotsMeta ? (robotsMeta.getAttribute('content') || '') : '';
                if (/noindex/i.test(robotsContent)) {
                  loaderMsg.textContent = `Pagina NOINDEX detectata — sarita din audit.`;
                  completedSubpages++;
                  progressBar.value = 25 + Math.floor((completedSubpages / subpagesToCrawl.length) * 65);
                  continue; // Do not audit noindex pages
                }
                // ---- END NOINDEX FILTER ----

                const subAudit = performHeuristics(subDoc, subUrl);
                crawledData.push({
                  url: subUrl,
                  type: 'Sub-page',
                  seo: subAudit.seoScore,
                  aeo: subAudit.aeoScore,
                  geo: subAudit.geoScore,
                  issues: subAudit.issues
                });
              }
            } catch (e) {
              // Silent fail on 404 or blocked pages
            }
            completedSubpages++;
            progressBar.value = 25 + Math.floor((completedSubpages / subpagesToCrawl.length) * 65);
          }
        } else {
          progressBar.value = 90;
        }

        // Step 3: Aggregate Results
        loaderMsg.textContent = "Finalizare... Calculam Metricele Globale";
        const finals = calculateGlobalScore(crawledData);

        setTimeout(() => {
          progressBar.value = 100;
          loader.classList.add('hidden');
          // Restore legend after audit completes
          if (legendSection) legendSection.classList.remove('hidden');
          showDashboard(finals, crawledData);
        }, 500);

      } catch (err) {
        loader.classList.add('hidden');
        // Restore legend on error too
        if (legendSection) legendSection.classList.remove('hidden');
        alert(`⚠️ RAID ESUAT! EROARE:\n${err.message}`);
      }
    });
  } else {
    console.error('DEBUG: audit-btn NU a fost găsit!');
    alert('EROARE: Nu am găsit butonul de scanare! Verifică consola.');
  }

  // Multi-Proxy Strategy for HTML Fetching (Enhanced with more options)
  async function fetchAndParse(targetUrl) {
    let html = null;
    
    const proxies = [
      // Primary: AllOrigins (most reliable)
      `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
      // Secondary: Various CORS proxies
      `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
      `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(targetUrl)}`,
      `https://thingproxy.freeboard.io/fetch/${targetUrl}`,
      `https://yacdn.org/proxy/${targetUrl}`,
      `https://r.jina.ai/http://${targetUrl.replace(/^https?:\/\//, '')}`,
      // Fallback: Direct fetch (might work for some sites)
      targetUrl
    ];

    console.log(`Trying to fetch: ${targetUrl}`);
    
    for (let i = 0; i < proxies.length; i++) {
      try {
        console.log(`Attempting proxy ${i + 1}: ${proxies[i].substring(0, 50)}...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const response = await fetch(proxies[i], { 
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        clearTimeout(timeoutId);
        console.log(`Proxy ${i + 1} status: ${response.status}`);
        
        if (response.ok) {
          let content = '';
          
          if (i === 0) { // AllOrigins returns JSON
            const data = await response.json();
            content = data.contents || '';
          } else if (i === 6) { // Jina AI might need special handling
            content = await response.text();
          } else {
            content = await response.text();
          }
          
          if (content && content.length > 500) {
            console.log(`Success with proxy ${i + 1}, content length: ${content.length}`);
            return { status: 'ok', html: content };
          }
        }
      } catch (e) { 
        console.warn(`Proxy ${i + 1} failed:`, e.message); 
      }
    }

    console.log('All proxies failed for:', targetUrl);
    return { status: 'failed', html: null };
  }

  const h1s = doc.querySelectorAll('h1');
  if (h1s.length === 0) {
    seoScore -= 25;
    issues.push("SEO - Structură critică! Pagina nu are NICIUN element H1.");
  }

  const images = doc.querySelectorAll('img');
  let imagesWithoutAlt = 0;
  images.forEach(img => { if (!img.hasAttribute('alt') || img.getAttribute('alt').trim() === '') imagesWithoutAlt++; });
  if (imagesWithoutAlt > 0) {
    seoScore -= Math.min(imagesWithoutAlt * 3, 20);
    issues.push(`SEO - ${imagesWithoutAlt} imagini fără atributul "alt". (Afectează Google Images)`);
  }

  // AEO (Answer Engine)
  const rawHtml = doc.documentElement.innerHTML;
  if (!rawHtml.includes('application/ld+json')) {
    aeoScore -= 30;
    issues.push("AEO - Fără JSON-LD Schema. Datele structurate sunt vitale pentru Google Voice / Siri.");
  }

  if (doc.querySelectorAll('h2').length === 0) {
    aeoScore -= 20;
    issues.push("AEO - Un singur bloc rigid. Utilizează etichete H2 pentru secțiuni ajutătoare (întrebări/răspunsuri).");
  }

  if (doc.querySelectorAll('ul, ol').length === 0) {
    aeoScore -= 15;
    issues.push("AEO - Formatele tip listă aduc Featured Snippets. Nu folosești liste.");
  }

  // GEO (Generative Engine)
  const paragraphs = doc.querySelectorAll('p, span, li');
  let words = 0;
  paragraphs.forEach(p => words += p.innerText.split(/\s+/).length);

  if (words < 200) {
    geoScore -= 40;
    issues.push(`GEO - Text subțire (${words} cuvinte detectate). Modelele AI LLC caută contexte profunde / articole detaliate.`);
  } else if (words < 500) {
    geoScore -= 15;
  }

  const extLinks = Array.from(doc.querySelectorAll('a[href^="http"]')).filter(a => !a.href.includes(new URL(pageUrl).hostname));
  if (extLinks.length === 0) {
    geoScore -= 20;
    issues.push("GEO - Autoritate slabă. Pentru AI-uri (ex: perplexity), a cita surse externe credibile te validează ca nod informațional bun.");
  }

  // Perfect State
  if (issues.length === 0) {
    issues.push("Toate testele tehnice On-Page au fost trecute perfect.");
  }

  return {
    seoScore: Math.max(0, seoScore),
    aeoScore: Math.max(0, aeoScore),
    geoScore: Math.max(0, geoScore),
    issues
  };
}

// Calculate averages across N crawled pages
function calculateGlobalScore(dataArray) {
  let seoTotal = 0, aeoTotal = 0, geoTotal = 0;
  dataArray.forEach(page => {
    seoTotal += page.seo;
    aeoTotal += page.aeo;
    geoTotal += page.geo;
  });

  const count = dataArray.length;

  return {
    finalSeo: Math.floor(seoTotal / count),
    finalAeo: Math.floor(aeoTotal / count),
    finalGeo: Math.floor(geoTotal / count)
  };
}

function showDashboard(finals, detailsArray) {
  dashboard.classList.remove('hidden');

  setTimeout(() => cardSeo.classList.add('show'), 200);
  setTimeout(() => cardAeo.classList.add('show'), 400);
  setTimeout(() => cardGeo.classList.add('show'), 600);
  setTimeout(() => helperSection.classList.add('show'), 900);

  // Show PDF Button at the very end
  setTimeout(() => actionsArea.classList.remove('hidden'), 1500);

  setTimeout(() => animateValue(seoScoreEl, seoProgress, 0, finals.finalSeo, 2000), 300);
  setTimeout(() => animateValue(aeoScoreEl, aeoProgress, 0, finals.finalAeo, 2000), 500);
  setTimeout(() => animateValue(geoScoreEl, geoProgress, 0, finals.finalGeo, 2000), 700);

  // Pick top 4 total unique issues globally for the UI Chat
  let allIssues = [];
  detailsArray.forEach(page => {
    page.issues.filter(i => !i.includes("trecute")).forEach(issue => allIssues.push(issue));
  });

  // Unique global issues
  let uniqueIssues = [...new Set(allIssues)];

  // Color code ideas for UI
  const formattedIdeas = uniqueIssues.slice(0, 4).map(str => {
    if (str.startsWith("SEO")) return `<span style='color: #e76e55'>[SEO]</span> ${str.replace('SEO - ', '')}`;
    if (str.startsWith("AEO")) return `<span style='color: #209cee'>[AEO]</span> ${str.replace('AEO - ', '')}`;
    if (str.startsWith("GEO")) return `<span style='color: #92cc41'>[GEO]</span> ${str.replace('GEO - ', '')}`;
    return str;
  });

  if (formattedIdeas.length === 0) formattedIdeas.push("<span style='color: #209cee'>[AURA PROTECT]</span> Rețeaua este solidă. Nu au fost găsite fisuri esențiale pe fluxurile scanate.");

  setTimeout(() => {
    formattedIdeas.forEach((idea, index) => {
      setTimeout(() => {
        const li = document.createElement('li');
        li.className = 'idea-item slide-in';
        li.innerHTML = idea;
        magicList.appendChild(li);
      }, index * 900);
    });
  }, 1800);
}

// ... rest of the code remains the same ...

// PDF Generation function (extracted from original pdfBtn listener)
function generatePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let currentY = 20;

  // Helper function to sanitize URLs for filenames
  function sanitizeForPdf(str) {
    return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }

  // Helper function to add text with word wrap
  function addText(text, fontSize = 12, fontStyle = 'normal') {
    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, 130);
    for (let i = 0; i < lines.length; i++) {
      if (currentY > 270) {
        doc.addPage();
        currentY = 20;
      }
      doc.text(lines[i], 40, currentY);
      currentY += fontSize * 0.8;
    }
    return currentY;
  }

  // Titlu si URL
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("CUBIC AUDIT - SEO REPORT", 40, currentY);
  currentY += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text(mainUrl, 40, currentY);
  currentY += 15;

  // Scoruri
  const seoScore = parseInt(seoScoreEl.textContent);
  const aeoScore = parseInt(aeoScoreEl.textContent);
  const geoScore = parseInt(geoScoreEl.textContent);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SCORURI AUDIT", 40, currentY);
  currentY += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`SEO Score: ${seoScore}/100`, 40, currentY);
  currentY += 8;
  doc.text(`AEO Score: ${aeoScore}/100`, 40, currentY);
  currentY += 8;
  doc.text(`GEO Score: ${geoScore}/100`, 40, currentY);
  currentY += 15;

  // Vulnerabilitati pe categorii
  const categories = ['SEO', 'AEO', 'GEO'];
  categories.forEach(cat => {
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`${cat} Vulnerabilities`, 40, currentY);
    currentY += 10;

    const catIssues = crawledData.filter(item => item.category === cat);
    if (catIssues.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.text(" No vulnerabilities found!", 40, currentY);
      currentY += 15;
    } else {
      let rows = [];
      catIssues.forEach(issue => {
        let msg = issue.issue;
        if (msg.includes(" - ")) {
          msg = msg.split(" - ")[1];
        }
        rows.push([cat, msg]);
      });

      doc.autoTable({
        startY: currentY + 10,
        head: [['Categorie', 'Vulnerabilitate Detaliata (Avertisment)']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [60, 60, 60] },
        styles: { font: "helvetica", fontSize: 10, cellPadding: 6 },
        columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold' } }
      });

      currentY = doc.lastAutoTable.finalY + 30;
    }
  });
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  );
  document.head.appendChild(style);

  // PDF Generation function (extracted from original pdfBtn listener)
  function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let currentY = 20;

    // Helper function to sanitize URLs for filenames
    function sanitizeForPdf(str) {
      return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }

    // Helper function to add text with word wrap
    function addText(text, fontSize = 12, fontStyle = 'normal') {
      doc.setFont("helvetica", fontStyle);
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, 130);
      for (let i = 0; i < lines.length; i++) {
        if (currentY > 270) {
          doc.addPage();
          currentY = 20;
        }
        doc.text(lines[i], 40, currentY);
        currentY += fontSize * 0.8;
      }
      return currentY;
    }

    // Titlu si URL
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("CUBIC AUDIT - SEO REPORT", 40, currentY);
    currentY += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.text(mainUrl, 40, currentY);
    currentY += 15;

    // Scoruri
    const seoScore = parseInt(seoScoreEl.textContent);
    const aeoScore = parseInt(aeoScoreEl.textContent);
    const geoScore = parseInt(geoScoreEl.textContent);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("SCORURI AUDIT", 40, currentY);
    currentY += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`SEO Score: ${seoScore}/100`, 40, currentY);
    currentY += 8;
    doc.text(`AEO Score: ${aeoScore}/100`, 40, currentY);
    currentY += 8;
    doc.text(`GEO Score: ${geoScore}/100`, 40, currentY);
    currentY += 15;

    // Vulnerabilitati pe categorii
    const categories = ['SEO', 'AEO', 'GEO'];
    categories.forEach(cat => {
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`${cat} Vulnerabilities`, 40, currentY);
      currentY += 10;

      const catIssues = crawledData.filter(item => item.category === cat);
      if (catIssues.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.text(" No vulnerabilities found!", 40, currentY);
        currentY += 15;
      } else {
        let rows = [];
        catIssues.forEach(issue => {
          let msg = issue.issue;
          if (msg.includes(" - ")) {
            msg = msg.split(" - ")[1];
          }
          rows.push([cat, msg]);
        });

        doc.autoTable({
          startY: currentY + 10,
          head: [['Categorie', 'Vulnerabilitate Detaliata (Avertisment)']],
          body: rows,
          theme: 'grid',
          headStyles: { fillColor: [60, 60, 60] },
          styles: { font: "helvetica", fontSize: 10, cellPadding: 6 },
          columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold' } }
        });

        currentY = doc.lastAutoTable.finalY + 30;
      }
    });

    // Informații despre Agentie la final de document
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("Acest raport contine analize On-Page automatizate ale codului sursa HTML. (Raw Audit Mode)", 40, doc.internal.pageSize.getHeight() - 40);
    doc.text("Recomandam un audit off-page (Backlinks) manual via Google Search Console.", 40, doc.internal.pageSize.getHeight() - 25);

    doc.save("Audit_Crawl_" + sanitizeForPdf(mainUrl).replace('https://', '').replace('http://', '').replace('/', '') + ".pdf");
  }

});
