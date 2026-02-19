(function () {
  function initValuationWidget() {
    const ENDPOINT_URL = '/wp-content/themes/wpresidence/valuation-handler.php';

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
    const lockTitleEl = document.getElementById('iv-lock-title');
    const lockTextEl = document.getElementById('iv-lock-text');

    const badgeEl = document.getElementById('iv-badge');
    const priceMainEl = document.getElementById('iv-price-main');
    const priceRangeEl = document.getElementById('iv-price-range');
    const scenariosEl = document.getElementById('iv-scenarios');
    const fastEl = document.getElementById('iv-fast');
    const fairEl = document.getElementById('iv-fair');
    const maxEl = document.getElementById('iv-max');

    const analysisBoxEl = document.getElementById('iv-analysis-box');
    const analysisTextEl = document.getElementById('iv-analysis-text');

    const parkingSelect = document.getElementById('iv-parking');
    const parkingSqmField = document.getElementById('iv-parking-sqm-field');
    const parkingSqmInput = document.getElementById('iv-parking-sqm');
    const parkingSqmLabel = document.getElementById('iv-parking-sqm-label');

    const outdoorSelect = document.getElementById('iv-outdoor');
    const outdoorSqmField = document.getElementById('iv-outdoor-sqm-field');
    const outdoorSqmInput = document.getElementById('iv-outdoor-sqm');
    const outdoorSqmLabel = document.getElementById('iv-outdoor-sqm-label');

    const submitBtn = form.querySelector('button[type="submit"]');

    if (stepTotalEl) stepTotalEl.textContent = String(totalSteps);

    const stepHints = {
      1: 'Dove si trova l\'immobile?',
      2: 'Dettagli immobile e accessori',
      3: 'Contatti e conferma',
      4: 'Conferma invio',
    };

    const propertyFields = [
      'address', 'city', 'cap', 'type', 'sqm', 'rooms', 'baths', 'area_quality',
      'year', 'condition', 'building_condition', 'energy', 'floor', 'occupancy',
      'heating', 'parking', 'parking_sqm', 'outdoor', 'outdoor_sqm', 'exposure',
      'noise', 'brightness', 'notes',
    ];

    const propertyCheckFields = ['elevator', 'furnished', 'ac', 'cellar', 'solar', 'view'];

    const aiState = {
      status: 'idle',
      estimate: null,
      hash: '',
      promise: null,
    };

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

    function setLocked(locked, title, text) {
      if (!cardEl) return;
      cardEl.classList.toggle('iv-locked', !!locked);
      if (lockEl) lockEl.style.display = locked ? 'flex' : 'none';
      if (lockTitleEl && title) lockTitleEl.textContent = title;
      if (lockTextEl && text) lockTextEl.textContent = text;
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

    function collectPropertyObject() {
      const out = {};
      propertyFields.forEach((name) => {
        const el = form.querySelector(`[name="${name}"]`);
        if (!el) return;
        const value = (el.value || '').toString().trim();
        if (value !== '') out[name] = value;
      });

      propertyCheckFields.forEach((name) => {
        const el = form.querySelector(`[name="${name}"]`);
        out[name] = el && el.checked ? 'Si' : 'No';
      });

      return out;
    }

    function propertyHash(obj) {
      return JSON.stringify(obj);
    }

    function invalidateAiEstimate() {
      aiState.status = 'idle';
      aiState.estimate = null;
      aiState.promise = null;
      aiState.hash = '';
      renderPendingCard();
      updateAnalysisUi();
    }

    function renderPendingCard() {
      if (badgeEl) badgeEl.textContent = 'In attesa';
      if (priceMainEl) priceMainEl.textContent = '-';
      if (priceRangeEl) priceRangeEl.textContent = 'Completa i dati per avviare l\'analisi';
      if (scenariosEl) scenariosEl.style.display = 'none';
    }

    function renderLoadingCard() {
      if (badgeEl) badgeEl.textContent = 'Analisi in corso';
      if (priceMainEl) priceMainEl.textContent = '...';
      if (priceRangeEl) priceRangeEl.textContent = 'Stiamo elaborando la valutazione completa';
      if (scenariosEl) scenariosEl.style.display = 'none';
    }

    function renderEstimateCard(est) {
      if (!est) {
        renderPendingCard();
        return;
      }

      if (badgeEl) badgeEl.textContent = 'Aggiornata';
      if (priceMainEl) priceMainEl.textContent = formatEUR(Number(est.fair));
      if (priceRangeEl) priceRangeEl.textContent = `Range stimato: ${formatEUR(Number(est.min))} - ${formatEUR(Number(est.max))}`;

      if (scenariosEl) scenariosEl.style.display = 'grid';
      if (fastEl) fastEl.textContent = formatEUR(Number(est.fast));
      if (fairEl) fairEl.textContent = formatEUR(Number(est.fair));
      if (maxEl) maxEl.textContent = formatEUR(Number(est.best));
    }

    function updateAnalysisUi() {
      if (!analysisBoxEl || !analysisTextEl) return;

      analysisBoxEl.classList.remove('is-loading', 'is-ready', 'is-error');

      if (aiState.status === 'loading') {
        analysisBoxEl.style.display = 'flex';
        analysisBoxEl.classList.add('is-loading');
        analysisTextEl.textContent = 'Analisi immobile in corso. Puoi compilare i contatti nel frattempo.';
      } else if (aiState.status === 'ready') {
        analysisBoxEl.style.display = 'flex';
        analysisBoxEl.classList.add('is-ready');
        analysisTextEl.textContent = 'Analisi completata. Puoi inviare la richiesta.';
      } else if (aiState.status === 'error') {
        analysisBoxEl.style.display = 'flex';
        analysisBoxEl.classList.add('is-error');
        analysisTextEl.textContent = 'Analisi non riuscita. Riprova tra qualche secondo.';
      } else {
        analysisBoxEl.style.display = 'none';
      }
    }

    function goTo(stepIndex) {
      steps.forEach((s, i) => {
        s.style.display = i === stepIndex ? 'block' : 'none';
      });

      const stepNumber = stepIndex + 1;
      if (stepNumEl) stepNumEl.textContent = String(stepNumber);
      if (stepHintEl) stepHintEl.textContent = stepHints[stepNumber] || '';
      if (progressFill) progressFill.style.width = `${Math.round((stepNumber / totalSteps) * 100)}%`;

      if (stepNumber >= 3 && aiState.status !== 'ready') {
        setLocked(true, 'Analisi in corso', 'Completiamo la valutazione mentre inserisci i contatti.');
      } else {
        setLocked(false);
      }

      if (stepNumber === 3) {
        updateAnalysisUi();
      }

      window.scrollTo({ top: wrap.offsetTop - 20, behavior: 'smooth' });
      updateConditionalSqmFields();
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

      if (stepIndex === 0) {
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

    function buildAiPayloadFromObject(obj) {
      const fd = new FormData();
      fd.append('action', 'ai_estimate');
      Object.keys(obj).forEach((k) => {
        fd.append(k, obj[k]);
      });
      return fd;
    }

    async function startAiEstimateIfNeeded(force) {
      const propertyObj = collectPropertyObject();
      const hash = propertyHash(propertyObj);

      if (!force && aiState.status === 'ready' && aiState.hash === hash && aiState.estimate) {
        return aiState.estimate;
      }

      if (!force && aiState.status === 'loading' && aiState.hash === hash && aiState.promise) {
        return aiState.promise;
      }

      aiState.status = 'loading';
      aiState.hash = hash;
      aiState.estimate = null;
      renderLoadingCard();
      updateAnalysisUi();

      if (submitBtn) submitBtn.disabled = false;

      aiState.promise = (async () => {
        try {
          const payload = buildAiPayloadFromObject(propertyObj);
          const res = await fetch(ENDPOINT_URL, { method: 'POST', body: payload });
          const data = await res.json().catch(() => ({}));

          if (!res.ok || !data.ok || !data.estimate) {
            throw new Error(data.error || 'Errore analisi valutazione');
          }

          const est = data.estimate;
          const parsed = {
            fair: Number(est.estimate_fair || 0),
            min: Number(est.estimate_min || 0),
            max: Number(est.estimate_max || 0),
            fast: Number(est.estimate_fast || 0),
            best: Number(est.estimate_best || 0),
            confidence: String(est.estimate_confidence || 'Aggiornata'),
            summary: String(est.summary || ''),
          };

          if (aiState.hash !== hash) {
            return parsed;
          }

          aiState.status = 'ready';
          aiState.estimate = parsed;
          renderEstimateCard(parsed);
          updateAnalysisUi();
          setLocked(false);
          return parsed;
        } catch (err) {
          if (aiState.hash === hash) {
            aiState.status = 'error';
            aiState.estimate = null;
            updateAnalysisUi();
            renderPendingCard();
          }
          throw err;
        }
      })();

      return aiState.promise;
    }

    let currentStep = 0;

    form.addEventListener('click', (e) => {
      const next = e.target.closest('.iv-next');
      const back = e.target.closest('.iv-back');

      if (next) {
        if (!validateStep(currentStep)) return;

        if (currentStep === 1) {
          currentStep = 2;
          goTo(currentStep);
          startAiEstimateIfNeeded(false).catch((err) => {
            console.error(err);
            if (statusEl) {
              statusEl.textContent = 'Analisi non disponibile al momento. Riprova.';
              statusEl.classList.add('iv-bad');
              statusEl.style.display = 'inline-block';
            }
          });
          return;
        }

        currentStep = Math.min(currentStep + 1, totalSteps - 1);
        goTo(currentStep);
      }

      if (back) {
        clearErrors();
        currentStep = Math.max(currentStep - 1, 0);
        goTo(currentStep);
      }
    });

    function shouldInvalidateByEventTarget(target) {
      if (!target || !target.name) return false;
      return propertyFields.includes(target.name) || propertyCheckFields.includes(target.name);
    }

    form.addEventListener('input', (e) => {
      updateConditionalSqmFields();
      if (shouldInvalidateByEventTarget(e.target)) {
        invalidateAiEstimate();
      }
    });

    form.addEventListener('change', (e) => {
      updateConditionalSqmFields();
      if (shouldInvalidateByEventTarget(e.target)) {
        invalidateAiEstimate();
      }
    });

    const newBtn = document.getElementById('iv-new');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        form.reset();
        clearErrors();
        currentStep = 0;
        invalidateAiEstimate();
        goTo(0);
      });
    }

    async function ensureAiReadyBeforeSend() {
      if (aiState.status === 'ready' && aiState.estimate) return aiState.estimate;

      if (statusEl) {
        statusEl.textContent = 'Ancora un attimo, stiamo finendo l\'analisi...';
        statusEl.classList.remove('iv-ok', 'iv-bad');
        statusEl.style.display = 'inline-block';
      }

      try {
        const est = await startAiEstimateIfNeeded(true);
        return est;
      } catch (err) {
        throw err;
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

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

      if (submitBtn) submitBtn.disabled = true;

      try {
        const aiEst = await ensureAiReadyBeforeSend();

        if (statusEl) {
          statusEl.textContent = 'Invio richiesta...';
          statusEl.classList.remove('iv-bad', 'iv-ok');
          statusEl.style.display = 'inline-block';
        }

        const payload = new FormData(form);
        payload.append('action', 'send_lead');
        payload.append('estimate_fast', String(aiEst.fast));
        payload.append('estimate_fair', String(aiEst.fair));
        payload.append('estimate_best', String(aiEst.best));
        payload.append('estimate_min', String(aiEst.min));
        payload.append('estimate_max', String(aiEst.max));
        payload.append('estimate_confidence', String(aiEst.confidence || ''));
        payload.append('estimate_summary', String(aiEst.summary || ''));

        const res = await fetch(ENDPOINT_URL, { method: 'POST', body: payload });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Errore invio');
        }

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

        currentStep = 3;
        goTo(currentStep);
      } catch (err) {
        console.error(err);
        if (statusEl) {
          statusEl.textContent = 'Ancora un attimo, analisi non completata o invio non riuscito. Riprova.';
          statusEl.classList.remove('iv-ok');
          statusEl.classList.add('iv-bad');
          statusEl.style.display = 'inline-block';
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    updateConditionalSqmFields();
    renderPendingCard();
    updateAnalysisUi();
    goTo(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initValuationWidget);
  } else {
    initValuationWidget();
  }
})();
