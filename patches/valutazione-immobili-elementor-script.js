(function(){
  const ENDPOINT_URL = '/wp-content/themes/wpresidence/valuation-handler.php';

  // Preview locale: +7%
  const ESTIMATE_UPLIFT = 1.07;

  const form = document.getElementById('iv-form');
  const wrap = document.getElementById('iv-wrap');

  const steps = Array.from(form.querySelectorAll('.iv-step'));
  const totalSteps = steps.length;

  const stepNumEl = document.getElementById('iv-step-num');
  const stepTotalEl = document.getElementById('iv-step-total');
  const stepHintEl = document.getElementById('iv-step-hint');
  const progressFill = document.getElementById('iv-progress-fill');

  const statusEl = document.getElementById('iv-status');

  // Estimate UI
  const cardEl = document.getElementById('iv-card');
  const lockEl = document.getElementById('iv-lock');

  const badgeEl = document.getElementById('iv-badge');
  const priceMainEl = document.getElementById('iv-price-main');
  const priceRangeEl = document.getElementById('iv-price-range');
  const scenariosEl = document.getElementById('iv-scenarios');
  const fastEl = document.getElementById('iv-fast');
  const fairEl = document.getElementById('iv-fair');
  const maxEl = document.getElementById('iv-max');

  // Conditional sqm fields
  const parkingSelect = document.getElementById('iv-parking');
  const parkingSqmField = document.getElementById('iv-parking-sqm-field');
  const parkingSqmInput = document.getElementById('iv-parking-sqm');
  const parkingSqmLabel = document.getElementById('iv-parking-sqm-label');

  const outdoorSelect = document.getElementById('iv-outdoor');
  const outdoorSqmField = document.getElementById('iv-outdoor-sqm-field');
  const outdoorSqmInput = document.getElementById('iv-outdoor-sqm');
  const outdoorSqmLabel = document.getElementById('iv-outdoor-sqm-label');

  stepTotalEl.textContent = String(totalSteps);

  const stepHints = {
    1: "Dove si trova l’immobile?",
    2: "Che immobile è e quanto è grande?",
    3: "Dettagli interni e prestazioni",
    4: "Accessori e contesto",
    5: "Lasciaci i contatti",
    6: "Conferma invio"
  };

  const pricePerSqm = {
    "milano": 2673, "roma": 2077, "torino": 1240, "venezia": 2513, "bologna": 1924,
    "firenze": 1954, "napoli": 1731, "verona": 1414, "padova": 1400, "genova": 1344,
    "brescia": 1328, "bergamo": 1313, "parma": 1477, "trento": 1792, "rimini": 1793,
    "cagliari": 1480, "palermo": 826, "catania": 1122
  };

  function normCity(s){
    if(!s) return "";
    return s.toLowerCase()
      .trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[\'’]/g,"")
      .replace(/\s\s+/g,' ');
  }

  function formatEUR(n){
    if(!isFinite(n)) return "—";
    try{
      return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
    }catch(e){
      return Math.round(n).toLocaleString('it-IT') + " €";
    }
  }

  function getValue(name){
    const el = form.querySelector(`[name="${name}"]`);
    if(!el) return null;
    if(el.type === 'checkbox') return el.checked ? "Sì" : "No";
    return (el.value ?? "").toString().trim();
  }

  function getNumber(name){
    const v = getValue(name);
    const n = parseFloat(v);
    return isFinite(n) ? n : null;
  }

  function clearErrors(){
    form.querySelectorAll('.iv-error').forEach(el => el.classList.remove('iv-error'));
    form.querySelectorAll('.iv-err').forEach(el => el.textContent = "");
    if(statusEl){
      statusEl.style.display = "none";
      statusEl.classList.remove('iv-ok','iv-bad');
      statusEl.textContent = "";
    }
  }

  function setFieldError(inputEl, msg){
    if(!inputEl) return;
    inputEl.classList.add('iv-error');
    const parent = inputEl.closest('.iv-field') || inputEl.parentElement;
    const err = parent ? parent.querySelector('.iv-err') : null;
    if(err) err.textContent = msg;
  }

  function updateConditionalSqmFields(){
    const p = (parkingSelect?.value || "").trim();
    const o = (outdoorSelect?.value || "").trim();

    const showParkingSqm = ["posto-auto","garage","posto-auto+garage"].includes(p);
    parkingSqmField.style.display = showParkingSqm ? "" : "none";
    if(!showParkingSqm) parkingSqmInput.value = "";
    if(showParkingSqm){
      parkingSqmLabel.textContent = (p === "posto-auto") ? "Mq posto auto" : "Mq garage";
    }

    const showOutdoorSqm = ["balcone","terrazzo","giardino","balcone+giardino","terrazzo+giardino"].includes(o);
    outdoorSqmField.style.display = showOutdoorSqm ? "" : "none";
    if(!showOutdoorSqm) outdoorSqmInput.value = "";
    if(showOutdoorSqm){
      if(o.includes("giardino") && (o.includes("terrazzo") || o.includes("balcone"))){
        outdoorSqmLabel.textContent = "Mq spazi esterni (totale)";
      } else if(o.includes("giardino")){
        outdoorSqmLabel.textContent = "Mq giardino";
      } else if(o.includes("terrazzo")){
        outdoorSqmLabel.textContent = "Mq terrazzo";
      } else if(o.includes("balcone")){
        outdoorSqmLabel.textContent = "Mq balcone";
      } else {
        outdoorSqmLabel.textContent = "Mq spazi esterni";
      }
    }
  }

  function setLocked(locked){
    if(!cardEl) return;
    cardEl.classList.toggle('iv-locked', !!locked);
    if(lockEl) lockEl.style.display = locked ? "flex" : "none";
  }

  function goTo(stepIndex){
    steps.forEach((s,i)=> s.style.display = i === stepIndex ? "block" : "none");
    const stepNumber = stepIndex + 1;

    stepNumEl.textContent = String(stepNumber);
    stepHintEl.textContent = stepHints[stepNumber] || "";
    progressFill.style.width = `${Math.round((stepNumber/totalSteps)*100)}%`;

    const shouldLock = (stepNumber >= 4 && stepNumber < 6);
    setLocked(shouldLock);

    window.scrollTo({ top: wrap.offsetTop - 20, behavior: 'smooth' });

    updateConditionalSqmFields();
    updateEstimate();
  }

  function validateStep(stepIndex){
    clearErrors();
    let ok = true;

    const step = steps[stepIndex];
    const requiredInputs = Array.from(step.querySelectorAll('[required]'));

    requiredInputs.forEach(el=>{
      if(el.type === 'checkbox'){
        if(!el.checked){ ok=false; setFieldError(el, "Campo obbligatorio."); }
      } else {
        const v = (el.value || "").trim();
        if(!v){ ok=false; setFieldError(el, "Campo obbligatorio."); }
        if(el.type === 'email' && v && !v.includes('@')){
          ok=false; setFieldError(el, "Inserisci un’email valida.");
        }
      }
    });

    if(stepIndex === 1){
      const sqmEl = document.getElementById('iv-mq');
      const sqm = parseFloat(sqmEl?.value || "");
      if(!isFinite(sqm) || sqm < 10){
        ok=false; setFieldError(sqmEl, "Inserisci almeno 10 mq.");
      }
    }

    if(!ok && statusEl){
      statusEl.textContent = "Controlla i campi evidenziati.";
      statusEl.classList.add('iv-bad');
      statusEl.style.display = "inline-block";
    }
    return ok;
  }

  function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }
  function roundTo(x, step){ return Math.round(x/step)*step; }

  function countMeaningfulFields(){
    const names = [
      "address","city","cap","type","sqm","rooms","baths","year","condition","energy","floor",
      "heating","parking","parking_sqm","outdoor","outdoor_sqm","exposure","notes"
    ];
    let c = 0;
    names.forEach(n=>{
      const v = getValue(n);
      if(v && v !== "") c++;
    });
    ["elevator","furnished","ac","cellar","solar","view"].forEach(n=>{
      const el = form.querySelector(`[name="${n}"]`);
      if(el && el.checked) c++;
    });
    return c;
  }

  function computeEstimate(){
    const cityRaw = getValue('city');
    const city = normCity(cityRaw);
    const sqm = getNumber('sqm');
    if(!sqm || sqm < 10) return null;

    const baseSqm = (city && pricePerSqm[city]) ? pricePerSqm[city] : 1000;
    let value = baseSqm * sqm;

    const type = getValue('type');
    const typeFactor = ({
      "attico": 1.08,
      "villa": 1.03,
      "casa-indipendente": 0.98,
      "bifamiliare": 1.00,
      "loft": 1.02,
      "ufficio": 0.95,
      "negozio": 0.92,
      "appartamento": 1.00
    })[type] ?? 1.00;
    value *= typeFactor;

    const condition = getValue('condition');
    const condFactor = ({ "nuovo": 1.10, "buono": 1.00, "da-ristrutturare": 0.88 })[condition] ?? 1.00;
    value *= condFactor;

    const energy = getValue('energy');
    const energyFactor = ({
      "A4": 1.10, "A3": 1.09, "A2": 1.08, "A1": 1.07,
      "A": 1.06, "B": 1.04, "C": 1.02, "D": 1.00,
      "E": 0.97, "F": 0.94, "G": 0.90, "ND": 1.00
    })[energy] ?? 1.00;
    value *= energyFactor;

    const year = getNumber('year');
    if(year && year < 1960) value *= 0.96;
    else if(year && year >= 2005) value *= 1.03;

    const floor = getValue('floor');
    const elevator = (form.querySelector('[name="elevator"]')?.checked) || false;
    if(floor === "t") value *= 0.98;
    if(["4","5","6","m"].includes(floor) && !elevator) value *= 0.96;
    if(["4","5","6"].includes(floor) && elevator) value *= 1.01;

    const heating = getValue('heating');
    if(heating === "pompa-calore") value *= 1.02;
    if(heating === "assente") value *= 0.94;

    const parking = getValue('parking');
    if(parking === "posto-auto") value *= 1.02;
    if(parking === "garage") value *= 1.04;
    if(parking === "posto-auto+garage") value *= 1.06;

    const outdoor = getValue('outdoor');
    if(outdoor === "balcone") value *= 1.01;
    if(outdoor === "terrazzo") value *= 1.03;
    if(outdoor === "giardino") value *= 1.04;
    if(outdoor === "balcone+giardino") value *= 1.05;
    if(outdoor === "terrazzo+giardino") value *= 1.06;

    if(form.querySelector('[name="cellar"]')?.checked) value *= 1.01;
    if(form.querySelector('[name="solar"]')?.checked) value *= 1.02;
    if(form.querySelector('[name="view"]')?.checked) value *= 1.02;
    if(form.querySelector('[name="ac"]')?.checked) value *= 1.01;
    if(form.querySelector('[name="furnished"]')?.checked) value *= 1.005;

    const outdoorSqm = getNumber('outdoor_sqm') || 0;
    if(outdoorSqm > 0){
      let w = 0.18;
      if(outdoor && outdoor.includes("terrazzo")) w = 0.25;
      if(outdoor && outdoor.includes("balcone")) w = Math.max(w, 0.22);
      if(outdoor && outdoor.includes("giardino")) w = Math.max(w, 0.15);
      value += outdoorSqm * baseSqm * w;
    }

    const parkingSqm = getNumber('parking_sqm') || 0;
    if(parkingSqm > 0){
      let w = 0.22;
      if(parking === "garage" || parking === "posto-auto+garage") w = 0.30;
      value += parkingSqm * baseSqm * w;
    }

    value *= ESTIMATE_UPLIFT;

    const filledCount = countMeaningfulFields();
    const rangePct = clamp(0.22 - (filledCount * 0.01), 0.10, 0.22);

    const fair = roundTo(value, 1000);
    const min = roundTo(fair * (1 - rangePct), 1000);
    const max = roundTo(fair * (1 + rangePct), 1000);

    const fast = roundTo(fair * 0.92, 1000);
    const best = roundTo(fair * 1.08, 1000);

    const confidence = rangePct <= 0.12 ? "Più precisa" : (rangePct <= 0.16 ? "Buona" : "Indicativa");

    return { fair, min, max, fast, best, confidence, baseSqm, rangePct };
  }

  function updateEstimateFromObject(est, isReal){
    if(!est){
      badgeEl.textContent = "Indicativa";
      priceMainEl.textContent = "—";
      priceRangeEl.textContent = "Compila i dati per vedere la stima";
      scenariosEl.style.display = "none";
      return;
    }

    badgeEl.textContent = isReal ? "Reale AI" : est.confidence;
    priceMainEl.textContent = formatEUR(Number(est.fair));
    priceRangeEl.textContent = `Range stimato: ${formatEUR(Number(est.min))} – ${formatEUR(Number(est.max))}`;

    scenariosEl.style.display = "grid";
    fastEl.textContent = formatEUR(Number(est.fast));
    fairEl.textContent = formatEUR(Number(est.fair));
    maxEl.textContent = formatEUR(Number(est.best));
  }

  function updateEstimate(){
    updateEstimateFromObject(computeEstimate(), false);
  }

  let currentStep = 0;

  form.addEventListener('click', (e)=>{
    const next = e.target.closest('.iv-next');
    const back = e.target.closest('.iv-back');

    if(next){
      if(validateStep(currentStep)){
        currentStep = Math.min(currentStep + 1, totalSteps - 1);
        goTo(currentStep);
      }
    }
    if(back){
      clearErrors();
      currentStep = Math.max(currentStep - 1, 0);
      goTo(currentStep);
    }
  });

  form.addEventListener('input', ()=> { updateConditionalSqmFields(); updateEstimate(); });
  form.addEventListener('change', ()=> { updateConditionalSqmFields(); updateEstimate(); });

  const newBtn = document.getElementById('iv-new');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      form.reset();
      clearErrors();
      currentStep = 0;
      goTo(0);
      updateEstimate();
    });
  }

  function buildAiPayload(){
    const fd = new FormData();
    fd.append('action', 'ai_estimate');

    [
      'address','city','cap','type','sqm','rooms','baths','year','condition','energy','floor',
      'heating','parking','parking_sqm','outdoor','outdoor_sqm','exposure','notes'
    ].forEach(k=>{
      const v = getValue(k);
      if(v !== null && v !== '') fd.append(k, v);
    });

    ['elevator','furnished','ac','cellar','solar','view'].forEach(k=>{
      const el = form.querySelector(`[name="${k}"]`);
      if(el) fd.append(k, el.checked ? 'Sì' : 'No');
    });

    return fd;
  }

  async function requestAiEstimate(){
    const aiPayload = buildAiPayload();
    const res = await fetch(ENDPOINT_URL, { method:'POST', body: aiPayload });
    const data = await res.json().catch(()=> ({}));
    if(!res.ok || !data.ok || !data.estimate){
      throw new Error(data.error || 'Errore valutazione AI');
    }

    const e = data.estimate;
    return {
      fair: Number(e.estimate_fair || 0),
      min: Number(e.estimate_min || 0),
      max: Number(e.estimate_max || 0),
      fast: Number(e.estimate_fast || 0),
      best: Number(e.estimate_best || 0),
      confidence: String(e.estimate_confidence || 'AI'),
      baseSqm: Number(e.estimate_base_sqm || 0),
      rangePct: Number(e.estimate_range_pct || 0)
    };
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(!validateStep(currentStep)) return;

    const requiredFinal = [
      { id:'iv-name', msg:'Inserisci nome e cognome.' },
      { id:'iv-email', msg:'Inserisci un’email valida.' },
      { id:'iv-phone', msg:'Inserisci un telefono valido.' }
    ];
    let ok = true;

    requiredFinal.forEach(r=>{
      const el = document.getElementById(r.id);
      if(!el || !el.value.trim()){
        ok=false; setFieldError(el, r.msg);
      }
      if(el && el.type === 'email' && el.value && !el.value.includes('@')){
        ok=false; setFieldError(el, 'Inserisci un’email valida.');
      }
    });

    const privacy = document.getElementById('iv-privacy');
    if(privacy && !privacy.checked){
      ok=false; setFieldError(privacy, 'Devi accettare la privacy.');
    }

    if(!ok){
      statusEl.textContent = 'Controlla i campi evidenziati.';
      statusEl.classList.add('iv-bad');
      statusEl.style.display = 'inline-block';
      return;
    }

    statusEl.textContent = 'Calcolo valutazione reale con AI…';
    statusEl.classList.remove('iv-bad','iv-ok');
    statusEl.style.display = 'inline-block';

    try{
      const aiEst = await requestAiEstimate();

      updateEstimateFromObject(aiEst, true);
      setLocked(false);

      statusEl.textContent = 'Invio richiesta…';

      const payload = new FormData(form);
      payload.append('action', 'send_lead');
      payload.append('estimate_fair', String(aiEst.fair));
      payload.append('estimate_min', String(aiEst.min));
      payload.append('estimate_max', String(aiEst.max));
      payload.append('estimate_fast', String(aiEst.fast));
      payload.append('estimate_best', String(aiEst.best));
      payload.append('estimate_confidence', aiEst.confidence);
      payload.append('estimate_base_sqm', String(aiEst.baseSqm));
      payload.append('estimate_range_pct', String(aiEst.rangePct));

      const res = await fetch(ENDPOINT_URL, { method:'POST', body: payload });
      const data = await res.json().catch(()=> ({}));
      if(!res.ok || !data.ok){
        throw new Error(data.error || 'Errore invio');
      }

      currentStep = totalSteps - 1;
      goTo(currentStep);

      const thanksFair = document.getElementById('iv-thanks-fair');
      const thanksRange = document.getElementById('iv-thanks-range');
      if (thanksFair && thanksRange) {
        thanksFair.textContent = formatEUR(aiEst.fair);
        thanksRange.textContent = `${formatEUR(aiEst.min)} – ${formatEUR(aiEst.max)}`;
      }

      statusEl.textContent = 'Inviato correttamente.';
      statusEl.classList.remove('iv-bad');
      statusEl.classList.add('iv-ok');
    }catch(err){
      console.error(err);
      statusEl.textContent = 'Errore durante la valutazione/invio. Riprova più tardi.';
      statusEl.classList.add('iv-bad');
      statusEl.style.display = 'inline-block';
    }
  });

  updateConditionalSqmFields();
  goTo(0);
  updateEstimate();
})();
