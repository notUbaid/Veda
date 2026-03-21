/**
 * VEDA — Master Pharma Catalog
 * 130 medicines across 15 categories, sorted by popularity within each category.
 * Used client-side for search & browse — no Firestore reads needed.
 * popularity: 1–10 (10 = most dispensed in Indian govt hospitals)
 */

export interface CatalogItem {
  name: string;
  genericName: string;
  category: string;
  unit: string;
  unitPrice: number;
  reorderThreshold: number;
  leadTimeDays: number;
  supplier: string;
  popularity: number;
  description: string;
  schedule?: string; // H, H1, X, G, OTC
}

export const PHARMA_CATALOG: CatalogItem[] = [
  // ── ANALGESIC ──────────────────────────────────────────────────────────
  { name:'Paracetamol 500mg',          genericName:'Acetaminophen',            category:'Analgesic',        unit:'Tablets',   unitPrice:2.5,   reorderThreshold:500, leadTimeDays:3, supplier:'Sun Pharma',    popularity:10, description:'First-line antipyretic and analgesic. WHO essential medicine.', schedule:'OTC' },
  { name:'Paracetamol 650mg',          genericName:'Acetaminophen ER',         category:'Analgesic',        unit:'Tablets',   unitPrice:4.0,   reorderThreshold:300, leadTimeDays:3, supplier:'Sun Pharma',    popularity:8,  description:'Extended-release paracetamol for sustained fever control.', schedule:'OTC' },
  { name:'Paracetamol 250mg Syrup',    genericName:'Acetaminophen',            category:'Analgesic',        unit:'Bottles',   unitPrice:28.0,  reorderThreshold:100, leadTimeDays:3, supplier:'Sun Pharma',    popularity:9,  description:'Paediatric fever and pain relief syrup.', schedule:'OTC' },
  { name:'Ibuprofen 400mg',            genericName:'Ibuprofen',                category:'Analgesic',        unit:'Tablets',   unitPrice:4.0,   reorderThreshold:300, leadTimeDays:3, supplier:'Cipla',         popularity:8,  description:'NSAID for pain, fever, and inflammation.', schedule:'OTC' },
  { name:'Diclofenac 50mg',            genericName:'Diclofenac Sodium',        category:'Analgesic',        unit:'Tablets',   unitPrice:5.5,   reorderThreshold:200, leadTimeDays:4, supplier:'Novartis',      popularity:7,  description:'NSAID for musculoskeletal pain and arthritis.', schedule:'H' },
  { name:'Aspirin 75mg',               genericName:'Acetylsalicylic Acid',     category:'Analgesic',        unit:'Tablets',   unitPrice:1.5,   reorderThreshold:400, leadTimeDays:3, supplier:'Bayer',         popularity:8,  description:'Low-dose aspirin for antiplatelet therapy.', schedule:'OTC' },
  { name:'Tramadol 50mg',              genericName:'Tramadol HCl',             category:'Analgesic',        unit:'Capsules',  unitPrice:8.0,   reorderThreshold:150, leadTimeDays:5, supplier:'Glenmark',      popularity:6,  description:'Opioid analgesic for moderate-severe pain.', schedule:'H' },
  { name:'Naproxen 250mg',             genericName:'Naproxen Sodium',          category:'Analgesic',        unit:'Tablets',   unitPrice:6.0,   reorderThreshold:150, leadTimeDays:4, supplier:'Roche',         popularity:5,  description:'NSAID for arthritis and dysmenorrhoea.', schedule:'H' },
  { name:'Ketorolac 10mg',             genericName:'Ketorolac Tromethamine',   category:'Analgesic',        unit:'Tablets',   unitPrice:12.0,  reorderThreshold:80,  leadTimeDays:5, supplier:'Rhobar',        popularity:5,  description:'Short-term treatment of moderate-to-severe pain.', schedule:'H' },
  { name:'Morphine 10mg Injection',    genericName:'Morphine Sulphate',        category:'Analgesic',        unit:'Vials',     unitPrice:45.0,  reorderThreshold:30,  leadTimeDays:7, supplier:'Neon Labs',     popularity:4,  description:'Opioid for severe pain management in hospital.', schedule:'X' },

  // ── ANTIBIOTIC ────────────────────────────────────────────────────────
  { name:'Amoxicillin 500mg',          genericName:'Amoxicillin',              category:'Antibiotic',       unit:'Capsules',  unitPrice:12.0,  reorderThreshold:200, leadTimeDays:5, supplier:'Cipla',         popularity:10, description:'Broad-spectrum penicillin antibiotic.', schedule:'H' },
  { name:'Azithromycin 500mg',         genericName:'Azithromycin',             category:'Antibiotic',       unit:'Tablets',   unitPrice:25.0,  reorderThreshold:150, leadTimeDays:5, supplier:'Cipla',         popularity:9,  description:'Macrolide antibiotic for RTI and STI.', schedule:'H' },
  { name:'Ciprofloxacin 500mg',        genericName:'Ciprofloxacin HCl',        category:'Antibiotic',       unit:'Tablets',   unitPrice:9.0,   reorderThreshold:200, leadTimeDays:4, supplier:'Bayer',         popularity:9,  description:'Fluoroquinolone for UTI and GI infections.', schedule:'H' },
  { name:'Amoxicillin+Clavulanate',    genericName:'Co-Amoxiclav 625mg',       category:'Antibiotic',       unit:'Tablets',   unitPrice:48.0,  reorderThreshold:80,  leadTimeDays:5, supplier:'GSK',           popularity:8,  description:'Augmented penicillin for resistant infections.', schedule:'H' },
  { name:'Metronidazole 400mg',        genericName:'Metronidazole',            category:'Antibiotic',       unit:'Tablets',   unitPrice:4.5,   reorderThreshold:250, leadTimeDays:3, supplier:'Abbott',        popularity:8,  description:'Antiprotozoal and antibiotic for anaerobic infections.', schedule:'H' },
  { name:'Cefixime 200mg',             genericName:'Cefixime',                 category:'Antibiotic',       unit:'Tablets',   unitPrice:32.0,  reorderThreshold:100, leadTimeDays:5, supplier:'Sun Pharma',    popularity:7,  description:'3rd gen cephalosporin for RTI and UTI.', schedule:'H' },
  { name:'Doxycycline 100mg',          genericName:'Doxycycline Hyclate',      category:'Antibiotic',       unit:'Capsules',  unitPrice:8.0,   reorderThreshold:150, leadTimeDays:4, supplier:'Pfizer',        popularity:7,  description:'Tetracycline antibiotic. Used for malaria prophylaxis.', schedule:'H' },
  { name:'Levofloxacin 500mg',         genericName:'Levofloxacin',             category:'Antibiotic',       unit:'Tablets',   unitPrice:22.0,  reorderThreshold:120, leadTimeDays:4, supplier:'Dr. Reddys',    popularity:7,  description:'Fluoroquinolone for pneumonia and pyelonephritis.', schedule:'H' },
  { name:'Ceftriaxone 1g Injection',   genericName:'Ceftriaxone Sodium',       category:'Antibiotic',       unit:'Vials',     unitPrice:85.0,  reorderThreshold:50,  leadTimeDays:6, supplier:'Roche',         popularity:8,  description:'3rd gen cephalosporin IV for severe infections.', schedule:'H' },
  { name:'Cotrimoxazole 480mg',        genericName:'Sulfamethoxazole+TMP',     category:'Antibiotic',       unit:'Tablets',   unitPrice:5.0,   reorderThreshold:200, leadTimeDays:4, supplier:'Cipla',         popularity:6,  description:'Sulphonamide combo for UTI and PCP prophylaxis.', schedule:'H' },
  { name:'Cloxacillin 250mg',          genericName:'Cloxacillin Sodium',       category:'Antibiotic',       unit:'Capsules',  unitPrice:14.0,  reorderThreshold:100, leadTimeDays:5, supplier:'Cipla',         popularity:6,  description:'Penicillinase-resistant antibiotic for staphylococcal infections.', schedule:'H' },
  { name:'Erythromycin 250mg',         genericName:'Erythromycin',             category:'Antibiotic',       unit:'Tablets',   unitPrice:7.0,   reorderThreshold:150, leadTimeDays:4, supplier:'Abbott',        popularity:5,  description:'Macrolide antibiotic; alternative in penicillin allergy.', schedule:'H' },
  { name:'Gentamicin 80mg Injection',  genericName:'Gentamicin Sulphate',      category:'Antibiotic',       unit:'Vials',     unitPrice:18.0,  reorderThreshold:40,  leadTimeDays:6, supplier:'GSK',           popularity:6,  description:'Aminoglycoside for severe gram-negative infections.', schedule:'H' },

  // ── ANTIDIABETIC ──────────────────────────────────────────────────────
  { name:'Metformin 500mg',            genericName:'Metformin HCl',            category:'Antidiabetic',     unit:'Tablets',   unitPrice:5.0,   reorderThreshold:300, leadTimeDays:4, supplier:'USV',           popularity:10, description:'First-line oral hypoglycaemic for T2DM.', schedule:'H' },
  { name:'Metformin 1000mg',           genericName:'Metformin HCl',            category:'Antidiabetic',     unit:'Tablets',   unitPrice:7.5,   reorderThreshold:200, leadTimeDays:4, supplier:'USV',           popularity:8,  description:'Higher dose metformin for T2DM.', schedule:'H' },
  { name:'Insulin Glargine 100IU/ml',  genericName:'Insulin Glargine',         category:'Antidiabetic',     unit:'Vials',     unitPrice:450.0, reorderThreshold:30,  leadTimeDays:7, supplier:'Sanofi',        popularity:8,  description:'Long-acting basal insulin analogue.', schedule:'H' },
  { name:'Insulin Regular 40IU/ml',    genericName:'Human Insulin Regular',    category:'Antidiabetic',     unit:'Vials',     unitPrice:160.0, reorderThreshold:40,  leadTimeDays:7, supplier:'Novo Nordisk',  popularity:7,  description:'Short-acting human insulin for mealtime coverage.', schedule:'H' },
  { name:'Glibenclamide 5mg',          genericName:'Glibenclamide',            category:'Antidiabetic',     unit:'Tablets',   unitPrice:3.5,   reorderThreshold:200, leadTimeDays:3, supplier:'Cipla',         popularity:7,  description:'Sulphonylurea oral hypoglycaemic.', schedule:'H' },
  { name:'Glimepiride 2mg',            genericName:'Glimepiride',              category:'Antidiabetic',     unit:'Tablets',   unitPrice:8.0,   reorderThreshold:150, leadTimeDays:4, supplier:'Sanofi',        popularity:6,  description:'Sulphonylurea for T2DM.', schedule:'H' },
  { name:'Sitagliptin 50mg',           genericName:'Sitagliptin Phosphate',    category:'Antidiabetic',     unit:'Tablets',   unitPrice:75.0,  reorderThreshold:60,  leadTimeDays:5, supplier:'MSD',           popularity:5,  description:'DPP-4 inhibitor oral hypoglycaemic.', schedule:'H' },
  { name:'Dapagliflozin 10mg',         genericName:'Dapagliflozin',            category:'Antidiabetic',     unit:'Tablets',   unitPrice:120.0, reorderThreshold:40,  leadTimeDays:5, supplier:'AstraZeneca',   popularity:5,  description:'SGLT-2 inhibitor with cardioprotective benefit.', schedule:'H' },

  // ── CARDIAC ──────────────────────────────────────────────────────────
  { name:'Amlodipine 5mg',             genericName:'Amlodipine Besylate',      category:'Cardiac',          unit:'Tablets',   unitPrice:7.0,   reorderThreshold:300, leadTimeDays:4, supplier:'Sun Pharma',    popularity:10, description:'CCB for hypertension and angina.', schedule:'H' },
  { name:'Atorvastatin 10mg',          genericName:'Atorvastatin',             category:'Cardiac',          unit:'Tablets',   unitPrice:18.0,  reorderThreshold:200, leadTimeDays:5, supplier:'Ranbaxy',       popularity:9,  description:'Statin for dyslipidaemia and CVD prevention.', schedule:'H' },
  { name:'Losartan 50mg',              genericName:'Losartan Potassium',       category:'Cardiac',          unit:'Tablets',   unitPrice:12.0,  reorderThreshold:150, leadTimeDays:4, supplier:'Glenmark',      popularity:8,  description:'ARB for hypertension; renal protection in DM.', schedule:'H' },
  { name:'Atenolol 50mg',              genericName:'Atenolol',                 category:'Cardiac',          unit:'Tablets',   unitPrice:4.0,   reorderThreshold:250, leadTimeDays:3, supplier:'Cipla',         popularity:8,  description:'Beta-blocker for hypertension and angina.', schedule:'H' },
  { name:'Clopidogrel 75mg',           genericName:'Clopidogrel Bisulphate',   category:'Cardiac',          unit:'Tablets',   unitPrice:28.0,  reorderThreshold:120, leadTimeDays:4, supplier:'Sanofi',        popularity:7,  description:'Antiplatelet for post-ACS and PCI.', schedule:'H' },
  { name:'Furosemide 40mg',            genericName:'Furosemide',               category:'Cardiac',          unit:'Tablets',   unitPrice:4.0,   reorderThreshold:200, leadTimeDays:3, supplier:'Sanofi',        popularity:7,  description:'Loop diuretic for oedema and heart failure.', schedule:'H' },
  { name:'Enalapril 5mg',              genericName:'Enalapril Maleate',        category:'Cardiac',          unit:'Tablets',   unitPrice:5.5,   reorderThreshold:200, leadTimeDays:4, supplier:'Sun Pharma',    popularity:7,  description:'ACE inhibitor for hypertension and heart failure.', schedule:'H' },
  { name:'Ramipril 5mg',               genericName:'Ramipril',                 category:'Cardiac',          unit:'Capsules',  unitPrice:14.0,  reorderThreshold:150, leadTimeDays:4, supplier:'Sanofi',        popularity:7,  description:'ACE inhibitor for post-MI and heart failure.', schedule:'H' },
  { name:'Rosuvastatin 10mg',          genericName:'Rosuvastatin Calcium',     category:'Cardiac',          unit:'Tablets',   unitPrice:22.0,  reorderThreshold:150, leadTimeDays:5, supplier:'AstraZeneca',   popularity:7,  description:'High-potency statin for dyslipidaemia.', schedule:'H' },
  { name:'Nitroglycerin 0.5mg SL',     genericName:'Glyceryl Trinitrate',      category:'Cardiac',          unit:'Tablets',   unitPrice:15.0,  reorderThreshold:80,  leadTimeDays:4, supplier:'Dr. Reddys',    popularity:6,  description:'Sublingual nitrate for acute angina.', schedule:'H' },
  { name:'Digoxin 0.25mg',             genericName:'Digoxin',                  category:'Cardiac',          unit:'Tablets',   unitPrice:6.5,   reorderThreshold:100, leadTimeDays:5, supplier:'GSK',           popularity:5,  description:'Cardiac glycoside for heart failure and AF.', schedule:'H' },

  // ── GI ────────────────────────────────────────────────────────────────
  { name:'Omeprazole 20mg',            genericName:'Omeprazole',               category:'GI',               unit:'Capsules',  unitPrice:6.5,   reorderThreshold:250, leadTimeDays:4, supplier:'Dr. Reddys',    popularity:10, description:'PPI for GERD, peptic ulcer.', schedule:'H' },
  { name:'ORS Sachets',                genericName:'Oral Rehydration Salts',   category:'GI',               unit:'Sachets',   unitPrice:8.0,   reorderThreshold:400, leadTimeDays:3, supplier:'Electral',      popularity:10, description:'WHO-ORS for dehydration and diarrhoea.', schedule:'OTC' },
  { name:'Pantoprazole 40mg',          genericName:'Pantoprazole',             category:'GI',               unit:'Tablets',   unitPrice:9.0,   reorderThreshold:200, leadTimeDays:4, supplier:'Zydus',         popularity:9,  description:'PPI for GERD and Zollinger-Ellison syndrome.', schedule:'H' },
  { name:'Ondansetron 4mg',            genericName:'Ondansetron HCl',          category:'GI',               unit:'Tablets',   unitPrice:14.0,  reorderThreshold:150, leadTimeDays:4, supplier:'GSK',           popularity:8,  description:'5-HT3 antagonist antiemetic for chemo nausea.', schedule:'H' },
  { name:'Antacid Suspension 200ml',   genericName:'Al-Mg Hydroxide',          category:'GI',               unit:'Bottles',   unitPrice:38.0,  reorderThreshold:80,  leadTimeDays:3, supplier:'Pfizer',        popularity:8,  description:'Rapid-acting antacid for dyspepsia.', schedule:'OTC' },
  { name:'Ranitidine 150mg',           genericName:'Ranitidine HCl',           category:'GI',               unit:'Tablets',   unitPrice:4.0,   reorderThreshold:200, leadTimeDays:3, supplier:'GSK',           popularity:7,  description:'H2 blocker for peptic ulcer and GERD.', schedule:'OTC' },
  { name:'Domperidone 10mg',           genericName:'Domperidone',              category:'GI',               unit:'Tablets',   unitPrice:5.0,   reorderThreshold:200, leadTimeDays:4, supplier:'Johnson',       popularity:7,  description:'Prokinetic antiemetic for nausea and gastroparesis.', schedule:'H' },
  { name:'Metoclopramide 10mg',        genericName:'Metoclopramide HCl',       category:'GI',               unit:'Tablets',   unitPrice:3.5,   reorderThreshold:200, leadTimeDays:3, supplier:'Cipla',         popularity:6,  description:'Antiemetic and prokinetic agent.', schedule:'H' },
  { name:'Loperamide 2mg',             genericName:'Loperamide HCl',           category:'GI',               unit:'Capsules',  unitPrice:6.0,   reorderThreshold:150, leadTimeDays:3, supplier:'Janssen',       popularity:6,  description:'Antidiarrhoeal for acute and chronic diarrhoea.', schedule:'OTC' },
  { name:'Lactulose 10g Syrup',        genericName:'Lactulose',                category:'GI',               unit:'Bottles',   unitPrice:85.0,  reorderThreshold:50,  leadTimeDays:4, supplier:'Abbott',        popularity:5,  description:'Osmotic laxative and hepatic encephalopathy treatment.', schedule:'OTC' },

  // ── RESPIRATORY ───────────────────────────────────────────────────────
  { name:'Salbutamol Inhaler 100mcg',  genericName:'Salbutamol Sulphate',      category:'Respiratory',      unit:'Inhalers',  unitPrice:120.0, reorderThreshold:50,  leadTimeDays:6, supplier:'GSK',           popularity:10, description:'Short-acting beta2-agonist bronchodilator for asthma.', schedule:'H' },
  { name:'Cough Syrup 100ml',          genericName:'Dextromethorphan',         category:'Respiratory',      unit:'Bottles',   unitPrice:65.0,  reorderThreshold:80,  leadTimeDays:5, supplier:'Benadryl',      popularity:8,  description:'Antitussive cough suppressant.', schedule:'G' },
  { name:'Prednisolone 5mg',           genericName:'Prednisolone',             category:'Respiratory',      unit:'Tablets',   unitPrice:4.0,   reorderThreshold:200, leadTimeDays:3, supplier:'Sun Pharma',    popularity:7,  description:'Corticosteroid for asthma exacerbation and allergies.', schedule:'H' },
  { name:'Montelukast 10mg',           genericName:'Montelukast Sodium',       category:'Respiratory',      unit:'Tablets',   unitPrice:18.0,  reorderThreshold:100, leadTimeDays:4, supplier:'MSD',           popularity:6,  description:'Leukotriene antagonist for asthma and allergic rhinitis.', schedule:'H' },
  { name:'Budesonide Inhaler 200mcg',  genericName:'Budesonide',               category:'Respiratory',      unit:'Inhalers',  unitPrice:280.0, reorderThreshold:30,  leadTimeDays:7, supplier:'AstraZeneca',   popularity:7,  description:'Inhaled corticosteroid for persistent asthma.', schedule:'H' },
  { name:'Theophylline 200mg SR',      genericName:'Theophylline',             category:'Respiratory',      unit:'Tablets',   unitPrice:6.5,   reorderThreshold:150, leadTimeDays:4, supplier:'Cipla',         popularity:5,  description:'Bronchodilator xanthine derivative for COPD.', schedule:'H' },
  { name:'Ipratropium Inhaler',        genericName:'Ipratropium Bromide',      category:'Respiratory',      unit:'Inhalers',  unitPrice:190.0, reorderThreshold:25,  leadTimeDays:7, supplier:'Boehringer',    popularity:5,  description:'Anticholinergic bronchodilator for COPD.', schedule:'H' },
  { name:'Beclomethasone 100mcg',      genericName:'Beclomethasone DP',        category:'Respiratory',      unit:'Inhalers',  unitPrice:220.0, reorderThreshold:30,  leadTimeDays:7, supplier:'GSK',           popularity:6,  description:'ICS for asthma maintenance.', schedule:'H' },

  // ── ANTIHISTAMINE ─────────────────────────────────────────────────────
  { name:'Cetirizine 10mg',            genericName:'Cetirizine HCl',           category:'Antihistamine',    unit:'Tablets',   unitPrice:4.0,   reorderThreshold:200, leadTimeDays:3, supplier:'Alkem',         popularity:10, description:'Non-sedating antihistamine for allergies.', schedule:'OTC' },
  { name:'Levocetirizine 5mg',         genericName:'Levocetirizine HCl',       category:'Antihistamine',    unit:'Tablets',   unitPrice:6.0,   reorderThreshold:150, leadTimeDays:3, supplier:'UCB',           popularity:8,  description:'Newer non-sedating antihistamine.', schedule:'OTC' },
  { name:'Chlorphenamine 4mg',         genericName:'Chlorpheniramine Maleate', category:'Antihistamine',    unit:'Tablets',   unitPrice:2.0,   reorderThreshold:200, leadTimeDays:3, supplier:'Cipla',         popularity:7,  description:'Sedating antihistamine for allergic conditions.', schedule:'OTC' },
  { name:'Diphenhydramine 25mg',       genericName:'Diphenhydramine HCl',      category:'Antihistamine',    unit:'Capsules',  unitPrice:4.5,   reorderThreshold:150, leadTimeDays:3, supplier:'Parke Davis',   popularity:6,  description:'1st gen antihistamine; also used for insomnia.', schedule:'OTC' },
  { name:'Promethazine 25mg',          genericName:'Promethazine HCl',         category:'Antihistamine',    unit:'Tablets',   unitPrice:5.5,   reorderThreshold:100, leadTimeDays:4, supplier:'Sanofi',        popularity:5,  description:'Phenothiazine antihistamine and antiemetic.', schedule:'H' },

  // ── ANTIFUNGAL ────────────────────────────────────────────────────────
  { name:'Fluconazole 150mg',          genericName:'Fluconazole',              category:'Antifungal',       unit:'Tablets',   unitPrice:22.0,  reorderThreshold:100, leadTimeDays:5, supplier:'Pfizer',        popularity:9,  description:'Triazole antifungal for candidiasis.', schedule:'H' },
  { name:'Clotrimazole 1% Cream',      genericName:'Clotrimazole',             category:'Antifungal',       unit:'Tubes',     unitPrice:35.0,  reorderThreshold:80,  leadTimeDays:4, supplier:'Bayer',         popularity:8,  description:'Topical antifungal for dermatophytosis.', schedule:'OTC' },
  { name:'Terbinafine 250mg',          genericName:'Terbinafine HCl',          category:'Antifungal',       unit:'Tablets',   unitPrice:30.0,  reorderThreshold:60,  leadTimeDays:5, supplier:'Novartis',      popularity:6,  description:'Allylamine antifungal for onychomycosis.', schedule:'H' },
  { name:'Itraconazole 100mg',         genericName:'Itraconazole',             category:'Antifungal',       unit:'Capsules',  unitPrice:45.0,  reorderThreshold:60,  leadTimeDays:5, supplier:'Janssen',       popularity:6,  description:'Broad-spectrum triazole antifungal.', schedule:'H' },
  { name:'Nystatin 100000IU Oral',     genericName:'Nystatin',                 category:'Antifungal',       unit:'Bottles',   unitPrice:80.0,  reorderThreshold:40,  leadTimeDays:5, supplier:'BMS',           popularity:5,  description:'Polyene antifungal for oral and intestinal candidiasis.', schedule:'H' },

  // ── SUPPLEMENT ────────────────────────────────────────────────────────
  { name:'Ferrous Sulphate 200mg',     genericName:'Ferrous Sulphate',         category:'Supplement',       unit:'Tablets',   unitPrice:2.5,   reorderThreshold:300, leadTimeDays:3, supplier:'IDPL',          popularity:9,  description:'Iron supplement for anaemia.', schedule:'OTC' },
  { name:'Vitamin C 500mg',            genericName:'Ascorbic Acid',            category:'Supplement',       unit:'Tablets',   unitPrice:3.0,   reorderThreshold:300, leadTimeDays:3, supplier:'Himalaya',      popularity:9,  description:'Antioxidant vitamin; immune support.', schedule:'OTC' },
  { name:'Folic Acid 5mg',             genericName:'Folic Acid',               category:'Supplement',       unit:'Tablets',   unitPrice:2.0,   reorderThreshold:300, leadTimeDays:3, supplier:'Cipla',         popularity:8,  description:'Folate for anaemia and neural tube defect prevention.', schedule:'OTC' },
  { name:'Vitamin D3 60000IU',         genericName:'Cholecalciferol',          category:'Supplement',       unit:'Sachets',   unitPrice:18.0,  reorderThreshold:150, leadTimeDays:4, supplier:'Sun Pharma',    popularity:8,  description:'Vitamin D megadose for deficiency.', schedule:'OTC' },
  { name:'Vitamin B Complex',          genericName:'B1+B6+B12',                category:'Supplement',       unit:'Tablets',   unitPrice:5.0,   reorderThreshold:200, leadTimeDays:3, supplier:'Pfizer',        popularity:8,  description:'B-vitamins for neuropathy and deficiency.', schedule:'OTC' },
  { name:'Calcium Carbonate 500mg',    genericName:'Calcium Carbonate',        category:'Supplement',       unit:'Tablets',   unitPrice:3.5,   reorderThreshold:200, leadTimeDays:3, supplier:'Elder',         popularity:7,  description:'Calcium supplement for osteoporosis.', schedule:'OTC' },
  { name:'Iron+Folic Acid Syrup',      genericName:'Ferrous Gluconate+Folic',  category:'Supplement',       unit:'Bottles',   unitPrice:42.0,  reorderThreshold:80,  leadTimeDays:3, supplier:'IDPL',          popularity:7,  description:'Combination iron-folate syrup for pregnancy anaemia.', schedule:'OTC' },
  { name:'Zinc Sulphate 20mg',         genericName:'Zinc Sulphate',            category:'Supplement',       unit:'Tablets',   unitPrice:4.0,   reorderThreshold:200, leadTimeDays:3, supplier:'Cipla',         popularity:6,  description:'Zinc supplement for diarrhoea in children.', schedule:'OTC' },
  { name:'Multivitamin Tablet',        genericName:'Multivitamin+Multimineral',category:'Supplement',       unit:'Tablets',   unitPrice:4.5,   reorderThreshold:200, leadTimeDays:3, supplier:'Pfizer',        popularity:7,  description:'General micronutrient supplementation.', schedule:'OTC' },

  // ── ANTIMALARIAL ──────────────────────────────────────────────────────
  { name:'Artemether+Lumefantrine',    genericName:'Coartem 20/120mg',         category:'Antimalarial',     unit:'Tablets',   unitPrice:38.0,  reorderThreshold:100, leadTimeDays:5, supplier:'Novartis',      popularity:8,  description:'ACT first-line for P. falciparum malaria.', schedule:'H' },
  { name:'Chloroquine 250mg',          genericName:'Chloroquine Phosphate',    category:'Antimalarial',     unit:'Tablets',   unitPrice:5.0,   reorderThreshold:200, leadTimeDays:4, supplier:'IDPL',          popularity:7,  description:'Antimalarial for P. vivax and P. malariae.', schedule:'H' },
  { name:'Primaquine 7.5mg',           genericName:'Primaquine Phosphate',     category:'Antimalarial',     unit:'Tablets',   unitPrice:4.5,   reorderThreshold:150, leadTimeDays:4, supplier:'IDPL',          popularity:5,  description:'Radical cure for P. vivax hypnozoites.', schedule:'H' },
  { name:'Quinine 300mg',              genericName:'Quinine Sulphate',         category:'Antimalarial',     unit:'Tablets',   unitPrice:12.0,  reorderThreshold:80,  leadTimeDays:5, supplier:'IDPL',          popularity:4,  description:'Quinine for severe or resistant malaria.', schedule:'H' },

  // ── CNS ───────────────────────────────────────────────────────────────
  { name:'Amitriptyline 25mg',         genericName:'Amitriptyline HCl',        category:'CNS',              unit:'Tablets',   unitPrice:4.5,   reorderThreshold:100, leadTimeDays:4, supplier:'Sun Pharma',    popularity:6,  description:'TCA antidepressant; neuropathic pain.', schedule:'H' },
  { name:'Carbamazepine 200mg',        genericName:'Carbamazepine',            category:'CNS',              unit:'Tablets',   unitPrice:6.0,   reorderThreshold:100, leadTimeDays:5, supplier:'Novartis',      popularity:6,  description:'Anticonvulsant and mood stabiliser.', schedule:'H' },
  { name:'Diazepam 5mg',               genericName:'Diazepam',                 category:'CNS',              unit:'Tablets',   unitPrice:3.5,   reorderThreshold:100, leadTimeDays:5, supplier:'Roche',         popularity:6,  description:'Benzodiazepine for anxiety and muscle spasm.', schedule:'H' },
  { name:'Phenobarbitone 30mg',        genericName:'Phenobarbital',            category:'CNS',              unit:'Tablets',   unitPrice:2.5,   reorderThreshold:150, leadTimeDays:5, supplier:'Wockhardt',     popularity:5,  description:'Barbiturate anticonvulsant for epilepsy.', schedule:'H' },
  { name:'Sertraline 50mg',            genericName:'Sertraline HCl',           category:'CNS',              unit:'Tablets',   unitPrice:18.0,  reorderThreshold:60,  leadTimeDays:5, supplier:'Pfizer',        popularity:5,  description:'SSRI antidepressant for depression and OCD.', schedule:'H' },
  { name:'Haloperidol 5mg',            genericName:'Haloperidol',              category:'CNS',              unit:'Tablets',   unitPrice:5.0,   reorderThreshold:80,  leadTimeDays:5, supplier:'Janssen',       popularity:5,  description:'Typical antipsychotic for schizophrenia.', schedule:'H' },

  // ── DERMATOLOGY ───────────────────────────────────────────────────────
  { name:'Hydrocortisone 1% Cream',    genericName:'Hydrocortisone',           category:'Dermatology',      unit:'Tubes',     unitPrice:28.0,  reorderThreshold:80,  leadTimeDays:4, supplier:'GSK',           popularity:8,  description:'Mild topical corticosteroid for eczema and dermatitis.', schedule:'OTC' },
  { name:'Calamine Lotion 100ml',      genericName:'Calamine',                 category:'Dermatology',      unit:'Bottles',   unitPrice:22.0,  reorderThreshold:80,  leadTimeDays:3, supplier:'Glenmark',      popularity:7,  description:'Topical for itch relief in chickenpox and prickly heat.', schedule:'OTC' },
  { name:'Betamethasone 0.1% Cream',   genericName:'Betamethasone Valerate',   category:'Dermatology',      unit:'Tubes',     unitPrice:32.0,  reorderThreshold:60,  leadTimeDays:4, supplier:'GSK',           popularity:7,  description:'Potent topical corticosteroid.', schedule:'H' },
  { name:'Mupirocin 2% Ointment',      genericName:'Mupirocin',                category:'Dermatology',      unit:'Tubes',     unitPrice:55.0,  reorderThreshold:40,  leadTimeDays:5, supplier:'GSK',           popularity:6,  description:'Topical antibiotic for impetigo and skin infections.', schedule:'H' },
  { name:'Permethrin 5% Cream',        genericName:'Permethrin',               category:'Dermatology',      unit:'Tubes',     unitPrice:48.0,  reorderThreshold:50,  leadTimeDays:4, supplier:'Cipla',         popularity:6,  description:'Topical antiparasitic for scabies.', schedule:'H' },

  // ── OPHTHALMOLOGY ─────────────────────────────────────────────────────
  { name:'Ciprofloxacin Eye Drops',    genericName:'Ciprofloxacin 0.3%',       category:'Ophthalmology',    unit:'Bottles',   unitPrice:35.0,  reorderThreshold:60,  leadTimeDays:4, supplier:'Allergan',      popularity:8,  description:'Antibiotic eye drops for bacterial conjunctivitis.', schedule:'H' },
  { name:'Artificial Tears',           genericName:'Carboxymethylcellulose',   category:'Ophthalmology',    unit:'Bottles',   unitPrice:55.0,  reorderThreshold:50,  leadTimeDays:3, supplier:'Alcon',         popularity:7,  description:'Lubricant for dry eye syndrome.', schedule:'OTC' },
  { name:'Tobramycin Eye Drops',       genericName:'Tobramycin 0.3%',          category:'Ophthalmology',    unit:'Bottles',   unitPrice:40.0,  reorderThreshold:40,  leadTimeDays:4, supplier:'Alcon',         popularity:6,  description:'Aminoglycoside antibiotic eye drops.', schedule:'H' },
  { name:'Atropine 1% Eye Drops',      genericName:'Atropine Sulphate',        category:'Ophthalmology',    unit:'Bottles',   unitPrice:28.0,  reorderThreshold:30,  leadTimeDays:5, supplier:'Allergan',      popularity:5,  description:'Mydriatic for eye examination and uveitis.', schedule:'H' },

  // ── ANTIPARASITIC ─────────────────────────────────────────────────────
  { name:'Albendazole 400mg',          genericName:'Albendazole',              category:'Antiparasitic',    unit:'Tablets',   unitPrice:6.0,   reorderThreshold:200, leadTimeDays:3, supplier:'GSK',           popularity:8,  description:'Broad-spectrum antihelminthic.', schedule:'H' },
  { name:'Mebendazole 100mg',          genericName:'Mebendazole',              category:'Antiparasitic',    unit:'Tablets',   unitPrice:4.5,   reorderThreshold:150, leadTimeDays:3, supplier:'Janssen',       popularity:7,  description:'Antihelminthic for intestinal worm infections.', schedule:'H' },
  { name:'Ivermectin 12mg',            genericName:'Ivermectin',               category:'Antiparasitic',    unit:'Tablets',   unitPrice:22.0,  reorderThreshold:80,  leadTimeDays:5, supplier:'Sun Pharma',    popularity:6,  description:'Macrocyclic lactone for strongyloidiasis and scabies.', schedule:'H' },
  { name:'DEC 100mg',                  genericName:'Diethylcarbamazine',       category:'Antiparasitic',    unit:'Tablets',   unitPrice:3.5,   reorderThreshold:200, leadTimeDays:4, supplier:'IDPL',          popularity:5,  description:'Microfilaricidal for lymphatic filariasis.', schedule:'H' },

  // ── EMERGENCY ─────────────────────────────────────────────────────────
  { name:'Normal Saline 0.9% 500ml',   genericName:'Sodium Chloride 0.9%',     category:'Emergency',        unit:'Bottles',   unitPrice:40.0,  reorderThreshold:60,  leadTimeDays:4, supplier:'Baxter',        popularity:9,  description:'IV crystalloid for volume replacement.', schedule:'H' },
  { name:'Dextrose 5% IV 500ml',       genericName:'Glucose 5%',               category:'Emergency',        unit:'Bottles',   unitPrice:45.0,  reorderThreshold:50,  leadTimeDays:4, supplier:'Baxter',        popularity:8,  description:'IV fluid for maintenance hydration.', schedule:'H' },
  { name:'Ringer Lactate 500ml',       genericName:'Compound Sodium Lactate',  category:'Emergency',        unit:'Bottles',   unitPrice:42.0,  reorderThreshold:50,  leadTimeDays:4, supplier:'Baxter',        popularity:8,  description:'Balanced crystalloid IV fluid.', schedule:'H' },
  { name:'Adrenaline 1mg/ml Inj',      genericName:'Epinephrine',              category:'Emergency',        unit:'Ampoules',  unitPrice:38.0,  reorderThreshold:30,  leadTimeDays:6, supplier:'Neon Labs',     popularity:9,  description:'First-line for anaphylaxis and cardiac arrest.', schedule:'H' },
  { name:'Dextrose 50% 20ml Inj',      genericName:'Glucose 50%',              category:'Emergency',        unit:'Ampoules',  unitPrice:12.0,  reorderThreshold:40,  leadTimeDays:4, supplier:'Baxter',        popularity:8,  description:'IV dextrose for hypoglycaemia.', schedule:'H' },
  { name:'Hydrocortisone 100mg Inj',   genericName:'Hydrocortisone Sod Succ',  category:'Emergency',        unit:'Vials',     unitPrice:55.0,  reorderThreshold:20,  leadTimeDays:6, supplier:'Pfizer',        popularity:7,  description:'IV corticosteroid for Addisonian crisis and anaphylaxis.', schedule:'H' },
  { name:'Atropine 0.6mg/ml Inj',      genericName:'Atropine Sulphate',        category:'Emergency',        unit:'Ampoules',  unitPrice:18.0,  reorderThreshold:30,  leadTimeDays:5, supplier:'Neon Labs',     popularity:7,  description:'Anticholinergic for bradycardia and OP poisoning.', schedule:'H' },
  { name:'Lignocaine 2% Inj',          genericName:'Lidocaine HCl',            category:'Emergency',        unit:'Vials',     unitPrice:22.0,  reorderThreshold:20,  leadTimeDays:5, supplier:'AstraZeneca',   popularity:6,  description:'Local anaesthetic and antiarrhythmic.', schedule:'H' },
  { name:'Sodium Bicarbonate 7.5%',    genericName:'Sodium Bicarbonate',       category:'Emergency',        unit:'Vials',     unitPrice:28.0,  reorderThreshold:20,  leadTimeDays:5, supplier:'Baxter',        popularity:5,  description:'IV buffer for severe metabolic acidosis.', schedule:'H' },
  { name:'Naloxone 0.4mg Inj',         genericName:'Naloxone HCl',             category:'Emergency',        unit:'Ampoules',  unitPrice:85.0,  reorderThreshold:15,  leadTimeDays:6, supplier:'Neon Labs',     popularity:4,  description:'Opioid antagonist for overdose reversal.', schedule:'H' },

  // ── OBSTETRIC ─────────────────────────────────────────────────────────
  { name:'Oxytocin 10IU/ml Inj',       genericName:'Oxytocin',                 category:'Obstetric',        unit:'Ampoules',  unitPrice:22.0,  reorderThreshold:30,  leadTimeDays:5, supplier:'Sun Pharma',    popularity:9,  description:'Uterotonic for induction and PPH prevention.', schedule:'H' },
  { name:'Magnesium Sulphate 50% Inj', genericName:'Magnesium Sulphate',       category:'Obstetric',        unit:'Ampoules',  unitPrice:15.0,  reorderThreshold:40,  leadTimeDays:5, supplier:'Baxter',        popularity:8,  description:'Anticonvulsant for eclampsia and pre-eclampsia.', schedule:'H' },
  { name:'Misoprostol 200mcg',         genericName:'Misoprostol',              category:'Obstetric',        unit:'Tablets',   unitPrice:18.0,  reorderThreshold:30,  leadTimeDays:5, supplier:'Pfizer',        popularity:7,  description:'Prostaglandin for PPH, cervical ripening.', schedule:'H' },
  { name:'Oral Contraceptive Pill',    genericName:'Levonorgestrel+EE',        category:'Obstetric',        unit:'Strips',    unitPrice:12.0,  reorderThreshold:100, leadTimeDays:3, supplier:'HLL',           popularity:7,  description:'Combined OCP for contraception.', schedule:'H' },
  { name:'Progesterone 200mg',         genericName:'Micronised Progesterone',  category:'Obstetric',        unit:'Capsules',  unitPrice:35.0,  reorderThreshold:60,  leadTimeDays:5, supplier:'Sun Pharma',    popularity:6,  description:'Luteal support and threatened abortion.', schedule:'H' },

  // ── ANTISEPTIC ────────────────────────────────────────────────────────
  { name:'Povidone Iodine 5%',         genericName:'Povidone Iodine',          category:'Antiseptic',       unit:'Bottles',   unitPrice:48.0,  reorderThreshold:60,  leadTimeDays:3, supplier:'Win-Medicare',  popularity:8,  description:'Broad-spectrum antiseptic for wound care.', schedule:'OTC' },
  { name:'Spirit 450ml',               genericName:'Isopropyl Alcohol 70%',    category:'Antiseptic',       unit:'Bottles',   unitPrice:35.0,  reorderThreshold:80,  leadTimeDays:2, supplier:'Local',         popularity:8,  description:'Topical antiseptic for skin disinfection.', schedule:'OTC' },
  { name:'Chlorhexidine 4% Solution',  genericName:'Chlorhexidine Gluconate',  category:'Antiseptic',       unit:'Bottles',   unitPrice:55.0,  reorderThreshold:40,  leadTimeDays:3, supplier:'Medi-Klin',     popularity:7,  description:'Antiseptic for surgical site prep and hand hygiene.', schedule:'OTC' },
  { name:'Hydrogen Peroxide 3%',       genericName:'Hydrogen Peroxide',        category:'Antiseptic',       unit:'Bottles',   unitPrice:18.0,  reorderThreshold:60,  leadTimeDays:2, supplier:'Local',         popularity:6,  description:'Wound cleansing and cerumen removal.', schedule:'OTC' },

  // ── MISCELLANEOUS ─────────────────────────────────────────────────────
  { name:'Levothyroxine 50mcg',        genericName:'Levothyroxine Sodium',     category:'Miscellaneous',    unit:'Tablets',   unitPrice:12.0,  reorderThreshold:100, leadTimeDays:4, supplier:'Abbott',        popularity:7,  description:'Thyroid hormone replacement for hypothyroidism.', schedule:'H' },
  { name:'Prednisolone 10mg',          genericName:'Prednisolone',             category:'Miscellaneous',    unit:'Tablets',   unitPrice:5.5,   reorderThreshold:150, leadTimeDays:3, supplier:'Sun Pharma',    popularity:7,  description:'Systemic corticosteroid for inflammatory conditions.', schedule:'H' },
  { name:'Dexamethasone 0.5mg',        genericName:'Dexamethasone',            category:'Miscellaneous',    unit:'Tablets',   unitPrice:4.0,   reorderThreshold:150, leadTimeDays:3, supplier:'Cipla',         popularity:6,  description:'Potent corticosteroid; cerebral oedema, croup.', schedule:'H' },
  { name:'Allopurinol 100mg',          genericName:'Allopurinol',              category:'Miscellaneous',    unit:'Tablets',   unitPrice:5.0,   reorderThreshold:150, leadTimeDays:3, supplier:'Cipla',         popularity:6,  description:'Xanthine oxidase inhibitor for hyperuricaemia.', schedule:'H' },
  { name:'Warfarin 5mg',               genericName:'Warfarin Sodium',          category:'Miscellaneous',    unit:'Tablets',   unitPrice:8.0,   reorderThreshold:80,  leadTimeDays:4, supplier:'Cipla',         popularity:5,  description:'Oral anticoagulant for AF and DVT.', schedule:'H' },
  { name:'Heparin 5000IU/ml Inj',      genericName:'Heparin Sodium',           category:'Miscellaneous',    unit:'Vials',     unitPrice:68.0,  reorderThreshold:20,  leadTimeDays:6, supplier:'Gland',         popularity:6,  description:'Anticoagulant for DVT prophylaxis and treatment.', schedule:'H' },
  { name:'Calcium Gluconate 10% Inj',  genericName:'Calcium Gluconate',        category:'Miscellaneous',    unit:'Ampoules',  unitPrice:22.0,  reorderThreshold:30,  leadTimeDays:4, supplier:'Baxter',        popularity:5,  description:'IV calcium for hypocalcaemia and hypermagnesaemia.', schedule:'H' },
  { name:'Potassium Chloride 15% Inj', genericName:'Potassium Chloride',       category:'Miscellaneous',    unit:'Ampoules',  unitPrice:12.0,  reorderThreshold:40,  leadTimeDays:4, supplier:'Baxter',        popularity:5,  description:'IV potassium for hypokalaemia.', schedule:'H' },
];

export const CATALOG_CATEGORIES = [
  'All',
  ...Array.from(new Set(PHARMA_CATALOG.map(i => i.category))).sort(),
];

export const getCatalogSorted = (category = 'All', query = '') =>
  PHARMA_CATALOG
    .filter(i =>
      (category === 'All' || i.category === category) &&
      (!query ||
        i.name.toLowerCase().includes(query.toLowerCase()) ||
        i.genericName.toLowerCase().includes(query.toLowerCase()) ||
        i.category.toLowerCase().includes(query.toLowerCase()) ||
        i.supplier.toLowerCase().includes(query.toLowerCase())
      )
    )
    .sort((a, b) => b.popularity - a.popularity);
