import { getToken } from './storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Cookie'] = `token=${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body?.error ?? 'Request failed');
  }

  return res.json() as Promise<T>;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export type LoginResponse = {
  message: string;
  redirect: string | null;
  user: import('../types').User;
  token?: string;
};

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: import('../types').User }> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Login failed' }));
    throw new ApiError(res.status, body?.error ?? 'Invalid credentials');
  }

  const data = await res.json() as LoginResponse;

  const setCookie = res.headers.get('set-cookie') ?? '';
  const tokenMatch = setCookie.match(/token=([^;]+)/);
  const token = tokenMatch?.[1] ?? '';

  if (!token) {
    throw new ApiError(401, 'No token received from server');
  }

  return { token, user: data.user };
}

export async function logout(): Promise<void> {
  await request('/api/auth/logout', { method: 'POST' }).catch(() => {});
}

export async function getProfile(): Promise<import('../types').User> {
  return request<import('../types').User>('/api/user/profile');
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function getProjects(): Promise<import('../types').Project[]> {
  return request<import('../types').Project[]>('/api/projects');
}

export async function getProject(id: string): Promise<import('../types').Project> {
  return request<import('../types').Project>(`/api/projects/${id}`);
}

// ─── RFIs ────────────────────────────────────────────────────────────────────

export async function getRFIs(projectId: string): Promise<import('../types').RFI[]> {
  return request<import('../types').RFI[]>(`/api/projects/${projectId}/rfis`);
}

export async function getRFI(projectId: string, rfiId: string): Promise<import('../types').RFI> {
  return request<import('../types').RFI>(`/api/projects/${projectId}/rfis/${rfiId}`);
}

export async function createRFI(
  projectId: string,
  data: Partial<import('../types').RFI>,
): Promise<import('../types').RFI> {
  return request<import('../types').RFI>(`/api/projects/${projectId}/rfis`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRFI(
  projectId: string,
  rfiId: string,
  data: Partial<import('../types').RFI>,
): Promise<import('../types').RFI> {
  return request<import('../types').RFI>(`/api/projects/${projectId}/rfis/${rfiId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function addRFIResponse(
  projectId: string,
  rfiId: string,
  response: string,
): Promise<import('../types').RFIResponse> {
  return request<import('../types').RFIResponse>(
    `/api/projects/${projectId}/rfis/${rfiId}/responses`,
    {
      method: 'POST',
      body: JSON.stringify({ response }),
    },
  );
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function getTasks(projectId: string): Promise<import('../types').Task[]> {
  return request<import('../types').Task[]>(`/api/projects/${projectId}/tasks`);
}

export async function getTask(projectId: string, taskId: string): Promise<import('../types').Task> {
  return request<import('../types').Task>(`/api/projects/${projectId}/tasks/${taskId}`);
}

export async function createTask(
  projectId: string,
  data: Partial<import('../types').Task>,
): Promise<import('../types').Task> {
  return request<import('../types').Task>(`/api/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTask(
  projectId: string,
  taskId: string,
  data: Partial<import('../types').Task>,
): Promise<import('../types').Task> {
  return request<import('../types').Task>(`/api/projects/${projectId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ─── Submittals ───────────────────────────────────────────────────────────────

export async function getSubmittals(projectId: string): Promise<import('../types').Submittal[]> {
  return request<import('../types').Submittal[]>(`/api/projects/${projectId}/submittals`);
}

export async function getSubmittal(
  projectId: string,
  submittalId: string,
): Promise<import('../types').Submittal> {
  return request<import('../types').Submittal>(
    `/api/projects/${projectId}/submittals/${submittalId}`,
  );
}

export async function updateSubmittal(
  projectId: string,
  submittalId: string,
  data: Partial<import('../types').Submittal>,
): Promise<import('../types').Submittal> {
  return request<import('../types').Submittal>(
    `/api/projects/${projectId}/submittals/${submittalId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  );
}

// ─── Daily Log ───────────────────────────────────────────────────────────────

export async function getDailyLogs(projectId: string): Promise<import('../types').DailyLog[]> {
  return request<import('../types').DailyLog[]>(`/api/projects/${projectId}/daily-log`);
}

export async function createDailyLog(
  projectId: string,
  data: Partial<import('../types').DailyLog>,
): Promise<import('../types').DailyLog> {
  return request<import('../types').DailyLog>(`/api/projects/${projectId}/daily-log`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDailyLog(
  projectId: string,
  logId: string,
  data: Partial<import('../types').DailyLog>,
): Promise<import('../types').DailyLog> {
  return request<import('../types').DailyLog>(`/api/projects/${projectId}/daily-log/${logId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ─── Budget ──────────────────────────────────────────────────────────────────

export async function getBudget(projectId: string): Promise<import('../types').BudgetLineItem[]> {
  return request<import('../types').BudgetLineItem[]>(`/api/projects/${projectId}/budget`);
}

// ─── Photos ──────────────────────────────────────────────────────────────────

export async function getPhotoAlbums(projectId: string): Promise<import('../types').PhotoAlbum[]> {
  return request<import('../types').PhotoAlbum[]>(`/api/projects/${projectId}/photos/albums`);
}

export async function getPhotos(
  projectId: string,
  albumId?: string,
): Promise<import('../types').ProjectPhoto[]> {
  const qs = albumId ? `?album_id=${albumId}` : '';
  return request<import('../types').ProjectPhoto[]>(`/api/projects/${projectId}/photos${qs}`);
}

export async function uploadPhotos(
  projectId: string,
  assets: Array<{ uri: string; name: string; type: string }>,
): Promise<import('../types').ProjectPhoto[]> {
  const token = await getToken();
  const formData = new FormData();

  for (const asset of assets) {
    formData.append('file', {
      uri: asset.uri,
      name: asset.name,
      type: asset.type,
    } as unknown as Blob);
  }

  const res = await fetch(`${BASE_URL}/api/projects/${projectId}/photos`, {
    method: 'POST',
    headers: {
      ...(token ? { Cookie: `token=${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body?.error ?? 'Upload failed');
  }

  return res.json() as Promise<import('../types').ProjectPhoto[]>;
}

// ─── Directory ───────────────────────────────────────────────────────────────

export async function getDirectory(
  projectId: string,
): Promise<import('../types').DirectoryContact[]> {
  return request<import('../types').DirectoryContact[]>(`/api/projects/${projectId}/directory`);
}

// ─── Punch List ──────────────────────────────────────────────────────────────

export async function getPunchList(
  projectId: string,
): Promise<import('../types').PunchListItem[]> {
  return request<import('../types').PunchListItem[]>(`/api/projects/${projectId}/punch-list`);
}

export async function getPunchListItem(
  projectId: string,
  itemId: string,
): Promise<import('../types').PunchListItem> {
  return request<import('../types').PunchListItem>(
    `/api/projects/${projectId}/punch-list/${itemId}`,
  );
}

export async function createPunchListItem(
  projectId: string,
  data: Partial<import('../types').PunchListItem>,
): Promise<import('../types').PunchListItem> {
  return request<import('../types').PunchListItem>(`/api/projects/${projectId}/punch-list`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePunchListItem(
  projectId: string,
  itemId: string,
  data: Partial<import('../types').PunchListItem>,
): Promise<import('../types').PunchListItem> {
  return request<import('../types').PunchListItem>(
    `/api/projects/${projectId}/punch-list/${itemId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  );
}

// ─── Drawings ────────────────────────────────────────────────────────────────

export async function getDrawings(
  projectId: string,
): Promise<{ drawings: import('../types').Drawing[]; uploads: import('../types').DrawingUpload[] }> {
  return request<{ drawings: import('../types').Drawing[]; uploads: import('../types').DrawingUpload[] }>(
    `/api/projects/${projectId}/drawings`,
  );
}

// ─── Specifications ───────────────────────────────────────────────────────────

export async function getSpecifications(
  projectId: string,
): Promise<import('../types').Specification[]> {
  return request<import('../types').Specification[]>(`/api/projects/${projectId}/specifications`);
}

// ─── Meetings ────────────────────────────────────────────────────────────────

export async function getMeetings(projectId: string): Promise<import('../types').Meeting[]> {
  return request<import('../types').Meeting[]>(`/api/projects/${projectId}/meetings`);
}

export async function getMeeting(
  projectId: string,
  meetingId: string,
): Promise<import('../types').Meeting> {
  return request<import('../types').Meeting>(`/api/projects/${projectId}/meetings/${meetingId}`);
}

export async function createMeeting(
  projectId: string,
  data: Partial<import('../types').Meeting>,
): Promise<import('../types').Meeting> {
  return request<import('../types').Meeting>(`/api/projects/${projectId}/meetings`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateMeeting(
  projectId: string,
  meetingId: string,
  data: Partial<import('../types').Meeting>,
): Promise<import('../types').Meeting> {
  return request<import('../types').Meeting>(
    `/api/projects/${projectId}/meetings/${meetingId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  );
}

// ─── Transmittals ─────────────────────────────────────────────────────────────

export async function getTransmittals(
  projectId: string,
): Promise<import('../types').Transmittal[]> {
  return request<import('../types').Transmittal[]>(`/api/projects/${projectId}/transmittals`);
}

export async function getTransmittal(
  projectId: string,
  transmittalId: string,
): Promise<import('../types').Transmittal> {
  return request<import('../types').Transmittal>(
    `/api/projects/${projectId}/transmittals/${transmittalId}`,
  );
}

export async function createTransmittal(
  projectId: string,
  data: Partial<import('../types').Transmittal>,
): Promise<import('../types').Transmittal> {
  return request<import('../types').Transmittal>(`/api/projects/${projectId}/transmittals`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Commitments ─────────────────────────────────────────────────────────────

export async function getCommitments(
  projectId: string,
): Promise<import('../types').Commitment[]> {
  return request<import('../types').Commitment[]>(`/api/projects/${projectId}/commitments`);
}

export async function getCommitment(
  projectId: string,
  commitmentId: string,
): Promise<import('../types').Commitment & { schedule_of_values?: import('../types').CommitmentSOVLine[] }> {
  return request(`/api/projects/${projectId}/commitments/${commitmentId}`);
}

export async function updateCommitment(
  projectId: string,
  commitmentId: string,
  data: Partial<import('../types').Commitment>,
): Promise<import('../types').Commitment> {
  return request<import('../types').Commitment>(
    `/api/projects/${projectId}/commitments/${commitmentId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  );
}

// ─── Change Events ────────────────────────────────────────────────────────────

export async function getChangeEvents(
  projectId: string,
): Promise<import('../types').ChangeEvent[]> {
  return request<import('../types').ChangeEvent[]>(`/api/projects/${projectId}/change-events`);
}

export async function getChangeEvent(
  projectId: string,
  eventId: string,
): Promise<import('../types').ChangeEvent> {
  return request<import('../types').ChangeEvent>(
    `/api/projects/${projectId}/change-events/${eventId}`,
  );
}

// ─── Change Orders ────────────────────────────────────────────────────────────

export async function getChangeOrders(
  projectId: string,
  type?: 'prime' | 'commitment',
): Promise<import('../types').ChangeOrder[]> {
  const qs = type ? `?type=${type}` : '';
  return request<import('../types').ChangeOrder[]>(
    `/api/projects/${projectId}/change-orders${qs}`,
  );
}

export async function getChangeOrder(
  projectId: string,
  changeOrderId: string,
): Promise<import('../types').ChangeOrder> {
  return request<import('../types').ChangeOrder>(
    `/api/projects/${projectId}/change-orders/${changeOrderId}`,
  );
}
