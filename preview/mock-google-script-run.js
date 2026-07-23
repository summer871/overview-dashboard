(function installLocalAppsScriptPreview() {
  'use strict';

  const CURRENT_YEAR = 2026;
  const PRIOR_YEAR = 2025;
  const THIRD_YEAR = 2024;
  const CURRENT_MONTH = 7;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const customers = [
    { id: '100101', name: 'Harbor Dental Group', active: true },
    { id: '100102', name: 'Mission Family Dentistry', active: true },
    { id: '100103', name: 'Peninsula Prosthodontics', active: true },
    { id: '100104', name: 'Bayview Smiles', active: true },
    { id: '100105', name: 'Sunset Dental Arts', active: true },
    { id: '100106', name: 'North County Dental', active: false },
    { id: '100107', name: 'Marina Implant Center', active: true },
    { id: '100108', name: 'Redwood Restorative', active: true }
  ];

  const products = [
    { id: 'P100', department: 'Fixed', group: 'Zirconia', category: 'Crown', type: 'Posterior', description: 'Fixed - Zirfit Prime - Posterior Crown', price: 155 },
    { id: 'P110', department: 'Fixed', group: 'Emax', category: 'Crown', type: 'Anterior', description: 'Fixed - Emax - Anterior Crown, Layered', price: 315 },
    { id: 'P200', department: 'Implant', group: 'Implant Crown', category: 'Crown', type: 'Posterior', description: 'Implant - Zirfit Prime - Posterior Crown', price: 295 },
    { id: 'P210', department: 'Implant', group: 'Abutment', category: 'Abutment', type: 'Custom', description: 'Implant - CDA Abutment', price: 265 },
    { id: 'P300', department: 'Removable', group: 'Denture', category: 'Process', type: 'Full Denture', description: 'REM - Denture - Process & Finish', price: 285 },
    { id: 'P400', department: 'Nightguard', group: 'Nightguard', category: 'Appliance', type: 'Comfortguard', description: 'Nightguard - Comfortguard', price: 165 }
  ];

  function seededValue(year, month, customerIndex, productIndex) {
    const yearFactor = year === CURRENT_YEAR ? 1.09 : year === PRIOR_YEAR ? 1 : 0.91;
    const seasonal = 0.82 + ((month * 17) % 7) * 0.055;
    const account = 0.72 + customerIndex * 0.12;
    const product = 0.78 + productIndex * 0.09;
    return yearFactor * seasonal * account * product;
  }

  function buildOverviewRows() {
    const rows = [];
    [THIRD_YEAR, PRIOR_YEAR, CURRENT_YEAR].forEach(function(year) {
      const lastMonth = year === CURRENT_YEAR ? CURRENT_MONTH : 12;
      for (let month = 1; month <= lastMonth; month += 1) {
        customers.forEach(function(customer, customerIndex) {
          products.forEach(function(product, productIndex) {
            if ((customerIndex + productIndex + month) % 3 === 0) return;
            const units = Math.max(1, Math.round(seededValue(year, month, customerIndex, productIndex) * (2 + ((month + productIndex) % 5))));
            const adjustment = 0.94 + (((customerIndex * 7 + month * 3 + productIndex) % 11) * 0.012);
            const netRevenue = Math.round(units * product.price * adjustment * 100) / 100;
            const day = 4 + ((customerIndex * 3 + productIndex * 2 + month) % 22);
            rows.push({
              year: year,
              monthNum: month,
              monthLabel: monthNames[month - 1],
              invoiceDate: String(year) + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
              dayOfMonth: day,
              productsDepartment: product.department,
              isMainDepartment: true,
              productsGroup: product.group,
              productsCategory: product.category,
              productsType: product.type,
              productsDescription: product.description,
              productId: product.id,
              customerId: customer.id,
              customerName: customer.name,
              customerActive: customer.active,
              netRevenue: netRevenue,
              units: units
            });
          });
        });
      }
    });
    return rows;
  }

  const overviewPayload = {
    ok: true,
    preview: true,
    generatedAt: '2026-07-22T08:00:00-07:00',
    message: 'Local preview data',
    config: {
      currentYear: CURRENT_YEAR,
      priorYear: PRIOR_YEAR,
      currentMonthNum: CURRENT_MONTH,
      currentMonth: CURRENT_MONTH,
      asOfDate: '2026-07-22'
    },
    factRows: buildOverviewRows(),
    customerStatusRows: customers.map(function(customer) {
      return { customerId: customer.id, customerActive: customer.active };
    })
  };

  const handlers = {
    getOverviewDashboardData: function() {
      return overviewPayload;
    },
    getDashboardPresentationMode: function() {
      return { ok: true, mode: 'all', preview: true };
    },
    getDashboardBaseUrl: function() {
      return window.location.origin + window.location.pathname;
    },
    getOverviewDashboardStatus: function() {
      return { ok: true, preview: true, generatedAt: overviewPayload.generatedAt, rowCount: overviewPayload.factRows.length };
    },
    refreshOverviewDashboardCache: function() {
      return { ok: true, preview: true, message: 'Preview simulation only. No Apps Script cache was changed.' };
    },
    getRemakeFactorData: function() {
      return { ok: false, preview: true, rows: [], message: 'Remake data is not included in the first local preview fixture.' };
    },
    getRemakeFactorBrowserReadyMetaV1330: function() {
      return { ok: false, preview: true, message: 'Remake preview fixture is not loaded.' };
    },
    getRemakeFactorBrowserReadyDataV1330: function() {
      return { ok: false, preview: true, message: 'Remake preview fixture is not loaded.' };
    },
    getCeramistRemakeAnalysisCacheMeta: function() {
      return { ok: false, preview: true, cacheToken: '', message: 'Ceramist preview fixture is not loaded.' };
    },
    getCeramistRemakeAnalysisData: function() {
      return { ok: false, preview: true, rows: [], message: 'Ceramist preview fixture is not loaded.' };
    }
  };

  function createRunner() {
    let successHandler = function() {};
    let failureHandler = function(error) { console.error(error); };
    let userObject;

    const target = {
      withSuccessHandler: function(handler) {
        successHandler = typeof handler === 'function' ? handler : function() {};
        return proxy;
      },
      withFailureHandler: function(handler) {
        failureHandler = typeof handler === 'function' ? handler : function(error) { console.error(error); };
        return proxy;
      },
      withUserObject: function(value) {
        userObject = value;
        return proxy;
      }
    };

    const proxy = new Proxy(target, {
      get: function(object, property) {
        if (property in object) return object[property];
        return function() {
          const args = Array.prototype.slice.call(arguments);
          window.setTimeout(function() {
            try {
              const handler = handlers[property];
              const result = handler
                ? handler.apply(null, args)
                : { ok: true, preview: true, message: String(property) + ' was simulated locally.' };
              successHandler(result, userObject);
            } catch (error) {
              failureHandler(error, userObject);
            }
          }, 90);
          return proxy;
        };
      }
    });

    return proxy;
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, 'run', {
    configurable: true,
    get: function() {
      return createRunner();
    }
  });

  function addPreviewBadge() {
    if (document.getElementById('cdaLocalPreviewBadge')) return;
    const badge = document.createElement('div');
    badge.id = 'cdaLocalPreviewBadge';
    badge.textContent = 'LOCAL PREVIEW · SAMPLE DATA';
    badge.title = 'This page is running locally. No Apps Script data or cache is being changed.';
    badge.style.cssText = [
      'position:fixed',
      'right:12px',
      'bottom:12px',
      'z-index:2147483647',
      'padding:7px 10px',
      'border-radius:999px',
      'background:#202124',
      'color:#fff',
      'font:700 11px/1.2 Arial,sans-serif',
      'letter-spacing:.04em',
      'box-shadow:0 2px 8px rgba(0,0,0,.25)',
      'pointer-events:none'
    ].join(';');
    document.body.appendChild(badge);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addPreviewBadge);
  else addPreviewBadge();
})();
