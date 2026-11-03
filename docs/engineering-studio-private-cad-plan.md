# Trinity Engineering Studio — private CAD integration plan (REV 00)

Status: **Design specification only. Not deployed. Not a CAD model.**

## Security boundary
The current repository is PUBLIC and GitHub Pages serves its published files publicly. Do not add confidential geometry, proprietary burner internals, trade-secret controls, customer records, CAD source models, access tokens, or a password-only client-side gate to this repository.

A private, authenticated engineering application with server-enforced authorization, private model storage, audit logs, and controlled CAD processing must be provisioned separately before handling restricted data. Public site may link to it after security review; no public navigation link should be added until access is verified.

## Five controlled work packages
- TC-BNR-G1: Existing burner — retrieve approved source, verify native geometry, revisions, mounting and interfaces.
- TC-PMP: Pump — retrieve approved source, verify 3D assembly, fit, interfaces and revision authority.
- TC-HX: Heat exchanger — retrieve approved source, preserve helix insert, verify connections and service envelope.
- TC-TC1: Turbocharger — first-article 3D model not yet verified; develop only from controlled requirements; rotor dynamics, bearings, position-feedback wastegate, trip/coast-down and qualification remain open.
- TC-BNR-G2: Generation 2 burner — separate development design, **not** approved for manufacture.

## Generation 2 sanitized handoff
External files: assembly envelope, mounting pattern, interfaces, maintenance clearances, generic service modules, sanitized BOM and neutral STEP / drawing DXF or DWG export after source reconciliation. Restricted files: protected combustion method, internal mixing geometry, proprietary orifice/reflector configuration, sensitive control logic and trade-secret know-how. Do not embed restricted data in public previews, filenames, model metadata or exported meshes.

## Engineering loop
1. Import verified source CAD and associated revision record.
2. Validate units, coordinate system, datum structure and interface control drawing.
3. User requests an edit in the private UI; CAD engine applies a parametric change to an editable model.
4. Generate preview and change comparison; log source, author, timestamp and revision.
5. Engineering approval gate; export native CAD and STEP, plus controlled drawings.
6. Separate manufacturing-release and independent performance/safety verification gates.

## Implementation acceptance gates
- Choose private hosting and authentication; establish role-based access for management, Adam and approved designers.
- Choose CAD backend/API (e.g. Onshape enterprise/private workspace or self-hosted parametric CAD worker), confirm license, integration permissions and export capabilities.
- Inventory and ingest existing CAD source files without overwriting originals.
- Create sanitized Generation 2 starter assembly **only after** approved dimensional/interface inputs are retrieved.
- Test access denial, export redaction, audit logs, backup and revision rollback.
- Keep GitHub Pages marketing site isolated from private design storage.

No claims of completed geometry, secure deployment, manufacturing validation or released drawings are authorized by this plan.
