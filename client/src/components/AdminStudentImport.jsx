import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  FaCheckCircle,
  FaDownload,
  FaFileCsv,
  FaMagic,
  FaTimes,
  FaUpload
} from 'react-icons/fa';

const editableFields = [
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['yearGroup', 'Year'],
  ['tutorGroup', 'Tutor group'],
  ['username', 'Username'],
  ['email', 'Email'],
  ['password', '6-digit password']
];

const escapeCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const downloadCsv = (filename, headers, rows) => {
  const content = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(','))
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const AdminStudentImport = ({ schools, onImported, onToast }) => {
  const manageableSchools = useMemo(
    () => schools.filter((school) => school.viewerCanManage),
    [schools]
  );
  const [groupId, setGroupId] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [students, setStudents] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [importedAccounts, setImportedAccounts] = useState([]);
  const [preparing, setPreparing] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!groupId && manageableSchools.length) {
      setGroupId(manageableSchools[0].groupId);
    }
  }, [groupId, manageableSchools]);

  const errorMap = useMemo(() => {
    const result = new Map();
    validationErrors.forEach((error) => result.set(String(error.rowNumber), error.fields || {}));
    return result;
  }, [validationErrors]);

  const prepareImport = async () => {
    if (!file || !groupId) return;
    const formData = new FormData();
    formData.append('groupId', groupId);
    formData.append('file', file);
    try {
      setPreparing(true);
      setImportedAccounts([]);
      const response = await axios.post('/admin/students/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPreview(response.data);
      setStudents(response.data.students || []);
      setValidationErrors(response.data.validationErrors || []);
      onToast({
        type: 'success',
        title: 'CSV ready to review',
        message: `${response.data.students?.length || 0} student accounts prepared for ${response.data.school?.name}.`
      });
    } catch (error) {
      const templateHint = error.response?.data?.templateRequired
        ? ' OpenAI is not configured, so use the downloadable template.'
        : '';
      onToast({
        type: 'error',
        title: 'CSV could not be prepared',
        message: `${error.response?.data?.error || error.message}${templateHint}`
      });
    } finally {
      setPreparing(false);
    }
  };

  const updateStudent = (index, field, value) => {
    setStudents((current) => current.map((student, rowIndex) => (
      rowIndex === index ? { ...student, [field]: value } : student
    )));
    setValidationErrors([]);
  };

  const removeStudent = (index) => {
    setStudents((current) => current.filter((_, rowIndex) => rowIndex !== index));
    setValidationErrors([]);
  };

  const importStudents = async () => {
    try {
      setImporting(true);
      const response = await axios.post('/admin/students/import', { groupId, students });
      setImportedAccounts(response.data.accounts || []);
      setPreview(null);
      setStudents([]);
      setValidationErrors([]);
      setFile(null);
      onToast({
        type: 'success',
        title: 'Students imported',
        message: response.data.message
      });
      await onImported();
    } catch (error) {
      setValidationErrors(error.response?.data?.validationErrors || []);
      onToast({
        type: 'error',
        title: 'Import needs attention',
        message: error.response?.data?.error || error.message
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    downloadCsv(
      'inner-performance-student-import-template.csv',
      ['first_name', 'last_name', 'year_group', 'tutor_group'],
      [{
        first_name: 'Amina',
        last_name: 'Khan',
        year_group: 'Year 10',
        tutor_group: '10AK'
      }]
    );
  };

  const downloadCredentials = () => {
    downloadCsv(
      `inner-performance-logins-${new Date().toISOString().slice(0, 10)}.csv`,
      ['firstName', 'lastName', 'username', 'email', 'temporaryPassword', 'yearGroup', 'tutorGroup'],
      importedAccounts
    );
  };

  return (
    <section className="mt-7 rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-indigo-500/5 to-transparent p-6 backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300">
            <FaFileCsv className="text-xl" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Bulk student onboarding</p>
            <h2 className="mt-1 text-xl font-semibold">Upload, review, then create every login</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Template files process instantly. Other CSV layouts use OpenAI to identify the right columns before you review any account.
            </p>
          </div>
        </div>
        <button type="button" onClick={downloadTemplate} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10">
          <FaDownload /> CSV template
        </button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[.8fr_1.2fr_auto]">
        <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none focus:border-cyan-400">
          <option value="">Choose school</option>
          {manageableSchools.map((school) => <option key={school.id} value={school.groupId}>{school.name}</option>)}
        </select>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 bg-slate-950/50 px-4 py-3 text-sm text-slate-300 transition hover:border-cyan-400/50">
          <FaUpload className="text-cyan-300" />
          <span className="truncate">{file?.name || 'Choose a UTF-8 CSV file'}</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </label>
        <button type="button" disabled={!file || !groupId || preparing} onClick={prepareImport} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-100 disabled:opacity-50">
          <FaMagic /> {preparing ? 'Preparing...' : 'Prepare review'}
        </button>
      </div>

      {preview && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
          <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{students.length} students ready for review</h3>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${preview.normalizationMethod === 'ai' ? 'bg-violet-400/15 text-violet-200' : 'bg-emerald-400/15 text-emerald-200'}`}>
                  {preview.normalizationMethod === 'ai' ? 'AI reformatted' : 'Template matched'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Edit any cell now. Passwords must stay exactly six digits.</p>
            </div>
            <button type="button" onClick={() => { setPreview(null); setStudents([]); }} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white">
              <FaTimes /> Cancel review
            </button>
          </div>

          {validationErrors.length > 0 && (
            <div className="border-b border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {validationErrors.length} row{validationErrors.length === 1 ? '' : 's'} need attention before import.
            </div>
          )}

          <div className="max-h-[500px] overflow-auto">
            <table className="min-w-[1120px] w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-3 py-3">Row</th>
                  {editableFields.map(([, label]) => <th key={label} className="px-3 py-3">{label}</th>)}
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => {
                  const rowErrors = errorMap.get(String(student.rowNumber)) || {};
                  return (
                    <tr key={`${student.rowNumber}-${index}`} className="border-t border-white/5 align-top">
                      <td className="px-3 py-3 text-slate-500">{student.rowNumber}</td>
                      {editableFields.map(([field]) => (
                        <td key={field} className="min-w-[130px] px-2 py-2">
                          <input
                            value={student[field] || ''}
                            onChange={(event) => updateStudent(index, field, event.target.value)}
                            className={`w-full rounded-lg border bg-slate-950/80 px-2.5 py-2 outline-none ${rowErrors[field] ? 'border-rose-400 text-rose-100' : 'border-white/10 focus:border-cyan-400'}`}
                          />
                          {rowErrors[field] && <div className="mt-1 max-w-[180px] text-[10px] leading-4 text-rose-300">{rowErrors[field]}</div>}
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        <button type="button" onClick={() => removeStudent(index)} aria-label="Remove student" className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300">
                          <FaTimes />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">Import is all-or-nothing. No accounts are created until every row passes validation.</p>
            <button type="button" disabled={!students.length || importing} onClick={importStudents} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-indigo-300 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">
              <FaCheckCircle /> {importing ? 'Creating students...' : `Create ${students.length} student accounts`}
            </button>
          </div>
        </div>
      )}

      {importedAccounts.length > 0 && (
        <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 font-semibold text-emerald-100"><FaCheckCircle /> {importedAccounts.length} accounts created</div>
              <p className="mt-1 text-sm text-emerald-100/70">Download the credentials now; passwords cannot be recovered after this screen.</p>
            </div>
            <button type="button" onClick={downloadCredentials} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-950">
              <FaDownload /> Download login CSV
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminStudentImport;
