// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import FormManager from '../../src/components/FormManager';
import { callGemini } from '../../src/utils/aiProxy';
import {
  MOCK_FICTITIOUS_PATIENT,
  MOCK_FICTITIOUS_HISTORY_TEXT,
  MOCK_FICTITIOUS_TIMELINE,
  MOCK_GEMINI_CLINICAL_SUMMARY_RESPONSE,
  MOCK_GEMINI_BANCO_ADMISION_RESPONSE,
  MOCK_GEMINI_BANCO_RENOVACION_RESPONSE,
  MOCK_GEMINI_PAMI_RESPONSE,
  MOCK_GEMINI_DRUG_DETAILS_RESPONSE,
  MOCK_GEMINI_DINADIC_RESPONSE,
} from './fixtures/fictitiousData';
import { PdfCharacterizationRecorder, setupBrowserEnvironmentMocks } from './pdfTestUtils';

// Mock de aiProxy y AuthWrapper
vi.mock('../../src/utils/aiProxy', () => ({
  callGemini: vi.fn(),
}));

vi.mock('../../src/components/AuthWrapper', () => ({
  useCurrentUser: vi.fn(() => ({
    uid: 'test-doctor-ficticio-uid',
    email: 'medico.ficticio@hospital-de-prueba.gob.ar',
    displayName: 'Dr. Médico de Prueba Ficticio',
  })),
}));

describe('Tests de Caracterización de FormManager (Prompts y PDFs)', () => {
  let teardownEnv: () => void;
  let pdfRecorder: PdfCharacterizationRecorder;

  beforeEach(() => {
    teardownEnv = setupBrowserEnvironmentMocks();
    pdfRecorder = new PdfCharacterizationRecorder();
    pdfRecorder.install();
    vi.mocked(callGemini).mockReset();
  });

  afterEach(() => {
    pdfRecorder.uninstall();
    teardownEnv();
  });

  function renderFormManager() {
    return render(
      <FormManager
        patient={MOCK_FICTITIOUS_PATIENT}
        historyText={MOCK_FICTITIOUS_HISTORY_TEXT}
        timeline={MOCK_FICTITIOUS_TIMELINE}
        files={[]}
        user={{
          uid: 'test-doctor-ficticio-uid',
          email: 'medico.ficticio@hospital-de-prueba.gob.ar',
          displayName: 'Dr. Médico de Prueba Ficticio',
        } as any}
      />
    );
  }

  describe('1. Resumen Clínico Institucional (Prompts y Coordenadas PDF)', () => {
    it('contexto ADMISIÓN: genera el prompt exacto y dibuja las coordenadas del PDF de resumen', async () => {
      vi.mocked(callGemini).mockResolvedValueOnce({ text: MOCK_GEMINI_CLINICAL_SUMMARY_RESPONSE });
      renderFormManager();

      const card = screen.getByText('ADMISIÓN BANCO DE DROGAS').closest('div.bg-white') as HTMLElement;
      const resumenBtn = within(card).getByRole('button', { name: /Resumen Clínico/i });
      fireEvent.click(resumenBtn);

      const input = await screen.findByPlaceholderText('Ej: Dabrafenib + Trametinib');
      fireEvent.change(input, { target: { value: 'Bevacizumab' } });

      const genBtn = screen.getByRole('button', { name: /Generar Resumen de HC/i });
      fireEvent.click(genBtn);

      await waitFor(() => expect(callGemini).toHaveBeenCalledTimes(1));

      const promptCall = vi.mocked(callGemini).mock.calls[0][0];
      expect(promptCall.parts[0].text).toMatchSnapshot('resumen_clinico_admision_prompt');

      await waitFor(() => expect(pdfRecorder.drawTextRecords.length).toBeGreaterThan(0));
      expect(pdfRecorder.drawTextRecords).toMatchSnapshot('resumen_clinico_admision_pdf_drawText');
      expect(pdfRecorder.drawLineRecords).toMatchSnapshot('resumen_clinico_admision_pdf_drawLine');
    });

    it('contexto RENOVACIÓN: genera el prompt exacto y dibuja las coordenadas del PDF de resumen', async () => {
      vi.mocked(callGemini).mockResolvedValueOnce({ text: MOCK_GEMINI_CLINICAL_SUMMARY_RESPONSE });
      renderFormManager();

      const card = screen.getByText('RENOVACIÓN BANCO DE DROGAS').closest('div.bg-white') as HTMLElement;
      const resumenBtn = within(card).getByRole('button', { name: /Resumen Clínico/i });
      fireEvent.click(resumenBtn);

      const input = await screen.findByPlaceholderText('Ej: Dabrafenib + Trametinib');
      fireEvent.change(input, { target: { value: 'Bevacizumab' } });

      const genBtn = screen.getByRole('button', { name: /Generar Resumen de HC/i });
      fireEvent.click(genBtn);

      await waitFor(() => expect(callGemini).toHaveBeenCalledTimes(1));

      const promptCall = vi.mocked(callGemini).mock.calls[0][0];
      expect(promptCall.parts[0].text).toMatchSnapshot('resumen_clinico_renovacion_prompt');

      await waitFor(() => expect(pdfRecorder.drawTextRecords.length).toBeGreaterThan(0));
      expect(pdfRecorder.drawTextRecords).toMatchSnapshot('resumen_clinico_renovacion_pdf_drawText');
    });

    it('contexto SOLICITUD / DINADIC: genera el prompt exacto y dibuja las coordenadas del PDF de resumen', async () => {
      vi.mocked(callGemini).mockResolvedValueOnce({ text: MOCK_GEMINI_CLINICAL_SUMMARY_RESPONSE });
      renderFormManager();

      const card = screen.getByText('DINADIC (ex-DADSE)').closest('div.bg-white') as HTMLElement;
      const resumenBtn = within(card).getByRole('button', { name: /Resumen Clínico/i });
      fireEvent.click(resumenBtn);

      const input = await screen.findByPlaceholderText('Ej: Dabrafenib + Trametinib');
      fireEvent.change(input, { target: { value: 'Bevacizumab' } });

      const genBtn = screen.getByRole('button', { name: /Generar Resumen de HC/i });
      fireEvent.click(genBtn);

      await waitFor(() => expect(callGemini).toHaveBeenCalledTimes(1));

      const promptCall = vi.mocked(callGemini).mock.calls[0][0];
      expect(promptCall.parts[0].text).toMatchSnapshot('resumen_clinico_solicitud_dinadic_prompt');

      await waitFor(() => expect(pdfRecorder.drawTextRecords.length).toBeGreaterThan(0));
      expect(pdfRecorder.drawTextRecords).toMatchSnapshot('resumen_clinico_solicitud_dinadic_pdf_drawText');
    });
  });

  describe('2. PAMI Oncológico (extractPamiData, resolveDrugDetails y AcroForm)', () => {
    it('genera ambos prompts y rellena con exactitud los campos AcroForm de pami.pdf', async () => {
      vi.mocked(callGemini)
        .mockResolvedValueOnce({ text: JSON.stringify(MOCK_GEMINI_PAMI_RESPONSE) })
        .mockResolvedValueOnce({ text: JSON.stringify(MOCK_GEMINI_DRUG_DETAILS_RESPONSE) });

      renderFormManager();

      const card = screen.getByText('Formulario PAMI Oncológico').closest('div.bg-white') as HTMLElement;
      const pamiBtn = within(card).getByRole('button', { name: /Generar Formulario PAMI/i });
      fireEvent.click(pamiBtn);

      await waitFor(() => expect(callGemini).toHaveBeenCalledTimes(2));

      // 1. Prompt de extracción PAMI
      const pamiExtractCall = vi.mocked(callGemini).mock.calls[0][0];
      expect(pamiExtractCall.parts[0].text).toMatchSnapshot('pami_extract_prompt');

      // 2. Prompt de resolución de drogas
      const drugDetailsCall = vi.mocked(callGemini).mock.calls[1][0];
      expect(drugDetailsCall.parts[0].text).toMatchSnapshot('pami_resolve_drug_details_prompt');

      // 3. Escrituras AcroForm en el PDF
      await waitFor(() => expect(pdfRecorder.acroFormRecords.length).toBeGreaterThan(0));
      expect(pdfRecorder.acroFormRecords).toMatchSnapshot('pami_pdf_acroform_records');
    });
  });

  describe('3. Banco de Drogas — ADMISIÓN (extractBancoDrogasData y AcroForm)', () => {
    it('genera el prompt de admisión y rellena con exactitud los campos AcroForm de admision.pdf', async () => {
      vi.mocked(callGemini).mockResolvedValueOnce({ text: JSON.stringify(MOCK_GEMINI_BANCO_ADMISION_RESPONSE) });
      renderFormManager();

      const card = screen.getByText('ADMISIÓN BANCO DE DROGAS').closest('div.bg-white') as HTMLElement;
      const generarBtn = within(card).getByRole('button', { name: /Generar/i });
      fireEvent.click(generarBtn);

      await waitFor(() => expect(callGemini).toHaveBeenCalledTimes(1));

      const extractCall = vi.mocked(callGemini).mock.calls[0][0];
      expect(extractCall.parts[0].text).toMatchSnapshot('banco_admision_extract_prompt');

      const downloadBtn = await screen.findByRole('button', { name: /Descargar Formulario Banco de Drogas/i });
      fireEvent.click(downloadBtn);

      // El formulario de Banco de Drogas exige confirmación si el nombre viene en blanco por directiva médica
      const confirmBtn = await screen.findByRole('button', { name: /Generar igualmente/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => expect(pdfRecorder.acroFormRecords.length).toBeGreaterThan(0));
      expect(pdfRecorder.acroFormRecords).toMatchSnapshot('banco_admision_pdf_acroform_records');
    });
  });

  describe('4. Banco de Drogas — RENOVACIÓN (extractBancoDrogasData y AcroForm)', () => {
    it('genera el prompt de renovación y rellena con exactitud los campos AcroForm de renovacion.pdf', async () => {
      vi.mocked(callGemini).mockResolvedValueOnce({ text: JSON.stringify(MOCK_GEMINI_BANCO_RENOVACION_RESPONSE) });
      renderFormManager();

      const card = screen.getByText('RENOVACIÓN BANCO DE DROGAS').closest('div.bg-white') as HTMLElement;
      const generarBtn = within(card).getByRole('button', { name: /Generar/i });
      fireEvent.click(generarBtn);

      await waitFor(() => expect(callGemini).toHaveBeenCalledTimes(1));

      const extractCall = vi.mocked(callGemini).mock.calls[0][0];
      expect(extractCall.parts[0].text).toMatchSnapshot('banco_renovacion_extract_prompt');

      const downloadBtn = await screen.findByRole('button', { name: /Descargar Formulario Banco de Drogas/i });
      fireEvent.click(downloadBtn);

      const confirmBtn = await screen.findByRole('button', { name: /Generar igualmente/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => expect(pdfRecorder.acroFormRecords.length).toBeGreaterThan(0));
      expect(pdfRecorder.acroFormRecords).toMatchSnapshot('banco_renovacion_pdf_acroform_records');
    });
  });

  describe('5. DINADIC (generateDinadicPDF Prompt y Coordenadas PDF)', () => {
    it('captura el fármaco por prompt window, genera el prompt exacto y dibuja en nuevo_dinadic.pdf', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('Bevacizumab');
      vi.mocked(callGemini).mockResolvedValueOnce({ text: JSON.stringify(MOCK_GEMINI_DINADIC_RESPONSE) });

      renderFormManager();

      const card = screen.getByText('DINADIC (ex-DADSE)').closest('div.bg-white') as HTMLElement;
      const generarBtn = within(card).getByRole('button', { name: /Generar/i });
      fireEvent.click(generarBtn);

      const submitEsquemaBtn = await screen.findByRole('button', { name: /Generar DINADIC/i });
      fireEvent.click(submitEsquemaBtn);

      await waitFor(() => expect(callGemini).toHaveBeenCalledTimes(1));

      const extractCall = vi.mocked(callGemini).mock.calls[0][0];
      expect(extractCall.parts[0].text).toMatchSnapshot('dinadic_extract_prompt');

      await waitFor(() => expect(pdfRecorder.drawTextRecords.length).toBeGreaterThan(0));
      expect(pdfRecorder.drawTextRecords).toMatchSnapshot('dinadic_pdf_drawText_records');
    });
  });
});
