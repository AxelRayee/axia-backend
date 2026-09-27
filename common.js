// AxIA — fonctions partagées par toutes les pages (navigation, en-tête de fiche, formats).
(function(){
  const ICONS = {
    link: '<path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    list: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    download: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    home: '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/>',
    plan: '<path d="M3 3h18v18H3z"/><path d="M3 12h8v9M11 3v5M15 12h6"/>',
    hardhat: '<path d="M4 17h16v2H4zM6 17v-3a6 6 0 0 1 12 0v3M10 8V5h4v3"/>'
  };

  function icon(name, cls){
    return `<svg class="${cls || 'icon'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  // Échappe le texte venant des annonces avant de l'insérer dans la page
  function esc(v){
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function currency(n){ return Math.round(n || 0).toLocaleString('fr-FR') + ' €'; }
  function signed(n){ const r = Math.round(n || 0); return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toLocaleString('fr-FR') + ' €'; }
  function pct(n, digits){
    if(n === null || n === undefined || isNaN(n)) return '—';
    return n.toFixed(digits ?? 1).replace('.', ',') + ' %';
  }
  function signedPct(n){
    if(n === null || n === undefined || isNaN(n)) return '—';
    const r = Math.round(n);
    return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r) + ' %';
  }

  function scoreColor(score){
    if(score >= 75) return 'var(--green)';
    if(score >= 55) return 'var(--gold)';
    return 'var(--red)';
  }
  function scoreBg(score){
    if(score >= 75) return 'var(--green-soft)';
    if(score >= 55) return 'var(--gold-soft)';
    return 'var(--red-soft)';
  }

  function ring(score, large){
    const s = Math.max(0, Math.min(100, score || 0));
    const offset = (113.1 * (1 - s / 100)).toFixed(1);
    const w = large ? 3 : 3.5;
    return `<div class="score${large ? ' lg' : ''}" role="img" aria-label="Score AxIA ${s} sur 100">
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="${w}"/>
        <circle cx="22" cy="22" r="18" fill="none" stroke="${scoreColor(s)}" stroke-width="${w}" stroke-dasharray="113.1" stroke-dashoffset="${offset}" stroke-linecap="round" transform="rotate(-90 22 22)"/>
      </svg><span aria-hidden="true">${s}</span></div>`;
  }

  // Barre de comparaison au marché (DVF) — renvoie '' si pas de données secteur
  function marketBlock(entry, opts){
    const f = entry.financials || {}, sec = entry.sector;
    if(!sec || !f.prixM2 || !(sec.max > sec.min)) return '';
    const clamp = v => Math.max(3, Math.min(97, v));
    const posPrice = clamp((f.prixM2 - sec.min) / (sec.max - sec.min) * 100);
    const posAvg = clamp((sec.avg - sec.min) / (sec.max - sec.min) * 100);
    const below = (f.ecartMarche ?? 0) <= 0;
    const color = below ? 'var(--green)' : 'var(--red)';
    const ecart = Math.abs(Math.round(f.ecartMarche ?? 0));
    const phrase = below ? `${ecart} % sous la moyenne des ventes du secteur` : `${ecart} % au-dessus de la moyenne des ventes du secteur`;
    const scale = opts && opts.scale
      ? `<div class="market-scale"><span>${currency(sec.min)}</span><span>moy. ${currency(sec.avg)}</span><span>${currency(sec.max)}</span></div>` : '';
    return `<div>
      <div class="market-head"><span>Prix/m² vs ventes du secteur</span><b>DVF</b></div>
      <div class="market-track"><div class="market-avg" style="left:${posAvg}%"></div><div class="market-pin" style="left:${posPrice}%;background:${color}"></div></div>
      ${scale}
      <div class="market-caption" style="margin-top:6px"><b style="color:${color}">${f.prixM2.toLocaleString('fr-FR')} €/m²</b> · ${phrase}</div>
    </div>`;
  }

  // Complète les champs manquants d'une analyse ancienne avec des valeurs neutres.
  // Ne renvoie null que si l'analyse est vraiment irrécupérable.
  function normalizeEntry(l){
    if(!l || !l.listing || !l.project || !l.financials) return null;
    const p = l.project;
    p.sources = p.sources || {};
    p.tauxAssuranceEmprunteur = p.tauxAssuranceEmprunteur ?? 0.34;
    p.travauxDetail = p.travauxDetail || null;
    p.gestionMensuelle = p.gestionMensuelle ?? 0;
    p.travaux = p.travaux ?? 0;
    p.apport = p.apport ?? 0;
    if(p.taxeFonciereAnnuelle === undefined && p.taxeFonciereMensuel !== undefined){
      p.taxeFonciereAnnuelle = Math.round((p.taxeFonciereMensuel || 0) * 12);
      p.sources.taxeFonciereAnnuelle = p.sources.taxeFonciereAnnuelle || 'manuel';
    }
    if(p.chargesCoproMensuelles === undefined && p.chargesMensuelles !== undefined){
      p.chargesCoproMensuelles = p.chargesMensuelles;
      p.sources.chargesCoproMensuelles = p.sources.chargesCoproMensuelles || 'manuel';
    }
    p.taxeFonciereAnnuelle = p.taxeFonciereAnnuelle ?? null;
    p.chargesCoproMensuelles = p.chargesCoproMensuelles ?? null;
    p.assurancePNO = p.assurancePNO ?? 0;
    const f = l.financials;
    f.assuranceEmprunteurMensuelle = f.assuranceEmprunteurMensuelle || 0;
    f.capitalEmprunte = f.capitalEmprunte ?? f.totalProjet ?? 0;
    return l;
  }

  function missingCount(entry){
    const src = entry.project.sources || {};
    return ['taxeFonciereAnnuelle', 'chargesCoproMensuelles', 'assurancePNO'].filter(k => src[k] === 'manquant').length;
  }

  function title(entry){
    const l = entry.listing;
    return [l.ville, l.quartier].filter(Boolean).join(' — ') || entry.label || 'Bien sans nom';
  }

  // ---------- Navigation ----------
  async function renderNav(active){
    const el = document.getElementById('app-nav') || document.querySelector('.app-nav');
    if(!el) return;
    el.outerHTML = `<nav class="app-nav" aria-label="Navigation principale">
      <div class="left">
        <a class="brand" href="index.html">Ax<span>IA</span></a>
        <div class="nav-links">
          <a href="index.html" class="${active === 'analyses' ? 'active' : ''}" ${active === 'analyses' ? 'aria-current="page"' : ''}>Analyses</a>
          <a href="reglages.html" class="${active === 'reglages' ? 'active' : ''}" ${active === 'reglages' ? 'aria-current="page"' : ''}>Réglages</a>
        </div>
      </div>
      <a class="nav-chip" href="reglages.html" id="navFiscalChip"><span class="dot"></span><span>Profil fiscal</span></a>
    </nav>`;
    try {
      const r = await fetch('/api/profil-fiscal');
      if(r.ok){
        const p = await r.json();
        const chip = document.querySelector('#navFiscalChip span:last-child');
        if(chip && p.tmi !== undefined) chip.textContent = `Profil fiscal · TMI ${p.tmi} %`;
      }
    } catch(e){ /* sans importance : la puce reste générique */ }
  }

  // ---------- En-tête de fiche + onglets ----------
  function renderFicheHeader(entry, activeTab){
    const el = document.getElementById('fiche-header');
    if(!el || !entry) return;
    const l = entry.listing, p = entry.project, f = entry.financials;
    const id = encodeURIComponent(entry.id);
    const img = l.imageUrl ? ` has-img" style="background-image:url('${esc(l.imageUrl)}')` : '';
    const pills = [
      l.type_bien,
      l.surface ? `${l.surface} m²${l.pieces ? ' · ' + l.pieces + ' p.' : ''}` : null,
      l.dpe ? `DPE ${l.dpe}` : null,
      l.imageIsCity ? 'Photo de la ville' : null
    ].filter(Boolean).map(t => `<span class="pill">${esc(t)}</span>`).join('');

    const chantierMeta = p.chantier ? 'Suivi en cours' : 'Non démarré';
    const travauxMeta = p.travaux ? `${currency(p.travaux)} prévus` : 'Non chiffrés';
    const tabs = [
      { key: 'analyse', label: 'Analyse', meta: 'Rentabilité et marché', href: `fiche.html?id=${id}` },
      { key: 'travaux', label: 'Travaux', meta: travauxMeta, href: `travaux.html?id=${id}` },
      { key: 'chantier', label: 'Chantier', meta: chantierMeta, href: `suivi-chantier.html?id=${id}` },
      { key: 'fiscalite', label: 'Fiscalité', meta: '4 régimes comparés', href: `fiscalite.html?id=${id}` }
    ].map(t => `<a class="tab" href="${t.href}" ${t.key === activeTab ? 'aria-current="page"' : ''}><span class="t">${t.label}</span><span class="m">${esc(t.meta)}</span></a>`).join('');

    el.innerHTML = `
      <a class="back-link" href="index.html">${icon('back')}Toutes les analyses</a>
      <section class="fiche-head">
        <div class="fiche-photo${img}"><span class="ph">${icon('home', 'icon-lg')}</span><span class="ph">Photo de l'annonce</span></div>
        <div class="fiche-info">
          <div class="fiche-top">
            <div>
              <div class="pills">${pills}</div>
              <h1 class="page-title">${esc(title(entry))}</h1>
              <div class="fiche-price">${currency(l.prix)}</div>
            </div>
            <div class="fiche-score">${ring(f.score, true)}<span>Score AxIA</span></div>
          </div>
          <div class="fiche-actions">
            ${l.url ? `<a class="btn-ghost" href="${esc(l.url)}" target="_blank" rel="noopener">${icon('external')}Voir l'annonce</a>` : ''}
            ${l.contact ? `<span class="pill" style="align-self:center">${esc(l.contact)}</span>` : ''}
          </div>
        </div>
      </section>
      <nav class="tabs" aria-label="Sections de la fiche">${tabs}</nav>`;
    document.title = `AxIA — ${title(entry)}`;
  }

  async function getListing(id){
    const r = await fetch(`/api/listings/${encodeURIComponent(id)}`);
    if(!r.ok) throw new Error('Analyse introuvable');
    return normalizeEntry(await r.json());
  }

  async function patchListing(id, body){
    const r = await fetch(`/api/listings/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if(!r.ok){ const e = await r.json().catch(() => ({})); throw new Error(e.details || e.error || 'Erreur serveur'); }
    return normalizeEntry(await r.json());
  }

  window.AxIA = { icon, esc, currency, signed, pct, signedPct, scoreColor, scoreBg, ring, marketBlock, normalizeEntry, missingCount, title, renderNav, renderFicheHeader, getListing, patchListing };
})();
