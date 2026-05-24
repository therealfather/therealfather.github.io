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

  // Multi-Proxy Strategy for HTML Fetching
  async function fetchAndParse(targetUrl) {
    const proxies = [
      `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
      `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(targetUrl)}`,
      `https://thingproxy.freeboard.io/fetch/${targetUrl}`,
      `https://yacdn.org/proxy/${targetUrl}`,
      `https://r.jina.ai/http://${targetUrl.replace(/^https?:\/\//, '')}`,
      targetUrl
    ];

    for (let i = 0; i < proxies.length; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(proxies[i], { 
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          let content = '';
          if (i === 0) {
            const data = await response.json();
            content = data.contents || '';
          } else {
            content = await response.text();
          }
          
          if (content && content.length > 500) {
            return { status: 'ok', html: content };
          }
        }
      } catch (e) { 
        console.warn(`Proxy ${i + 1} failed:`, e.message); 
      }
    }
    return { status: 'failed', html: null };
  }

  // --- 1. Audit Heuristics (Applied Per Page) ---
  function performHeuristics(doc, pageUrl) {
    let seoScore = 100;
    let aeoScore = 100;
    let geoScore = 100;
    const issues = [];

    // SEO
    const title = doc.querySelector('title');
    if (!title || title.innerText.trim().length === 0) {
      seoScore -= 25;
      issues.push("SEO - Lipsă completă a etichetei <title>.");
    } else if (title.innerText.length < 15) {
      seoScore -= 10;
      issues.push("SEO - Eticheta <title> e prea scurtă.");
    }

    const metaDesc = doc.querySelector('meta[name="description"]');
    if (!metaDesc || metaDesc.getAttribute('content').trim().length === 0) {
      seoScore -= 20;
      issues.push("SEO - Nu ai descriere Meta.");
    }

    const h1s = doc.querySelectorAll('h1');
    if (h1s.length === 0) {
      seoScore -= 25;
      issues.push("SEO - Structură critică! Niciun element H1.");
    }

    const images = doc.querySelectorAll('img');
    let imagesWithoutAlt = 0;
    images.forEach(img => { if (!img.hasAttribute('alt') || img.getAttribute('alt').trim() === '') imagesWithoutAlt++; });
    if (imagesWithoutAlt > 0) {
      seoScore -= Math.min(imagesWithoutAlt * 3, 20);
      issues.push(`SEO - ${imagesWithoutAlt} imagini fără atributul "alt".`);
    }

    // AEO (Answer Engine)
    const rawHtml = doc.documentElement.innerHTML;
    if (!rawHtml.includes('application/ld+json')) {
      aeoScore -= 30;
      issues.push("AEO - Fără JSON-LD Schema.");
    }

    if (doc.querySelectorAll('h2').length === 0) {
      aeoScore -= 20;
      issues.push("AEO - Utilizează etichete H2 pentru secțiuni.");
    }

    if (doc.querySelectorAll('ul, ol').length === 0) {
      aeoScore -= 15;
      issues.push("AEO - Formatele tip listă aduc Featured Snippets.");
    }

    // GEO (Generative Engine)
    const paragraphs = doc.querySelectorAll('p, span, li');
    let words = 0;
    paragraphs.forEach(p => words += p.innerText.split(/\s+/).length);

    if (words < 200) {
      geoScore -= 40;
      issues.push(`GEO - Text subțire (${words} cuvinte detectate).`);
    } else if (words < 500) {
      geoScore -= 15;
    }

    const extLinks = Array.from(doc.querySelectorAll('a[href^="http"]')).filter(a => !a.href.includes(new URL(pageUrl).hostname));
    if (extLinks.length === 0) {
      geoScore -= 20;
      issues.push("GEO - Autoritate slabă. Citează surse externe.");
    }

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

  // --- 2. Calculate Global Score ---
  function calculateGlobalScore(data) {
    if (data.length === 0) return { finalSeo: 0, finalAeo: 0, finalGeo: 0 };
    
    const totals = data.reduce((acc, page) => ({
      seo: acc.seo + page.seo,
      aeo: acc.aeo + page.aeo,
      geo: acc.geo + page.geo
    }), { seo: 0, aeo: 0, geo: 0 });

    return {
      finalSeo: Math.round(totals.seo / data.length),
      finalAeo: Math.round(totals.aeo / data.length),
      finalGeo: Math.round(totals.geo / data.length)
    };
  }

  // Helper for animated counting
  function animateValue(obj, progressBar, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const val = Math.floor(progress * (end - start) + start);
      obj.innerHTML = val;
      if (progressBar) progressBar.value = val;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }

  // --- 3. Show Dashboard ---
  function showDashboard(finals, crawledData) {
    dashboard.classList.remove('hidden');
    setTimeout(() => cardSeo.classList.add('show'), 200);
    setTimeout(() => cardAeo.classList.add('show'), 400);
    setTimeout(() => cardGeo.classList.add('show'), 600);
    setTimeout(() => helperSection.classList.add('show'), 900);

    setTimeout(() => animateValue(seoScoreEl, seoProgress, 0, finals.finalSeo, 2000), 300);
    setTimeout(() => animateValue(aeoScoreEl, aeoProgress, 0, finals.finalAeo, 2000), 500);
    setTimeout(() => animateValue(geoScoreEl, geoProgress, 0, finals.finalGeo, 2000), 700);

    // Show actions area (PDF + Donate) after scores animation starts
    setTimeout(() => {
      actionsArea.classList.remove('hidden');
      actionsArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 1500);

    magicList.innerHTML = '';
    const allIssues = [...new Set(crawledData.flatMap(page => page.issues))].filter(i => !i.includes("perfect"));
    
    allIssues.slice(0, 4).forEach((idea, index) => {
      setTimeout(() => {
        const li = document.createElement('li');
        li.className = 'idea-item slide-in';
        li.innerHTML = idea;
        magicList.appendChild(li);
      }, (index + 2) * 900);
    });
  }

  // Audit Button Logic
  if (auditBtn) {
    auditBtn.addEventListener('click', async () => {
      let rawUrl = urlInput.value.trim();
      if (!rawUrl) {
        alert("⚠️ EROARE SISTEM: Introdu un link valid.");
        urlInput.focus();
        return;
      }

      if (!/^https?:\/\//i.test(rawUrl)) {
        rawUrl = 'https://' + rawUrl;
        urlInput.value = rawUrl;
      }

      mainUrl = rawUrl;
      crawledData = [];

      const legendSection = document.querySelector('.legend-section');
      if (legendSection) legendSection.classList.add('hidden');

      dashboard.classList.add('hidden');
      actionsArea.classList.add('hidden');
      loader.classList.remove('hidden');
      setTimeout(() => loader.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);

      cardSeo.classList.remove('show');
      cardAeo.classList.remove('show');
      cardGeo.classList.remove('show');
      helperSection.classList.remove('show');
      magicList.innerHTML = '';

      progressBar.value = 5;
      loaderMsg.textContent = "Se verifica domeniul principal...";

      try {
        const baseResult = await fetchAndParse(mainUrl);
        if (!baseResult || baseResult.status === 'failed') {
          throw new Error("Nu s-a putut accesa site-ul principal.");
        }

        progressBar.value = 25;
        const parser = new DOMParser();
        const doc = parser.parseFromString(baseResult.html, 'text/html');
        const baseHostname = new URL(mainUrl).hostname;

        // Find valid internal links
        const NON_CONTENT_PATHS = /\/(wp-admin|wp-content|wp-includes|login|admin|cart|checkout|feed|rss|sitemap|xmlrpc|cgi-bin)/i;
        const NON_CONTENT_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|css|js|json|xml|pdf|zip|svg|ico|woff|woff2|ttf|mp4|mp3|avi|mov)$/i;

        const allLinks = Array.from(doc.querySelectorAll('a[href]'))
          .map(a => {
            try { return new URL(a.href, mainUrl).href; } catch (e) { return null; }
          })
          .filter(href => {
            if (!href) return false;
            try {
              const u = new URL(href);
              return (
                u.hostname === baseHostname &&
                !NON_CONTENT_EXTENSIONS.test(u.pathname) &&
                !NON_CONTENT_PATHS.test(u.pathname) &&
                u.hash === ''
              );
            } catch (e) { return false; }
          });

        let uniqueLinks = [...new Set(allLinks)];
        uniqueLinks = uniqueLinks.filter(l => l.replace(/\/$/, '') !== mainUrl.replace(/\/$/, ''));
        
        // Check for "pro" mode via URL parameter (e.g., ?pro=1)
        const urlParams = new URLSearchParams(window.location.search);
        const isProMode = urlParams.get('pro') === '1' || urlParams.get('limit') === '1000';
        const scanLimit = isProMode ? 1000 : 19; // 19 subpages + homepage = 20 total
        
        const subpagesToCrawl = uniqueLinks.slice(0, scanLimit);

        // Process Homepage
        const homeAudit = performHeuristics(doc, mainUrl);
        crawledData.push({
          url: mainUrl,
          type: 'Homepage',
          seo: homeAudit.seoScore,
          aeo: homeAudit.aeoScore,
          geo: homeAudit.geoScore,
          issues: homeAudit.issues
        });

        // Crawl subpages
        let completedSubpages = 0;
        if (subpagesToCrawl.length > 0) {
          loaderMsg.textContent = `Harta gasita! Se scaneaza ${subpagesToCrawl.length} pagini...`;
          for (const subUrl of subpagesToCrawl) {
            try {
              const subResult = await fetchAndParse(subUrl);
              if (subResult && subResult.status === 'ok') {
                const subDoc = parser.parseFromString(subResult.html, 'text/html');
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
            } catch (e) {}
            completedSubpages++;
            progressBar.value = 25 + Math.floor((completedSubpages / subpagesToCrawl.length) * 65);
          }
        } else {
          progressBar.value = 90;
        }

        loaderMsg.textContent = "Finalizare audit...";
        const finals = calculateGlobalScore(crawledData);

        setTimeout(() => {
          progressBar.value = 100;
          loader.classList.add('hidden');
          if (legendSection) legendSection.classList.remove('hidden');
          showDashboard(finals, crawledData);
        }, 500);

      } catch (err) {
        loader.classList.add('hidden');
        if (legendSection) legendSection.classList.remove('hidden');
        alert(`⚠️ EROARE: ${err.message}`);
      }
    });
  }

  // Diacritics sanitizer
  function sanitizeForPdf(str) {
    if (!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/ă/g, 'a').replace(/Ă/g, 'A')
      .replace(/â/g, 'a').replace(/Â/g, 'A')
      .replace(/î/g, 'i').replace(/Î/g, 'I')
      .replace(/ș/g, 's').replace(/Ș/g, 'S')
      .replace(/ț/g, 't').replace(/Ț/g, 'T');
  }

  // --- PROFESSIONAL jsPDF AutoTable Generation ---
  function generatePDF() {
    if (!window.jspdf || !window.jspdf.jsPDF || crawledData.length === 0) {
      console.error("jsPDF nu este gata sau nu ai date de export");
      return;
    }

    const doc = new window.jspdf.jsPDF('p', 'pt', 'a4');

    // Config Colors
    const primaryBlue = [32, 156, 238];
    const lightGrey = [245, 245, 245];
    const darkText = [50, 50, 50];

    // Page 1: Titlu și Overview
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.text("RAPORT AUDIT - Cubic Audit by Tamas Alex", 40, 60);

    doc.setFontSize(11);
    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.setFont("helvetica", "normal");
    doc.text(`Generat la data: ${new Date().toLocaleDateString()}`, 40, 85);
    doc.text(`Obiectiv Scanat (URL de baza):  ${sanitizeForPdf(mainUrl)}`, 40, 105);
    doc.text(`Total Pagini Parcurse si Analizate: ${crawledData.length} Endpoint-uri`, 40, 125);

    // Bloc EXPLICATIV Piloni (Legendă și Baseline)
    doc.setFillColor(lightGrey[0], lightGrey[1], lightGrey[2]);
    doc.rect(40, 145, doc.internal.pageSize.getWidth() - 80, 150, 'F');

    // Titlu Legendă
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("LEGENDA METRICELOR & IMPORTANTA DE BUSINESS", 55, 165);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    // SEO
    doc.setFont("helvetica", "bold"); doc.text("1. SEO (Search Engine Optimization):", 55, 185);
    doc.setFont("helvetica", "normal"); doc.text("Trafic Organic din Google. Fundamental pentru orice website.", 270, 185);
    // AEO
    doc.setFont("helvetica", "bold"); doc.text("2. AEO (Answer Engine Optimization):", 55, 205);
    doc.setFont("helvetica", "normal"); doc.text("Siri / Alexa / Google Snippets. Vital pentru afaceri locale.", 270, 205);
    // GEO
    doc.setFont("helvetica", "bold"); doc.text("3. GEO (Generative Engine Opt):", 55, 225);
    doc.setFont("helvetica", "normal");
    doc.text("Citat de LLMs (A.I.). Ideal daca publici articole ample.", 270, 225);

    // Baseline
    doc.setFont("helvetica", "bold");
    doc.text("BASELINE (Pragul Minim Acceptat):", 55, 255);
    doc.setFont("helvetica", "normal");
    doc.text("Un scor SUB 50 indica erori critice majore. Un site sanatos atinge o medie minima de 80 puncte.", 55, 275);

    // Summary block (Averages)
    const sums = calculateGlobalScore(crawledData);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Scoruri Agregate (Medie globala tot site-ul)", 40, 330);

    doc.autoTable({
      startY: 345,
      head: [['Pilon', 'Scor (0-100)', 'Status Sanatate']],
      body: [
        ['1. SEO Score', `${sums.finalSeo}/100`, sums.finalSeo >= 80 ? 'EXCELENT' : sums.finalSeo >= 50 ? 'MEDIU / AVERTISMENT' : 'CRITIC / PENALIZARE'],
        ['2. AEO Score', `${sums.finalAeo}/100`, sums.finalAeo >= 80 ? 'EXCELENT' : sums.finalAeo >= 50 ? 'MEDIU / NEOPTIMIZAT' : 'LIPSA STRUCTURA'],
        ['3. GEO Score', `${sums.finalGeo}/100`, sums.finalGeo >= 80 ? 'EXCELENT' : sums.finalGeo >= 50 ? 'CONTINUT SUBTIRE' : 'LIPSA AUTORITATE']
      ],
      theme: 'striped',
      headStyles: { fillColor: primaryBlue, textColor: 255 },
      styles: { font: "helvetica", fontSize: 11, cellPadding: 8 }
    });

    // Page break or continue
    let currentY = doc.lastAutoTable.finalY + 40;

    // Detailed Table per Page Crawled
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Jurnal Detaliat de Scanare (Deep Crawl)", 40, currentY);
    currentY += 20;

    // Loop through the crawled data array
    crawledData.forEach((pageData, index) => {
      // If we are too low on page, create new page
      if (currentY > 700) {
        doc.addPage();
        currentY = 60;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);

      let displayUrl = pageData.url;
      if (displayUrl.length > 70) displayUrl = displayUrl.substring(0, 67) + "...";

      doc.text(`Pag. #${index + 1} [${pageData.type}] - ${displayUrl}`, 40, currentY);
      currentY += 5;

      // Build Rows for the AutoTable
      const rows = [];
      rows.push([{ content: `Metrice => SEO: ${pageData.seo} | AEO: ${pageData.aeo} | GEO: ${pageData.geo}`, colSpan: 2, styles: { fillColor: [230, 230, 230], fontStyle: 'bold' } }]);

      if (pageData.issues.length === 0) {
        rows.push(['STARE', 'Auditul a trecut cu brio. Nicio bresa tehnica On-Page minora.']);
      } else {
        pageData.issues.forEach(issue => {
          const cleanIssue = sanitizeForPdf(issue);
          let cat = "WARN";
          let msg = cleanIssue;
          if (cleanIssue.includes(" - ")) {
            cat = cleanIssue.split(" - ")[0];
            msg = cleanIssue.split(" - ")[1];
          }
          rows.push([cat, msg]);
        });
      }

      doc.autoTable({
        startY: currentY + 10,
        head: [['Categorie', 'Vulnerabilitate Detaliata (Avertisment)']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [60, 60, 60] },
        styles: { font: "helvetica", fontSize: 10, cellPadding: 6 },
        columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold' } }
      });

      currentY = doc.lastAutoTable.finalY + 30; // space for next iteration
    });

    // Informații despre Agentie la final de document
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("Acest raport contine analize On-Page automatizate ale codului sursa HTML. (Raw Audit Mode)", 40, doc.internal.pageSize.getHeight() - 40);
    doc.text("Recomandam un audit off-page (Backlinks) manual via Google Search Console.", 40, doc.internal.pageSize.getHeight() - 25);

    doc.save("Audit_Crawl_" + sanitizeForPdf(mainUrl).replace('https://', '').replace('http://', '').replace('/', '') + ".pdf");
  }

  if (pdfBtn) {
    pdfBtn.addEventListener('click', generatePDF);
  }

});
