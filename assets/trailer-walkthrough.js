/* Trinity Continuum eight-trailer presentation walkthrough.
 * Public explanations describe functions, not controlled CAD dimensions or certified output.
 * Correspondence: Gold TR01–TR06 + independently developed BFS-01 and DC-01 additions.
 */
(() => {
  'use strict';

  const trailers = [
    {
      number: '01', title: 'Feedwater pretreatment',
      category: 'Integrated utility core', role: 'Prepares incoming source water for the downstream integrated process.',
      points: [
        'Start with source-water conditions: quality, availability, and treatment needs vary by site.',
        'The pretreatment step supports downstream equipment and product-water quality objectives.',
        'Exact treatment selection, capacity, waste handling and interfaces depend on engineered requirements.'
      ],
      status: 'Conceptual functional assignment. Source-water testing and final equipment selections remain project-specific.'
    },
    {
      number: '02', title: 'Primary heating and turbo stage',
      category: 'Integrated utility core', role: 'Introduces the primary thermal and energy-transfer elements in the six-trailer process.',
      points: [
        'Discuss how the heating and heat-transfer portions interact with the broader water-and-power system.',
        'Explain the proposed thermal/turbo coupling at a high level, without disclosing proprietary geometry.',
        'Focus on fuel, heat recovery, control boundaries and safe system interfaces.'
      ],
      status: 'Operating envelopes, equipment geometry and thermal performance require controlled design closure and testing.'
    },
    {
      number: '03', title: 'Pump, expander and generation',
      category: 'Integrated utility core', role: 'Connects the fluid-power machinery to the proposed electrical generation pathway.',
      points: [
        'Explain the relationship between the pump, expansion equipment and electrical output in the integrated concept.',
        'Distinguish gross generation and useful net power after system auxiliaries and site electrical needs.',
        'Review interconnections, protection, commissioning and reliability with the buyer’s engineer.'
      ],
      status: 'A 1-MW-class design is a planning reference, not independently certified net delivered electrical output.'
    },
    {
      number: '04', title: 'Secondary thermal integration',
      category: 'Integrated utility core', role: 'Represents the secondary heating, turbo and heat-transfer portion of the process rail.',
      points: [
        'Show how the system concept coordinates additional thermal exchange with earlier stages.',
        'Discuss the difference between useful recovered heat and residual heat that must be safely rejected.',
        'Keep energy balances and engineering interfaces tied to the actual deployment.'
      ],
      status: 'Thermal balances, equipment selection and installed routing remain subject to design verification.'
    },
    {
      number: '05', title: 'Vacuum distillation and water finishing',
      category: 'Integrated utility core', role: 'Carries the proposed water-purification sequence through vacuum distillation, condensation and finishing.',
      points: [
        'Walk through the concept of purification, polishing, sampling and product-quality release.',
        'Describe water quality by intended application, not by an unverified universal purity claim.',
        'The six-trailer core has a modeled planning reference of approximately 30 million gallons per year at 8,000 operating hours.'
      ],
      status: 'The annual water figure is modeled, not a measured or independently certified production guarantee.'
    },
    {
      number: '06', title: 'Product-water storage',
      category: 'Integrated utility core', role: 'Provides the planned finished-water storage and delivery interface of the integrated core.',
      points: [
        'Explain the role of holding, sampling and controlled transfer before water reaches an intended customer.',
        'For the separate BFS module, a qualified sanitary water handoff is a proposed system interface.',
        'Storage volume, sanitary controls, connection points and dispatch arrangements depend on final design.'
      ],
      status: 'No blanket potable, pharmaceutical, sterile or other regulated-grade qualification is implied.'
    },
    {
      number: '07', title: 'BFS packaging addition',
      category: 'Separate proposed trailer', role: 'Proposed mobile blow–fill–seal (BFS) packaging and controlled water-finishing module.',
      points: [
        'The proposed flow is qualified incoming product water, finishing/holding, container forming, filling and sealing, inspection and packout.',
        'The concept calls for a controlled clean environment in a separately engineered 53-foot mobile module.',
        'Actual bottle formats, machine/cleanroom fit, capacity and regulatory pathway depend on vendor and engineering verification.'
      ],
      status: 'This is a development concept. Aseptic or sterile product approvals, equipment fit and production rates are not established.'
    },
    {
      number: '08', title: 'Data-center computing addition',
      category: 'Separate proposed trailer', role: 'Proposed mobile computing space with server racks and coordinated electrical, cooling and networking interfaces.',
      points: [
        'Discuss possible modular computing loads and utility integration without promising a finished data center.',
        'Rack service access, fire safety, structural load, cooling, UPS, power quality and redundancy must all be engineered.',
        'Concurrent data-center and BFS power demand is not verified to fit the six-trailer core’s modeled generation capability.'
      ],
      status: 'The rack count, continuous available power, heat rejection and commercial computing capacity are unapproved planning options.'
    }
  ];

  function init() {
    const grid = document.getElementById('trailer-walkthrough-grid');
    const dialog = document.getElementById('trailer-walkthrough-dialog');
    if (!grid || !dialog) return;

    const image = document.getElementById('trailer-detail-image');
    const title = document.getElementById('trailer-detail-title');
    const category = document.getElementById('trailer-detail-category');
    const summary = document.getElementById('trailer-detail-summary');
    const points = document.getElementById('trailer-detail-points');
    const status = document.getElementById('trailer-detail-status');
    const counter = document.getElementById('trailer-detail-counter');
    const previous = document.getElementById('trailer-detail-previous');
    const next = document.getElementById('trailer-detail-next');
    const close = document.getElementById('trailer-detail-close');

    let current = 0;
    let opener = null;
    let dialogFallback = false;

    trailers.forEach((trailer, index) => {
      const item = document.createElement('li');
      item.className = 'trailer-walkthrough-item';
      const button = document.createElement('button');
      button.className = 'trailer-walkthrough-card';
      button.type = 'button';
      button.setAttribute('aria-label', 'Open trailer ' + trailer.number + ': ' + trailer.title);
      const art = document.createElement('img');
      art.src = 'assets/trailer-walkthrough-' + trailer.number + '.svg';
      art.alt = 'Illustrative graphic for trailer ' + trailer.number + ', ' + trailer.title + '; not an equipment placement drawing';
      art.loading = 'lazy';
      art.width = 940;
      art.height = 510;
      const small = document.createElement('span');
      small.className = 'trailer-walkthrough-kind';
      small.textContent = trailer.category;
      const label = document.createElement('strong');
      label.textContent = trailer.number + ' · ' + trailer.title;
      const hint = document.createElement('span');
      hint.className = 'trailer-walkthrough-hint';
      hint.textContent = 'Open trailer details';
      button.append(art, small, label, hint);
      item.appendChild(button);
      grid.appendChild(item);
      button.addEventListener('click', () => {
        opener = button;
        show(index);
      });
    });

    function show(index) {
      current = (index + trailers.length) % trailers.length;
      const trailer = trailers[current];
      title.textContent = 'Trailer ' + trailer.number + ' · ' + trailer.title;
      category.textContent = trailer.category;
      summary.textContent = trailer.role;
      image.src = 'assets/trailer-walkthrough-' + trailer.number + '.svg';
      image.alt = 'Expanded conceptual illustration of trailer ' + trailer.number + ': ' + trailer.title;
      counter.textContent = 'Trailer ' + (current + 1) + ' of ' + trailers.length;
      points.replaceChildren();
      for (const point of trailer.points) {
        const li = document.createElement('li');
        li.textContent = point;
        points.appendChild(li);
      }
      status.textContent = trailer.status;
      const content = dialog.querySelector('.trailer-walkthrough-modal-content');
      if (content) content.scrollTop = 0;
      if (dialog.open || dialogFallback) return;
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialogFallback = true;
        dialog.classList.add('trailer-walkthrough-dialog-fallback');
        dialog.setAttribute('open','');
        dialog.setAttribute('role','dialog');
        dialog.setAttribute('aria-modal','true');
      }
      close.focus();
    }

    function exit() {
      if (dialogFallback) {
        dialogFallback = false;
        dialog.removeAttribute('open');
        dialog.removeAttribute('role');
        dialog.removeAttribute('aria-modal');
        dialog.classList.remove('trailer-walkthrough-dialog-fallback');
        restoreFocus();
      } else if (dialog.open) {
        dialog.close();
      }
    }

    function restoreFocus() {
      if (opener && opener.isConnected) opener.focus();
    }

    previous.addEventListener('click', () => show(current - 1));
    next.addEventListener('click', () => show(current + 1));
    close.addEventListener('click', exit);
    dialog.addEventListener('close', restoreFocus);
    dialog.addEventListener('click', event => {
      if (event.target === dialog) exit();
    });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        show(current - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        show(current + 1);
      } else if (dialogFallback && event.key === 'Escape') {
        event.preventDefault();
        exit();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }
})();
