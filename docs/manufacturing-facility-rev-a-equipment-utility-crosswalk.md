# Factory Equipment-to-Plan-to-Utility Reconciliation | REV A
**Control:** internal working crosswalk, not an equipment procurement schedule or approved design. **Source:** Jack's 2026-11-06 manufacturing handoff; underlying original factory drawings not yet inspected.

## Document-level reconciliation
| Subject | Historical reference A | Historical reference B | Controlling value | Required evidence |
| --- | --- | --- | --- | --- |
| Factory area | ~250,000 sq ft | ~312,000 sq ft | UNDETERMINED | Original approved dimensioned architectural plan, revision chain, site constraints |
| Production bays | 10 | 12 | UNDETERMINED | Approved bay/room plan and MFG-09.73 equipment assignment crosswalk |
| Incoming/transformer | MFG-09.75: 13.8 kV incoming, 3,000 kVA transformer | Other source: 4,000 kVA design / 2,650 kVA peak | UNDETERMINED | Stamped electrical basis, connected/demand loads, utility confirmation |
| Distribution/standby | MFG-09.75: 4,000 A at 480 V; 2,000 kW / 2,500 kVA standby | Other electrical schedule unknown | UNDETERMINED | Approved one-line and equipment load/safety classification |
| Production equipment | MFG-09.73: 36 major lines / 66 units, 12 bay assignments | Original OEM/quantity schedule not yet recovered | UNDETERMINED | Source schedule and current revision |
| Factory equipment budget | MFG-09.73: $7,694,700 installed allowance | Historical machinery line ~$8.5m in ~$73m central factory CAPEX | OVERLAP UNKNOWN | Cost code crosswalk, dated sources and exclusions |
| Factory kitchen | Historical 5,000 sq ft | Original room sheet unknown | UNVERIFIED | Approved kitchen plan, hoods, suppression and OEMs |
| Dedicated laboratory | Water quality + manufacturing QA required | Room sheet/instruments unknown | UNVERIFIED | Approved lab plan, HVAC, safety, utilities and instrumentation |

## Equipment row template (one row per original equipment ID, not per invented machine)
| Equipment ID | Source drawing / revision | Equipment family | OEM / model | Qty | Bay / room / coordinates | Footprint + maintenance clearance | Mass / rigging / foundations | Voltage / phase / connected kW / demand kVA | Air / cooling / gas / water / drainage | Exhaust / safety | Cost code / allowance / lead time | GC/OEM procurement + installation | FAT/SAT / warranty | Evidence status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **PENDING ORIGINAL MFG-09.73** | Unverified | CNC / machining / additive | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | HOLD |
| **PENDING ORIGINAL MFG-09.73** | Unverified | Welding / fabrication / robotics | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | HOLD |
| **PENDING ORIGINAL MFG-09.73** | Unverified | Assembly / testing / lifting | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | HOLD |
| **PENDING ORIGINAL MFG-09.85** | Unverified | Panels / MCC / PLC / VFD | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | HOLD |
| **PENDING KITCHEN SHEETS** | Unverified | Kitchen OEM / hood / suppression | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | HOLD |
| **PENDING LAB SHEETS** | Unverified | Water quality / QA instruments | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | OPEN | HOLD |

**Do not treat the placeholder rows as the 36 actual equipment IDs.** Expand only from recovered original schedules.

## Reconciliation sequence
1. Authenticate original drawing IDs, dates, revision status and approving authority.
2. Fix *one* controlling factory footprint and bay geometry from approved architectural sheets.
3. Map every actual equipment ID to the controlling bay, required clearances, handling and foundations.
4. Aggregate connected and coincident demand by voltage and bay; check utility one-line and standby essential-load scope.
5. Coordinate exhaust, process gases, lab segregation, commercial kitchen and test stands with fire/EHS.
6. Reconcile allowances to cost codes, explicitly identifying duplicate machinery entries.
7. Obtain independent engineering review and Jack's written sign-off before promoting rows to contractor exhibits.

**Release status: HOLD.** No design selection, engineering certification, bid solicitation, or purchase authorization is implied.
