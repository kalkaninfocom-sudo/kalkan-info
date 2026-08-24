/**
 * form-validate.js — Kalkan Info shared inline form validation
 * Vanilla JS, no framework. Attaches blur + submit validation.
 * Patterns match existing auth.js error display conventions.
 */

'use strict';

/* ─────────────────────────────────────────────
   CSS injected once — error message styling
   Uses the existing brand colours from login/register
   ───────────────────────────────────────────── */
(function injectStyles() {
  if (document.getElementById('fv-styles')) return;
  const style = document.createElement('style');
  style.id = 'fv-styles';
  style.textContent = `
    .fv-error-msg {
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      color: #c0392b;
      margin-top: 0.25rem;
    }
    .fv-error-msg:empty { display: none; }
    input.fv-invalid, select.fv-invalid, textarea.fv-invalid {
      border-color: #c0392b !important;
      box-shadow: 0 0 0 3px rgba(192,57,43,0.12) !important;
    }
    input.fv-valid, select.fv-valid, textarea.fv-valid {
      border-color: #27ae60 !important;
    }
    /* focus-visible ring — keep accessible on keyboard nav */
    input.fv-invalid:focus-visible,
    select.fv-invalid:focus-visible,
    textarea.fv-invalid:focus-visible {
      outline: 2px solid #c0392b;
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
})();

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

/** Get or create the error message element for a field */
function _getErrEl(field) {
  const errId = field.id ? `fv-err-${field.id}` : null;
  if (errId) {
    let el = document.getElementById(errId);
    if (!el) {
      el = document.createElement('span');
      el.id = errId;
      el.className = 'fv-error-msg';
      el.setAttribute('role', 'alert');
      el.setAttribute('aria-live', 'polite');
      field.insertAdjacentElement('afterend', el);
    }
    return el;
  }
  return null;
}

function _markInvalid(field, message) {
  field.classList.add('fv-invalid');
  field.classList.remove('fv-valid');
  field.setAttribute('aria-invalid', 'true');
  const errEl = _getErrEl(field);
  if (errEl) errEl.textContent = message;
}

function _markValid(field) {
  field.classList.remove('fv-invalid');
  field.classList.add('fv-valid');
  field.setAttribute('aria-invalid', 'false');
  const errEl = _getErrEl(field);
  if (errEl) errEl.textContent = '';
}

function _clearState(field) {
  field.classList.remove('fv-invalid', 'fv-valid');
  field.removeAttribute('aria-invalid');
  const errEl = _getErrEl(field);
  if (errEl) errEl.textContent = '';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^(\+?9?0?[\s\-]?)?\(?5[0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;

/** Validate a single field according to data-fv-* attributes.
 *  Returns true if valid, false if invalid. */
function validateField(field) {
  const val = field.value.trim();

  // required
  if (field.required && !val) {
    _markInvalid(field, field.dataset.fvRequired || 'Bu alan zorunludur.');
    return false;
  }

  // email
  if (field.type === 'email' && val && !EMAIL_RE.test(val)) {
    _markInvalid(field, field.dataset.fvEmail || 'Geçerli bir e-posta adresi girin.');
    return false;
  }

  // minlength
  const minLen = parseInt(field.dataset.fvMinlength || field.minLength || 0);
  if (minLen > 0 && val && val.length < minLen) {
    _markInvalid(field, field.dataset.fvMinlengthMsg || `En az ${minLen} karakter giriniz.`);
    return false;
  }

  // phone (optional — only validated when non-empty)
  if (field.dataset.fvPhone && val) {
    const digits = val.replace(/\D/g, '');
    // Accept 10–13 digits (covers +90 5XX XXX XX XX → 12 digits, or 0 5XX... → 11, or 5XX... → 10)
    if (digits.length < 10 || digits.length > 13) {
      _markInvalid(field, field.dataset.fvPhoneMsg || 'Geçerli bir telefon numarası girin.');
      return false;
    }
  }

  // match another field
  const matchId = field.dataset.fvMatch;
  if (matchId) {
    const other = document.getElementById(matchId);
    if (other && field.value !== other.value) {
      _markInvalid(field, field.dataset.fvMatchMsg || 'Girilen değerler eşleşmiyor.');
      return false;
    }
  }

  // custom min for number
  if (field.type === 'number' && field.required && val !== '') {
    const num = parseFloat(val);
    const min = parseFloat(field.min);
    if (!isNaN(min) && num < min) {
      _markInvalid(field, `En az ${min} olmalıdır.`);
      return false;
    }
  }

  // All good
  if (val) _markValid(field);
  else _clearState(field);
  return true;
}

/* ─────────────────────────────────────────────
   Public API
   ───────────────────────────────────────────── */

/**
 * Attach blur validation to all validatable fields inside `form`.
 * @param {HTMLFormElement} form
 * @param {object} [opts]
 * @param {function} [opts.onSubmit] — called with (isValid, form) on submit. Return false to cancel.
 */
export function attachValidation(form, opts = {}) {
  if (!form) return;

  const fields = [...form.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')];

  // Blur validation
  fields.forEach(field => {
    // Skip if explicitly opted out
    if (field.dataset.fvSkip) return;
    field.addEventListener('blur', () => validateField(field));
    // Also re-validate on input after first blur so feedback updates in real-time
    field.addEventListener('input', () => {
      if (field.classList.contains('fv-invalid') || field.classList.contains('fv-valid')) {
        validateField(field);
      }
    });
  });

  // Submit validation — run all fields first
  form.addEventListener('submit', (e) => {
    let allValid = true;
    let firstInvalid = null;
    fields.forEach(field => {
      if (field.dataset.fvSkip) return;
      if (!validateField(field)) {
        allValid = false;
        if (!firstInvalid) firstInvalid = field;
      }
    });
    if (!allValid) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (firstInvalid) {
        firstInvalid.focus();
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (opts.onSubmit) opts.onSubmit(false, form);
      return;
    }
    if (opts.onSubmit) {
      const result = opts.onSubmit(true, form);
      if (result === false) e.preventDefault();
    }
  }, true /* capture — runs before other submit handlers */);
}

/**
 * Manually validate a form and return true/false.
 * Does not prevent submission — caller decides.
 */
export function validateForm(form) {
  if (!form) return true;
  const fields = [...form.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea')];
  let allValid = true;
  let firstInvalid = null;
  fields.forEach(field => {
    if (field.dataset.fvSkip) return;
    if (!validateField(field)) {
      allValid = false;
      if (!firstInvalid) firstInvalid = field;
    }
  });
  if (!allValid && firstInvalid) {
    firstInvalid.focus();
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return allValid;
}
