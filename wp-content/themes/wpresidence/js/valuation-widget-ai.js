(function () {
  function initValuationWidget() {
    const ENDPOINT_URL = '/wp-content/themes/wpresidence/valuation-handler.php';
    const ESTIMATE_UPLIFT = 1.07;

    const form = document.getElementById('iv-form');
    const wrap = document.getElementById('iv-wrap');
    if (!form || !wrap) return;

    const steps = Array.from(form.querySelectorAll('.iv-step'));
    const totalSteps = steps.length;

    const stepNumEl = document.getElementById('iv-step-num');
    const stepTotalEl = document.getElementById('iv-step-total');
    const stepHintEl = document.getElementById('iv-step-hint');
    const progressFill = document.getElementById('iv-progress-fill');
    const statusEl = document.getElementById('iv-status');

    const cardEl = document.getElementById('iv-card');
    const lockEl = document.getElementById('iv-lock');
    const badgeEl = document.getElementById('iv-badge');
    const priceMainEl = document.getElementById('iv-price-main');
    const priceRangeEl = document.getElementById('iv-price-range');
    const scenariosEl = document.getElementById('iv-scenarios');
    const fastEl = document.getElementById('iv-fast');
    const fairEl = document.getElementById('iv-fair');
    const maxEl = document.getElementById('iv-max');

    const parkingSelect = document.getElementById('iv-parking');
    const parkingSqmField = document.getElementById('iv-parking-sqm-field');
    const parkingSqmInput = document.getElementById('iv-parking-sqm');
    const parkingSqmLabel = document.getElementById('iv-parking-sqm-label');

    const outdoorSelect = document.getElementById('iv-outdoor');
    const outdoorSqmField = document.getElementById('iv-outdoor-sqm-field');
    const outdoorSqmInput = document.getElementById('iv-outdoor-sqm');
    const outdoorSqmLabel = document.getElementById('iv-outdoor-sqm-label');

    if (stepTotalEl) stepTotalEl.textContent = String(totalSteps);

    const stepHints = {
      1: 'Dove si trova l\'immobile?',
      2: 'Tipo immobile e dimensioni',
      3: 'Qualita e stato generale',
      4: 'Accessori e contesto',
      5: 'I tuoi contatti',
      6: 'Conferma invio',
    };

    const pricePerSqm = {
      milano: 2673, roma: 2077, torino: 1240, venezia: 2513, bologna: 1924,
      firenze: 1954, napoli: 1731, verona: 1414, padova: 1400, genova: 1344,
      brescia: 1328, bergamo: 1313, parma: 1477, trento: 1792, rimini: 1793,
      cagliari: 1480, palermo: 826, catania: 1122,
    };

    function normCity(s) {
      if (!s) return '';
      return s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\'’]/g, '').replace(/\s\s+/g, ' ');
    }

    function formatEUR(n) {
      if (!isFinite(n)) return '-';
      try {
        return new Intl.NumberFormat('it-IT', {
          style: 'currency',
          currency: 'EUR',
          maximumFractionDigits: 0,
        }).format(n);
      } catch (e) {
        return Math.round(n).toLocaleString('it-IT') + ' EUR';
      }
    }

    function getValue(name) {
      const el = form.querySelector(`[name="${name}"]`);
      if (!el) return null;
      if (el.type === 'checkbox') return el.checked ? 'Si' : 'No';
      return (el.value ?? '').toString().trim();
    }

    function getNumber(name) {
      const v = getValue(name);
      const n = parseFloat(v);
      return isFinite(n) ? n : null;
    }

    function clearErrors() {
      form.querySelectorAll('.iv-error').forEach((el) => el.classList.remove('iv-error'));
      form.querySelectorAll('.iv-err').forEach((el) => {
        el.textContent = '';
      });
      if (statusEl) {
        statusEl.style.display = 'none';
        statusEl.classList.remove('iv-ok', 'iv-bad');
        statusEl.textContent = '';
      }
    }

    function setFieldError(inputEl, msg) {
      if (!inputEl) return;
      inputEl.classList.add('iv-error');
      const parent = inputEl.closest('.iv-field') || inputEl.parentElement;
      const err = parent ? parent.querySelector('.iv-err') : null;
      if (err) err.textContent = msg;
    }

    function updateConditionalSqmFields() {
      const p = (parkingSelect?.value || '').trim();
      const o = (outdoorSelect?.value || '').trim();

      const showParkingSqm = ['posto-auto', 'garage', 'posto-auto+garage'].includes(p);
      if (parkingSqmField) parkingSqmField.style.display = showParkingSqm ? '' : 'none';
      if (!showParkingSqm && parkingSqmInput) parkingSqmInput.value = '';
      if (showParkingSqm && parkingSqmLabel) {
        parkingSqmLabel.textContent = p === 'posto-auto' ? 'Mq posto auto' : 'Mq garage';
      }

      const showOutdoorSqm = ['balcone', 'terrazzo', 'giardino', 'balcone+giardino', 'terrazzo+giardino'].includes(o);
      if (outdoorSqmField) outdoorSqmField.style.display = showOutdoorSqm ? '' : 'none';
      if (!showOutdoorSqm && outdoorSqmInput) outdoorSqmInput.value = '';
      if (showOutdoorSqm && outdoorSqmLabel) {
        if (o.includes('giardino') && (o.includes('terrazzo') || o.includes('balcone'))) {
          outdoorSqmLabel.textContent = 'Mq spazi esterni (totale)';
        } else if (o.includes('giardino')) {
          outdoorSqmLabel.textContent = 'Mq giardino';
        } else if (o.includes('terrazzo')) {
          outdoorSqmLabel.textContent = 'Mq terrazzo';
        } else if (o.includes('balcone')) {
          outdoorSqmLabel.textContent = 'Mq balcone';
        } else {
          outdoorSqmLabel.textContent = 'Mq spazi esterni';
        }
      }
    }

    function setLocked(locked) {
      if (!cardEl) return;
      cardEl.classList.toggle('iv-locked', !!locked);
      if (lockEl) lockEl.style.display = locked ? 'flex' : 'none';
    }

    function goTo(stepIndex) {
      steps.forEach((s, i) => {
        s.style.display = i === stepIndex ? 'block' : 'none';
      });

      const stepNumber = stepIndex + 1;
      if (stepNumEl) stepNumEl.textContent = String(stepNumber);
      if (stepHintEl) stepHintEl.textContent = stepHints[stepNumber] || '';
      if (progressFill) progressFill.style.width = `${Math.round((stepNumber / totalSteps) * 100)}%`;

      setLocked(stepNumber >= 4 && stepNumber < 6);
      window.scrollTo({ top: wrap.offsetTop - 20, behavior: 'smooth' });

      updateConditionalSqmFields();
      updateEstimate();
    }

    function validateStep(stepIndex) {
      clearErrors();
      let ok = true;

      const step = steps[stepIndex];
      const requiredInputs = Array.from(step.querySelectorAll('[required]'));

      requiredInputs.forEach((el) => {
        if (el.type === 'checkbox') {
          if (!el.checked) {
            ok = false;
            setFieldError(el, 'Campo obbligatorio.');
          }
        } else {
          const v = (el.value || '').trim();
          if (!v) {
            ok = false;
            setFieldError(el, 'Campo obbligatorio.');
          }
          if (el.type === 'email' && v && !v.includes('@')) {
            ok = false;
            setFieldError(el, 'Inserisci un\'email valida.');
          }
        }
      });

      if (stepIndex === 1) {
        const sqmEl = document.getElementById('iv-mq');
        const sqm = parseFloat(sqmEl?.value || '');
        if (!isFinite(sqm) || sqm < 10) {
          ok = false;
          setFieldError(sqmEl, 'Inserisci almeno 10 mq.');
        }
      }

      if (!ok && statusEl) {
        statusEl.textContent = 'Controlla i campi evidenziati.';
        statusEl.classList.add('iv-bad');
        statusEl.style.display = 'inline-block';
      }
      return ok;
    }

    function clamp(x, a, b) {
      return Math.max(a, Math.min(b, x));
    }

    function roundTo(x, step) {
      return Math.round(x / step) * step;
    }

    function countMeaningfulFields() {
      const names = [
        'address', 'city', 'cap', 'type', 'sqm', 'rooms', 'baths', 'year', 'condition', 'energy', 'floor',
        'area_quality', 'occupancy', 'building_condition', 'heating', 'parking', 'parking_sqm', 'outdoor',
        'outdoor_sqm', 'exposure', 'noise', 'brightness', 'notes',
      ];
      let c = 0;
      names.forEach((n) => {
        const v = getValue(n);
        if (v && v !== '') c += 1;
      });
      ['elevator', 'furnished', 'ac', 'cellar', 'solar', 'view'].forEach((n) => {
        const el = form.querySelector(`[name="${n}"]`);
        if (el && el.checked) c += 1;
      });
      return c;
    }

    function computeEstimate() {
      const city = normCity(getValue('city'));
      const sqm = getNumber('sqm');
      if (!sqm || sqm < 10) return null;

      const baseSqm = city && pricePerSqm[city] ? pricePerSqm[city] : 1000;
      let value = baseSqm * sqm;

      const type = getValue('type');
      const typeFactor = ({
        attico: 1.08,
        villa: 1.03,
        'casa-indipendente': 0.98,
        bifamiliare: 1.0,
        loft: 1.02,
        ufficio: 0.95,
        negozio: 0.92,
        appartamento: 1.0,
      })[type] ?? 1.0;
      value *= typeFactor;

      const condition = getValue('condition');
      const condFactor = ({ nuovo: 1.1, buono: 1.0, 'da-ristrutturare': 0.88 })[condition] ?? 1.0;
      value *= condFactor;

      const buildingCondition = getValue('building_condition');
      const buildingFactor = ({ ottimo: 1.02, buono: 1.0, da_aggiornare: 0.97 })[buildingCondition] ?? 1.0;
      value *= buildingFactor;

      const areaQuality = getValue('area_quality');
      const areaFactor = ({ centrale: 1.08, semicentrale: 1.03, periferica: 0.95, frazione: 0.9 })[areaQuality] ?? 1.0;
      value *= areaFactor;

      const energy = getValue('energy');
      const energyFactor = ({
        A4: 1.1, A3: 1.09, A2: 1.08, A1: 1.07,
        A: 1.06, B: 1.04, C: 1.02, D: 1.0,
        E: 0.97, F: 0.94, G: 0.9, ND: 1.0,
      })[energy] ?? 1.0;
      value *= energyFactor;

      const year = getNumber('year');
      if (year && year < 1960) value *= 0.96;
      else if (year && year >= 2005) value *= 1.03;

      const floor = getValue('floor');
      const elevator = form.querySelector('[name="elevator"]')?.checked || false;
      if (floor === 't') value *= 0.98;
      if (['4', '5', '6', 'm'].includes(floor) && !elevator) value *= 0.96;
      if (['4', '5', '6'].includes(floor) && elevator) value *= 1.01;

      const occupancy = getValue('occupancy');
      if (occupancy === 'locato') value *= 0.97;
      if (occupancy === 'libero_subito') value *= 1.01;

      const heating = getValue('heating');
      if (heating === 'pompa-calore') value *= 1.02;
      if (heating === 'assente') value *= 0.94;

      const parking = getValue('parking');
      if (parking === 'posto-auto') value *= 1.02;
      if (parking === 'garage') value *= 1.04;
      if (parking === 'posto-auto+garage') value *= 1.06;

      const outdoor = getValue('outdoor');
      if (outdoor === 'balcone') value *= 1.01;
      if (outdoor === 'terrazzo') value *= 1.03;
      if (outdoor === 'giardino') value *= 1.04;
      if (outdoor === 'balcone+giardino') value *= 1.05;
      if (outdoor === 'terrazzo+giardino') value *= 1.06;

      const noise = getValue('noise');
      if (noise === 'silenziosa') value *= 1.015;
      if (noise === 'trafficata') value *= 0.975;

      const brightness = getValue('brightness');
      if (brightness === 'alta') value *= 1.02;
      if (brightness === 'bassa') value *= 0.98;

      if (form.querySelector('[name="cellar"]')?.checked) value *= 1.01;
      if (form.querySelector('[name="solar"]')?.checked) value *= 1.02;
      if (form.querySelector('[name="view"]')?.checked) value *= 1.02;
      if (form.querySelector('[name="ac"]')?.checked) value *= 1.01;
      if (form.querySelector('[name="furnished"]')?.checked) value *= 1.005;

      const outdoorSqm = getNumber('outdoor_sqm') || 0;
      if (outdoorSqm > 0) {
        let w = 0.18;
        if (outdoor && outdoor.includes('terrazzo')) w = 0.25;
        if (outdoor && outdoor.includes('balcone')) w = Math.max(w, 0.22);
        if (outdoor && outdoor.includes('giardino')) w = Math.max(w, 0.15);
        value += outdoorSqm * baseSqm * w;
      }

      const parkingSqm = getNumber('parking_sqm') || 0;
      if (parkingSqm > 0) {
        let w = 0.22;
        if (parking === 'garage' || parking === 'posto-auto+garage') w = 0.3;
        value += parkingSqm * baseSqm * w;
      }

      value *= ESTIMATE_UPLIFT;

      const filledCount = countMeaningfulFields();
      const rangePct = clamp(0.22 - (filledCount * 0.0085), 0.09, 0.22);

      const fair = roundTo(value, 1000);
      const min = roundTo(fair * (1 - rangePct), 1000);
      const max = roundTo(fair * (1 + rangePct), 1000);
      const fast = roundTo(fair * 0.92, 1000);
      const best = roundTo(fair * 1.08, 1000);
      const confidence = rangePct <= 0.12 ? 'Piu precisa' : rangePct <= 0.16 ? 'Buona' : 'Indicativa';

      return { fair, min, max, fast, best, confidence };
    }

    function updateEstimateFromObject(est, isFinal) {
      if (!est) {
        if (badgeEl) badgeEl.textContent = 'Indicativa';
        if (priceMainEl) priceMainEl.textContent = '-';
        if (priceRangeEl) priceRangeEl.textContent = 'Compila i dati per vedere la stima';
        if (scenariosEl) scenariosEl.style.display = 'none';
        return;
      }

      if (badgeEl) badgeEl.textContent = isFinal ? 'Aggiornata' : est.confidence;
      if (priceMainEl) priceMainEl.textContent = formatEUR(Number(est.fair));
      if (priceRangeEl) {
        priceRangeEl.textContent = isFinal
          ? 'Proposta finale pronta.'
          : `Range stimato: ${formatEUR(Number(est.min))} - ${formatEUR(Number(est.max))}`;
      }

      if (scenariosEl) scenariosEl.style.display = 'grid';
      if (fastEl) fastEl.textContent = formatEUR(Number(est.fast));
      if (fairEl) fairEl.textContent = formatEUR(Number(est.fair));
      if (maxEl) maxEl.textContent = formatEUR(Number(est.best));
    }

    function updateEstimate() {
      updateEstimateFromObject(computeEstimate(), false);
    }

    let currentStep = 0;

    form.addEventListener('click', (e) => {
      const next = e.target.closest('.iv-next');
      const back = e.target.closest('.iv-back');

      if (next) {
        if (validateStep(currentStep)) {
          currentStep = Math.min(currentStep + 1, totalSteps - 1);
          goTo(currentStep);
        }
      }
      if (back) {
        clearErrors();
        currentStep = Math.max(currentStep - 1, 0);
        goTo(currentStep);
      }
    });

    form.addEventListener('input', () => {
      updateConditionalSqmFields();
      updateEstimate();
    });

    form.addEventListener('change', () => {
      updateConditionalSqmFields();
      updateEstimate();
    });

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

    function buildAiPayload() {
      const fd = new FormData();
      fd.append('action', 'ai_estimate');

      [
        'address', 'city', 'cap', 'type', 'sqm', 'rooms', 'baths', 'year',
        'condition', 'energy', 'floor', 'area_quality', 'occupancy',
        'building_condition', 'heating', 'parking', 'parking_sqm', 'outdoor',
        'outdoor_sqm', 'exposure', 'noise', 'brightness', 'notes',
      ].forEach((k) => {
        const v = getValue(k);
        if (v !== null && v !== '') fd.append(k, v);
      });

      ['elevator', 'furnished', 'ac', 'cellar', 'solar', 'view'].forEach((k) => {
        const el = form.querySelector(`[name="${k}"]`);
        if (el) fd.append(k, el.checked ? 'Si' : 'No');
      });

      return fd;
    }

    async function requestAiEstimate() {
      const aiPayload = buildAiPayload();
      const res = await fetch(ENDPOINT_URL, { method: 'POST', body: aiPayload });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.estimate) {
        throw new Error(data.error || 'Errore valutazione dettagliata');
      }

      const est = data.estimate;
      return {
        fair: Number(est.estimate_fair || 0),
        min: Number(est.estimate_min || 0),
        max: Number(est.estimate_max || 0),
        fast: Number(est.estimate_fast || 0),
        best: Number(est.estimate_best || 0),
        confidence: String(est.estimate_confidence || 'Aggiornata'),
      };
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateStep(currentStep)) return;

      const requiredFinal = [
        { id: 'iv-name', msg: 'Inserisci nome e cognome.' },
        { id: 'iv-email', msg: 'Inserisci un\'email valida.' },
        { id: 'iv-phone', msg: 'Inserisci un telefono valido.' },
      ];
      let ok = true;

      requiredFinal.forEach((r) => {
        const el = document.getElementById(r.id);
        if (!el || !el.value.trim()) {
          ok = false;
          setFieldError(el, r.msg);
        }
        if (el && el.type === 'email' && el.value && !el.value.includes('@')) {
          ok = false;
          setFieldError(el, 'Inserisci un\'email valida.');
        }
      });

      const privacy = document.getElementById('iv-privacy');
      if (privacy && !privacy.checked) {
        ok = false;
        setFieldError(privacy, 'Devi accettare la privacy.');
      }

      if (!ok) {
        if (statusEl) {
          statusEl.textContent = 'Controlla i campi evidenziati.';
          statusEl.classList.add('iv-bad');
          statusEl.style.display = 'inline-block';
        }
        return;
      }

      if (statusEl) {
        statusEl.textContent = 'Stiamo completando l\'analisi dettagliata dell\'immobile...';
        statusEl.classList.remove('iv-bad', 'iv-ok');
        statusEl.style.display = 'inline-block';
      }

      try {
        const aiEst = await requestAiEstimate();
        updateEstimateFromObject(aiEst, true);
        setLocked(false);

        if (statusEl) statusEl.textContent = 'Invio richiesta...';

        const payload = new FormData(form);
        payload.append('action', 'send_lead');
        payload.append('estimate_fast', String(aiEst.fast));
        payload.append('estimate_fair', String(aiEst.fair));
        payload.append('estimate_best', String(aiEst.best));

        const res = await fetch(ENDPOINT_URL, { method: 'POST', body: payload });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Errore invio');
        }

        currentStep = totalSteps - 1;
        goTo(currentStep);

        const thanksFair = document.getElementById('iv-thanks-fair');
        const thanksRange = document.getElementById('iv-thanks-range');
        if (thanksFair && thanksRange) {
          thanksFair.textContent = `Valore di mercato: ${formatEUR(aiEst.fair)}`;
          thanksRange.textContent = `Vendita rapida: ${formatEUR(aiEst.fast)} | Miglior offerente: ${formatEUR(aiEst.best)}`;
        }

        if (statusEl) {
          statusEl.textContent = 'Inviato correttamente.';
          statusEl.classList.remove('iv-bad');
          statusEl.classList.add('iv-ok');
        }
      } catch (err) {
        console.error(err);
        if (statusEl) {
          statusEl.textContent = 'Errore durante la valutazione/invio. Riprova piu tardi.';
          statusEl.classList.add('iv-bad');
          statusEl.style.display = 'inline-block';
        }
      }
    });

    updateConditionalSqmFields();
    goTo(0);
    updateEstimate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initValuationWidget);
  } else {
    initValuationWidget();
  }
})();
