const TOKEN_KEY = 'turnero_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error de red');
  }
  return data;
}

async function requestForm(path, form) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { method: 'POST', headers, body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error de red');
  }
  return data;
}

export const api = {
  login: (body) => request('/api/auth/login', { method: 'POST', body }),
  me: () => request('/api/auth/me'),
  saveProfile: (body) => request('/api/auth/me', { method: 'PUT', body }),
  uploadMyPhoto: (file) => {
    const form = new FormData();
    form.append('photo', file);
    return requestForm('/api/auth/me/photo', form);
  },
  logout: () => request('/api/auth/logout', { method: 'POST', body: {} }),
  forgotPassword: (email) => request('/api/auth/olvide', { method: 'POST', body: { email } }),
  resetPassword: (body) => request('/api/auth/restablecer', { method: 'POST', body }),
  settings: () => request('/api/settings'),
  saveSettings: (body) => request('/api/settings', { method: 'PUT', body }),
  kapsoNumbers: () => request('/api/kapso/numeros').then((res) => res.data || []),
  connectKapso: (phoneNumberId) => request('/api/kapso/conectar', { method: 'POST', body: { phoneNumberId } }),
  professionals: () => request('/api/professionals'),
  professional: (id) => request(`/api/professionals/${id}`),
  saveProfessional: (id, body) =>
    id
      ? request(`/api/professionals/${id}`, { method: 'PUT', body })
      : request('/api/professionals', { method: 'POST', body }),
  deleteProfessional: (id) => request(`/api/professionals/${id}`, { method: 'DELETE' }),
  shareProfessional: (id, rotate = false) =>
    request(`/api/professionals/${id}/share`, { method: 'POST', body: { rotate } }),
  services: () => request('/api/services'),
  service: (id) => request(`/api/services/${id}`),
  saveService: (id, body) =>
    id ? request(`/api/services/${id}`, { method: 'PUT', body }) : request('/api/services', { method: 'POST', body }),
  deleteService: (id) => request(`/api/services/${id}`, { method: 'DELETE' }),
  shareService: (id, rotate = false) =>
    request(`/api/services/${id}/share`, { method: 'POST', body: { rotate } }),
  saveSchedules: (professionalId, windows) =>
    request(`/api/schedules/masivo/${professionalId}`, { method: 'PUT', body: { windows } }),
  blocks: (params = '') => request(`/api/blocks${params}`),
  saveBlock: (id, body) =>
    id ? request(`/api/blocks/${id}`, { method: 'PUT', body }) : request('/api/blocks', { method: 'POST', body }),
  deleteBlock: (id) => request(`/api/blocks/${id}`, { method: 'DELETE' }),
  patients: (params = '') => request(`/api/patients${params}`),
  patient: (id) => request(`/api/patients/${id}`),
  savePatient: (id, body) =>
    id ? request(`/api/patients/${id}`, { method: 'PUT', body }) : request('/api/patients', { method: 'POST', body }),
  deletePatient: (id) => request(`/api/patients/${id}`, { method: 'DELETE' }),
  clinicalNotes: (patientId) => request(`/api/clinical/patients/${patientId}/notes`),
  saveClinicalNote: (patientId, body, id) =>
    id
      ? request(`/api/clinical/notes/${id}`, { method: 'PUT', body })
      : request(`/api/clinical/patients/${patientId}/notes`, { method: 'POST', body }),
  deleteClinicalNote: (id) => request(`/api/clinical/notes/${id}`, { method: 'DELETE' }),
  uploadClinicalFiles: (noteId, files) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    return requestForm(`/api/clinical/notes/${noteId}/files`, form);
  },
  deleteClinicalFile: (id) => request(`/api/clinical/files/${id}`, { method: 'DELETE' }),
  exportClinicalHistory: async (patientId) => {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`/api/clinical/patients/${patientId}/export`, { headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'No se pudo descargar la historia clínica');
    }
    const blob = await res.blob();
    const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '');
    const filename = match?.[1] || 'historia-clinica.pdf';
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
  clinicalFields: (params = '') => request(`/api/clinical/fields${params}`),
  saveClinicalField: (id, body) =>
    id
      ? request(`/api/clinical/fields/${id}`, { method: 'PUT', body })
      : request('/api/clinical/fields', { method: 'POST', body }),
  deleteClinicalField: (id) => request(`/api/clinical/fields/${id}`, { method: 'DELETE' }),
  extraFields: (params = '') => request(`/api/extra-fields${params}`),
  saveExtraField: (id, body) =>
    id
      ? request(`/api/extra-fields/${id}`, { method: 'PUT', body })
      : request('/api/extra-fields', { method: 'POST', body }),
  deleteExtraField: (id) => request(`/api/extra-fields/${id}`, { method: 'DELETE' }),
  appointments: (params = '') => request(`/api/appointments${params}`),
  saveAppointment: (id, body) =>
    id
      ? request(`/api/appointments/${id}`, { method: 'PUT', body })
      : request('/api/appointments', { method: 'POST', body }),
  cancelAppointment: (id) => request(`/api/appointments/${id}/cancelar`, { method: 'PUT', body: {} }),
  deleteAppointment: (id) => request(`/api/appointments/${id}`, { method: 'DELETE' }),
  agenda: (params = '') => request(`/api/agenda${params}`),
  availability: (params = '') => request(`/api/agenda/disponibilidad${params}`),
  publicCalendar: (kind, slug) => request(`/api/public/${kind}/${slug}`),
  publicSlots: (kind, slug, params = '') => request(`/api/public/${kind}/${slug}/slots${params}`),
  publicBook: (kind, slug, body) => request(`/api/public/${kind}/${slug}/book`, { method: 'POST', body }),
  usersMeta: () => request('/api/users/meta'),
  users: () => request('/api/users'),
  saveUser: (id, body) =>
    id ? request(`/api/users/${id}`, { method: 'PUT', body }) : request('/api/users', { method: 'POST', body }),
  deleteUser: (id) => request(`/api/users/${id}`, { method: 'DELETE' }),
  uploadPhoto: (kind, id, file) => {
    const form = new FormData();
    form.append('photo', file);
    return requestForm(`/api/${kind}/${id}/photo`, form);
  },
};
