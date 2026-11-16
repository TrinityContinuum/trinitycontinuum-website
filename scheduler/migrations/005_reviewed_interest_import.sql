-- Optional, reviewed import for the four genuinely interested, not-yet-booked contacts.
-- Run AFTER migrations 003 and 004, and only after verifying the live queue
-- does not already contain these leads. Never run automatically on deploy.
-- Phone fields deliberately NULL until confirmed by correspondence.
INSERT INTO scheduling_opportunities
(id,organization,contact_name,contact_email,subject,status,next_action,source_reference,notes,phone,location,proposed_times)
SELECT 'lead-inl-moorehead-20261115','Idaho National Laboratory','John Moorehead','John.Moorehead@inl.gov','Energy and Environmental Directorate partnership discussion','scheduling','Coordinate offered meeting windows and confirm with Jack','Gmail: Idaho DOE strategic partnership inquiry','Interested in initial technical discussion; suggested multiple Mountain Time windows.',NULL,'Idaho, USA','Nov 18, 19, 23, 24 or 25; confirm exact Mountain Time slot'
WHERE NOT EXISTS(SELECT 1 FROM scheduling_opportunities WHERE lower(contact_email)='john.moorehead@inl.gov');
INSERT INTO scheduling_opportunities
(id,organization,contact_name,contact_email,subject,status,next_action,source_reference,notes,phone,location,proposed_times)
SELECT 'lead-sfwmd-vitani-20261115','South Florida Water Management District','Nicholas Vitani','nvitani@sfwmd.gov','Water-use pre-application discussion','scheduling','Select offered slot with Jack; avoid DeSoto conflict','Gmail: South Florida water-use pre-application inquiry','Times offered in Eastern Time; Nov 16 3 PM ET conflicts with DeSoto County meeting.',NULL,'South Florida, USA','Nov 18 2:30 or 3 PM ET; Nov 19 9:30–11 AM ET'
WHERE NOT EXISTS(SELECT 1 FROM scheduling_opportunities WHERE lower(contact_email)='nvitani@sfwmd.gov');
INSERT INTO scheduling_opportunities
(id,organization,contact_name,contact_email,subject,status,next_action,source_reference,notes,phone,location)
SELECT 'lead-somerset-sines-20261115','Somerset County Planning Commission','Chadd Sines',NULL,'Data center ordinance and technical planning','interested','Offer virtual meeting times and request preferred contact details','Gmail: Somerset County data center ordinance — technical planning introduction','Contact offered virtual or in-person meeting; email address not verified from available excerpt.',NULL,'Somerset County, USA'
WHERE NOT EXISTS(SELECT 1 FROM scheduling_opportunities WHERE organization='Somerset County Planning Commission' AND contact_name='Chadd Sines');
INSERT INTO scheduling_opportunities
(id,organization,contact_name,contact_email,subject,status,next_action,source_reference,notes,phone,location,proposed_times)
SELECT 'lead-mdc-meyer-20261115','Missouri Department of Conservation','Jordan Meyer','Jordan.Meyer@mdc.mo.gov','Missouri data center water and environmental planning','scheduling','Confirm Jack availability and propose one offered date','Gmail: Missouri data center water and environmental planning','Contact offered introductory meeting.',NULL,'Missouri, USA','Nov 23–25; exact time not yet selected'
WHERE NOT EXISTS(SELECT 1 FROM scheduling_opportunities WHERE lower(contact_email)='jordan.meyer@mdc.mo.gov');
