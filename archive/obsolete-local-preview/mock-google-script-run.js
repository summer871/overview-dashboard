(function installLocalAppsScriptPreview() {
  'use strict';

  const CURRENT_YEAR = 2026;
  const PRIOR_YEAR = 2025;
  const CURRENT_MONTH = 7;
  const GENERATED_AT = '2026-07-22T08:00:00-07:00';
  const CACHE_TOKEN = 'local-remake-preview-v2';
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const customers = [
    ['100101', 'Harbor Dental Group', 'Harbor Dental Group', 1],
    ['100102', 'Mission Family Dentistry', 'Mission Family Dentistry', 1],
    ['100103', 'Peninsula Prosthodontics', 'Peninsula Prosthodontics', 1],
    ['100104', 'Bayview Smiles', 'Bayview Smiles', 1],
    ['100105', 'Sunset Dental Arts', 'Sunset Dental Arts', 1],
    ['100106', 'North County Dental', 'North County Dental', 0],
    ['100107', 'Marina Implant Center', 'Marina Implant Center', 1],
    ['100108', 'Redwood Restorative', 'Redwood Restorative', 1],
    ['100109', 'Golden Gate Dental', 'Golden Gate Dental', 1],
    ['100110', 'Pacific Heights Dental', 'Pacific Heights Dental', 1],
    ['100111', 'Coastside Dentistry', 'Coastside Dentistry', 1],
    ['100112', 'Burlingame Dental Studio', 'Burlingame Dental Studio', 1],
    ['100113', 'San Mateo Prosthodontics', 'San Mateo Prosthodontics', 1],
    ['100114', 'Daly City Family Dental', 'Daly City Family Dental', 1],
    ['100115', 'South Bay Implant Center', 'South Bay Implant Center', 1],
    ['100116', 'Pacifica Dental Care', 'Pacifica Dental Care', 1]
  ];

  const products = [
    ['F100', 'Solid Zirconia Crown', 'Fixed', 'Solid Zirconia', 155],
    ['F101', 'Solid Zirconia Bridge Unit', 'Fixed', 'Solid Zirconia', 165],
    ['F110', 'Layered Zirconia Crown', 'Fixed', 'Layered Zirconia', 245],
    ['F120', 'Emax Crown', 'Fixed', 'Emax', 315],
    ['F121', 'Emax Veneer', 'Fixed', 'Emax', 325],
    ['F130', 'PFM Crown', 'Fixed', 'PFM', 225],
    ['F140', 'Gold Crown', 'Fixed', 'Gold Crown', 575],
    ['F150', 'Hybrid Crown', 'Fixed', 'Hybrid', 295],
    ['I200', 'Implant Zirconia Crown', 'Implant', 'Implant Crown', 295],
    ['I210', 'Custom Abutment', 'Implant', 'Implant Part', 265],
    ['I220', 'Implant Verification Jig', 'Implant', 'Implant Part', 175],
    ['R300', 'Printed Model', 'Removable', 'Printed Model', 55],
    ['R310', 'RPD Framework', 'Removable', 'RPD', 495],
    ['R320', 'Denture Process and Finish', 'Removable', 'Denture', 285],
    ['N400', 'Comfort Nightguard', 'Nightguard', 'Nightguard', 165],
    ['A500', 'Alloy Crown', 'Alloy', 'Alloy Crown', 210],
    ['P600', 'Full Arch Prototype', 'Advanced Prosthetics', 'Full Arch', 1250],
    ['S700', 'Reline and Repair', 'Services', 'Reline & Repair', 145],
    ['S710', 'Diagnostic Wax-Up', 'Services', 'Service', 95],
    ['H800', 'Shipping', 'Shipping', 'Shipping', 18]
  ];

  const remakeReasons = [
    'Adjust Shade',
    'Adjust Fit',
    'Add Mesial Contact',
    'Margin Open',
    'Add Distal Contact',
    'Warranty',
    'Chipped or fractured',
    'Adjust Occlusion',
    'Margin Short',
    'New Impression',
    'Adjust Porcelain',
    'Add porcelain',
    'Change Material'
  ];

  const weightedProductIndexes = [0, 0, 0, 1, 2, 2, 3, 4, 5, 6, 7, 8, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

  function buildOverviewRows() {
    const rows = [];
    [2024, PRIOR_YEAR, CURRENT_YEAR].forEach(function(year) {
      const lastMonth = year === CURRENT_YEAR ? CURRENT_MONTH : 12;
      for (let month = 1; month <= lastMonth; month += 1) {
        customers.forEach(function(customer, customerIndex) {
          products.slice(0, 12).forEach(function(product, productIndex) {
            if ((customerIndex + productIndex + month) % 3 === 0) return;
            const units = 1 + ((year + month + customerIndex + productIndex) % 5);
            const netRevenue = Math.round(units * product[4] * (0.94 + ((customerIndex + month) % 6) * 0.01) * 100) / 100;
            const day = 3 + ((customerIndex * 3 + productIndex * 2 + month) % 24);
            rows.push({
              year: year,
              monthNum: month,
              monthLabel: monthNames[month - 1],
              invoiceDate: String(year) + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'),
              dayOfMonth: day,
              productsDepartment: product[2],
              isMainDepartment: true,
              productsGroup: product[3],
              productsCategory: product[3],
              productsType: product[3],
              productsDescription: product[1],
              productId: product[0],
              customerId: customer[0],
              customerName: customer[1],
              customerActive: customer[3] !== 0,
              netRevenue: netRevenue,
              units: units
            });
          });
        });
      }
    });
    return rows;
  }

  function buildRemakeRows() {
    const rows = [];
    let sequence = 0;
    [PRIOR_YEAR, CURRENT_YEAR].forEach(function(year) {
      for (let month = 1; month <= CURRENT_MONTH; month += 1) {
        const casesThisMonth = year === CURRENT_YEAR ? 155 : 145;
        for (let caseIndex = 0; caseIndex < casesThisMonth; caseIndex += 1) {
          sequence += 1;
          const customer = customers[(caseIndex * 5 + month * 3 + year) % customers.length];
          const product = products[weightedProductIndexes[(caseIndex * 7 + month * 5 + year) % weightedProductIndexes.length]];
          const quantity = 1 + ((caseIndex + month + product[0].charCodeAt(0)) % 4);
          const remakeSeed = (caseIndex * 11 + month * 13 + year + product[0].charCodeAt(1)) % 100;
          const isRemake = remakeSeed < (year === CURRENT_YEAR ? 7 : 6);
          const reason = isRemake ? remakeReasons[(caseIndex + month * 2 + product[0].charCodeAt(0)) % remakeReasons.length] : 'Not a remake';
          const discountRate = isRemake ? ([0.25, 0.5, 0.75, 1][(caseIndex + month) % 4]) : 0;
          const chargeAmount = Math.round(quantity * product[4] * 100) / 100;
          const remakeDiscount = isRemake ? Math.round(chargeAmount * discountRate * 100) / 100 : 0;
          const day = 1 + ((caseIndex * 3 + month) % 27);
          const caseId = String(year) + String(month).padStart(2, '0') + String(sequence).padStart(6, '0');
          const monthKey = String(year) + '-' + String(month).padStart(2, '0');
          rows.push({
            month: monthKey,
            year: year,
            invoiceDate: monthKey + '-' + String(day).padStart(2, '0'),
            caseId: caseId,
            customerId: customer[0],
            customerKey: customer[0],
            customerName: customer[1],
            practiceName: customer[2],
            customerDisplayLabel: customer[1] + ' (' + customer[0] + ')',
            customerActive: customer[3] !== 0,
            department: product[2],
            productId: product[0],
            productKey: product[0],
            productName: product[1],
            productGroup: product[3],
            remakeReason: reason,
            quantity: quantity,
            units: quantity,
            isRemake: isRemake,
            remakeUnits: isRemake ? quantity : 0,
            remakeDiscount: remakeDiscount,
            isRealInvoicedCharge: true,
            chargeAmount: chargeAmount,
            remakeDiscountSource: isRemake ? 'Product line remake discount' : ''
          });
        }
      }
    });
    return rows;
  }

  const overviewPayload = {
    ok: true,
    preview: true,
    generatedAt: GENERATED_AT,
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
      return { customerId: customer[0], customerActive: customer[3] !== 0 };
    })
  };

  const remakeRows = buildRemakeRows();
  const remakePayload = {
    ok: true,
    preview: true,
    version: 'Local Remake Preview v2',
    generatedAt: GENERATED_AT,
    sourceGeneratedAt: GENERATED_AT,
    currentSourceGeneratedAt: GENERATED_AT,
    browserReadyBuiltAt: GENERATED_AT,
    source: 'Local sample Remake Factor data',
    message: '',
    cacheToken: CACHE_TOKEN,
    dateRange: { startDate: '2025-01-01', endDate: '2026-07-22', lookbackMonths: 19 },
    stats: { browserReadyConsolidated: true, browserRows: remakeRows.length, preview: true },
    browserReadyRowCount: remakeRows.length,
    browserReadyStale: false,
    browserRowsNormalized: true,
    browserRowSchema: 'remakeBrowserRowV1323',
    rows: remakeRows
  };

  function dictionaryIndex(state, name, value) {
    const key = JSON.stringify(value);
    if (!state.maps[name].has(key)) {
      state.maps[name].set(key, state.values[name].length);
      state.values[name].push(value);
    }
    return state.maps[name].get(key);
  }

  function packRemakePayload() {
    const names = ['months', 'dates', 'cases', 'customers', 'departments', 'products', 'groups', 'reasons', 'discountSources'];
    const state = { values: {}, maps: {} };
    names.forEach(function(name) {
      state.values[name] = [];
      state.maps[name] = new Map();
    });

    const packedRows = remakeRows.map(function(row) {
      const customer = [row.customerId, row.customerName, row.practiceName, row.customerActive ? 1 : 0];
      const product = [row.productId, row.productName];
      return [
        dictionaryIndex(state, 'months', row.month),
        dictionaryIndex(state, 'dates', row.invoiceDate),
        dictionaryIndex(state, 'cases', row.caseId),
        dictionaryIndex(state, 'customers', customer),
        dictionaryIndex(state, 'departments', row.department),
        dictionaryIndex(state, 'products', product),
        dictionaryIndex(state, 'groups', row.productGroup),
        dictionaryIndex(state, 'reasons', row.remakeReason),
        row.quantity,
        row.isRemake ? 1 : 0,
        row.remakeUnits,
        row.remakeDiscount,
        row.isRealInvoicedCharge ? 1 : 0,
        row.chargeAmount,
        dictionaryIndex(state, 'discountSources', row.remakeDiscountSource)
      ];
    });

    return {
      ok: true,
      version: 'RemakeFactorBrowserReady local preview v1',
      storageMode: 'browserReadyConsolidatedGzip',
      generatedAt: GENERATED_AT,
      source: 'Local sample Remake Factor data',
      message: '',
      dateRange: remakePayload.dateRange,
      stats: remakePayload.stats,
      cacheToken: CACHE_TOKEN,
      browserRowsPacked: true,
      browserRowSchema: 'remakeBrowserPackedV1330',
      rows: packedRows,
      dictionaries: state.values
    };
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(index, Math.min(index + chunkSize, bytes.length)));
    }
    return window.btoa(binary);
  }

  let browserReadyPromise = null;
  function getBrowserReadyEnvelope() {
    if (browserReadyPromise) return browserReadyPromise;
    browserReadyPromise = (async function() {
      if (typeof window.CompressionStream !== 'function') {
        throw new Error('This browser does not support the local gzip preview fixture.');
      }
      const packed = packRemakePayload();
      const sourceBytes = new TextEncoder().encode(JSON.stringify(packed));
      const stream = new Blob([sourceBytes]).stream().pipeThrough(new CompressionStream('gzip'));
      const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
      return {
        ok: true,
        preview: true,
        payloadBase64: bytesToBase64(compressed),
        cacheToken: CACHE_TOKEN,
        generatedAt: GENERATED_AT,
        sourceGeneratedAt: GENERATED_AT,
        currentSourceGeneratedAt: GENERATED_AT,
        browserReadyBuiltAt: GENERATED_AT,
        browserReadyRowCount: remakeRows.length,
        browserReadyStale: false
      };
    })();
    return browserReadyPromise;
  }

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
      return remakePayload;
    },
    getRemakeFactorBrowserReadyMetaV1330: function() {
      return {
        ok: true,
        preview: true,
        cacheToken: CACHE_TOKEN,
        generatedAt: GENERATED_AT,
        sourceGeneratedAt: GENERATED_AT,
        currentSourceGeneratedAt: GENERATED_AT,
        browserReadyBuiltAt: GENERATED_AT,
        rowCount: remakeRows.length,
        browserReadyRowCount: remakeRows.length,
        stale: false,
        browserReadyStale: false
      };
    },
    getRemakeFactorBrowserReadyDataV1330: function() {
      return getBrowserReadyEnvelope();
    },
    refreshRemakeFactorOpenMonthsCacheV150: function() {
      return { ok: true, preview: true, message: 'Local preview refresh completed.', cacheToken: CACHE_TOKEN };
    },
    refreshRemakeFactorDailyCache: function() {
      return { ok: true, preview: true, message: 'Local preview refresh completed.', cacheToken: CACHE_TOKEN };
    },
    getCeramistRemakeAnalysisCacheMeta: function() {
      return { ok: false, preview: true, cacheToken: '', message: 'Technician fixture is not loaded yet.' };
    },
    getCeramistRemakeAnalysisData: function() {
      return { ok: false, preview: true, rows: [], message: 'Technician fixture is not loaded yet.' };
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
              Promise.resolve(result)
                .then(function(value) { successHandler(value, userObject); })
                .catch(function(error) { failureHandler(error, userObject); });
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
