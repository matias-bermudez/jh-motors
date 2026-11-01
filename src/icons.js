// Íconos SVG tal cual el diseño. Uso en EJS: <%- icon.wa(18) %>
const svg = (paths, { size = 18, stroke = 'currentColor', width = 1.9, style = '' } = {}) =>
  `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${style ? ` style="${style}"` : ''}>${paths}</svg>`;

const CAR_PATHS = '<path d="M58 46 L70 24 Q100 18 130 24 L142 46"></path><path d="M26 70 L30 56 Q34 47 50 46 L150 46 Q166 47 170 56 L174 70 L174 78 Q174 82 170 82 L30 82 Q26 82 26 78 Z"></path><path d="M36 60 Q46 63 62 63M164 60 Q154 63 138 63M82 72 L118 72M34 82 L34 90 L52 90 L52 82M148 82 L148 90 L166 90 L166 82"></path>';

module.exports = {
  wa: (size = 18) => svg('<path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.3A8.5 8.5 0 1 1 21 12z"></path>', { size }),
  arrowRight: (size = 18) => svg('<path d="M5 12h14M13 6l6 6-6 6"></path>', { size, width: 2 }),
  arrowLeft: (size = 16) => svg('<path d="M19 12H5M11 6l-6 6 6 6"></path>', { size, width: 2 }),
  chevronLeft: (size = 20) => svg('<path d="M15 6l-6 6 6 6"></path>', { size, width: 2 }),
  chevronRight: (size = 20) => svg('<path d="M9 6l6 6-6 6"></path>', { size, width: 2 }),
  warning: (size = 18, style = 'flex-shrink: 0') => svg('<path d="M12 3l10 18H2L12 3z"></path><path d="M12 10v5M12 18v.01"></path>', { size, stroke: '#FF3B30', style }),
  camera: (size = 16, stroke = 'currentColor') => svg('<path d="M4 8h3l2-3h6l2 3h3v12H4z"></path><circle cx="12" cy="14" r="3.5"></circle>', { size, stroke, width: 1.8 }),
  search: () => svg('<circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path>', { stroke: '#8A8A93', style: 'position: absolute; left: 14px; top: 13px' }),
  check: (size = 18, style = 'flex-shrink: 0; margin-top: 1px') => svg('<path d="M5 12l5 5 9-10"></path>', { size, stroke: '#FF3B30', width: 2.2, style }),
  pin: (size = 16, stroke = '#8A8A93', width = 1.8) => svg('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"></path><circle cx="12" cy="10" r="2.5"></circle>', { size, stroke, width }),
  calendar: () => svg('<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>', { size: 16, stroke: '#8A8A93', width: 1.8 }),
  gauge: () => svg('<path d="M4 17a8 8 0 1 1 16 0"></path><path d="M12 17l4-5"></path>', { size: 16, stroke: '#8A8A93', width: 1.8 }),
  fuel: () => svg('<path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14M15 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3M8 8h4"></path>', { size: 16, stroke: '#8A8A93', width: 1.8 }),
  gearbox: () => svg('<circle cx="6" cy="5" r="2"></circle><circle cx="12" cy="5" r="2"></circle><circle cx="18" cy="5" r="2"></circle><circle cx="6" cy="19" r="2"></circle><circle cx="12" cy="19" r="2"></circle><path d="M6 7v10M12 7v10M18 7v5H6"></path>', { size: 16, stroke: '#8A8A93', width: 1.8 }),
  engine: () => svg('<path d="M4 10h3l2-3h5l2 3h4v8h-4l-2 2H9l-2-2H4z"></path>', { size: 16, stroke: '#8A8A93', width: 1.8 }),
  // Silueta de auto para cuando todavía no hay fotos.
  car: (width = '46%', stroke = '#4A4A52', strokeWidth = 2) =>
    `<svg aria-hidden="true" viewBox="0 0 200 100" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" style="width: ${width}; height: auto">${CAR_PATHS}</svg>`,
  carSplit: () =>
    `<svg aria-hidden="true" viewBox="0 0 200 100" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width: 68%; height: auto"><defs><linearGradient id="split" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3E8EDE"></stop><stop offset="0.5" stop-color="#3E8EDE"></stop><stop offset="0.5" stop-color="#FF3B30"></stop><stop offset="1" stop-color="#FF3B30"></stop></linearGradient></defs><g stroke="url(#split)">${CAR_PATHS}</g></svg>`
};
