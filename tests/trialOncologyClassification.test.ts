import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isOncologyTrial, classifyOncologyTrial } = require('../functions/clinicalTrialsSync.js');

describe('FASE A: Clasificación de Ensayos Oncológicos (isOncologyTrial / classifyOncologyTrial)', () => {
  it('clasifica el registro de Fabry (NCT00196742) como NO oncológico', () => {
    const fabryTrial = {
      conditions: ['Fabry Disease'],
      title: 'Fabry Outcome Survey: An International Database of Patients With Fabry Disease',
      officialTitle: 'A Registry for Patients With Fabry Disease',
      keywords: ['Lysosomal Storage Disease', 'Alpha-galactosidase A']
    };

    expect(isOncologyTrial(fabryTrial)).toBe(false);

    const classification = classifyOncologyTrial(fabryTrial);
    expect(classification.isOncology).toBe(false);
    expect(classification.isWeakMatch).toBe(false);
    expect(classification.matchedTerm).toBeUndefined();
  });

  it('clasifica ensayo de cáncer de pulmón como oncológico (coincidencia fuerte)', () => {
    const trial = {
      conditions: ['Non-Small Cell Lung Cancer'],
      title: 'Phase 3 Study of Osimertinib vs Standard of Care EGFR-TKI in NSCLC',
      officialTitle: 'A Randomized Phase III Study in Lung Cancer',
      keywords: ['EGFR', 'Lung adenocarcinoma']
    };

    expect(isOncologyTrial(trial)).toBe(true);

    const classification = classifyOncologyTrial(trial);
    expect(classification.isOncology).toBe(true);
    expect(classification.isWeakMatch).toBe(false);
    expect(classification.matchType).toBe('strong');
    expect(classification.matchedTerm).toBe('cancer');
  });

  it('clasifica ensayo de leucemia como oncológico (coincidencia fuerte)', () => {
    const trial = {
      conditions: ['Acute Myeloid Leukemia'],
      title: 'A Study of Venetoclax Combined with Azacitidine',
      officialTitle: null
    };

    expect(isOncologyTrial(trial)).toBe(true);
    const classification = classifyOncologyTrial(trial);
    expect(classification.isOncology).toBe(true);
    expect(classification.matchedTerm).toBe('leukemia');
  });

  it('clasifica ensayo de mieloma como oncológico (coincidencia fuerte)', () => {
    const trial = {
      conditions: ['Multiple Myeloma', 'Relapsed/Refractory Myeloma'],
      title: 'Daratumumab in Relapsed Myeloma',
      officialTitle: 'Evaluation of CD38 antibody in Multiple Myeloma'
    };

    expect(isOncologyTrial(trial)).toBe(true);
    const classification = classifyOncologyTrial(trial);
    expect(classification.isOncology).toBe(true);
    expect(classification.matchedTerm).toBe('myeloma');
  });

  it('clasifica ensayo de sarcoma como oncológico (coincidencia fuerte)', () => {
    const trial = {
      conditions: ['Synovial Sarcoma', 'Soft Tissue Sarcoma'],
      title: 'Phase 2 Trial of Targeted Agent in Advanced Sarcoma',
      officialTitle: 'Safety and Efficacy in Liposarcoma and Leiomyosarcoma'
    };

    expect(isOncologyTrial(trial)).toBe(true);
    const classification = classifyOncologyTrial(trial);
    expect(classification.isOncology).toBe(true);
    expect(classification.matchedTerm).toBe('sarcoma');
  });

  it('clasifica ensayo con título y condición en español como oncológico', () => {
    const trial = {
      conditions: ['Cáncer gástrico avanzado', 'Adenocarcinoma de estómago'],
      title: 'Estudio de fase 3 en carcinoma gástrico irresecable',
      officialTitle: 'Ensayo clínico aleatorizado en neoplasia gástrica metastásica'
    };

    expect(isOncologyTrial(trial)).toBe(true);
    const classification = classifyOncologyTrial(trial);
    expect(classification.isOncology).toBe(true);
    expect(classification.isWeakMatch).toBe(false);
  });

  it('clasifica ensayos de cuidados de soporte oncológicos (quimioterapia / neutropenia febril) como oncológicos', () => {
    const chemoNauseaTrial = {
      conditions: ['Chemotherapy-Induced Nausea and Vomiting (CINV)'],
      title: 'Evaluation of New Antiemetic Regimen in Chemotherapy Patients',
      officialTitle: 'Prevention of acute and delayed nausea induced by chemotherapy'
    };

    expect(isOncologyTrial(chemoNauseaTrial)).toBe(true);
    const classification = classifyOncologyTrial(chemoNauseaTrial);
    expect(classification.isOncology).toBe(true);
    expect(classification.isWeakMatch).toBe(true);
    expect(classification.matchType).toBe('supportive');
    expect(classification.matchedTerm).toBe('chemotherap');

    const neutropeniaTrial = {
      conditions: ['Febrile Neutropenia'],
      title: 'Antibiotic stewardship in hospitalized patients with febrile neutropenia',
      officialTitle: null
    };

    expect(isOncologyTrial(neutropeniaTrial)).toBe(true);
    const neutropeniaClass = classifyOncologyTrial(neutropeniaTrial);
    expect(neutropeniaClass.isOncology).toBe(true);
    expect(neutropeniaClass.isWeakMatch).toBe(true);
    expect(neutropeniaClass.matchType).toBe('supportive');
  });

  it('clasifica ensayos con condición vacía o ausente como oncológicos por defecto (criterio conservador)', () => {
    const emptyTrial = {
      conditions: [],
      title: 'Estudio clínico multicéntrico internacional',
      officialTitle: null
    };

    expect(isOncologyTrial(emptyTrial)).toBe(true);
    const classification = classifyOncologyTrial(emptyTrial);
    expect(classification.isOncology).toBe(true);
    expect(classification.isWeakMatch).toBe(false);
    expect(classification.matchType).toBe('default');

    const undefinedConditionsTrial = {
      title: 'Protocolo de investigación clínica'
    };
    expect(isOncologyTrial(undefinedConditionsTrial)).toBe(true);
  });

  it('excluye patologías no oncológicas que mencionan "tumor necrosis factor" en título o condición', () => {
    // Caso Artritis Reumatoide con anti-tumor necrosis factor
    const rheumatoidTrial = {
      conditions: ['Rheumatoid Arthritis'],
      title: 'A Study of Adalimumab (Anti-Tumor Necrosis Factor) in Subjects With Active Rheumatoid Arthritis',
      officialTitle: 'Phase III Trial of an Anti-Tumor Necrosis Factor Monoclonal Antibody'
    };

    expect(isOncologyTrial(rheumatoidTrial)).toBe(false);
    expect(classifyOncologyTrial(rheumatoidTrial).isOncology).toBe(false);

    // Caso Diabetes Tipo 2 con niveles de Tumor Necrosis Factor
    const diabetesTrial = {
      conditions: ['Type 2 Diabetes Mellitus'],
      title: 'Serum Tumor Necrosis Factor Alpha Levels and Insulin Resistance in Diabetic Patients',
      officialTitle: 'Inflammatory Markers and Tumor Necrosis Factor in Type 2 Diabetes'
    };

    expect(isOncologyTrial(diabetesTrial)).toBe(false);
    expect(classifyOncologyTrial(diabetesTrial).isOncology).toBe(false);

    // Caso Enfermedad de Crohn en español
    const crohnTrial = {
      conditions: ['Enfermedad de Crohn'],
      title: 'Tratamiento con antagonista del factor de necrosis tumoral en pacientes con enfermedad inflamatoria intestinal',
      officialTitle: null
    };

    expect(isOncologyTrial(crohnTrial)).toBe(false);
    expect(classifyOncologyTrial(crohnTrial).isOncology).toBe(false);
  });

  it('mantiene como oncológico un ensayo de cáncer que también menciona tumor necrosis factor', () => {
    const cancerWithTnf = {
      conditions: ['Metastatic Melanoma'],
      title: 'A Study of Tumor Necrosis Factor and Interleukin-2 in Patients with Melanoma',
      officialTitle: 'Isolated Limb Perfusion with Tumor Necrosis Factor for In-Transit Melanoma'
    };

    expect(isOncologyTrial(cancerWithTnf)).toBe(true);
    const classification = classifyOncologyTrial(cancerWithTnf);
    expect(classification.isOncology).toBe(true);
    expect(classification.isWeakMatch).toBe(false);
    expect(classification.matchType).toBe('strong');
  });

  it('clasifica y reporta como coincidencia débil SOLO cuando el match proviene de keywords o de soporte oncológico', () => {
    // 1. Coincidencia débil por keywords únicamente (el título y condiciones no tienen términos oncológicos)
    const keywordsOnlyTrial = {
      conditions: ['Oral Stomatitis'],
      title: 'Evaluation of Antimicrobial Mouthwash for Stomatitis',
      officialTitle: null,
      keywords: ['oncology supportive care', 'palliative care']
    };

    expect(isOncologyTrial(keywordsOnlyTrial)).toBe(true);
    const kwClassification = classifyOncologyTrial(keywordsOnlyTrial);
    expect(kwClassification.isOncology).toBe(true);
    expect(kwClassification.isWeakMatch).toBe(true);
    expect(kwClassification.matchType).toBe('keywords');
    expect(kwClassification.matchedTerm).toBe('oncolog');

    // 2. Coincidencia débil por soporte (radioterapia) sin mención explícita de tumor/cáncer
    const radiotherapyOnlyTrial = {
      conditions: ['Dermatitis'],
      title: 'Topical Hydrogel for Prevention of Radiotherapy-Induced Skin Reaction',
      officialTitle: 'Skin Care during External Beam Radiation Therapy'
    };

    expect(isOncologyTrial(radiotherapyOnlyTrial)).toBe(true);
    const radioClassification = classifyOncologyTrial(radiotherapyOnlyTrial);
    expect(radioClassification.isOncology).toBe(true);
    expect(radioClassification.isWeakMatch).toBe(true);
    expect(radioClassification.matchType).toBe('supportive');
    expect(radioClassification.matchedTerm).toBe('radiotherap');

    // 3. Coincidencia débil por trasplante de médula / stem cell sin mención explícita de cáncer
    const marrowTrial = {
      conditions: ['Graft Versus Host Disease'],
      title: 'Prophylaxis of Acute GVHD Following Bone Marrow Transplant',
      officialTitle: 'Immunosuppressive Regimen in Allogeneic Bone Marrow Transplantation'
    };

    expect(isOncologyTrial(marrowTrial)).toBe(true);
    const marrowClassification = classifyOncologyTrial(marrowTrial);
    expect(marrowClassification.isOncology).toBe(true);
    expect(marrowClassification.isWeakMatch).toBe(true);
    expect(marrowClassification.matchType).toBe('supportive');
    expect(marrowClassification.matchedTerm).toBe('bone marrow transplant');
  });

  describe('Refinamiento de términos fuertes y prevención de falsos positivos con límites de palabra (\\b)', () => {
    it('clasifica "Acute Lymphoblastic Leukaemia" (NCT01949129, grafía británica) como oncológico', () => {
      const trial = {
        conditions: ['Acute Lymphoblastic Leukaemia'],
        title: 'Phase II Trial of Novel Targeted Agent in Relapsed/Refractory ALL',
        officialTitle: 'A Study in Patients with Acute Lymphoblastic Leukaemia'
      };

      expect(isOncologyTrial(trial)).toBe(true);
      const classification = classifyOncologyTrial(trial);
      expect(classification.isOncology).toBe(true);
      expect(classification.isWeakMatch).toBe(false);
      expect(['leukaemia', 'lymphoblastic']).toContain(classification.matchedTerm);
    });

    it('clasifica "Indolent Systemic Mastocytosis" (NCT04910685) como oncológico', () => {
      const trial = {
        conditions: ['Indolent Systemic Mastocytosis'],
        title: 'A Study to Evaluate the Safety and Efficacy of BLU-263 in Indolent Systemic Mastocytosis',
        officialTitle: 'Phase 2 Study in Adult Patients with Indolent Systemic Mastocytosis'
      };

      expect(isOncologyTrial(trial)).toBe(true);
      const classification = classifyOncologyTrial(trial);
      expect(classification.isOncology).toBe(true);
      expect(classification.isWeakMatch).toBe(false);
      expect(classification.matchedTerm).toBe('mastocytosis');
    });

    it('clasifica "Generalized Myasthenia Gravis" como NO oncológico', () => {
      const trial = {
        conditions: ['Generalized Myasthenia Gravis'],
        title: 'Study of Monoclonal Antibody in Generalized Myasthenia Gravis',
        officialTitle: 'A Phase 3 Study in Patients with Acetylcholine Receptor Positive Generalized Myasthenia Gravis'
      };

      expect(isOncologyTrial(trial)).toBe(false);
      const classification = classifyOncologyTrial(trial);
      expect(classification.isOncology).toBe(false);
    });

    it('clasifica "Lymphatic Malformations" como NO oncológico (no confunde con lymphoma)', () => {
      const trial = {
        conditions: ['Lymphatic Malformations'],
        title: 'Efficacy of Sildenafil in Congenital Lymphatic Malformations',
        officialTitle: 'Prospective Clinical Trial in Microcystic Lymphatic Malformations'
      };

      expect(isOncologyTrial(trial)).toBe(false);
      const classification = classifyOncologyTrial(trial);
      expect(classification.isOncology).toBe(false);
    });

    it('clasifica "Chewing gum for postoperative ileus" como NO oncológico (evita falso positivo de "ewing")', () => {
      const trial = {
        conditions: ['Postoperative Ileus'],
        title: 'Chewing gum for postoperative ileus in abdominal surgery',
        officialTitle: 'Randomized Controlled Trial of Chewing Gum versus Standard Care'
      };

      expect(isOncologyTrial(trial)).toBe(false);
      const classification = classifyOncologyTrial(trial);
      expect(classification.isOncology).toBe(false);
    });

    it('clasifica "Ewing Sarcoma" como oncológico mediante límite de palabra estricto', () => {
      const trial = {
        conditions: ['Ewing Sarcoma'],
        title: 'Chemotherapy Intensification in Localized Ewing Sarcoma',
        officialTitle: 'International Phase 3 Trial for Patients with Ewing Sarcoma'
      };

      expect(isOncologyTrial(trial)).toBe(true);
      const classification = classifyOncologyTrial(trial);
      expect(classification.isOncology).toBe(true);
      expect(classification.isWeakMatch).toBe(false);
      expect(['ewing', 'sarcoma']).toContain(classification.matchedTerm);
    });

    it('confirma que la excepción de "tumor necrosis factor" sigue funcionando correctamente', () => {
      const tnfTrial = {
        conditions: ['Rheumatoid Arthritis'],
        title: 'Adalimumab Anti-Tumor Necrosis Factor Therapy in Severe RA',
        officialTitle: 'Monitoring Tumor Necrosis Factor blockade in Rheumatoid Arthritis'
      };

      expect(isOncologyTrial(tnfTrial)).toBe(false);
      expect(classifyOncologyTrial(tnfTrial).isOncology).toBe(false);
    });
  });
});
