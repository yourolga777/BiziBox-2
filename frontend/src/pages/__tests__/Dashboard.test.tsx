import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { ToastProvider } from '../../components/common/Toast';
import Dashboard from '../Dashboard';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ToastProvider>{children}</ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

const EMPTY_METRICS = {
  total_messages_today: 0, total_tasks_today: 0, new_contacts_today: 0,
  total_messages: 0, total_tasks: 0, total_contacts: 0,
  messages_yesterday: 0, tasks_yesterday: 0, contacts_yesterday: 0,
  unread_messages: 0, unread_chats: 0, answered_messages: 0, completed_tasks: 0,
  channel_distribution: [], top_contacts: [],
  last_activity: new Date().toISOString(), last_updated: new Date().toISOString(),
  pulse_animation: { type: 'balanced', intensity: 0.5 },
};

describe('Dashboard page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    server.resetHandlers();
    server.use(
      http.get('/api/dashboard/metrics', () => HttpResponse.json(EMPTY_METRICS)),
      http.get('/api/tasks', () => HttpResponse.json([])),
      http.get('/api/messages/inbox', () => HttpResponse.json([])),
      http.get('/api/contacts', () => HttpResponse.json([])),
      http.get('/api/folders', () => HttpResponse.json([])),
    );
  });

  it('показывает дашборд с нулевыми данными (без welcome-заглушки)', async () => {
    render(<Dashboard />, { wrapper: createWrapper() });
    expect(await screen.findByText('Пульс')).toBeInTheDocument();
    expect(screen.getByText('Сегодня')).toBeInTheDocument();
    expect(screen.getByText('Просроченное')).toBeInTheDocument();
    expect(screen.getAllByText('Непрочитанные').length).toBeGreaterThan(0);
    expect(screen.getByText('Дни рождения')).toBeInTheDocument();
  });

  it('рендерит секции дашборда при наличии данных (AC1)', async () => {
    server.use(
      http.get('/api/tasks', () => HttpResponse.json([
        { id: 1, contact_id: null, title: 'Позвонить', description: null, status: 'new', due_date: null, created_at: '2026-08-01T00:00:00', updated_at: '2026-08-01T00:00:00' },
      ])),
    );
    render(<Dashboard />, { wrapper: createWrapper() });

    expect(await screen.findByText('Пульс')).toBeInTheDocument();
    expect(screen.getByText('Сегодня')).toBeInTheDocument();
    expect(screen.getByText('Просроченное')).toBeInTheDocument();
    expect(screen.getAllByText('Непрочитанные').length).toBeGreaterThan(0);
    expect(screen.getByText('Дни рождения')).toBeInTheDocument();
  });
});
