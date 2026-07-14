-- Test data: 10 dummy clients for walkthrough/QA. All tagged source
-- 'Seed — Test Data' so they're easy to filter and delete later:
--   DELETE FROM public.leads WHERE source = 'Seed — Test Data';
-- Guarded so it inserts only once (no duplicates if the migration re-runs).

INSERT INTO public.leads
  (first_name, last_name, email, phone, full_name, stage, source,
   marital_status, veteran_status, state, household_size, monthly_income,
   sms_consent, dob, priority, notes)
SELECT v.first_name, v.last_name, v.email, v.phone, v.full_name,
       v.stage::public.lead_stage, v.source, v.marital_status, v.veteran_status,
       v.state, v.household_size, v.monthly_income, v.sms_consent, v.dob::date,
       v.priority, v.notes
FROM (VALUES
  ('Margaret','Thompson','margaret.thompson@example.com','+15550100101','Margaret Thompson','new','Seed — Test Data','Married with Community Spouse','Spouse of Veteran','NY',2,4200,true,'1946-03-12','high','Seeded test client.'),
  ('Robert','Chen','robert.chen@example.com','+15550100102','Robert Chen','new','Seed — Test Data','Single','Not a Veteran','NJ',1,1850,false,'1951-07-04','normal','Seeded test client.'),
  ('Dorothy','Williams','dorothy.williams@example.com','+15550100103','Dorothy Williams','intake','Seed — Test Data','Widow/Widower of Veteran','Veteran','PA',1,2100,true,'1939-11-23','urgent','Seeded test client.'),
  ('James','Rodriguez','james.rodriguez@example.com','+15550100104','James Rodriguez','intake','Seed — Test Data','Married with Facility Spouse','Not a Veteran','TX',2,3300,true,'1950-01-30','normal','Seeded test client.'),
  ('Patricia','Johnson','patricia.johnson@example.com','+15550100105','Patricia Johnson','screening','Seed — Test Data','Single','Not a Veteran','FL',1,1600,false,'1944-05-19','high','Seeded test client.'),
  ('William','Brown','william.brown@example.com','+15550100106','William Brown','application','Seed — Test Data','Married with Community Spouse','Veteran','CA',2,5200,true,'1948-09-08','normal','Seeded test client.'),
  ('Linda','Davis','linda.davis@example.com','+15550100107','Linda Davis','submitted','Seed — Test Data','Married with Community Spouse','Not a Veteran','NY',2,2750,false,'1953-02-14','normal','Seeded test client.'),
  ('Charles','Miller','charles.miller@example.com','+15550100108','Charles Miller','approved','Seed — Test Data','Widow/Widower of Veteran','Veteran','NJ',1,1980,true,'1937-12-01','low','Seeded test client.'),
  ('Barbara','Wilson','barbara.wilson@example.com','+15550100109','Barbara Wilson','denied','Seed — Test Data','Married with Facility Spouse','Not a Veteran','PA',2,6100,false,'1949-06-27','normal','Seeded test client.'),
  ('Joseph','Garcia','joseph.garcia@example.com','+15550100110','Joseph Garcia','closed','Seed — Test Data','Single','Not a Veteran','TX',1,1400,false,'1942-08-16','low','Seeded test client.')
) AS v(first_name,last_name,email,phone,full_name,stage,source,marital_status,veteran_status,state,household_size,monthly_income,sms_consent,dob,priority,notes)
WHERE NOT EXISTS (SELECT 1 FROM public.leads WHERE source = 'Seed — Test Data');
